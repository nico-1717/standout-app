import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireValue } from '@/core/sync/types';

import { answerLetter, HISTORY_LENGTH, levelOf, needsReview, type Level } from './levels';
import { stamp, type StudyRepo } from './study';

/** Oltre questa pausa non si sta più giocando: il tempo non si conta (come sul sito: 5 minuti). */
export const PAUSE_MAX_SECONDS = 300;

export type GameStatus = 'all' | '1' | '0';
export type GameOrder = 'in_order' | 'random';
export type Grade = 'correct' | 'wrong' | 'learnt';

export interface GameRow {
  uuid: string;
  game_date: string | null;
  score: number | null;
  type: string;
  card_status: string | null;
  parent_uuid: string | null;
  total_father_words: number;
  game_order: string | null;
  total_words_with_children: number;
  max_card_uuid: string | null;
}

export interface PlayRow {
  uuid: string;
  game_uuid: string;
  card_uuid: string | null;
  child_uuid: string | null;
  correct_answer: string | null;
  user_answer: string | null;
  position: number;
  play_date: string | null;
}

/** Una risposta che non è un voto: un titolo (si legge e basta) o una carta già nota/da imparare che si guarda soltanto. */
export const isNoVote = (a: string | null): boolean => a === 'Titolo' || a === 'Visione';
export const isVote = (a: string | null): boolean => a === 'Correct' || a === 'Wrong';

export interface StartInput {
  /** i mazzi scelti, nell'ordine scelto (vuoto = tutti) */
  decks: string[];
  status: GameStatus;
  order: GameOrder;
  /** solo le carte che hanno (o hanno una sottocarta a) uno di questi livelli */
  levels?: Level[];
  /** «solo le difficili»: da imparare, difficile e difficilissima; la partita è sempre mescolata e con tutte le carte */
  onlyHard?: boolean;
}

export type StartOutcome = { kind: 'started'; game: string } | { kind: 'empty' };

export interface CardHistory {
  c: number;
  w: number;
  u: string;
}

interface CardLite {
  uuid: string;
  category_uuid: string;
  question_desc: string | null;
  answer_desc: string | null;
  answer_image: string | null;
  answer_audio: string | null;
  is_father: number;
  custom_order: number;
}

/** Un campo di carta senza niente di scritto (gemella di fcv_testo_vuoto del sito). */
export function isBlankField(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim();
  if (!t) return true;
  const strip = (s: string): string => s.replace(/[\s ​-‍﻿]+/g, '');
  let doc: unknown = null;
  try {
    doc = JSON.parse(t);
  } catch {
    doc = null;
  }
  const blocks = (doc as { blocks?: unknown } | null)?.blocks;
  if (!Array.isArray(blocks)) return strip(t.replace(/<[^>]*>/g, '')) === '';
  for (const b of blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== 'object') continue;
    const tipo = String(b.t ?? 'p');
    if (tipo !== 'p' && tipo !== 'li') return false;
    for (const r of (b.runs as unknown[]) ?? []) {
      if (r && typeof r === 'object' && strip(String((r as { s?: unknown }).s ?? '')) !== '')
        return false;
      if (typeof r === 'string' && strip(r) !== '') return false;
    }
  }
  return true;
}

/** Vero se questa carta padre va trattata come titolo (una domanda scritta, nessuna risposta, almeno una sottocarta). */
export function isTitleCard(
  card: {
    is_father: number;
    answer_desc: string | null;
    answer_image: string | null;
    answer_audio: string | null;
  },
  childCount: number,
): boolean {
  return (
    card.is_father === 1 &&
    childCount >= 1 &&
    isBlankField(card.answer_desc) &&
    !card.answer_image &&
    !card.answer_audio
  );
}

/**
 * Le partite di studio sul telefono. Stesse regole del sito (fc_game_start.php, fc_game.php, fc_game_retry.php,
 * fc_ripresa.php, fc_result.php): la sequenza dei padri si decide una volta sola all'avvio, le righe delle risposte nascono
 * quando si arriva alla posizione (il padre per primo, poi le sottocarte), un titolo parte già chiuso, in una partita
 * «da imparare» le parti già imparate si guardano soltanto, il punteggio è giuste / date.
 */
