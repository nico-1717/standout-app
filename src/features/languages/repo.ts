import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import type { SyncTable } from '@/core/sync/manifest';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireValue } from '@/core/sync/types';
import { learntUuid, vocabRecordUuid } from '@/core/sync/uuid5';
import {
  deckBranch,
  deckMap,
  deckWouldCycle,
  inheritedDeckColor,
  isDeckIcon,
  sortCards,
  type Deck,
} from '@/features/flashcards/logic';
import { GameRepo, vocabScope, type GameStore } from '@/features/flashcards/game';
import { stamp } from '@/features/flashcards/study';
import type { ProjectsRepo } from '@/features/projects/repo';
import { localToday } from '@/features/tasks/groups';

import { isKnownLang, isLearnLang, langBase, langName } from './langs';

export interface Course {
  uuid: string;
  known_lang: string;
  learn_lang: string;
  project_uuid: string | null;
  sort_key: string;
}

/** Un mazzo di lingua: come uno di studio, dentro un corso. */
export interface LangDeck extends Deck {
  course_uuid: string;
}

export interface Word {
  uuid: string;
  category_uuid: string;
  word: string;
  translation: string | null;
  meaning: string | null;
  notes: string | null;
  image: string | null;
  is_father: number;
  custom_order: number;
}

export interface Child {
  uuid: string;
  parent_uuid: string;
  word: string;
  translation: string | null;
  meaning: string | null;
  notes: string | null;
  image: string | null;
  custom_order: number;
}

export interface WordExample {
  uuid: string;
  card_uuid: string | null;
  child_uuid: string | null;
  example_text: string | null;
  gap_text: string | null;
  example_image: string | null;
  example_audio: string | null;
}

/** I testi di una parola, come arrivano dal modulo. */
export interface WordText {
  word?: string;
  translation?: string | null;
  meaning?: string | null;
  notes?: string | null;
}

export type CourseError = 'languages' | 'same' | 'exists' | 'variant';

const COURSE_COLS = 'uuid, known_lang, learn_lang, project_uuid, sort_key';
const DECK_COLS =
  'uuid, course_uuid, parent_uuid, name, color, color_edited, archived, icon, notes, pinned, exam_date';
const WORD_COLS =
  'uuid, category_uuid, word, translation, meaning, notes, image, is_father, custom_order';
const CHILD_COLS = 'uuid, parent_uuid, word, translation, meaning, notes, image, custom_order';
const EX_COLS = 'uuid, card_uuid, child_uuid, example_text, gap_text, example_image, example_audio';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Il viola dei progetti nati da un corso (come il sito). */
const COURSE_PROJECT_COLOR = '#5856D6';
export const WORD_MAX = 255;
export const TRANSLATION_MAX = 500;
export const CHILD_TRANSLATION_MAX = 255;
export const MEANING_MAX = 400;
export const NOTES_MAX = 3000;
export const EXAMPLE_MAX = 1000;

const clean = (v: string | null | undefined, max: number): string | null => {
  const t = (v ?? '').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * I corsi di lingua sul telefono: corsi, mazzi, parole (con le parole figlie), esempi, preferiti e parole imparate.
 * Stesse regole del sito e del server (lib/sync_lingue.php): un corso è una coppia (lingua che conosci, lingua che impari);
 * si può cambiare solo la variante di quella che impari; nasce insieme al suo progetto; un mazzo sta dentro un corso e il
 * suo padre è dello stesso corso; la parola non è mai vuota. Togliere un corso (o un mazzo, o una parola) toglie con sé tutto
 * quello che dipende, e il telefono butta le modifiche in attesa di quelle righe: il server farebbe lo stesso giro.
 * Immagini, `is_father` e l'ordine delle parole li decide il server (qui si vedono soltanto, salvo l'ordine in fondo).
 */
