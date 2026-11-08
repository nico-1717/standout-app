import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireValue } from '@/core/sync/types';

import {
  deckBranch,
  deckMap,
  deckWouldCycle,
  inheritedDeckColor,
  isDeckIcon,
  sortCards,
  type Card,
  type Deck,
  type SubCard,
} from './logic';
import { dropCardDependents } from './study';

const DECK_COLS =
  'uuid, parent_uuid, name, color, color_edited, archived, icon, notes, pinned, exam_date';
const CARD_COLS =
  'uuid, category_uuid, question_desc, answer_desc, question_image, answer_image, question_audio, answer_audio, is_father, custom_order';
const SUB_COLS =
  'uuid, parent_uuid, question_desc, answer_desc, question_image, answer_image, question_audio, answer_audio, custom_order';

export interface Draft {
  uuid: string;
  front: string;
  back: string;
  deck_uuid: string | null;
  created_at: string | null;
}

/** Cosa si può cambiare di un mazzo. `color: null` = automatico (segue il padre). `icon: null` = quella del nome. */
export interface DeckPatch {
  name?: string;
  color?: string | null;
  icon?: string | null;
  notes?: string | null;
  exam_date?: string | null;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DOC_MAX = 60_000;
const DRAFT_FRONT_MAX = 500;
const DRAFT_MAX = 200;

/**
 * I mazzi e le carte di studio sul telefono. Come sul sito (fc_decks.php): il colore si eredita dal padre finché non lo
 * scegli tu e passa ai figli «automatici»; un mazzo non va dentro se stesso né dentro un suo figlio; il nome non è mai
 * vuoto; le carte nuove vanno in fondo. Il server rifà gli stessi controlli: se rifiuta, il motore rimette la riga com'era.
 * Immagini, audio, `is_father` e l'ordine delle carte li decide il server (qui si vedono soltanto).
 */
export class FlashcardsRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  /* ---------------- lettura ---------------- */

  decks(): Deck[] {
    return this.db.all<Deck>(`SELECT ${DECK_COLS} FROM fc_study_decks ORDER BY name, uuid`);
  }

  deck(uuid: string): Deck | null {
    return (
      this.db.all<Deck>(`SELECT ${DECK_COLS} FROM fc_study_decks WHERE uuid = ?`, [uuid])[0] ?? null
    );
  }

  cards(deckUuid: string): Card[] {
    return sortCards(
      this.db.all<Card>(
        `SELECT ${CARD_COLS}, rowid AS rid FROM fc_study_cards WHERE category_uuid = ?`,
        [deckUuid],
      ),
    );
  }

  card(uuid: string): Card | null {
    return (
      this.db.all<Card>(`SELECT ${CARD_COLS} FROM fc_study_cards WHERE uuid = ?`, [uuid])[0] ?? null
    );
  }

  subcards(cardUuid: string): SubCard[] {
    return sortCards(
      this.db.all<SubCard>(`SELECT ${SUB_COLS} FROM fc_study_subcards WHERE parent_uuid = ?`, [
        cardUuid,
      ]),
    );
  }

  subcard(uuid: string): SubCard | null {
    return (
      this.db.all<SubCard>(`SELECT ${SUB_COLS} FROM fc_study_subcards WHERE uuid = ?`, [uuid])[0] ??
      null
    );
  }

  /** Quante carte (padre + figlie) ha ogni mazzo, solo nel mazzo stesso. */
  cardCounts(): Map<string, number> {
    const out = new Map<string, number>();
    for (const r of this.db.all<{ d: string; n: number }>(
      `SELECT c.category_uuid AS d, COUNT(*) + COALESCE(SUM((SELECT COUNT(*) FROM fc_study_subcards s WHERE s.parent_uuid = c.uuid)), 0) AS n
         FROM fc_study_cards c GROUP BY c.category_uuid`,
    ))
      out.set(r.d, r.n);
    return out;
  }