export class GameRepo {
  /** l'ultimo istante di gioco di ogni partita, in memoria: serve a non contare le pause lunghe */
  private readonly active = new Map<string, number>();

  constructor(
    private readonly db: SqlDb,
    private readonly study: StudyRepo,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
    private readonly nowMs: () => number = () => Date.now(),
    private readonly nowStamp: () => string = () => stamp(),
    private readonly rng: () => number = Math.random,
  ) {}

  /* ---------------- lettura ---------------- */

  game(uuid: string): GameRow | null {
    return (
      this.db.all<GameRow>(
        `SELECT uuid, game_date, score, type, card_status, parent_uuid, total_father_words, game_order,
                total_words_with_children, max_card_uuid FROM fc_games WHERE uuid = ?`,
        [uuid],
      )[0] ?? null
    );
  }

  /** Le partite, dalla più recente. */
  games(): GameRow[] {
    return this.db.all<GameRow>(
      `SELECT uuid, game_date, score, type, card_status, parent_uuid, total_father_words, game_order,
              total_words_with_children, max_card_uuid FROM fc_games ORDER BY game_date DESC, rowid DESC`,
    );
  }

  totalPositions(gameUuid: string): number {
    return Number(
      this.db.all<{ n: number }>(
        'SELECT COUNT(*) AS n FROM fc_study_sequence WHERE game_uuid = ?',
        [gameUuid],
      )[0]?.n ?? 0,
    );
  }

  /** Le righe di risposta di una posizione: il padre per primo, poi le sottocarte nel loro ordine. */
  plays(gameUuid: string, position: number): PlayRow[] {
    return this.db.all<PlayRow>(
      `SELECT p.uuid, p.game_uuid, p.card_uuid, p.child_uuid, p.correct_answer, p.user_answer, p.position, p.play_date
         FROM fc_study_plays p LEFT JOIN fc_study_subcards s ON s.uuid = p.child_uuid
        WHERE p.game_uuid = ? AND p.position = ?
        ORDER BY (p.child_uuid IS NOT NULL) ASC, s.custom_order ASC, p.rowid ASC`,
      [gameUuid, position],
    );
  }

  allPlays(gameUuid: string): PlayRow[] {
    return this.db.all<PlayRow>(
      `SELECT uuid, game_uuid, card_uuid, child_uuid, correct_answer, user_answer, position, play_date
         FROM fc_study_plays WHERE game_uuid = ? ORDER BY position ASC, rowid ASC`,
      [gameUuid],
    );
  }

  gameDecks(gameUuid: string): string[] {
    return this.db
      .all<{ deck_uuid: string }>(
        'SELECT deck_uuid FROM fc_study_game_decks WHERE game_uuid = ? ORDER BY category_order, rowid',
        [gameUuid],
      )
      .map((r) => r.deck_uuid);
  }

  /** Il tempo giocato in tutto, in secondi. */
  playedSeconds(gameUuid: string): number {
    return Number(
      this.db.all<{ t: number | null }>(
        'SELECT SUM(duration_seconds) AS t FROM fc_game_durations WHERE game_uuid = ?',
        [gameUuid],
      )[0]?.t ?? 0,
    );
  }

  /* ---------------- storia delle carte e livelli ---------------- */

  /** Per ogni carta (chiave `p<uuid>`) e carta figlia (`c<uuid>`): giuste, sbagliate e storia recente (i ripassi in minuscolo). */
  histories(): Map<string, CardHistory> {
    const out = new Map<string, CardHistory>();
    const rows = this.db.all<{
      card_uuid: string | null;
      child_uuid: string | null;
      user_answer: string;
      retry: number;
    }>(
      `SELECT p.card_uuid, p.child_uuid, p.user_answer, (g.parent_uuid IS NOT NULL) AS retry
         FROM fc_study_plays p LEFT JOIN fc_games g ON g.uuid = p.game_uuid
        WHERE p.user_answer IN ('Correct', 'Wrong')
        ORDER BY p.play_date ASC, p.rowid ASC`,
    );
    for (const r of rows) {
      const key = r.child_uuid ? `c${r.child_uuid}` : r.card_uuid ? `p${r.card_uuid}` : null;
      if (!key) continue;
      const h = out.get(key) ?? { c: 0, w: 0, u: '' };
      const ok = r.user_answer === 'Correct';
      if (ok) h.c += 1;
      else h.w += 1;
      h.u = (h.u + answerLetter(ok, !!r.retry)).slice(-HISTORY_LENGTH);
      out.set(key, h);
    }
    return out;
  }

