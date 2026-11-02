import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireRow, WireValue } from '@/core/sync/types';

import { eventsInRange, type EventRow, type EventView } from './events';
import { inputOf, normalise, type Context, type EventInput } from './model';

export interface Calendar {
  uuid: string;
  name: string;
  color: string | null;
  is_visible: number;
  is_default: number;
  role: string | null;
  keywords: string;
  def_repeat: string;
  def_notify: string;
  sort_key: string;
}

export interface Category {
  uuid: string;
  name: string;
  color: string;
  is_hidden: number;
  role: string | null;
  sort_key: string;
}

export interface Keyword {
  uuid: string;
  category_uuid: string;
  keyword: string;
}

/** Le colonne di un evento che si scrivono (le altre le decide il server). */
const WRITABLE = [
  'title',
  'notes',
  'location',
  'place_name',
  'place_lat',
  'place_lon',
  'place_ref',
  'duration_locked',
  'event_date',
  'end_date',
  'start_time',
  'end_time',
  'is_all_day',
  'category_uuid',
  'calendar_uuid',
  'importance',
  'color',
  'item_type',
  'notify_type',
  'notify_minutes',
  'repeat_type',
  'repeat_interval',
  'repeat_unit',
  'repeat_until',
] as const;
const BOOLEAN = new Set(['duration_locked', 'is_all_day', 'is_completed', 'is_cancelled']);

const wire = (field: string, v: unknown): WireValue =>
  BOOLEAN.has(field) ? v === 1 || v === true : (v as WireValue);

export type EditMode = 'one' | 'all';
export type DeleteScope = 'one' | 'series';

/**
 * Il planner sul telefono. Ogni modifica si scrive subito in locale e si mette in coda per il server, che
 * rifà lo stesso lavoro del sito (lib/sync_planner.php) e rimanda la riga com'è. Le serie sono un capostipite
 * con una regola; «solo questa volta» e «questa volta no» sono righe a parte (eccezioni).
 */
