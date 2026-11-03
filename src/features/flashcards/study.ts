import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { SyncTable } from '@/core/sync/manifest';
import type { WireValue } from '@/core/sync/types';
import { learntUuid, perUserUuid, studyRecordUuid } from '@/core/sync/uuid5';
import { localToday } from '@/features/tasks/groups';

export const DEFAULT_DAILY_GOAL = 20;
export const MAX_DAILY_GOAL = 1000;
export const INDIZI_MODI = ['aperto', 'tocco', 'dopo'] as const;
export type IndizioModo = (typeof INDIZI_MODI)[number];
/** lettura vocale: domanda (0-1), risposta (1-2), significato (0-1), esempi (0-2): come sul sito (fc_lettura_valida). */
const VOICE_READ = /^[01][12][01][012]$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const EXAMPLE_MAX = 2000;

export interface StudySettings {
  vocab_meaning: IndizioModo;
  vocab_examples: IndizioModo;
  voice_read: string | null;
}

export interface Example {
  uuid: string;
  card_uuid: string | null;
  child_uuid: string | null;
  example_text: string | null;
  example_image: string | null;
  example_audio: string | null;
}

export interface StudyRecord {
  uuid: string;
  kind: string;
  value: number;
  game_uuid: string | null;
  achieved_at: string | null;
}

