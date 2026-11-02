import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import { checkInUuid } from '@/core/sync/uuid5';
import type { WireRow, WireValue } from '@/core/sync/types';

import {
  addDays,
  applyCheckIn,
  type CheckInMode,
  type Habit,
  type HabitLog,
  type LogStatus,
} from './logic';

export interface HabitCategory {
  uuid: string;
  slug: string | null;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_system: number;
}

/** I campi che l'utente scrive da un'abitudine (gli altri li decide il server). */
export type HabitInput = Partial<
  Pick<
    Habit,
    | 'category_uuid'
    | 'preset_key'
    | 'name'
    | 'icon'
    | 'color'
    | 'motivation'
    | 'kind'
    | 'goal_type'
    | 'target_amount'
    | 'step_amount'
    | 'unit'
    | 'frequency_type'
    | 'weekdays'
    | 'times_per_week'
    | 'times_per_month'
    | 'interval_days'
    | 'day_part'
    | 'duration_type'
    | 'duration_days'
    | 'start_date'
    | 'end_date'
    | 'planner_minutes'
  >
> & { is_archived?: boolean };

/**
 * Cosa parte verso il server: `duration_days: null` no (il server lo accetta solo come numero ed è lui
 * a metterlo a null quando la durata è «per sempre»); il telefono invece lo azzera subito in locale.
 */
const toWire = (f: Record<string, WireValue>): Record<string, WireValue> =>
  Object.fromEntries(Object.entries(f).filter(([k, v]) => !(k === 'duration_days' && v === null)));

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Record<
    string,
    WireValue
  >;

/** Le categorie delle abitudini: quelle di sistema si leggono, solo le proprie si cambiano. */
export class HabitCategoriesRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  list(): HabitCategory[] {
    return this.db.all<HabitCategory>(
      'SELECT uuid, slug, name, icon, color, sort_order, is_system FROM habit_categories ORDER BY sort_order, name',
    );
  }

  create(name: string, icon = '🏷️', color = '#8E8E93'): string {
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      const max = this.db.all<{ m: number | null }>(
        'SELECT MAX(sort_order) AS m FROM habit_categories WHERE is_system = 0',
      )[0]?.m;
      upsertRow(this.db, 'habit_categories', {
        uuid,
        slug: null,
        name,
        icon,
        color,
        sort_order: (max ?? 0) + 10,
        is_system: 0,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'habit_categories',
          uuid,
          op: 'upsert',
          patch: { name, icon, color },
          isCreate: true,
        },
        now,
      );
    });
    return uuid;
  }

  update(uuid: string, patch: { name?: string; icon?: string; color?: string }): void {
    const c = clean(patch);
    if (!Object.keys(c).length) return;
    this.db.transaction(() => {
      const row = this.db.all<{ is_system: number }>(
        'SELECT is_system FROM habit_categories WHERE uuid = ?',
        [uuid],
      )[0];
      if (!row || row.is_system) return; // di sistema: non si cambia
      patchRow(this.db, 'habit_categories', uuid, c);
      enqueue(this.db, { table: 'habit_categories', uuid, op: 'upsert', patch: c }, this.clock());
    });
  }

  remove(uuid: string): void {
    this.db.transaction(() => {
      const row = this.db.all<{ is_system: number }>(
        'SELECT is_system FROM habit_categories WHERE uuid = ?',
        [uuid],
      )[0];
      if (!row || row.is_system) return;
      // le abitudini restano, senza categoria (lo fa anche il server)
      this.db.run('UPDATE habits SET category_uuid = NULL WHERE category_uuid = ?', [uuid]);
      deleteRow(this.db, 'habit_categories', uuid);
      enqueue(this.db, { table: 'habit_categories', uuid, op: 'delete' }, this.clock());
    });
  }
}