export class LanguagesRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly userId: number | string,
    private readonly projects: ProjectsRepo,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
    private readonly today: () => string = () => localToday(),
    private readonly nowStamp: () => string = () => stamp(),
  ) {}

  /* ---------------- corsi ---------------- */

  courses(): Course[] {
    return this.db.all<Course>(
      `SELECT ${COURSE_COLS} FROM fc_vocab_courses ORDER BY sort_key, uuid`,
    );
  }

  course(uuid: string): Course | null {
    return (
      this.db.all<Course>(`SELECT ${COURSE_COLS} FROM fc_vocab_courses WHERE uuid = ?`, [
        uuid,
      ])[0] ?? null
    );
  }

  /** Il progetto di un corso: uno già chiamato come la lingua (e non di un altro corso), altrimenti se ne fa uno viola. */
  private projectFor(learn: string, ui: 'it' | 'en', courseUuid: string): string | null {
    const name = langName(learn, ui, false);
    const taken = new Set(
      this.db
        .all<{ p: string }>(
          'SELECT project_uuid AS p FROM fc_vocab_courses WHERE project_uuid IS NOT NULL AND uuid <> ?',
          [courseUuid],
        )
        .map((r) => r.p),
    );
    const found = this.projects
      .all()
      .filter((p) => p.name.toLowerCase() === name.toLowerCase() && !taken.has(p.uuid))
      .sort((a, b) => Number(!!a.parent_uuid) - Number(!!b.parent_uuid))[0];
    if (found) return found.uuid;
    return this.projects.create({ name, color: COURSE_PROJECT_COLOR, position: 'last' });
  }

  /** Aggiunge un corso. Ritorna l'uuid, o il motivo per cui non si può. */
  addCourse(known: string, learn: string, ui: 'it' | 'en' = 'it'): string | CourseError {
    if (!isKnownLang(known) || !isLearnLang(learn)) return 'languages';
    if (langBase(learn) === known) return 'same';
    const all = this.courses();
    if (all.some((c) => c.known_lang === known && c.learn_lang === learn)) return 'exists';
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      const key = generateKeyBetween(all[all.length - 1]?.sort_key || null, null);
      const project = this.projectFor(learn, ui, uuid);
      upsertRow(this.db, 'fc_vocab_courses', {
        uuid,
        known_lang: known,
        learn_lang: learn,
        project_uuid: project,
        sort_key: key,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'fc_vocab_courses',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { known_lang: known, learn_lang: learn, project_uuid: project, sort_key: key },
        },
        now,
      );
    });
    return uuid;
  }

  /** Cambia la variante della lingua che impari (en-GB → en-US): solo la stessa lingua, mai un'altra. */
  changeVariant(uuid: string, learn: string): true | CourseError {
    const cur = this.course(uuid);
    if (!cur) return 'languages';
    if (!isLearnLang(learn) || langBase(learn) !== langBase(cur.learn_lang)) return 'variant';
    if (learn === cur.learn_lang) return true;
    if (
      this.courses().some(
        (c) => c.uuid !== uuid && c.known_lang === cur.known_lang && c.learn_lang === learn,
      )
    )
      return 'exists';
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_vocab_courses', uuid, { learn_lang: learn, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_vocab_courses', uuid, op: 'upsert', patch: { learn_lang: learn } },
        now,
      );
    });
    return true;
  }

  /** Mette il corso tra `before` e `after` (null = in cima / in fondo). */
  reorderCourse(uuid: string, before: string | null, after: string | null): void {
    const all = this.courses();
    const key = (id: string | null) =>
      id ? (all.find((c) => c.uuid === id)?.sort_key ?? null) : null;
    const k = generateKeyBetween(key(before) || null, key(after) || null);
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_vocab_courses', uuid, { sort_key: k, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_vocab_courses', uuid, op: 'upsert', patch: { sort_key: k } },
        now,
      );
    });
  }

  /** Toglie un corso con i suoi mazzi, parole, esempi, preferiti e imparate. Il progetto resta. */
  removeCourse(uuid: string): boolean {
    if (!this.course(uuid)) return false;
    this.db.transaction(() => {
      const now = this.clock();
      this.dropCourseGames(uuid);
      this.dropDecks(this.decks(uuid).map((d) => d.uuid));
      enqueue(this.db, { table: 'fc_vocab_courses', uuid, op: 'delete' }, now);
      deleteRow(this.db, 'fc_vocab_courses', uuid);
    });
    return true;
  }

  /** Toglie dal telefono le partite e i record di un corso, senza dire niente al server (lo sa già: una cancellazione sola). */
  private dropCourseGames(course: string): void {
    const games = this.db
      .all<{ uuid: string }>('SELECT uuid FROM fc_games WHERE course_uuid = ?', [course])
      .map((g) => g.uuid);
    const wipe = (table: SyncTable, column: string, list: string[]): void => {
      for (let i = 0; i < list.length; i += 400) {
        const part = list.slice(i, i + 400);
        const ph = part.map(() => '?').join(',');
        this.db.run(
          `DELETE FROM outbox WHERE tbl = ? AND state = 'pending' AND uuid IN (SELECT uuid FROM ${table} WHERE ${column} IN (${ph}))`,
          [table, ...part],
        );
        this.db.run(`DELETE FROM ${table} WHERE ${column} IN (${ph})`, part);
      }
    };
    for (const t of [
      'fc_vocab_plays',
      'fc_game_durations',
      'fc_vocab_game_decks',
      'fc_vocab_sequence',
    ] as const) {
      wipe(t, 'game_uuid', games);
    }
    wipe('fc_games', 'uuid', games);
    wipe('fc_vocab_records', 'course_uuid', [course]);
  }

  /** Quante parole (padri + figlie) e quante imparate ha ogni corso. */
  courseStats(): Map<string, { words: number; learnt: number }> {
    const out = new Map<string, { words: number; learnt: number }>();
    const learnt = this.learnt();
    for (const d of this.db.all<{ course: string; uuid: string }>(
      'SELECT d.course_uuid AS course, c.uuid AS uuid FROM fc_vocab_cards c JOIN fc_vocab_decks d ON d.uuid = c.category_uuid',
    )) {
      const s = out.get(d.course) ?? { words: 0, learnt: 0 };
      s.words += 1;
      if (learnt.has(d.uuid)) s.learnt += 1;
      out.set(d.course, s);
    }
    for (const d of this.db.all<{ course: string; uuid: string }>(
      `SELECT d.course_uuid AS course, s.uuid AS uuid FROM fc_vocab_subcards s
         JOIN fc_vocab_cards c ON c.uuid = s.parent_uuid JOIN fc_vocab_decks d ON d.uuid = c.category_uuid`,
    )) {
      const s = out.get(d.course) ?? { words: 0, learnt: 0 };
      s.words += 1;
      if (learnt.has(d.uuid)) s.learnt += 1;
      out.set(d.course, s);
    }
    return out;
  }

  /* ---------------- mazzi ---------------- */

  decks(courseUuid: string): LangDeck[] {
    return this.db.all<LangDeck>(
      `SELECT ${DECK_COLS} FROM fc_vocab_decks WHERE course_uuid = ? ORDER BY name, uuid`,
      [courseUuid],
    );
  }

  deck(uuid: string): LangDeck | null {
    return (
      this.db.all<LangDeck>(`SELECT ${DECK_COLS} FROM fc_vocab_decks WHERE uuid = ?`, [uuid])[0] ??
      null
    );
  }

  /** Il colore passa ai discendenti che non l'hanno scelto a mano. */
  private cascadeColor(all: LangDeck[], uuid: string, color: string): void {
    for (const c of all.filter((d) => d.parent_uuid === uuid)) {
      if (c.color_edited) continue;
      patchRow(this.db, 'fc_vocab_decks', c.uuid, { color });
      c.color = color;
      this.cascadeColor(all, c.uuid, color);
    }
  }

  /** Crea un mazzo nel corso. Ritorna l'uuid, o null se manca il nome, il corso o il padre (che deve essere dello stesso corso). */
  createDeck(
    courseUuid: string,
    input: {
      name: string;
      parent?: string | null;
      color?: string | null;
      icon?: string | null;
      notes?: string | null;
      exam_date?: string | null;
    },
  ): string | null {
    const name = input.name.trim().slice(0, 120);
    if (!name || !this.course(courseUuid)) return null;
    const parent = input.parent ?? null;
    const all = this.decks(courseUuid);
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
        course_uuid: courseUuid,
        name,
        parent_uuid: parent,
        color,
        color_edited: edited,
      };
      if (icon) patch.icon = icon;
      if (notes) patch.notes = notes;
      if (input.exam_date) patch.exam_date = input.exam_date;
      upsertRow(this.db, 'fc_vocab_decks', {
        uuid,
        course_uuid: courseUuid,
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
      enqueue(this.db, { table: 'fc_vocab_decks', uuid, op: 'upsert', isCreate: true, patch }, now);
    });
    return uuid;
  }

  /** Cambia dei campi di un mazzo. `color: null` = automatico (segue il padre). `icon: null` = quella del nome. */
  updateDeck(
    uuid: string,
    p: {
      name?: string;
      color?: string | null;
      icon?: string | null;
      notes?: string | null;
      exam_date?: string | null;
    },
  ): boolean {
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
        if (cur.color_edited) {
          newColor = inheritedDeckColor(deckMap(this.decks(cur.course_uuid)), cur.parent_uuid);
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
      patchRow(this.db, 'fc_vocab_decks', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'fc_vocab_decks', uuid, op: 'upsert', patch }, now);
      if (newColor) this.cascadeColor(this.decks(cur.course_uuid), uuid, newColor);
    });
    return true;
  }

  /** Mette un mazzo dentro un altro dello stesso corso (o alla radice). False se farebbe un ciclo o il padre non va bene. */
  moveDeck(uuid: string, newParent: string | null): boolean {
    const cur = this.deck(uuid);
    if (!cur) return false;
    const all = this.decks(cur.course_uuid);
    if (newParent && !all.some((d) => d.uuid === newParent)) return false;
    if (deckWouldCycle(all, uuid, newParent)) return false;
    if (cur.parent_uuid === newParent) return true;
    this.db.transaction(() => {
      const patch: Record<string, WireValue> = { parent_uuid: newParent };
      const local: Record<string, WireValue> = { ...patch };
      let color: string | null = null;
      if (!cur.color_edited) {
        color = inheritedDeckColor(deckMap(all), newParent);
        local.color = color;
      }
      const now = this.clock();
      patchRow(this.db, 'fc_vocab_decks', uuid, { ...local, updated_at: now });
      enqueue(this.db, { table: 'fc_vocab_decks', uuid, op: 'upsert', patch }, now);
      if (color) this.cascadeColor(this.decks(cur.course_uuid), uuid, color);
    });
    return true;
  }

  setPinned(uuid: string, on: boolean): void {
    this.flag(uuid, 'pinned', on);
  }

  setArchived(uuid: string, on: boolean): void {
    this.flag(uuid, 'archived', on);
  }

  private flag(uuid: string, field: 'pinned' | 'archived', on: boolean): void {
    const cur = this.deck(uuid);
    if (!cur || !!cur[field] === on) return;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_vocab_decks', uuid, { [field]: on, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_vocab_decks', uuid, op: 'upsert', patch: { [field]: on } },
        now,
      );
    });
  }

  /** Un mazzo si cancella solo se è vuoto (niente parole, niente sotto-mazzi), come sul sito. */
  canDeleteDeck(uuid: string): boolean {
    if (!this.deck(uuid)) return false;
    const n = (sql: string) => this.db.all<{ n: number }>(sql, [uuid])[0]?.n ?? 0;
    return (
      !n('SELECT COUNT(*) AS n FROM fc_vocab_decks WHERE parent_uuid = ?') &&
      !n('SELECT COUNT(*) AS n FROM fc_vocab_cards WHERE category_uuid = ?')
    );
  }

  /** Toglie un mazzo (se è vuoto; con `force` tutto il ramo, con parole ed esempi). Ritorna se ha tolto qualcosa. */
  removeDeck(uuid: string, force = false): boolean {
    const cur = this.deck(uuid);
    if (!cur) return false;
    if (!force && !this.canDeleteDeck(uuid)) return false;
    this.db.transaction(() => {
      const ids = deckBranch(this.decks(cur.course_uuid), uuid);
      this.dropDecks(ids.filter((i) => i !== uuid));
      this.dropWordsOf([uuid]);
      enqueue(this.db, { table: 'fc_vocab_decks', uuid, op: 'delete' }, this.clock());
      deleteRow(this.db, 'fc_vocab_decks', uuid);
    });
    return true;
  }

  /** Toglie dal telefono questi mazzi con le loro parole, senza dire niente al server (lo sa già: una cancellazione sola). */
  private dropDecks(ids: string[]): void {
    this.dropWordsOf(ids);
    for (const id of ids) {
      this.db.run(
        `DELETE FROM outbox WHERE tbl = 'fc_vocab_decks' AND uuid = ? AND state = 'pending'`,
        [id],
      );
      deleteRow(this.db, 'fc_vocab_decks', id);
    }
  }

  private dropWordsOf(deckIds: string[]): void {
    if (!deckIds.length) return;
    const ph = deckIds.map(() => '?').join(',');
    // i mazzi scelti per una partita non hanno più il mazzo
    this.db.run(
      `DELETE FROM outbox WHERE tbl = 'fc_vocab_game_decks' AND state = 'pending' AND uuid IN (SELECT uuid FROM fc_vocab_game_decks WHERE deck_uuid IN (${ph}))`,
      deckIds,
    );
    this.db.run(`DELETE FROM fc_vocab_game_decks WHERE deck_uuid IN (${ph})`, deckIds);
    const cards = this.db
      .all<{ uuid: string }>(
        `SELECT uuid FROM fc_vocab_cards WHERE category_uuid IN (${ph})`,
        deckIds,
      )
      .map((r) => r.uuid);
    this.dropWords(cards);
  }

  /** Toglie dal telefono queste parole con figlie, esempi, preferiti e imparate. */
  private dropWords(cards: string[], keepOwnOutbox = false): void {
    if (!cards.length) return;
    const children: string[] = [];
    for (let i = 0; i < cards.length; i += 400) {
      const part = cards.slice(i, i + 400);
      const ph = part.map(() => '?').join(',');
      children.push(
        ...this.db
          .all<{ uuid: string }>(
            `SELECT uuid FROM fc_vocab_subcards WHERE parent_uuid IN (${ph})`,
            part,
          )
          .map((r) => r.uuid),
      );
    }
    const jobs: [SyncTable, string, string[]][] = [
      ['fc_vocab_plays', 'card_uuid', cards],
      ['fc_vocab_plays', 'child_uuid', children],
      ['fc_vocab_sequence', 'card_uuid', cards],
      ['fc_vocab_favorites', 'card_uuid', cards],
      ['fc_vocab_examples', 'card_uuid', cards],
      ['fc_vocab_learnt', 'target_uuid', [...cards, ...children]],
      ['fc_vocab_favorites', 'child_uuid', children],
      ['fc_vocab_examples', 'child_uuid', children],
      ['fc_vocab_subcards', 'uuid', children],
      ['fc_vocab_cards', 'uuid', cards],
    ];
    for (const [table, column, list] of jobs) {
      for (let i = 0; i < list.length; i += 400) {
        const part = list.slice(i, i + 400);
        const ph = part.map(() => '?').join(',');
        // la parola da cui si parte la sistema `enqueue`: mai inviata = sparisce senza lasciare tracce
        if (keepOwnOutbox && table === 'fc_vocab_cards') {
          this.db.run(`DELETE FROM ${table} WHERE ${column} IN (${ph})`, part);
          continue;
        }
        this.db.run(
          `DELETE FROM outbox WHERE tbl = ? AND state = 'pending' AND uuid IN (SELECT uuid FROM ${table} WHERE ${column} IN (${ph}))`,
          [table, ...part],
        );
        this.db.run(`DELETE FROM ${table} WHERE ${column} IN (${ph})`, part);
      }
    }
  }

  /* ---------------- parole ---------------- */

  words(deckUuid: string): Word[] {
    return sortCards(
      this.db.all<Word>(`SELECT ${WORD_COLS} FROM fc_vocab_cards WHERE category_uuid = ?`, [
        deckUuid,
      ]),
    );
  }

  word(uuid: string): Word | null {
    return (
      this.db.all<Word>(`SELECT ${WORD_COLS} FROM fc_vocab_cards WHERE uuid = ?`, [uuid])[0] ?? null
    );
  }

  children(wordUuid: string): Child[] {
    return sortCards(
      this.db.all<Child>(`SELECT ${CHILD_COLS} FROM fc_vocab_subcards WHERE parent_uuid = ?`, [
        wordUuid,
      ]),
    );
  }

  child(uuid: string): Child | null {
    return (
      this.db.all<Child>(`SELECT ${CHILD_COLS} FROM fc_vocab_subcards WHERE uuid = ?`, [uuid])[0] ??
      null
    );
  }

  /** Tutte le parole di un corso (padri), con il mazzo in cui stanno: per cercare. */
  courseWords(courseUuid: string): Word[] {
    return this.db.all<Word>(
      `SELECT ${WORD_COLS.split(', ')
        .map((c) => `c.${c}`)
        .join(
          ', ',
        )} FROM fc_vocab_cards c JOIN fc_vocab_decks d ON d.uuid = c.category_uuid WHERE d.course_uuid = ? ORDER BY c.word COLLATE NOCASE, c.uuid`,
      [courseUuid],
    );
  }

  /** Parole (padre + figlie) di ogni mazzo, solo nel mazzo stesso. */
  wordCounts(courseUuid: string): Map<string, number> {
    const out = new Map<string, number>();
    for (const r of this.db.all<{ d: string; n: number }>(
      `SELECT c.category_uuid AS d, COUNT(*) + COALESCE(SUM((SELECT COUNT(*) FROM fc_vocab_subcards s WHERE s.parent_uuid = c.uuid)), 0) AS n
         FROM fc_vocab_cards c JOIN fc_vocab_decks d ON d.uuid = c.category_uuid WHERE d.course_uuid = ? GROUP BY c.category_uuid`,
      [courseUuid],
    ))
      out.set(r.d, r.n);
    return out;
  }

  private nextOrder(
    table: 'fc_vocab_cards' | 'fc_vocab_subcards',
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

  /** Aggiunge una parola in fondo al mazzo. Ritorna l'uuid, o null se il mazzo non c'è o la parola è vuota. */
  addWord(deckUuid: string, t: WordText): string | null {
    if (!this.deck(deckUuid)) return null;
    const word = clean(t.word, WORD_MAX);
    if (!word) return null;
    const fields = {
      word,
      translation: clean(t.translation, TRANSLATION_MAX),
      meaning: clean(t.meaning, MEANING_MAX),
      notes: clean(t.notes, NOTES_MAX),
    };
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'fc_vocab_cards', {
        uuid,
        category_uuid: deckUuid,
        ...fields,
        image: null,
        is_father: 0,
        custom_order: this.nextOrder('fc_vocab_cards', 'category_uuid', deckUuid),
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'fc_vocab_cards',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { category_uuid: deckUuid, ...fields },
        },
        now,
      );
    });
    return uuid;
  }

  /** Cambia i testi di una parola. La parola non diventa mai vuota. */
  updateWord(uuid: string, t: WordText): boolean {
    const cur = this.word(uuid);
    if (!cur) return false;
    const patch = this.textPatch(cur, t, TRANSLATION_MAX, false);
    if (patch === null) return false;
    return this.savePatch('fc_vocab_cards', uuid, patch);
  }

  /** Sposta una parola in un altro mazzo dello stesso corso (in fondo). */
  moveWord(uuid: string, deckUuid: string): boolean {
    const cur = this.word(uuid);
    const to = this.deck(deckUuid);
    const from = cur ? this.deck(cur.category_uuid) : null;
    if (!cur || !to || !from || to.course_uuid !== from.course_uuid) return false;
    if (cur.category_uuid === deckUuid) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_vocab_cards', uuid, {
        category_uuid: deckUuid,
        custom_order: this.nextOrder('fc_vocab_cards', 'category_uuid', deckUuid),
        updated_at: now,
      });
      enqueue(
        this.db,
        { table: 'fc_vocab_cards', uuid, op: 'upsert', patch: { category_uuid: deckUuid } },
        now,
      );
    });
    return true;
  }

  /** Toglie una parola con le sue figlie, esempi, preferiti e imparate. */
  removeWord(uuid: string): void {
    if (!this.word(uuid)) return;
    this.db.transaction(() => {
      const now = this.clock();
      this.dropWords([uuid], true);
      enqueue(this.db, { table: 'fc_vocab_cards', uuid, op: 'delete' }, now);
    });
  }

  /** Il patch dei testi che cambiano davvero. null = la parola resterebbe vuota. */
  private textPatch(
    cur: Word | Child,
    t: WordText,
    translationMax: number,
    child: boolean,
  ): Record<string, WireValue> | null {
    const patch: Record<string, WireValue> = {};
    if (t.word !== undefined) {
      const w = clean(t.word, WORD_MAX);
      if (!w) return null;
      if (w !== cur.word) patch.word = w;
    }
    if (t.translation !== undefined) {
      // la figlia non ha «nessuna traduzione»: il server la tiene come testo vuoto
      const v = clean(t.translation, translationMax);
      const next = v ?? (child ? '' : null);
      if (next !== (cur.translation ?? (child ? '' : null))) patch.translation = next;
    }
    if (t.meaning !== undefined) {
      const v = clean(t.meaning, MEANING_MAX);
      if (v !== (cur.meaning || null)) patch.meaning = v;
    }
    if (t.notes !== undefined) {
      const v = clean(t.notes, NOTES_MAX);
      if (v !== (cur.notes || null)) patch.notes = v;
    }
    return patch;
  }

  private savePatch(
    table: 'fc_vocab_cards' | 'fc_vocab_subcards',
    uuid: string,
    patch: Record<string, WireValue>,
  ): boolean {
    if (!Object.keys(patch).length) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, table, uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table, uuid, op: 'upsert', patch }, now);
    });
    return true;
  }

  /* ---------------- parole figlie ---------------- */

  /** Aggiunge una parola figlia (una forma, un modo di dire) sotto una parola. Ritorna l'uuid o null. */
  addChild(wordUuid: string, t: WordText): string | null {
    if (!this.word(wordUuid)) return null;
    const word = clean(t.word, WORD_MAX);
    if (!word) return null;
    const fields = {
      word,
      translation: clean(t.translation, CHILD_TRANSLATION_MAX) ?? '',
      meaning: clean(t.meaning, MEANING_MAX),
      notes: clean(t.notes, NOTES_MAX),
    };
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'fc_vocab_subcards', {
        uuid,
        parent_uuid: wordUuid,
        ...fields,
        image: null,
        custom_order: this.nextOrder('fc_vocab_subcards', 'parent_uuid', wordUuid),
        updated_at: now,
      });
      patchRow(this.db, 'fc_vocab_cards', wordUuid, { is_father: 1 });
      enqueue(
        this.db,
        {
          table: 'fc_vocab_subcards',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { parent_uuid: wordUuid, ...fields },
        },
        now,
      );
    });
    return uuid;
  }

  updateChild(uuid: string, t: WordText): boolean {
    const cur = this.child(uuid);
    if (!cur) return false;
    const patch = this.textPatch(cur, t, CHILD_TRANSLATION_MAX, true);
    if (patch === null) return false;
    return this.savePatch('fc_vocab_subcards', uuid, patch);
  }

  removeChild(uuid: string): void {
    const cur = this.child(uuid);
    if (!cur) return;
    this.db.transaction(() => {
      const now = this.clock();
      const jobs: [SyncTable, string][] = [
        ['fc_vocab_favorites', 'child_uuid'],
        ['fc_vocab_examples', 'child_uuid'],
        ['fc_vocab_learnt', 'target_uuid'],
      ];
      for (const [table, column] of jobs) {
        this.db.run(
          `DELETE FROM outbox WHERE tbl = ? AND state = 'pending' AND uuid IN (SELECT uuid FROM ${table} WHERE ${column} = ?)`,
          [table, uuid],
        );
        this.db.run(`DELETE FROM ${table} WHERE ${column} = ?`, [uuid]);
      }
      deleteRow(this.db, 'fc_vocab_subcards', uuid);
      const left = this.db.all<{ n: number }>(
        'SELECT COUNT(*) AS n FROM fc_vocab_subcards WHERE parent_uuid = ?',
        [cur.parent_uuid],
      )[0]?.n;
      patchRow(this.db, 'fc_vocab_cards', cur.parent_uuid, { is_father: left ? 1 : 0 });
      enqueue(this.db, { table: 'fc_vocab_subcards', uuid, op: 'delete' }, now);
    });
  }

  /* ---------------- preferiti ---------------- */

  private targetExists(uuid: string, isChild: boolean): boolean {
    return (
      this.db.all(
        `SELECT 1 FROM ${isChild ? 'fc_vocab_subcards' : 'fc_vocab_cards'} WHERE uuid = ?`,
        [uuid],
      ).length > 0
    );
  }

  /** Gli uuid delle parole e figlie preferite. */
  favorites(): Set<string> {
    return new Set(
      this.db
        .all<{ t: string }>(
          'SELECT COALESCE(card_uuid, child_uuid) AS t FROM fc_vocab_favorites WHERE COALESCE(card_uuid, child_uuid) IS NOT NULL',
        )
        .map((r) => r.t),
    );
  }

  setFavorite(targetUuid: string, isChild: boolean, on: boolean): boolean {
    if (!this.targetExists(targetUuid, isChild)) return false;
    const col = isChild ? 'child_uuid' : 'card_uuid';
    const rows = this.db.all<{ uuid: string }>(
      `SELECT uuid FROM fc_vocab_favorites WHERE ${col} = ?`,
      [targetUuid],
    );
    const now = this.clock();
    this.db.transaction(() => {
      if (!on) {
        for (const r of rows) {
          deleteRow(this.db, 'fc_vocab_favorites', r.uuid);
          enqueue(this.db, { table: 'fc_vocab_favorites', uuid: r.uuid, op: 'delete' }, now);
        }
        return;
      }
      if (rows.length) return;
      const uuid = this.newId();
      const patch = {
        card_uuid: isChild ? null : targetUuid,
        child_uuid: isChild ? targetUuid : null,
        favorited_date: this.today(),
      };
      upsertRow(this.db, 'fc_vocab_favorites', { uuid, ...patch });
      enqueue(
        this.db,
        { table: 'fc_vocab_favorites', uuid, op: 'upsert', isCreate: true, patch },
        now,
      );
    });
    return true;
  }

  /* ---------------- imparate ---------------- */

  /** Gli uuid delle parole e figlie imparate. */
  learnt(): Set<string> {
    return new Set(
      this.db.all<{ t: string }>('SELECT target_uuid AS t FROM fc_vocab_learnt').map((r) => r.t),
    );
  }

  setLearnt(targetUuid: string, isChild: boolean, on: boolean): boolean {
    if (!this.targetExists(targetUuid, isChild)) return false;
    const uuid = learntUuid(this.userId, targetUuid, isChild);
    const has = this.db.all('SELECT 1 FROM fc_vocab_learnt WHERE uuid = ?', [uuid]).length > 0;
    const now = this.clock();
    this.db.transaction(() => {
      if (!on) {
        if (!has) return;
        deleteRow(this.db, 'fc_vocab_learnt', uuid);
        enqueue(this.db, { table: 'fc_vocab_learnt', uuid, op: 'delete' }, now);
        return;
      }
      // già imparata: la data resta quella di prima
      if (has) return;
      const patch = { target_uuid: targetUuid, is_child: isChild, learnt_date: this.today() };
      upsertRow(this.db, 'fc_vocab_learnt', { uuid, ...patch, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_vocab_learnt', uuid, op: 'upsert', isCreate: true, patch },
        now,
      );
    });
    return true;
  }

  /** Una parola o figlia preferita? */
  isFavorite(targetUuid: string): boolean {
    return this.favorites().has(targetUuid);
  }

  /* ---------------- gioco ---------------- */

  /** Il gioco di un corso: stesse regole dello studio, con le parole e i mazzi di quel corso. */
  games(course: string): GameRepo {
    return new GameRepo(
      this.db,
      this.store(course),
      this.clock,
      this.newId,
      undefined,
      this.nowStamp,
      undefined,
      vocabScope(course),
    );
  }

  /** Il corso di una partita di lingua (null = non è una partita di lingua). */
  courseOfGame(gameUuid: string): string | null {
    return (
      this.db.all<{ c: string | null }>(
        `SELECT course_uuid AS c FROM fc_games WHERE uuid = ? AND kind = 'vocab'`,
        [gameUuid],
      )[0]?.c ?? null
    );
  }

  /** I record di un corso: [tipo => valore]. */
  records(course: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.db.all<{ kind: string; value: number }>(
      'SELECT kind, value FROM fc_vocab_records WHERE course_uuid = ?',
      [course],
    )) {
      out[r.kind] = Number(r.value);
    }
    return out;
  }

  /** Scrive un record del corso solo se è migliore di quello che c'è (come lo studio). */
  bumpRecord(
    course: string,
    kind: string,
    value: number,
    gameUuid: string | null,
    lowerWins = false,
  ): { before: number | null; changed: boolean; first: boolean } {
    const uuid = vocabRecordUuid(this.userId, course, kind);
    const cur = this.db.all<{ value: number }>(
      'SELECT value FROM fc_vocab_records WHERE uuid = ?',
      [uuid],
    )[0];
    const before = cur ? Number(cur.value) : null;
    const v = Math.round(value * 100) / 100;
    const better = before === null || (lowerWins ? v < before : v > before);
    if (!better) return { before, changed: false, first: false };
    const patch = {
      ...(before === null ? { kind, course_uuid: course } : null),
      value: v,
      game_uuid: gameUuid,
      achieved_at: this.nowStamp(),
    };
    const now = this.clock();
    this.db.transaction(() => {
      if (cur) patchRow(this.db, 'fc_vocab_records', uuid, { ...patch, updated_at: now });
      else upsertRow(this.db, 'fc_vocab_records', { uuid, ...patch, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_vocab_records', uuid, op: 'upsert', isCreate: !cur, patch },
        now,
      );
    });
    return { before, changed: before !== null, first: before === null };
  }

  private store(course: string): GameStore {
    return {
      learnt: () => this.learnt(),
      setLearnt: (t, isChild, on) => this.setLearnt(t, isChild, on),
      bumpRecord: (kind, value, game, lowerWins) =>
        this.bumpRecord(course, kind, value, game, lowerWins),
    };
  }

  /* ---------------- esempi ---------------- */

  examples(targetUuid: string): WordExample[] {
    return this.db.all<WordExample>(
      `SELECT ${EX_COLS} FROM fc_vocab_examples WHERE card_uuid = ? OR child_uuid = ? ORDER BY rowid`,
      [targetUuid, targetUuid],
    );
  }

  addExample(targetUuid: string, isChild: boolean, text: string): string | null {
    const t = text.trim().slice(0, EXAMPLE_MAX);
    if (!t || !this.targetExists(targetUuid, isChild)) return null;
    const uuid = this.newId();
    const patch = {
      card_uuid: isChild ? null : targetUuid,
      child_uuid: isChild ? targetUuid : null,
      example_text: t,
    };
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'fc_vocab_examples', {
        uuid,
        ...patch,
        gap_text: null,
        example_image: null,
        example_audio: null,
        updated_at: now,
      });
      enqueue(
        this.db,
        { table: 'fc_vocab_examples', uuid, op: 'upsert', isCreate: true, patch },
        now,
      );
    });
    return uuid;
  }

  updateExample(uuid: string, text: string): boolean {
    const t = text.trim().slice(0, EXAMPLE_MAX);
    if (!t || !this.db.all('SELECT 1 FROM fc_vocab_examples WHERE uuid = ?', [uuid]).length)
      return false;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'fc_vocab_examples', uuid, { example_text: t, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_vocab_examples', uuid, op: 'upsert', patch: { example_text: t } },
        now,
      );
    });
    return true;
  }

  removeExample(uuid: string): void {
    if (!this.db.all('SELECT 1 FROM fc_vocab_examples WHERE uuid = ?', [uuid]).length) return;
    this.db.transaction(() => {
      deleteRow(this.db, 'fc_vocab_examples', uuid);
      enqueue(this.db, { table: 'fc_vocab_examples', uuid, op: 'delete' }, this.clock());
    });
  }
}