/** "YYYY-MM-DD HH:MM:SS" nell'ora del telefono (il sito scrive l'ora del server, qui l'ora di chi studia). */
export function stamp(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Quando una carta (o carta figlia) sparisce, il server toglie con lei preferiti, imparate, esempi, risposte e posti in
 * sequenza (chiavi esterne a cascata). Sul telefono lo facciamo noi, e buttiamo le modifiche in attesa di quelle righe.
 */
export function dropCardDependents(
  db: SqlDb,
  { cards = [], children = [] }: { cards?: string[]; children?: string[] },
): void {
  const jobs: [SyncTable, string, string[]][] = [
    ['fc_study_favorites', 'card_uuid', cards],
    ['fc_study_examples', 'card_uuid', cards],
    ['fc_study_plays', 'card_uuid', cards],
    ['fc_study_sequence', 'card_uuid', cards],
    ['fc_study_learnt', 'target_uuid', [...cards, ...children]],
    ['fc_study_favorites', 'child_uuid', children],
    ['fc_study_examples', 'child_uuid', children],
    ['fc_study_plays', 'child_uuid', children],
  ];
  for (const [table, column, list] of jobs) {
    if (!list.length) continue;
    // a blocchi: SQLite ha un tetto ai segnaposto
    for (let i = 0; i < list.length; i += 400) {
      const part = list.slice(i, i + 400);
      const ph = part.map(() => '?').join(',');
      db.run(
        `DELETE FROM outbox WHERE tbl = ? AND state = 'pending' AND uuid IN (SELECT uuid FROM ${table} WHERE ${column} IN (${ph}))`,
        [table, ...part],
      );
      db.run(`DELETE FROM ${table} WHERE ${column} IN (${ph})`, part);
    }
  }
}

/**
 * I dati di studio dell'utente: preferiti, carte imparate, esempi, obiettivo giornaliero, impostazioni e record.
 * Stesse regole del sito (fc_game.php, fc_stats.php, fc_impostazioni.php, fc_vocab_gioco.php): «imparata» e «preferita» sono
 * etichette sulla carta (o sulla carta figlia), l'obiettivo va da 1 a 1000 (20 se non l'hai scelto), un record si scrive solo
 * se è migliore del vecchio. Le righe a chiave naturale (imparate, record, impostazioni, obiettivo) hanno l'uuid calcolato
 * come sul server, così telefono e sito parlano della stessa riga anche senza rete.
 */
export class StudyRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly userId: number | string,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
    private readonly today: () => string = () => localToday(),
    private readonly nowStamp: () => string = () => stamp(),
  ) {}

  private exists(table: SyncTable, uuid: string): boolean {
    return this.db.all(`SELECT 1 FROM ${table} WHERE uuid = ?`, [uuid]).length > 0;
  }

  private targetExists(uuid: string, isChild: boolean): boolean {
    return this.exists(isChild ? 'fc_study_subcards' : 'fc_study_cards', uuid);
  }

  /* ---------------- preferiti ---------------- */

  /** Gli uuid delle carte e carte figlie preferite. */
  favorites(): Set<string> {
    return new Set(
      this.db
        .all<{ t: string }>(
          'SELECT COALESCE(card_uuid, child_uuid) AS t FROM fc_study_favorites WHERE COALESCE(card_uuid, child_uuid) IS NOT NULL',
        )
        .map((r) => r.t),
    );
  }

  isFavorite(targetUuid: string): boolean {
    return (
      this.db.all(
        'SELECT 1 FROM fc_study_favorites WHERE card_uuid = ? OR child_uuid = ? LIMIT 1',
        [targetUuid, targetUuid],
      ).length > 0
    );
  }

  setFavorite(targetUuid: string, isChild: boolean, on: boolean): boolean {
    if (!this.targetExists(targetUuid, isChild)) return false;
    const col = isChild ? 'child_uuid' : 'card_uuid';
    const rows = this.db.all<{ uuid: string }>(
      `SELECT uuid FROM fc_study_favorites WHERE ${col} = ?`,
      [targetUuid],
    );
    const now = this.clock();
    this.db.transaction(() => {
      if (!on) {
        for (const r of rows) {
          deleteRow(this.db, 'fc_study_favorites', r.uuid);
          enqueue(this.db, { table: 'fc_study_favorites', uuid: r.uuid, op: 'delete' }, now);
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
      upsertRow(this.db, 'fc_study_favorites', { uuid, ...patch });
      enqueue(
        this.db,
        { table: 'fc_study_favorites', uuid, op: 'upsert', isCreate: true, patch },
        now,
      );
    });
    return true;
  }

  /* ---------------- imparate ---------------- */

  /** Gli uuid delle carte e carte figlie imparate. */
  learnt(): Set<string> {
    return new Set(
      this.db.all<{ t: string }>('SELECT target_uuid AS t FROM fc_study_learnt').map((r) => r.t),
    );
  }

  isLearnt(targetUuid: string): boolean {
    return (
      this.exists('fc_study_learnt', learntUuid(this.userId, targetUuid, false)) ||
      this.exists('fc_study_learnt', learntUuid(this.userId, targetUuid, true))
    );
  }

  setLearnt(targetUuid: string, isChild: boolean, on: boolean): boolean {
    if (!this.targetExists(targetUuid, isChild)) return false;
    const uuid = learntUuid(this.userId, targetUuid, isChild);
    const has = this.exists('fc_study_learnt', uuid);
    const now = this.clock();
    this.db.transaction(() => {
      if (!on) {
        if (!has) return;
        deleteRow(this.db, 'fc_study_learnt', uuid);
        enqueue(this.db, { table: 'fc_study_learnt', uuid, op: 'delete' }, now);
        return;
      }
      // già imparata: la data resta quella di prima (il sito fa «INSERT IGNORE»)
      if (has) return;
      const patch = {
        target_uuid: targetUuid,
        is_child: isChild,
        learnt_date: this.today(),
      };
      upsertRow(this.db, 'fc_study_learnt', {
        uuid,
        ...patch,
        updated_at: now,
      });
      enqueue(
        this.db,
        { table: 'fc_study_learnt', uuid, op: 'upsert', isCreate: true, patch },
        now,
      );
    });
    return true;
  }

  /* ---------------- esempi ---------------- */

  examples(targetUuid: string): Example[] {
    return this.db.all<Example>(
      `SELECT uuid, card_uuid, child_uuid, example_text, example_image, example_audio
         FROM fc_study_examples WHERE card_uuid = ? OR child_uuid = ? ORDER BY rowid`,
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
      upsertRow(this.db, 'fc_study_examples', {
        uuid,
        ...patch,
        example_image: null,
        example_audio: null,
      });
      enqueue(
        this.db,
        { table: 'fc_study_examples', uuid, op: 'upsert', isCreate: true, patch },
        this.clock(),
      );
    });
    return uuid;
  }

  updateExample(uuid: string, text: string): boolean {
    const t = text.trim().slice(0, EXAMPLE_MAX);
    if (!t || !this.exists('fc_study_examples', uuid)) return false;
    this.db.transaction(() => {
      patchRow(this.db, 'fc_study_examples', uuid, { example_text: t });
      enqueue(
        this.db,
        { table: 'fc_study_examples', uuid, op: 'upsert', patch: { example_text: t } },
        this.clock(),
      );
    });
    return true;
  }

  removeExample(uuid: string): void {
    if (!this.exists('fc_study_examples', uuid)) return;
    this.db.transaction(() => {
      deleteRow(this.db, 'fc_study_examples', uuid);
      enqueue(this.db, { table: 'fc_study_examples', uuid, op: 'delete' }, this.clock());
    });
  }

  /* ---------------- obiettivo e impostazioni ---------------- */

  goal(): number {
    const r = this.db.all<{ daily_goal: number }>('SELECT daily_goal FROM fc_goals LIMIT 1')[0];
    return r ? Number(r.daily_goal) : DEFAULT_DAILY_GOAL;
  }

  /** L'obiettivo di carte al giorno: intero da 1 a 1000. */
  setGoal(n: number): boolean {
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAILY_GOAL) return false;
    const uuid = perUserUuid('fc_goals', this.userId);
    const has = this.exists('fc_goals', uuid);
    if (has && n === this.goal()) return true;
    const now = this.clock();
    this.db.transaction(() => {
      if (has) patchRow(this.db, 'fc_goals', uuid, { daily_goal: n, updated_at: now });
      else upsertRow(this.db, 'fc_goals', { uuid, daily_goal: n, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_goals', uuid, op: 'upsert', isCreate: !has, patch: { daily_goal: n } },
        now,
      );
    });
    return true;
  }

  settings(): StudySettings {
    const r = this.db.all<StudySettings>(
      'SELECT vocab_meaning, vocab_examples, voice_read FROM fc_settings LIMIT 1',
    )[0];
    return {
      vocab_meaning: INDIZI_MODI.includes(r?.vocab_meaning as IndizioModo)
        ? (r!.vocab_meaning as IndizioModo)
        : 'aperto',
      vocab_examples: INDIZI_MODI.includes(r?.vocab_examples as IndizioModo)
        ? (r!.vocab_examples as IndizioModo)
        : 'aperto',
      voice_read: r?.voice_read && VOICE_READ.test(r.voice_read) ? r.voice_read : null,
    };
  }

  saveSettings(p: Partial<StudySettings>): boolean {
    const cur = this.settings();
    const patch: Record<string, WireValue> = {};
    for (const k of ['vocab_meaning', 'vocab_examples'] as const) {
      if (p[k] === undefined) continue;
      if (!INDIZI_MODI.includes(p[k])) return false;
      if (p[k] !== cur[k]) patch[k] = p[k];
    }
    if (p.voice_read !== undefined) {
      if (p.voice_read !== null && !VOICE_READ.test(p.voice_read)) return false;
      if (p.voice_read !== cur.voice_read) patch.voice_read = p.voice_read;
    }
    const uuid = perUserUuid('fc_settings', this.userId);
    const has = this.exists('fc_settings', uuid);
    if (!Object.keys(patch).length && has) return true;
    const now = this.clock();
    this.db.transaction(() => {
      const merged = { ...cur, ...patch };
      if (has) patchRow(this.db, 'fc_settings', uuid, { ...patch, updated_at: now });
      else upsertRow(this.db, 'fc_settings', { uuid, ...merged, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_settings', uuid, op: 'upsert', isCreate: !has, patch: has ? patch : merged },
        now,
      );
    });
    return true;
  }

  /* ---------------- record ---------------- */

  records(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.db.all<StudyRecord>('SELECT kind, value FROM fc_study_records')) {
      out[r.kind] = Number(r.value);
    }
    return out;
  }

  /**
   * Scrive un record solo se è migliore di quello che c'è (più alto; più basso nei tipi in cui vince il minore).
   * Ritorna il valore di prima (null se non c'era) e se il record è cambiato.
   */
  bumpRecord(
    kind: string,
    value: number,
    gameUuid: string | null,
    lowerWins = false,
  ): { before: number | null; changed: boolean; first: boolean } {
    const uuid = studyRecordUuid(this.userId, kind);
    const cur = this.db.all<{ value: number }>(
      'SELECT value FROM fc_study_records WHERE uuid = ?',
      [uuid],
    )[0];
    const before = cur ? Number(cur.value) : null;
    const v = Math.round(value * 100) / 100;
    const better = before === null || (lowerWins ? v < before : v > before);
    if (!better) return { before, changed: false, first: false };
    const patch = {
      ...(before === null ? { kind } : null),
      value: v,
      game_uuid: gameUuid,
      achieved_at: this.nowStamp(),
    };
    const now = this.clock();
    this.db.transaction(() => {
      if (cur) patchRow(this.db, 'fc_study_records', uuid, { ...patch, updated_at: now });
      else upsertRow(this.db, 'fc_study_records', { uuid, ...patch, updated_at: now });
      enqueue(
        this.db,
        { table: 'fc_study_records', uuid, op: 'upsert', isCreate: !cur, patch },
        now,
      );
    });
    return { before, changed: before !== null, first: before === null };
  }
}

export const isIsoDay = (s: string): boolean => ISO_DAY.test(s);