  /** Le carte di un mazzo e di tutti i suoi sotto-mazzi (il «ramo»). */
  branchCardCount(deckUuid: string): number {
    const ids = deckBranch(this.decks(), deckUuid);
    const counts = this.cardCounts();
    return ids.reduce((a, id) => a + (counts.get(id) ?? 0), 0);
  }

  /* ---------------- mazzi ---------------- */

  /** Il colore passa ai discendenti che non l'hanno scelto a mano; un ramo con colore proprio si ferma lì. */
  private cascadeColor(all: Deck[], uuid: string, color: string): void {
    for (const c of all.filter((d) => d.parent_uuid === uuid)) {
      if (c.color_edited) continue;
      patchRow(this.db, 'fc_study_decks', c.uuid, { color });
      c.color = color;
      this.cascadeColor(all, c.uuid, color);
    }
  }

  /** Crea un mazzo. Ritorna l'uuid, o null se manca il nome o il padre non c'è. */
  createDeck(input: {
    name: string;
    parent?: string | null;
    color?: string | null;
    icon?: string | null;
    notes?: string | null;
    exam_date?: string | null;
  }): string | null {
    const name = input.name.trim().slice(0, 120);
    if (!name) return null;
    const parent = input.parent ?? null;
    const all = this.decks();
    if (parent && !all.some((d) => d.uuid === parent)) return null;
    if (input.color && !HEX.test(input.color)) return null;
    if (input.exam_date && !ISO_DAY.test(input.exam_date)) return null;
    const icon = isDeckIcon(input.icon) ? input.icon : null;
    const notes = input.notes?.trim() ? input.notes.slice(0, 20_000) : null;
    const uuid = this.newId();
    const edited = !!input.color;
    const color = input.color
      ? input.color.toUpperCase()
      : inheritedDeckColor(deckMap(all), parent);
    this.db.transaction(() => {
      const now = this.clock();
      const patch: Record<string, WireValue> = {
        name,
        parent_uuid: parent,
        color,
        color_edited: edited,
      };
      if (icon) patch.icon = icon;
      if (notes) patch.notes = notes;
      if (input.exam_date) patch.exam_date = input.exam_date;
      upsertRow(this.db, 'fc_study_decks', {
        uuid,
        parent_uuid: parent,
        name,
        color,
        color_edited: edited ? 1 : 0,
        archived: 0,
        icon,
        notes,
        pinned: 0,
        exam_date: input.exam_date ?? null,
        updated_at: now,
      });
      enqueue(this.db, { table: 'fc_study_decks', uuid, op: 'upsert', isCreate: true, patch }, now);
    });
    return uuid;
  }