export class HabitsRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
    /** il giorno di oggi, «YYYY-MM-DD» (il fuso lo sceglie chi costruisce il repo) */
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  /* ---------------- abitudini ---------------- */

  list(opts: { archived?: boolean } = {}): Habit[] {
    return this.db.all<Habit>(`SELECT * FROM habits WHERE is_archived = ? ORDER BY sort_key`, [
      opts.archived ? 1 : 0,
    ]);
  }

  get(uuid: string): Habit | null {
    return this.db.all<Habit>('SELECT * FROM habits WHERE uuid = ?', [uuid])[0] ?? null;
  }

  /** Come hb_abitudine_salva(): la quantità vale solo per le abitudini «a quantità»; la fine si ricava dalla durata. */
  private normalise(input: HabitInput, base: Partial<Habit>): Record<string, WireValue> {
    const m = { ...base, ...input } as Record<string, unknown>;
    const out: Record<string, WireValue> = {};
    for (const [k, v] of Object.entries(input)) if (v !== undefined) out[k] = v as WireValue;
    if (m.goal_type === 'completion') {
      if ('goal_type' in input || 'target_amount' in input) out.target_amount = 1;
      if ('goal_type' in input || 'step_amount' in input) out.step_amount = 1;
      if ('goal_type' in input || 'unit' in input) out.unit = '';
    }
    // la durata si ricalcola solo se l'utente ha toccato qualcosa che la riguarda (altrimenti ogni modifica manderebbe campi inutili)
    const touchesDuration = ['duration_type', 'duration_days', 'start_date'].some(
      (k) => k in input,
    );
    if (touchesDuration && m.duration_type === 'days' && m.duration_days) {
      out.end_date = addDays(String(m.start_date), Number(m.duration_days) - 1);
    } else if ('duration_type' in input && m.duration_type === 'forever') {
      out.end_date = null;
      out.duration_days = null;
    }
    return out;
  }

  create(input: HabitInput & { name: string }): string {
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      const last = this.db.all<{ sort_key: string }>(
        'SELECT sort_key FROM habits ORDER BY sort_key DESC LIMIT 1',
      )[0]?.sort_key;
      const sortKey = generateKeyBetween(last ?? null, null);
      const start = input.start_date ?? this.today();
      const fields = this.normalise({ ...input, start_date: start }, {});
      const row = {
        uuid,
        category_uuid: null,
        preset_key: null,
        icon: '⭐',
        color: '#7C5CFF',
        motivation: null,
        kind: 'build',
        goal_type: 'completion',
        target_amount: 1,
        step_amount: 1,
        unit: '',
        frequency_type: 'daily',
        weekdays: '1111111',
        times_per_week: 7,
        times_per_month: 30,
        interval_days: 1,
        day_part: 'any',
        duration_type: 'forever',
        duration_days: null,
        end_date: null,
        planner_minutes: null,
        is_archived: 0,
        archived_at: null,
        sort_key: sortKey,
        created_at: now,
        updated_at: now,
        ...fields,
      } as WireRow;
      upsertRow(this.db, 'habits', row);
      enqueue(
        this.db,
        {
          table: 'habits',
          uuid,
          op: 'upsert',
          patch: { ...toWire(fields), sort_key: sortKey },
          isCreate: true,
        },
        now,
      );
    });
    return uuid;
  }

  update(uuid: string, patch: HabitInput & { sort_key?: string }): void {
    this.db.transaction(() => {
      const h = this.get(uuid);
      if (!h) return;
      const { sort_key, ...rest } = patch;
      const fields: Record<string, WireValue> = {
        ...this.normalise(rest, h),
        ...(sort_key ? { sort_key } : {}),
      };
      if (!Object.keys(fields).length) return;
      const now = this.clock();
      if (fields.is_archived !== undefined) {
        this.db.run('UPDATE habits SET archived_at = ? WHERE uuid = ?', [
          fields.is_archived ? now : null,
          uuid,
        ]);
      }
      patchRow(this.db, 'habits', uuid, fields);
      enqueue(this.db, { table: 'habits', uuid, op: 'upsert', patch: toWire(fields) }, now);
    });
  }

  archive(uuid: string, archived = true): void {
    this.update(uuid, { is_archived: archived });
  }

  move(uuid: string, before: string | null, after: string | null): void {
    const a = before ? (this.get(before)?.sort_key ?? null) : null;
    const b = after ? (this.get(after)?.sort_key ?? null) : null;
    this.update(uuid, { sort_key: generateKeyBetween(a, b) });
  }

  /** Cancella l'abitudine e (come il server, a cascata) i suoi check-in. */
  remove(uuid: string): void {
    this.db.transaction(() => {
      this.db.run('DELETE FROM habit_logs WHERE habit_uuid = ?', [uuid]);
      deleteRow(this.db, 'habits', uuid);
      enqueue(this.db, { table: 'habits', uuid, op: 'delete' }, this.clock());
    });
  }

  /* ---------------- check-in ---------------- */

  log(habitUuid: string, day: string): HabitLog | null {
    return (
      this.db.all<HabitLog>('SELECT * FROM habit_logs WHERE habit_uuid = ? AND log_date = ?', [
        habitUuid,
        day,
      ])[0] ?? null
    );
  }

  /** Tutti i check-in fra due giorni (estremi inclusi). */
  logsBetween(from: string, to: string): HabitLog[] {
    return this.db.all<HabitLog>('SELECT * FROM habit_logs WHERE log_date BETWEEN ? AND ?', [
      from,
      to,
    ]);
  }

  /** Tutti i check-in di un'abitudine, per giorno (le statistiche della scheda di dettaglio). */
  logsOf(habitUuid: string): HabitLog[] {
    return this.db.all<HabitLog>(
      'SELECT * FROM habit_logs WHERE habit_uuid = ? ORDER BY log_date',
      [habitUuid],
    );
  }

  /** Stato per giorno di un'abitudine (serve alla serie). */
  statusByDate(habitUuid: string): Record<string, LogStatus> {
    const out: Record<string, LogStatus> = {};
    for (const r of this.db.all<{ log_date: string; status: LogStatus }>(
      'SELECT log_date, status FROM habit_logs WHERE habit_uuid = ?',
      [habitUuid],
    ))
      out[r.log_date] = r.status;
    return out;
  }

  /**
   * Un gesto dell'utente su un giorno (tocco, scorrimento, «+», «salta»…). Il telefono calcola subito
   * il nuovo stato con le regole del sito; al server arriva lo STATO del giorno (quantità e stato),
   * non il gesto: così due telefoni non si sommano e rimandare è innocuo.
   */
  checkIn(habitUuid: string, day: string, mode: CheckInMode, value = 0): HabitLog | null {
    if (day > this.today()) throw new Error('future_day');
    return this.db.transaction(() => {
      const h = this.get(habitUuid);
      if (!h) return null;
      const cur = this.log(habitUuid, day);
      const next = applyCheckIn(h, cur, mode, value, !!cur?.note || cur?.mood != null);
      const uuid = checkInUuid(habitUuid, day);
      const now = this.clock();
      if (next.removed) {
        if (cur) {
          deleteRow(this.db, 'habit_logs', cur.uuid);
          enqueue(this.db, { table: 'habit_logs', uuid: cur.uuid, op: 'delete' }, now);
        }
        return null;
      }
      const patch: Record<string, WireValue> = { status: next.status, amount: next.amount };
      if (!cur) Object.assign(patch, { habit_uuid: habitUuid, log_date: day });
      upsertRow(this.db, 'habit_logs', {
        uuid,
        habit_uuid: habitUuid,
        log_date: day,
        status: next.status,
        amount: next.amount,
        completions: next.completions,
        target_amount: h.target_amount,
        note: cur?.note ?? null,
        mood: cur?.mood ?? null,
        first_logged_at: cur
          ? (this.db.all<{ f: string | null }>(
              'SELECT first_logged_at AS f FROM habit_logs WHERE uuid = ?',
              [uuid],
            )[0]?.f ?? now)
          : now,
        updated_at: now,
      });
      enqueue(this.db, { table: 'habit_logs', uuid, op: 'upsert', patch, isCreate: !cur }, now);
      return this.log(habitUuid, day);
    });
  }

  /** Nota e/o umore di un giorno (null = toglie). Una chiave non nominata resta com'era. */
  setNote(habitUuid: string, day: string, p: { note?: string | null; mood?: number | null }): void {
    if (day > this.today()) throw new Error('future_day');
    this.db.transaction(() => {
      if (!this.get(habitUuid)) return;
      const cur = this.log(habitUuid, day);
      const note = 'note' in p ? (p.note ?? '').slice(0, 500) : (cur?.note ?? '');
      const mood = 'mood' in p ? (p.mood ?? null) : (cur?.mood ?? null);
      const uuid = checkInUuid(habitUuid, day);
      const now = this.clock();
      const empty =
        (cur ? cur.amount : 0) <= 0 &&
        (cur ? cur.status : 'partial') === 'partial' &&
        note === '' &&
        mood === null;
      if (empty) {
        if (cur) {
          deleteRow(this.db, 'habit_logs', cur.uuid);
          enqueue(this.db, { table: 'habit_logs', uuid: cur.uuid, op: 'delete' }, now);
        }
        return;
      }
      if (cur) patchRow(this.db, 'habit_logs', uuid, { note: note || null, mood });
      else {
        upsertRow(this.db, 'habit_logs', {
          uuid,
          habit_uuid: habitUuid,
          log_date: day,
          status: 'partial',
          amount: 0,
          completions: 0,
          target_amount: 1,
          note: note || null,
          mood,
          first_logged_at: now,
          updated_at: now,
        });
      }
      const patch: Record<string, WireValue> = {};
      if ('note' in p) patch.note = note || null;
      if ('mood' in p) patch.mood = mood;
      if (!cur)
        Object.assign(patch, {
          habit_uuid: habitUuid,
          log_date: day,
          status: 'partial',
          amount: 0,
        });
      enqueue(this.db, { table: 'habit_logs', uuid, op: 'upsert', patch, isCreate: !cur }, now);
    });
  }
}