  /** Il livello di una carta (`p<uuid>`) o carta figlia (`c<uuid>`). */
  levelOfKey(key: string, hist: Map<string, CardHistory> = this.histories()): Level {
    const h = hist.get(key) ?? { c: 0, w: 0, u: '' };
    return levelOf(h.c, h.w, h.u);
  }

  /* ---------------- avvio ---------------- */

  private cardsFor(deckUuids: string[]): CardLite[] {
    const cols =
      'uuid, category_uuid, question_desc, answer_desc, answer_image, answer_audio, is_father, custom_order';
    if (!deckUuids.length) return this.db.all<CardLite>(`SELECT ${cols} FROM fc_study_cards`);
    const out: CardLite[] = [];
    for (let i = 0; i < deckUuids.length; i += 400) {
      const part = deckUuids.slice(i, i + 400);
      out.push(
        ...this.db.all<CardLite>(
          `SELECT ${cols} FROM fc_study_cards WHERE category_uuid IN (${part.map(() => '?').join(',')})`,
          part,
        ),
      );
    }
    return out;
  }

  /** I titoli: carte padre con sottocarte, domanda scritta e risposta vuota (non hanno livello e non si imparano). */
  private childrenByParent(): Map<string, string[]> {
    const m = new Map<string, string[]>();
    for (const r of this.db.all<{ uuid: string; parent_uuid: string }>(
      'SELECT uuid, parent_uuid FROM fc_study_subcards ORDER BY custom_order, rowid',
    )) {
      const l = m.get(r.parent_uuid) ?? [];
      l.push(r.uuid);
      m.set(r.parent_uuid, l);
    }
    return m;
  }