export class PlannerRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
    private readonly untitled: () => string = () => 'Untitled',
  ) {}

  /* ---------------- lettura ---------------- */

  calendars(): Calendar[] {
    return this.db.all<Calendar>('SELECT * FROM planner_calendars ORDER BY sort_key, uuid');
  }
  categories(): Category[] {
    return this.db.all<Category>('SELECT * FROM planner_categories ORDER BY sort_key, uuid');
  }
  keywords(): Keyword[] {
    return this.db.all<Keyword>(
      'SELECT uuid, category_uuid, keyword FROM planner_category_keywords',
    );
  }
  rows(): EventRow[] {
    return this.db.all<EventRow>('SELECT * FROM planner_events');
  }
  row(uuid: string): EventRow | null {
    return this.db.all<EventRow>('SELECT * FROM planner_events WHERE uuid = ?', [uuid])[0] ?? null;
  }

  /** Cosa si vede nel periodo, come lo calcola il sito. */
  eventsInRange(from: string, to: string): EventView[] {
    return eventsInRange(this.rows(), from, to);
  }

  /**
   * Come eventsInRange, ma senza gli eventi dei calendari spenti e delle categorie nascoste
   * (i filtri rapidi del planner). Un evento senza calendario o categoria si vede sempre.
   */
  visibleEventsInRange(from: string, to: string): EventView[] {
    const off = new Set(
      this.calendars()
        .filter((c) => !c.is_visible)
        .map((c) => c.uuid),
    );
    const hidden = new Set(
      this.categories()
        .filter((c) => c.is_hidden)
        .map((c) => c.uuid),
    );
    return this.eventsInRange(from, to).filter(
      (e) =>
        !(e.calendarUuid && off.has(e.calendarUuid)) &&
        !(e.categoryUuid && hidden.has(e.categoryUuid)),
    );
  }

  private context(): Context {
    const cals = this.calendars();
    const def = cals.find((c) => c.is_default)?.uuid ?? null;
    const keywords = this.keywords().sort((a, b) => b.keyword.length - a.keyword.length);
    return {
      defaultCalendar: def,
      untitled: this.untitled(),
      autoCategory: (title) => {
        const t = title.toLowerCase();
        return (
          keywords.find((k) => k.keyword !== '' && t.includes(k.keyword))?.category_uuid ?? null
        );
      },
      autoCalendar: (title) => {
        const t = title.toLowerCase();
        for (const c of cals) {
          for (const raw of c.keywords.split(',')) {
            const kw = raw.trim().toLowerCase();
            if (kw !== '' && t.includes(kw)) {
              return { uuid: c.uuid, defRepeat: c.def_repeat, defNotify: c.def_notify };
            }
          }
        }
        return null;
      },
    };
  }

  /* ---------------- eventi ---------------- */

  private writeNew(row: EventRow, patch: Record<string, WireValue>): void {
    const now = this.clock();
    upsertRow(this.db, 'planner_events', {
      ...row,
      created_at: now,
      updated_at: now,
    } as unknown as WireRow);
    enqueue(
      this.db,
      { table: 'planner_events', uuid: row.uuid, op: 'upsert', patch, isCreate: true },
      now,
    );
  }

  private blank(uuid: string, date: string): EventRow {
    return {
      uuid,
      title: '',
      notes: '',
      location: '',
      place_name: null,
      place_lat: null,
      place_lon: null,
      place_ref: null,
      duration_locked: 1,
      event_date: date,
      end_date: null,
      start_time: '09:00',
      end_time: '10:00',
      is_all_day: 0,
      category_uuid: null,
      calendar_uuid: null,
      habit_uuid: null,
      importance: 'normal',
      color: null,
      item_type: 'event',
      is_completed: 0,
      notify_type: 'h1',
      notify_minutes: 60,
      repeat_type: 'none',
      repeat_interval: 1,
      repeat_unit: 'week',
      repeat_until: null,
      rrule: null,
      series_uuid: null,
      original_date: null,
      is_cancelled: 0,
      routine_group: null,
      sort_order: 0,
    };
  }

  /** Un evento nuovo (o una serie, se si ripete). Ritorna l'uuid. */
  create(input: EventInput): string {
    const uuid = this.newId();
    this.db.transaction(() => {
      const norm = normalise(
        input,
        this.context(),
        new Set(Object.keys(input) as (keyof EventInput)[]),
        true,
      );
      const row: EventRow = { ...this.blank(uuid, norm.event_date), ...norm };
      if (row.rrule) row.series_uuid = uuid;
      const patch: Record<string, WireValue> = {};
      for (const f of WRITABLE) patch[f] = wire(f, row[f]);
      this.writeNew(row, patch);
    });
    return uuid;
  }

  /**
   * Cambia un evento. `view` è quello che si vede: una ripetizione di una serie si cambia «solo questa volta»
   * (nasce un'eccezione) o «tutta la serie» (cambia il capostipite).
   */
  update(view: EventView, changes: Partial<EventInput>, mode: EditMode = 'all'): string {
    return this.db.transaction(() => {
      const now = this.clock();
      if (view.isOccurrence && mode === 'one') {
        const master = this.row(view.masterUuid);
        if (!master) return view.uuid;
        // l'eccezione parte dal capostipite, con la data di quella volta, e non si ripete
        const base: EventInput = {
          ...inputOf(master),
          date: view.date,
          endDate: view.multiday ? view.endDate : null,
          repeat: 'none',
          repeatUntil: null,
          ...changes,
        };
        const norm = normalise(base, this.context(), new Set(), false);
        const uuid = this.newId();
        const row: EventRow = {
          ...this.blank(uuid, norm.event_date),
          ...norm,
          repeat_type: 'none',
          rrule: null,
          series_uuid: master.uuid,
          original_date: view.occDate,
        };
        const patch: Record<string, WireValue> = {
          series_uuid: master.uuid,
          original_date: view.occDate,
        };
        for (const f of WRITABLE) patch[f] = wire(f, row[f]);
        this.writeNew(row, patch);
        return uuid;
      }
      const target = this.row(view.isOccurrence ? view.masterUuid : view.uuid);
      if (!target) return view.uuid;
      const merged: EventInput = { ...inputOf(target), ...changes };
      const norm = normalise(
        merged,
        this.context(),
        new Set(Object.keys(changes) as (keyof EventInput)[]),
        false,
      );
      const patch: Record<string, WireValue> = {};
      const set: Record<string, WireValue> = { updated_at: now };
      for (const f of [...WRITABLE, 'rrule'] as const) {
        const next = norm[f];
        if (next !== target[f]) {
          set[f] = wire(f, next);
          if (f !== 'rrule') patch[f] = wire(f, next);
        }
      }
      if (Object.keys(patch).length) {
        patchRow(this.db, 'planner_events', target.uuid, set);
        enqueue(this.db, { table: 'planner_events', uuid: target.uuid, op: 'upsert', patch }, now);
      }
      return target.uuid;
    });
  }

  /** Spunta o toglie la spunta. Una ripetizione si spunta da sola (nasce un'eccezione), non tutta la serie. */
  toggleDone(view: EventView): void {
    const next = !view.done;
    if (view.isOccurrence) {
      this.db.transaction(() => {
        const uuid = this.update(view, {}, 'one');
        const now = this.clock();
        patchRow(this.db, 'planner_events', uuid, { is_completed: next ? 1 : 0, updated_at: now });
        enqueue(
          this.db,
          { table: 'planner_events', uuid, op: 'upsert', patch: { is_completed: next } },
          now,
        );
      });
      return;
    }
    const now = this.clock();
    this.db.transaction(() => {
      patchRow(this.db, 'planner_events', view.uuid, {
        is_completed: next ? 1 : 0,
        updated_at: now,
      });
      enqueue(
        this.db,
        { table: 'planner_events', uuid: view.uuid, op: 'upsert', patch: { is_completed: next } },
        now,
      );
    });
  }

  /** Toglie un evento. `one` = solo questa volta (per una serie la volta resta tolta), `series` = tutta la serie. */
  remove(view: EventView, scope: DeleteScope = 'one'): void {
    this.db.transaction(() => {
      const now = this.clock();
      const master = view.isOccurrence
        ? view.masterUuid
        : view.seriesUuid === view.uuid
          ? view.uuid
          : null;
      if (scope === 'series' && (master || view.isException)) {
        const head = master ?? view.seriesUuid!;
        this.db.run('DELETE FROM planner_events WHERE series_uuid = ? OR uuid = ?', [head, head]);
        enqueue(this.db, { table: 'planner_events', uuid: head, op: 'delete' }, now);
        return;
      }
      if (view.isOccurrence) {
        // «questa volta no»: una riga che lo dice
        const uuid = this.newId();
        const row: EventRow = {
          ...this.blank(uuid, view.occDate),
          title: 'Cancellato',
          start_time: '00:00',
          end_time: '00:00',
          series_uuid: view.masterUuid,
          original_date: view.occDate,
          is_cancelled: 1,
        };
        this.writeNew(row, {
          series_uuid: view.masterUuid,
          original_date: view.occDate,
          is_cancelled: true,
        });
        return;
      }
      if (view.isException) {
        patchRow(this.db, 'planner_events', view.uuid, { is_cancelled: 1, updated_at: now });
        enqueue(
          this.db,
          { table: 'planner_events', uuid: view.uuid, op: 'upsert', patch: { is_cancelled: true } },
          now,
        );
        return;
      }
      deleteRow(this.db, 'planner_events', view.uuid);
      enqueue(this.db, { table: 'planner_events', uuid: view.uuid, op: 'delete' }, now);
    });
  }

  /* ---------------- calendari, categorie, parole ---------------- */

  private lastKey(table: 'planner_calendars' | 'planner_categories'): string | null {
    return (
      this.db.all<{ sort_key: string }>(
        `SELECT sort_key FROM ${table} ORDER BY sort_key DESC LIMIT 1`,
      )[0]?.sort_key ?? null
    );
  }

  addCalendar(name: string, color: string | null): string {
    const uuid = this.newId();
    this.db.transaction(() => {
      const key = generateKeyBetween(this.lastKey('planner_calendars'), null);
      const now = this.clock();
      upsertRow(this.db, 'planner_calendars', {
        uuid,
        name,
        color,
        is_visible: 1,
        is_default: 0,
        role: null,
        keywords: '',
        def_repeat: 'none',
        def_notify: 'none',
        sort_key: key,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'planner_calendars',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { name, color, sort_key: key },
        },
        now,
      );
    });
    return uuid;
  }

  updateCalendar(
    uuid: string,
    c: Partial<Pick<Calendar, 'name' | 'color' | 'keywords' | 'def_repeat' | 'def_notify'>> & {
      is_visible?: boolean;
    },
  ): void {
    this.db.transaction(() => {
      const now = this.clock();
      const patch: Record<string, WireValue> = {};
      const set: Record<string, WireValue> = { updated_at: now };
      for (const [k, v] of Object.entries(c)) {
        if (v === undefined) continue;
        patch[k] = v as WireValue;
        set[k] = k === 'is_visible' ? (v ? 1 : 0) : (v as WireValue);
      }
      patchRow(this.db, 'planner_calendars', uuid, set);
      enqueue(this.db, { table: 'planner_calendars', uuid, op: 'upsert', patch }, now);
    });
  }

  removeCalendar(uuid: string): boolean {
    const cal = this.calendars().find((c) => c.uuid === uuid);
    if (!cal || cal.is_default) return false;
    const def = this.calendars().find((c) => c.is_default)?.uuid ?? null;
    this.db.transaction(() => {
      // i suoi eventi non si perdono: passano al principale (il server fa lo stesso)
      this.db.run('UPDATE planner_events SET calendar_uuid = ? WHERE calendar_uuid = ?', [
        def,
        uuid,
      ]);
      deleteRow(this.db, 'planner_calendars', uuid);
      enqueue(this.db, { table: 'planner_calendars', uuid, op: 'delete' }, this.clock());
    });
    return true;
  }

  /** «Mostra solo questo» (uuid) oppure «mostra tutti» (null). */
  showOnly(uuid: string | null): void {
    this.db.transaction(() => {
      for (const c of this.calendars()) {
        const want = uuid === null || c.uuid === uuid;
        if (!!c.is_visible !== want) this.updateCalendar(c.uuid, { is_visible: want });
      }
    });
  }

  addCategory(name: string, color: string): string {
    const uuid = this.newId();
    this.db.transaction(() => {
      const key = generateKeyBetween(this.lastKey('planner_categories'), null);
      const now = this.clock();
      upsertRow(this.db, 'planner_categories', {
        uuid,
        name,
        color,
        is_hidden: 0,
        role: null,
        sort_key: key,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'planner_categories',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { name, color, sort_key: key },
        },
        now,
      );
    });
    return uuid;
  }

  updateCategory(uuid: string, c: { name?: string; color?: string; is_hidden?: boolean }): void {
    this.db.transaction(() => {
      const now = this.clock();
      const patch: Record<string, WireValue> = {};
      const set: Record<string, WireValue> = { updated_at: now };
      for (const [k, v] of Object.entries(c)) {
        if (v === undefined) continue;
        patch[k] = v as WireValue;
        set[k] = k === 'is_hidden' ? (v ? 1 : 0) : (v as WireValue);
      }
      patchRow(this.db, 'planner_categories', uuid, set);
      enqueue(this.db, { table: 'planner_categories', uuid, op: 'upsert', patch }, now);
    });
  }

  removeCategory(uuid: string): void {
    this.db.transaction(() => {
      this.db.run('UPDATE planner_events SET category_uuid = NULL WHERE category_uuid = ?', [uuid]);
      this.db.run('DELETE FROM planner_category_keywords WHERE category_uuid = ?', [uuid]);
      deleteRow(this.db, 'planner_categories', uuid);
      enqueue(this.db, { table: 'planner_categories', uuid, op: 'delete' }, this.clock());
    });
  }

  /** Aggiunge una parola a una categoria. Ritorna false se è già di un'altra (una parola è di una sola). */
  addKeyword(categoryUuid: string, word: string): boolean {
    const keyword = word.trim().toLowerCase().slice(0, 60);
    if (keyword === '') return false;
    if (this.keywords().some((k) => k.keyword === keyword)) return false;
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'planner_category_keywords', {
        uuid,
        category_uuid: categoryUuid,
        keyword,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'planner_category_keywords',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { category_uuid: categoryUuid, keyword },
        },
        now,
      );
    });
    return true;
  }

  removeKeyword(uuid: string): void {
    this.db.transaction(() => {
      deleteRow(this.db, 'planner_category_keywords', uuid);
      enqueue(this.db, { table: 'planner_category_keywords', uuid, op: 'delete' }, this.clock());
    });
  }
}