  /** Cambia dei campi di un mazzo. Il nome vuoto non si salva. */
  updateDeck(uuid: string, p: DeckPatch): boolean {
    const cur = this.deck(uuid);
    if (!cur) return false;
    const patch: Record<string, WireValue> = {};
    if (p.name !== undefined) {
      const name = p.name.trim().slice(0, 120);
      if (!name) return false;
      if (name !== cur.name) patch.name = name;
    }
    if (p.icon !== undefined) {
      const icon = isDeckIcon(p.icon) ? p.icon : null;
      if (p.icon !== null && !icon) return false;
      if (icon !== cur.icon) patch.icon = icon;
    }
    if (p.notes !== undefined) {
      const notes = p.notes && p.notes.trim() ? p.notes.slice(0, 20_000) : null;
      if (notes !== cur.notes) patch.notes = notes;
    }
    if (p.exam_date !== undefined) {
      if (p.exam_date !== null && !ISO_DAY.test(p.exam_date)) return false;
      if (p.exam_date !== cur.exam_date) patch.exam_date = p.exam_date;
    }
    let newColor: string | null = null;
    if (p.color !== undefined) {
      if (p.color === null) {
        // automatico: segue il padre ATTUALE
        if (cur.color_edited) {
          newColor = inheritedDeckColor(deckMap(this.decks()), cur.parent_uuid);
          patch.color_edited = false;
          patch.color = newColor;
        }
      } else {
        if (!HEX.test(p.color)) return false;
        const c = p.color.toUpperCase();
        if (c !== cur.color || !cur.color_edited) {
          newColor = c;
          patch.color = c;
          patch.color_edited = true;
        }
      }
    }
    if (!Object.keys(patch).length) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_study_decks', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'fc_study_decks', uuid, op: 'upsert', patch }, now);
      if (newColor) this.cascadeColor(this.decks(), uuid, newColor);
    });
    return true;
  }

  /** Mette un mazzo dentro un altro (o alla radice). Ritorna false se farebbe un ciclo o il padre non c'è. */
  moveDeck(uuid: string, newParent: string | null): boolean {
    const all = this.decks();
    const cur = all.find((d) => d.uuid === uuid);
    if (!cur) return false;
    if (newParent && !all.some((d) => d.uuid === newParent)) return false;
    if (deckWouldCycle(all, uuid, newParent)) return false;
    if (cur.parent_uuid === newParent) return true;
    this.db.transaction(() => {
      const patch: Record<string, WireValue> = { parent_uuid: newParent };
      const local: Record<string, WireValue> = { ...patch };
      let color: string | null = null;
      // un colore automatico segue il padre nuovo
      if (!cur.color_edited) {
        color = inheritedDeckColor(deckMap(all), newParent);
        local.color = color;
      }
      const now = this.clock();
      patchRow(this.db, 'fc_study_decks', uuid, { ...local, updated_at: now });
      enqueue(this.db, { table: 'fc_study_decks', uuid, op: 'upsert', patch }, now);
      if (color) this.cascadeColor(this.decks(), uuid, color);
    });
    return true;
  }

  setPinned(uuid: string, pinned: boolean): void {
    this.flag(uuid, 'pinned', pinned);
  }

  setArchived(uuid: string, archived: boolean): void {
    this.flag(uuid, 'archived', archived);
  }

  private flag(uuid: string, field: 'pinned' | 'archived', on: boolean): void {
    const cur = this.deck(uuid);
    if (!cur || !!cur[field] === on) return;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_study_decks', uuid, { [field]: on, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_study_decks', uuid, op: 'upsert', patch: { [field]: on } },
        now,
      );
    });
  }

  /** Un mazzo si può cancellare solo se è vuoto: niente carte e niente sotto-mazzi (come il sito). */
  canDeleteDeck(uuid: string): boolean {
    if (!this.deck(uuid)) return false;
    const kids = this.db.all<{ n: number }>(
      'SELECT COUNT(*) AS n FROM fc_study_decks WHERE parent_uuid = ?',
      [uuid],
    )[0]?.n;
    const cards = this.db.all<{ n: number }>(
      'SELECT COUNT(*) AS n FROM fc_study_cards WHERE category_uuid = ?',
      [uuid],
    )[0]?.n;
    return !kids && !cards;
  }

  /**
   * Toglie un mazzo. Come il sito, solo se è vuoto (`force`: toglie anche il ramo intero: sotto-mazzi, carte e carte figlie;
   * il server fa lo stesso con una sola cancellazione, qui si toglie tutto subito e si buttano le modifiche in attesa delle
   * righe che non esistono più). Ritorna se ha tolto qualcosa.
   */
  removeDeck(uuid: string, force = false): boolean {
    const all = this.decks();
    if (!all.some((d) => d.uuid === uuid)) return false;
    if (!force && !this.canDeleteDeck(uuid)) return false;
    const ids = deckBranch(all, uuid);
    this.db.transaction(() => {
      const now = this.clock();
      const ph = ids.map(() => '?').join(',');
      const cards = this.db.all<{ uuid: string }>(
        `SELECT uuid FROM fc_study_cards WHERE category_uuid IN (${ph})`,
        ids,
      );
      const cph = cards.map(() => '?').join(',');
      const subs = cards.length
        ? this.db.all<{ uuid: string }>(
            `SELECT uuid FROM fc_study_subcards WHERE parent_uuid IN (${cph})`,
            cards.map((c) => c.uuid),
          )
        : [];
      const gone: [string, string[]][] = [
        ['fc_study_subcards', subs.map((s) => s.uuid)],
        ['fc_study_cards', cards.map((c) => c.uuid)],
        ['fc_study_decks', ids],
      ];
      for (const [table, list] of gone) {
        for (const id of list) {
          // il mazzo da cui si parte lo sistema `enqueue` (mai inviato = sparisce senza lasciare tracce)
          if (id !== uuid)
            this.db.run(`DELETE FROM outbox WHERE tbl = ? AND uuid = ? AND state = 'pending'`, [
              table,
              id,
            ]);
          deleteRow(this.db, table as 'fc_study_decks', id);
        }
      }
      dropCardDependents(this.db, {
        cards: cards.map((c) => c.uuid),
        children: subs.map((s) => s.uuid),
      });
      // le partite non perdono nulla: restano, ma senza il mazzo che avevano scelto
      this.db.run(
        `DELETE FROM outbox WHERE tbl = 'fc_study_game_decks' AND state = 'pending' AND uuid IN (SELECT uuid FROM fc_study_game_decks WHERE deck_uuid IN (${ph}))`,
        ids,
      );
      this.db.run(`DELETE FROM fc_study_game_decks WHERE deck_uuid IN (${ph})`, ids);
      enqueue(this.db, { table: 'fc_study_decks', uuid, op: 'delete' }, now);
    });
    return true;
  }

  /* ---------------- carte ---------------- */

  private nextOrder(
    table: 'fc_study_cards' | 'fc_study_subcards',
    col: string,
    id: string,
  ): number {
    return (
      this.db.all<{ n: number }>(
        `SELECT COALESCE(MAX(custom_order), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`,
        [id],
      )[0]?.n ?? 1
    );
  }

  /** Aggiunge una carta in fondo al mazzo. Ritorna l'uuid, o null se il mazzo non c'è o il testo è troppo lungo. */
  addCard(deckUuid: string, question: string | null, answer: string | null): string | null {
    if (!this.deck(deckUuid)) return null;
    if (!validDoc(question) || !validDoc(answer)) return null;
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'fc_study_cards', {
        uuid,
        category_uuid: deckUuid,
        question_desc: question || null,
        answer_desc: answer || null,
        question_image: null,
        answer_image: null,
        question_audio: null,
        answer_audio: null,
        is_father: 0,
        custom_order: this.nextOrder('fc_study_cards', 'category_uuid', deckUuid),
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'fc_study_cards',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: {
            category_uuid: deckUuid,
            question_desc: question || null,
            answer_desc: answer || null,
          },
        },
        now,
      );
    });
    return uuid;
  }

  /** Cambia domanda e/o risposta di una carta (i documenti del sito: JSON o vecchi tag). */
  updateCard(uuid: string, p: { question?: string | null; answer?: string | null }): boolean {
    const cur = this.card(uuid);
    if (!cur) return false;
    if (!validDoc(p.question) || !validDoc(p.answer)) return false;
    const patch: Record<string, WireValue> = {};
    if (p.question !== undefined && (p.question || null) !== cur.question_desc)
      patch.question_desc = p.question || null;
    if (p.answer !== undefined && (p.answer || null) !== cur.answer_desc)
      patch.answer_desc = p.answer || null;
    if (!Object.keys(patch).length) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_study_cards', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'fc_study_cards', uuid, op: 'upsert', patch }, now);
    });
    return true;
  }

  /** Sposta una carta in un altro mazzo (in fondo). */
  moveCard(uuid: string, deckUuid: string): boolean {
    const cur = this.card(uuid);
    if (!cur || !this.deck(deckUuid)) return false;
    if (cur.category_uuid === deckUuid) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_study_cards', uuid, {
        category_uuid: deckUuid,
        custom_order: this.nextOrder('fc_study_cards', 'category_uuid', deckUuid),
        updated_at: now,
      });
      enqueue(
        this.db,
        { table: 'fc_study_cards', uuid, op: 'upsert', patch: { category_uuid: deckUuid } },
        now,
      );
    });
    return true;
  }

  /** Toglie una carta e le sue carte figlie. */
  removeCard(uuid: string): void {
    if (!this.card(uuid)) return;
    this.db.transaction(() => {
      const now = this.clock();
      const kids = this.subcards(uuid).map((s) => s.uuid);
      for (const s of this.subcards(uuid)) {
        this.db.run(
          `DELETE FROM outbox WHERE tbl = 'fc_study_subcards' AND uuid = ? AND state = 'pending'`,
          [s.uuid],
        );
        deleteRow(this.db, 'fc_study_subcards', s.uuid);
      }
      deleteRow(this.db, 'fc_study_cards', uuid);
      dropCardDependents(this.db, {
        cards: [uuid],
        children: kids,
      });
      enqueue(this.db, { table: 'fc_study_cards', uuid, op: 'delete' }, now);
    });
  }

  /**
   * «Unisci» del sito: le carte scelte diventano carte figlie di `parentUuid` (testo copiato, la carta vecchia sparisce).
   * Non si uniscono la carta padre stessa, le carte che hanno già figlie, e quelle con un'immagine o un audio (i file li
   * attacca il server: una figlia nuova nascerebbe senza). Ritorna quante se ne sono unite e quante no.
   */
  joinCards(parentUuid: string, uuids: string[]): { joined: number; skipped: number } {
    let joined = 0;
    let skipped = 0;
    if (!this.card(parentUuid)) return { joined, skipped: uuids.length };
    this.db.transaction(() => {
      for (const u of uuids) {
        const c = this.card(u);
        if (!c || u === parentUuid) continue;
        if (this.subcards(u).length || hasMedia(c)) {
          skipped++;
          continue;
        }
        if (!this.addSubcard(parentUuid, c.question_desc, c.answer_desc)) {
          skipped++;
          continue;
        }
        this.removeCard(u);
        joined++;
      }
    });
    return { joined, skipped };
  }

  /**
   * «Separa» del sito: la carta figlia torna una carta del mazzo del suo padre. Una figlia con immagine o audio resta
   * dov'è (ritorna null). Ritorna l'uuid della carta nuova.
   */
  unjoinSubcard(subUuid: string): string | null {
    const sub = this.subcard(subUuid);
    if (!sub || hasMedia(sub)) return null;
    const parent = this.card(sub.parent_uuid);
    if (!parent) return null;
    let made: string | null = null;
    this.db.transaction(() => {
      made = this.addCard(parent.category_uuid, sub.question_desc, sub.answer_desc);
      if (made) this.removeSubcard(subUuid);
    });
    return made;
  }

  /* ---------------- bozze veloci ---------------- */

  /** Le bozze della Home, dalla più recente: solo il fronte, il resto si completa dopo. */
  drafts(): Draft[] {
    return this.db.all<Draft>(
      'SELECT uuid, front, back, deck_uuid, created_at FROM fc_quick_drafts ORDER BY created_at DESC, uuid DESC',
    );
  }

  /** Aggiunge una bozza (solo il fronte, fino a 500 caratteri; al massimo 200 bozze, come sul sito). Ritorna l'uuid o null. */
  addDraft(front: string): string | null {
    const f = front
      .replace(/[\u0000-\u001F]+/g, ' ')
      .trim()
      .slice(0, DRAFT_FRONT_MAX);
    if (!f) return null;
    if (
      (this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM fc_quick_drafts')[0]?.n ?? 0) >=
      DRAFT_MAX
    )
      return null;
    const uuid = this.newId();
    const now = this.clock();
    this.db.transaction(() => {
      upsertRow(this.db, 'fc_quick_drafts', {
        uuid,
        front: f,
        back: '',
        deck_uuid: null,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'fc_quick_drafts',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { front: f, back: '' },
        },
        now,
      );
    });
    return uuid;
  }

  removeDraft(uuid: string): void {
    const now = this.clock();
    this.db.transaction(() => {
      deleteRow(this.db, 'fc_quick_drafts', uuid);
      enqueue(this.db, { table: 'fc_quick_drafts', uuid, op: 'delete' }, now);
    });
  }

  /**
   * La bozza diventa una carta vera, in fondo al mazzo scelto (home_api.php: draft_finish). Serve il retro e un mazzo che c'è.
   * Ritorna l'uuid della carta, o null.
   */
  finishDraft(uuid: string, p: { front: string; back: string; deck: string }): string | null {
    const draft = this.db.all<{ uuid: string }>('SELECT uuid FROM fc_quick_drafts WHERE uuid = ?', [
      uuid,
    ])[0];
    if (!draft) return null;
    const front = p.front.trim().slice(0, DRAFT_FRONT_MAX);
    const back = p.back.trim();
    if (!front || !back || !this.deck(p.deck)) return null;
    let card: string | null = null;
    this.db.transaction(() => {
      card = this.addCard(p.deck, front, back);
      if (card) this.removeDraft(uuid);
    });
    return card;
  }

  /* ---------------- mazzo collegato a un progetto ---------------- */

  /** Il mazzo di studio collegato a un progetto, o null. */
  linkedDeck(projectUuid: string): string | null {
    return (
      this.db.all<{ deck_uuid: string }>(
        'SELECT deck_uuid FROM fc_study_deck_projects WHERE project_uuid = ? LIMIT 1',
        [projectUuid],
      )[0]?.deck_uuid ?? null
    );
  }

  /** Il progetto a cui è collegato un mazzo (solo lui, non i suoi rami), o null. */
  linkedProject(deckUuid: string): string | null {
    return (
      this.db.all<{ project_uuid: string }>(
        'SELECT project_uuid FROM fc_study_deck_projects WHERE deck_uuid = ? LIMIT 1',
        [deckUuid],
      )[0]?.project_uuid ?? null
    );
  }

  /**
   * La materia non è libera se lei, un suo padre o un suo figlio è già di un altro progetto (prog_category_link_blocked):
   * ritorna chi la occupa (e il mazzo che causa il blocco), o null se è libera.
   */
  deckLinkConflict(
    deckUuid: string,
    projectUuid: string,
  ): { kind: 'self' | 'parent' | 'child'; deck: string; project: string } | null {
    const all = this.decks();
    const byId = new Map(all.map((d) => [d.uuid, d]));
    const kind = new Map<string, 'self' | 'parent' | 'child'>();
    for (const id of deckBranch(all, deckUuid)) kind.set(id, id === deckUuid ? 'self' : 'child');
    for (let cur = byId.get(deckUuid)?.parent_uuid ?? null, g = 0; cur && g < 100; g++) {
      kind.set(cur, 'parent');
      cur = byId.get(cur)?.parent_uuid ?? null;
    }
    const rows = this.db.all<{ deck_uuid: string; project_uuid: string }>(
      'SELECT deck_uuid, project_uuid FROM fc_study_deck_projects',
    );
    for (const r of rows) {
      const k = kind.get(r.deck_uuid);
      if (k && r.project_uuid !== projectUuid)
        return { kind: k, deck: r.deck_uuid, project: r.project_uuid };
    }
    return null;
  }

  deckLinkBlocked(deckUuid: string, projectUuid: string): boolean {
    return this.deckLinkConflict(deckUuid, projectUuid) !== null;
  }

  /** Collega un mazzo a un progetto (o scollega con null). Uno solo per progetto: la riga di prima se ne va. Ritorna false se non si può. */
  linkDeck(projectUuid: string, deckUuid: string | null): boolean {
    if (deckUuid !== null && (!this.deck(deckUuid) || this.deckLinkBlocked(deckUuid, projectUuid)))
      return false;
    const now = this.clock();
    this.db.transaction(() => {
      for (const r of this.db.all<{ uuid: string }>(
        'SELECT uuid FROM fc_study_deck_projects WHERE project_uuid = ?',
        [projectUuid],
      )) {
        deleteRow(this.db, 'fc_study_deck_projects', r.uuid);
        enqueue(this.db, { table: 'fc_study_deck_projects', uuid: r.uuid, op: 'delete' }, now);
      }
      if (deckUuid === null) return;
      const uuid = this.newId();
      upsertRow(this.db, 'fc_study_deck_projects', {
        uuid,
        project_uuid: projectUuid,
        deck_uuid: deckUuid,
        created_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'fc_study_deck_projects',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { project_uuid: projectUuid, deck_uuid: deckUuid },
        },
        now,
      );
    });
    return true;
  }

  /* ---------------- carte figlie ---------------- */

  private refreshFather(cardUuid: string): void {
    const n = this.db.all<{ n: number }>(
      'SELECT COUNT(*) AS n FROM fc_study_subcards WHERE parent_uuid = ?',
      [cardUuid],
    )[0]?.n;
    patchRow(this.db, 'fc_study_cards', cardUuid, { is_father: (n ?? 0) > 0 });
  }

  /** Aggiunge una carta figlia sotto una carta. */
  addSubcard(cardUuid: string, question: string | null, answer: string | null): string | null {
    if (!this.card(cardUuid)) return null;
    if (!validDoc(question) || !validDoc(answer)) return null;
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'fc_study_subcards', {
        uuid,
        parent_uuid: cardUuid,
        question_desc: question || null,
        answer_desc: answer || null,
        question_image: null,
        answer_image: null,
        question_audio: null,
        answer_audio: null,
        custom_order: this.nextOrder('fc_study_subcards', 'parent_uuid', cardUuid),
        updated_at: now,
      });
      this.refreshFather(cardUuid);
      enqueue(
        this.db,
        {
          table: 'fc_study_subcards',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: {
            parent_uuid: cardUuid,
            question_desc: question || null,
            answer_desc: answer || null,
          },
        },
        now,
      );
    });
    return uuid;
  }

  updateSubcard(uuid: string, p: { question?: string | null; answer?: string | null }): boolean {
    const cur = this.subcard(uuid);
    if (!cur) return false;
    if (!validDoc(p.question) || !validDoc(p.answer)) return false;
    const patch: Record<string, WireValue> = {};
    if (p.question !== undefined && (p.question || null) !== cur.question_desc)
      patch.question_desc = p.question || null;
    if (p.answer !== undefined && (p.answer || null) !== cur.answer_desc)
      patch.answer_desc = p.answer || null;
    if (!Object.keys(patch).length) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_study_subcards', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'fc_study_subcards', uuid, op: 'upsert', patch }, now);
    });
    return true;
  }

  removeSubcard(uuid: string): void {
    const cur = this.subcard(uuid);
    if (!cur) return;
    this.db.transaction(() => {
      const now = this.clock();
      deleteRow(this.db, 'fc_study_subcards', uuid);
      dropCardDependents(this.db, { children: [uuid] });
      this.refreshFather(cur.parent_uuid);
      enqueue(this.db, { table: 'fc_study_subcards', uuid, op: 'delete' }, now);
    });
  }
}

/** La carta ha un file (immagine o audio) attaccato dal server. */
function hasMedia(c: {
  question_image: string | null;
  answer_image: string | null;
  question_audio: string | null;
  answer_audio: string | null;
}): boolean {
  return !!(c.question_image || c.answer_image || c.question_audio || c.answer_audio);
}

/** Un documento di carta: vuoto, o testo non troppo lungo e senza byte nulli (il server rifiuta il resto). */
function validDoc(v: string | null | undefined): boolean {
  if (v === undefined || v === null || v === '') return true;
  return v.length <= DOC_MAX && !v.includes('\0');
}