  private shuffle<T>(list: T[]): T[] {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  /** Quali carte padre entrano in una partita con queste scelte, nell'ordine di gioco, e quante carte figlie portano. */
  select(input: StartInput): { fathers: string[]; children: number; decks: string[] } {
    const decksKnown = new Set(
      this.db.all<{ uuid: string }>('SELECT uuid FROM fc_study_decks').map((d) => d.uuid),
    );
    const decks = [...new Set(input.decks)].filter((d) => decksKnown.has(d));
    const learnt = this.study.learnt();
    const kids = this.childrenByParent();
    const status: GameStatus = input.onlyHard ? 'all' : input.status;
    const cards = this.cardsFor(decks);
    const isTitle = (c: CardLite): boolean =>
      isTitleCard(c, kids.get(c.uuid)?.length ?? 0) && !isBlankField(c.question_desc);

    let chosen = cards.filter((c) => {
      if (status === 'all') return true;
      const ch = kids.get(c.uuid) ?? [];
      if (status === '1') return learnt.has(c.uuid) || ch.some((k) => learnt.has(k));
      // i titoli non si imparano: la loro parte non conta
      return (!learnt.has(c.uuid) && !isTitle(c)) || ch.some((k) => !learnt.has(k));
    });
    // le sottocarte di chi è padre vero
    let children = chosen.reduce(
      (n, c) => n + (c.is_father === 1 ? (kids.get(c.uuid)?.length ?? 0) : 0),
      0,
    );

    if (input.onlyHard || input.levels?.length) {
      const hist = this.histories();
      const allowed = (l: Level): boolean =>
        (!input.onlyHard || needsReview(l)) && (!input.levels?.length || input.levels.includes(l));
      chosen = chosen.filter((c) => {
        const keys = isTitle(c) ? [] : [`p${c.uuid}`];
        for (const k of kids.get(c.uuid) ?? []) keys.push(`c${k}`);
        return keys.some((k) => allowed(this.levelOfKey(k, hist)));
      });
      children = chosen.reduce((n, c) => n + (kids.get(c.uuid)?.length ?? 0), 0);
    }

    const order: GameOrder = input.onlyHard ? 'random' : input.order;
    let sorted: CardLite[];
    if (order === 'random') sorted = this.shuffle(chosen);
    else {
      const rank = new Map(decks.map((d, i) => [d, i]));
      sorted = chosen
        .slice()
        .sort(
          (a, b) =>
            (rank.get(a.category_uuid) ?? Number.MAX_SAFE_INTEGER) -
              (rank.get(b.category_uuid) ?? Number.MAX_SAFE_INTEGER) ||
            a.custom_order - b.custom_order ||
            (a.uuid < b.uuid ? -1 : 1),
        );
    }
    return { fathers: sorted.map((c) => c.uuid), children, decks };
  }

  private newDuration(gameUuid: string): void {
    const uuid = this.newId();
    const row = {
      game_uuid: gameUuid,
      start_time: this.nowStamp(),
      duration_seconds: 0,
    };
    upsertRow(this.db, 'fc_game_durations', { uuid, ...row, updated_at: this.nowStamp() });
    enqueue(
      this.db,
      { table: 'fc_game_durations', uuid, op: 'upsert', isCreate: true, patch: row },
      this.clock(),
    );
  }

  private writeSequence(gameUuid: string, fathers: string[]): void {
    const now = this.clock();
    fathers.forEach((card, i) => {
      const uuid = this.newId();
      const row = { game_uuid: gameUuid, position: i + 1, card_uuid: card };
      upsertRow(this.db, 'fc_study_sequence', { uuid, ...row });
      enqueue(
        this.db,
        { table: 'fc_study_sequence', uuid, op: 'upsert', isCreate: true, patch: row },
        now,
      );
    });
  }

  private writeGameDecks(gameUuid: string, decks: string[]): void {
    const now = this.clock();
    decks.forEach((deck, i) => {
      const uuid = this.newId();
      const row = { game_uuid: gameUuid, deck_uuid: deck, category_order: i };
      upsertRow(this.db, 'fc_study_game_decks', { uuid, ...row });
      enqueue(
        this.db,
        { table: 'fc_study_game_decks', uuid, op: 'upsert', isCreate: true, patch: row },
        now,
      );
    });
  }

  private createGame(
    fields: {
      type: string;
      card_status: string | null;
      game_order: GameOrder;
      parent_uuid: string | null;
      fathers: number;
      total: number;
    },
    decks: string[],
    sequence: string[],
  ): string {
    const uuid = this.newId();
    const row = {
      game_date: this.nowStamp(),
      score: 0,
      type: fields.type,
      card_status: fields.card_status,
      parent_uuid: fields.parent_uuid,
      total_father_words: fields.fathers,
      game_order: fields.game_order,
      total_words_with_children: fields.total,
      max_card_uuid: null,
    };
    this.db.transaction(() => {
      upsertRow(this.db, 'fc_games', { uuid, ...row });
      enqueue(
        this.db,
        { table: 'fc_games', uuid, op: 'upsert', isCreate: true, patch: row },
        this.clock(),
      );
      this.newDuration(uuid);
      this.writeGameDecks(uuid, decks);
      this.writeSequence(uuid, sequence);
    });
    this.active.set(uuid, this.nowMs());
    return uuid;
  }

  /** Avvia una partita sui mazzi scelti. Una scelta senza carte non crea niente. */
  start(input: StartInput): StartOutcome {
    const sel = this.select(input);
    if (!sel.fathers.length) return { kind: 'empty' };
    const status: GameStatus = input.onlyHard ? 'all' : input.status;
    const game = this.createGame(
      {
        type: status === '1' ? 'fc_L' : 'fc',
        card_status: status,
        game_order: input.onlyHard ? 'random' : input.order,
        parent_uuid: null,
        fathers: sel.fathers.length,
        total: sel.fathers.length + sel.children,
      },
      sel.decks,
      sel.fathers,
    );
    return { kind: 'started', game };
  }

  /**
   * «Ripassa gli errori»: una nuova partita con i padri che hanno almeno una carta sbagliata nella partita di origine
   * (anche se l'errore era su una sottocarta: la posizione si rigioca intera), mescolati. Senza errori non nasce niente.
   */
  retry(parentUuid: string): StartOutcome {
    const parent = this.game(parentUuid);
    if (!parent) return { kind: 'empty' };
    const wrongPositions = new Set(
      this.db
        .all<{ position: number }>(
          `SELECT DISTINCT position FROM fc_study_plays WHERE game_uuid = ? AND user_answer = 'Wrong'`,
          [parentUuid],
        )
        .map((r) => r.position),
    );
    const fathers = [
      ...new Set(
        this.allPlays(parentUuid)
          .filter((p) => p.card_uuid && wrongPositions.has(p.position))
          .map((p) => p.card_uuid!),
      ),
    ];
    if (!fathers.length) return { kind: 'empty' };
    const kids = this.childrenByParent();
    const children = fathers.reduce((n, f) => {
      const row = this.db.all<{ is_father: number }>(
        'SELECT is_father FROM fc_study_cards WHERE uuid = ?',
        [f],
      )[0];
      return n + (row?.is_father === 1 ? (kids.get(f)?.length ?? 0) : 0);
    }, 0);
    const status = ['all', '1', '0'].includes(parent.card_status ?? '') ? parent.card_status : null;
    const game = this.createGame(
      {
        type: parent.type,
        card_status: status,
        game_order: 'random',
        parent_uuid: parentUuid,
        fathers: fathers.length,
        total: fathers.length + children,
      },
      this.gameDecks(parentUuid),
      this.shuffle(fathers),
    );
    return { kind: 'started', game };
  }

  /* ---------------- le posizioni ---------------- */

  private insertPlay(
    gameUuid: string,
    position: number,
    target: { card?: string; child?: string },
    answer: string,
    correct: string | null,
  ): void {
    const uuid = this.newId();
    const row = {
      game_uuid: gameUuid,
      card_uuid: target.card ?? null,
      child_uuid: target.child ?? null,
      correct_answer: correct,
      user_answer: answer,
      position,
      play_date: null,
    };
    upsertRow(this.db, 'fc_study_plays', { uuid, ...row });
    enqueue(
      this.db,
      { table: 'fc_study_plays', uuid, op: 'upsert', isCreate: true, patch: row },
      this.clock(),
    );
  }

  /**
   * Le righe di risposta di una posizione, create se è la prima volta (il padre, poi le sottocarte). Ritorna null se la
   * posizione è oltre la fine della sequenza.
   */
  ensurePosition(gameUuid: string, position: number): PlayRow[] | null {
    const have = this.plays(gameUuid, position);
    if (have.length) return have;
    const game = this.game(gameUuid);
    const seq = this.db.all<{ card_uuid: string }>(
      'SELECT card_uuid FROM fc_study_sequence WHERE game_uuid = ? AND position = ?',
      [gameUuid, position],
    )[0];
    if (!game || !seq) return null;
    const card = this.db.all<CardLite>(
      `SELECT uuid, category_uuid, question_desc, answer_desc, answer_image, answer_audio, is_father, custom_order
         FROM fc_study_cards WHERE uuid = ?`,
      [seq.card_uuid],
    )[0];
    if (!card) return null;
    const kids = card.is_father === 1 ? (this.childrenByParent().get(card.uuid) ?? []) : [];
    const title = isTitleCard(card, kids.length);

    // un ripasso parte con «giusto» le carte già giuste nella partita di origine
    const prevCorrect = (col: 'card_uuid' | 'child_uuid', id: string): boolean =>
      !!game.parent_uuid &&
      this.db.all(
        `SELECT 1 FROM fc_study_plays WHERE game_uuid = ? AND ${col} = ? AND user_answer = 'Correct' LIMIT 1`,
        [game.parent_uuid, id],
      ).length > 0;

    // in una partita «da imparare» le parti già imparate si guardano soltanto; in «imparate» il contrario
    const status = game.card_status ?? 'all';
    const watchOnly = !game.parent_uuid && (status === '0' || status === '1');
    const learnt = watchOnly ? this.study.learnt() : new Set<string>();
    const toWatch = (id: string): boolean => {
      if (!watchOnly) return false;
      return status === '0' ? learnt.has(id) : !learnt.has(id);
    };

    this.db.transaction(() => {
      let a = title ? 'Titolo' : '';
      if (!title && prevCorrect('card_uuid', card.uuid)) a = 'Correct';
      if (a === '' && toWatch(card.uuid)) a = 'Visione';
      this.insertPlay(
        gameUuid,
        position,
        { card: card.uuid },
        a,
        title ? '' : (card.answer_desc ?? '').slice(0, 100),
      );
      for (const k of kids) {
        const child = this.db.all<{ answer_desc: string | null }>(
          'SELECT answer_desc FROM fc_study_subcards WHERE uuid = ?',
          [k],
        )[0];
        let ca = '';
        if (prevCorrect('child_uuid', k)) ca = 'Correct';
        if (ca === '' && toWatch(k)) ca = 'Visione';
        this.insertPlay(
          gameUuid,
          position,
          { child: k },
          ca,
          (child?.answer_desc ?? '').slice(0, 100),
        );
      }
    });
    return this.plays(gameUuid, position);
  }

  /** La prima posizione ancora da rispondere (null = nessuna). */
  firstUnanswered(gameUuid: string): number | null {
    const r = this.db.all<{ p: number | null }>(
      `SELECT MIN(position) AS p FROM fc_study_plays WHERE game_uuid = ? AND COALESCE(user_answer, '') = ''`,
      [gameUuid],
    )[0];
    return r?.p ? Number(r.p) : null;
  }

  /**
   * Da che posizione si riprende: la prima con una riga ancora vuota, altrimenti la prima della sequenza senza risposte.
   * null = la partita è finita.
   */
  resumePosition(gameUuid: string): number | null {
    const open = this.firstUnanswered(gameUuid);
    if (open) return open;
    const r = this.db.all<{ p: number | null }>(
      `SELECT MIN(s.position) AS p FROM fc_study_sequence s
        WHERE s.game_uuid = ?
          AND NOT EXISTS (SELECT 1 FROM fc_study_plays p WHERE p.game_uuid = s.game_uuid AND p.position = s.position
                            AND COALESCE(p.user_answer, '') <> '')`,
      [gameUuid],
    )[0];
    return r?.p ? Number(r.p) : null;
  }

  /** Dove si va quando si chiede una posizione: una dietro la prima ancora da rispondere rimanda a quella. */
  effectivePosition(gameUuid: string, requested: number): number {
    const first = this.firstUnanswered(gameUuid);
    return first !== null && first < requested ? first : requested;
  }

  /** Il fronte: la posizione più avanti con una risposta vera (non titolo, non da guardare). */
  frontier(gameUuid: string): number {
    const r = this.db.all<{ p: number | null }>(
      `SELECT MAX(position) AS p FROM fc_study_plays
        WHERE game_uuid = ? AND user_answer <> '' AND user_answer NOT IN ('Titolo', 'Visione')`,
      [gameUuid],
    )[0];
    return r?.p ? Number(r.p) : 0;
  }

  /* ---------------- tempo ---------------- */

  /**
   * Segna che si sta giocando adesso: aggiunge al tempo della sessione quello passato dall'ultima attività (al massimo
   * 5 minuti); dopo una pausa più lunga, o appena aperta l'app, comincia una sessione nuova.
   */
  touch(gameUuid: string): void {
    const now = this.nowMs();
    const last = this.active.get(gameUuid);
    this.active.set(gameUuid, now);
    const latest = this.db.all<{ uuid: string; duration_seconds: number }>(
      'SELECT uuid, duration_seconds FROM fc_game_durations WHERE game_uuid = ? ORDER BY start_time DESC, rowid DESC LIMIT 1',
      [gameUuid],
    )[0];
    if (!latest || last === undefined || (now - last) / 1000 > PAUSE_MAX_SECONDS) {
      // una sessione nuova solo se si riprende davvero: la partita appena nata ne ha già una a zero
      if (!latest || Number(latest.duration_seconds) > 0 || last !== undefined)
        this.newDuration(gameUuid);
      return;
    }
    const add = Math.min(Math.floor((now - last) / 1000), PAUSE_MAX_SECONDS);
    if (add <= 0) return;
    const total = Number(latest.duration_seconds) + add;
    patchRow(this.db, 'fc_game_durations', latest.uuid, { duration_seconds: total });
    enqueue(
      this.db,
      {
        table: 'fc_game_durations',
        uuid: latest.uuid,
        op: 'upsert',
        patch: { duration_seconds: total },
      },
      this.clock(),
    );
  }

  /* ---------------- voti ---------------- */

  private findPlay(
    gameUuid: string,
    position: number,
    target: string,
    isChild: boolean,
  ): PlayRow | null {
    return (
      this.db.all<PlayRow>(
        `SELECT uuid, game_uuid, card_uuid, child_uuid, correct_answer, user_answer, position, play_date
           FROM fc_study_plays WHERE game_uuid = ? AND position = ? AND ${isChild ? 'child_uuid' : 'card_uuid'} = ?`,
        [gameUuid, position, target],
      )[0] ?? null
    );
  }

  private writeAnswer(play: PlayRow, answer: string): void {
    const patch: Record<string, WireValue> = { user_answer: answer, play_date: this.nowStamp() };
    patchRow(this.db, 'fc_study_plays', play.uuid, patch);
    enqueue(
      this.db,
      { table: 'fc_study_plays', uuid: play.uuid, op: 'upsert', patch },
      this.clock(),
    );
  }

  /**
   * Un voto. «Imparata» vale giusta e segna la carta (o la sottocarta) imparata. Ritorna quante righe della posizione
   * sono ancora da rispondere e dove si va dopo: sulla stessa posizione se ne restano; altrimenti avanti di una, ma se
   * la posizione era un ripasso dietro al fronte si torna dritti al fronte.
   */
  grade(
    gameUuid: string,
    position: number,
    target: string,
    isChild: boolean,
    result: Grade,
  ): { ok: boolean; unanswered: number; next: number } {
    const play = this.findPlay(gameUuid, position, target, isChild);
    if (!play) return { ok: false, unanswered: 0, next: position };
    this.db.transaction(() => {
      if (result === 'learnt') this.study.setLearnt(target, isChild, true);
      this.writeAnswer(play, result === 'wrong' ? 'Wrong' : 'Correct');
      this.touch(gameUuid);
    });
    const unanswered = this.plays(gameUuid, position).filter(
      (p) => (p.user_answer ?? '') === '',
    ).length;
    if (unanswered > 0) return { ok: true, unanswered, next: position };
    const front = this.frontier(gameUuid);
    return { ok: true, unanswered: 0, next: position < front ? front : position + 1 };
  }

  /**
   * Cambia il verdetto di una carta già giocata, senza avanzare e senza contare tempo. Una carta segnata sbagliata non
   * resta «imparata».
   */
  changeVerdict(
    gameUuid: string,
    position: number,
    target: string,
    isChild: boolean,
    result: 'correct' | 'wrong',
  ): boolean {
    const play = this.findPlay(gameUuid, position, target, isChild);
    if (!play) return false;
    this.db.transaction(() => {
      this.writeAnswer(play, result === 'wrong' ? 'Wrong' : 'Correct');
      if (result === 'wrong') this.study.setLearnt(target, isChild, false);
    });
    return true;
  }

  /* ---------------- avanzamento e punteggio ---------------- */

  /** Giuste, sbagliate e carte giocate (i titoli e le carte solo da guardare non contano). */
  tally(gameUuid: string): { correct: number; wrong: number; played: number; score: number } {
    const rows = this.db.all<{ a: string; n: number }>(
      `SELECT user_answer AS a, COUNT(*) AS n FROM fc_study_plays WHERE game_uuid = ? GROUP BY user_answer`,
      [gameUuid],
    );
    const count = (a: string): number => Number(rows.find((r) => r.a === a)?.n ?? 0);
    const correct = count('Correct');
    const wrong = count('Wrong');
    const played = correct + wrong;
    return { correct, wrong, played, score: played > 0 ? (correct / played) * 100 : 0 };
  }

  /** Quante posizioni sono chiuse (hanno righe e nessuna ancora da rispondere). */
  closedPositions(gameUuid: string): number {
    return Number(
      this.db.all<{ n: number }>(
        `SELECT COUNT(*) AS n FROM (SELECT position FROM fc_study_plays WHERE game_uuid = ?
                GROUP BY position HAVING SUM(COALESCE(user_answer, '') = '') = 0)`,
        [gameUuid],
      )[0]?.n ?? 0,
    );
  }

  /**
   * Chiude la partita: via le posizioni arrivate solo a metà strada senza nessuna risposta (precaricate e mai giocate) e
   * il punteggio scritto. Ritorna il punteggio.
   */
  conclude(gameUuid: string): number {
    const empty = this.db
      .all<{ position: number }>(
        `SELECT position FROM fc_study_plays WHERE game_uuid = ? GROUP BY position
          HAVING SUM(CASE WHEN COALESCE(user_answer, '') <> '' THEN 1 ELSE 0 END) = 0`,
        [gameUuid],
      )
      .map((r) => r.position);
    this.db.transaction(() => {
      for (const pos of empty) {
        for (const p of this.plays(gameUuid, pos)) {
          // se la riga non era ancora partita, `enqueue` la fa sparire senza lasciare tracce
          deleteRow(this.db, 'fc_study_plays', p.uuid);
          enqueue(this.db, { table: 'fc_study_plays', uuid: p.uuid, op: 'delete' }, this.clock());
        }
      }
      const score = Math.round(this.tally(gameUuid).score * 100) / 100;
      const g = this.game(gameUuid);
      if (g && Number(g.score ?? 0) !== score) {
        patchRow(this.db, 'fc_games', gameUuid, { score });
        enqueue(
          this.db,
          { table: 'fc_games', uuid: gameUuid, op: 'upsert', patch: { score } },
          this.clock(),
        );
      }
    });
    return this.tally(gameUuid).score;
  }

  /** Toglie una partita (e, con lei, tempo, risposte, mazzi e sequenza). I ripassi restano, senza legame. */
  remove(gameUuid: string): void {
    if (!this.game(gameUuid)) return;
    this.db.transaction(() => {
      const now = this.clock();
      for (const table of [
        'fc_study_plays',
        'fc_game_durations',
        'fc_study_game_decks',
        'fc_study_sequence',
      ] as const) {
        this.db.run(
          `DELETE FROM outbox WHERE tbl = ? AND state = 'pending' AND uuid IN (SELECT uuid FROM ${table} WHERE game_uuid = ?)`,
          [table, gameUuid],
        );
        this.db.run(`DELETE FROM ${table} WHERE game_uuid = ?`, [gameUuid]);
      }
      this.db.run('UPDATE fc_games SET parent_uuid = NULL WHERE parent_uuid = ?', [gameUuid]);
      deleteRow(this.db, 'fc_games', gameUuid);
      enqueue(this.db, { table: 'fc_games', uuid: gameUuid, op: 'delete' }, now);
    });
  }

  /**
   * La partita lasciata a metà: la più recente degli ultimi 90 giorni con almeno una risposta e posizioni ancora aperte.
   */
  unfinished(today: Date = new Date(this.nowMs())): {
    game: GameRow;
    position: number;
    closed: number;
    total: number;
    label: string;
  } | null {
    const limit = stamp(new Date(today.getTime() - 90 * 86_400_000));
    const candidates = this.db.all<GameRow>(
      `SELECT uuid, game_date, score, type, card_status, parent_uuid, total_father_words, game_order,
              total_words_with_children, max_card_uuid
         FROM fc_games WHERE game_date >= ? ORDER BY game_date DESC, rowid DESC LIMIT 12`,
      [limit],
    );
    for (const g of candidates) {
      const total = this.totalPositions(g.uuid);
      if (total < 1) continue;
      const answered = Number(
        this.db.all<{ n: number }>(
          `SELECT COUNT(*) AS n FROM fc_study_plays WHERE game_uuid = ? AND user_answer IN ('Correct', 'Wrong')`,
          [g.uuid],
        )[0]?.n ?? 0,
      );
      if (answered < 1) continue;
      const closed = this.closedPositions(g.uuid);
      const position = this.resumePosition(g.uuid);
      if (position === null || closed >= total) continue;
      const first = this.gameDecks(g.uuid)[0];
      const label = first
        ? (this.db.all<{ name: string }>('SELECT name FROM fc_study_decks WHERE uuid = ?', [
            first,
          ])[0]?.name ?? '')
        : '';
      return { game: g, position, closed: Math.min(closed, total), total, label };
    }
    return null;
  }
}
