/**
 * Copia (a mano, per ora) del manifest del server: lib/sync_manifest.php.
 * Sul filo i campi hanno lo STESSO nome delle colonne locali. Quando le tabelle saranno
 * tante, `npm run sync:manifest` la genererà da GET /sync/schema e la CI confronterà.
 */
export type SyncTable =
  | 'todo_buy_categories'
  | 'todos'
  | 'habit_categories'
  | 'habits'
  | 'habit_logs'
  | 'pill_plans'
  | 'pill_doses'
  | 'habit_daily_journal'
  | 'diary_list_items'
  | 'planner_calendars'
  | 'planner_categories'
  | 'planner_category_keywords'
  | 'planner_priorities'
  | 'planner_routines'
  | 'planner_routine_items'
  | 'planner_events';

export interface TableDef {
  /** nell'ordine di dipendenza: il padre prima del figlio */
  order: number;
  /** colonne scritte dal server e mai dal telefono */
  readOnly: string[];
  /** campi scritti solo quando la riga nasce */
  createOnly: string[];
  /** campi booleani sul filo (colonne intere 0/1 in locale) */
  booleans: string[];
  columns: string[];
  /** righe figlie che il server cancella insieme a questa (chiave esterna a cascata): il telefono le toglie dalla vista */
  children?: { table: SyncTable; column: string }[];
}

export const MANIFEST: Record<SyncTable, TableDef> = {
  todo_buy_categories: {
    order: 10,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: [],
    columns: ['uuid', 'name', 'color', 'sort_key', 'created_at', 'updated_at'],
  },
  todos: {
    order: 20,
    readOnly: ['buy_image', 'done_at', 'created_at', 'updated_at'],
    createOnly: ['list_type', 'parent_uuid'],
    booleans: ['is_done'],
    columns: [
      'uuid',
      'list_type',
      'parent_uuid',
      'buy_category_uuid',
      'buy_priority',
      'buy_price_cents',
      'buy_url',
      'buy_image',
      'title',
      'is_done',
      'done_at',
      'due_date',
      'due_time',
      'duration_minutes',
      'sort_key',
      'created_at',
      'updated_at',
    ],
  },
  habit_categories: {
    order: 30,
    // di sistema (user_id 0 sul server) o proprie; il telefono scrive solo name, icon, color delle proprie
    readOnly: ['slug', 'sort_order', 'is_system', 'created_at', 'updated_at'],
    createOnly: [],
    booleans: ['is_system'],
    columns: [
      'uuid',
      'slug',
      'name',
      'icon',
      'color',
      'sort_order',
      'is_system',
      'created_at',
      'updated_at',
    ],
  },
  habits: {
    order: 40,
    readOnly: ['archived_at', 'created_at', 'updated_at'],
    createOnly: [],
    booleans: ['is_archived'],
    columns: [
      'uuid',
      'category_uuid',
      'preset_key',
      'name',
      'icon',
      'color',
      'motivation',
      'kind',
      'goal_type',
      'target_amount',
      'step_amount',
      'unit',
      'frequency_type',
      'weekdays',
      'times_per_week',
      'times_per_month',
      'interval_days',
      'day_part',
      'duration_type',
      'duration_days',
      'start_date',
      'end_date',
      'planner_minutes',
      'is_archived',
      'archived_at',
      'sort_key',
      'created_at',
      'updated_at',
    ],
    children: [{ table: 'habit_logs', column: 'habit_uuid' }],
  },
  habit_logs: {
    order: 50,
    // completions e target_amount li ricalcola il server; il telefono li calcola per mostrarli subito
    readOnly: ['completions', 'target_amount', 'first_logged_at', 'updated_at'],
    createOnly: ['habit_uuid', 'log_date'],
    booleans: [],
    columns: [
      'uuid',
      'habit_uuid',
      'log_date',
      'status',
      'amount',
      'completions',
      'target_amount',
      'note',
      'mood',
      'first_logged_at',
      'updated_at',
    ],
  },
  pill_plans: {
    order: 60,
    // il ritmo nuovo vale da quando lo decide il server (schedule_from); il telefono lo ricalcola per mostrarlo subito
    readOnly: ['schedule_from', 'created_at', 'updated_at'],
    createOnly: [],
    booleans: ['is_active'],
    columns: [
      'uuid',
      'name',
      'dose',
      'notes',
      'color',
      'freq_type',
      'weekdays',
      'month_days',
      'interval_days',
      'times',
      'start_date',
      'end_date',
      'is_active',
      'schedule_from',
      'created_at',
      'updated_at',
    ],
    children: [{ table: 'pill_doses', column: 'plan_uuid' }],
  },
  pill_doses: {
    order: 70,
    readOnly: ['updated_at'],
    createOnly: ['plan_uuid', 'due_date', 'due_time', 'seq'],
    booleans: [],
    columns: [
      'uuid',
      'plan_uuid',
      'due_date',
      'due_time',
      'seq',
      'status',
      'taken_at',
      'updated_at',
    ],
  },
  // il giorno del diario: una riga per (utente, giorno), uuid = UUIDv5 di quella chiave (vedi uuid5.ts › diaryDayUuid).
  // note_rev è l'impronta del testo sul server: viaggia con la modifica del testo (così il server vede se è cambiato nel frattempo).
  habit_daily_journal: {
    order: 80,
    readOnly: ['created_at', 'updated_at'],
    createOnly: ['entry_date'],
    booleans: [],
    columns: [
      'uuid',
      'entry_date',
      'mood',
      'energy',
      'note',
      'note_rev',
      'created_at',
      'updated_at',
    ],
  },
  diary_list_items: {
    order: 90,
    // l'ordine nell'elenco lo decide il server (sort_order); il telefono ne mette uno suo per mostrare subito la voce
    readOnly: ['sort_order', 'created_at', 'updated_at'],
    createOnly: ['entry_date', 'list_type'],
    booleans: [],
    columns: [
      'uuid',
      'entry_date',
      'list_type',
      'content',
      'sort_order',
      'created_at',
      'updated_at',
    ],
  },
  // ---- planner ----
  planner_calendars: {
    order: 100,
    // il «principale» e il ruolo li decide il server
    readOnly: ['is_default', 'role', 'created_at', 'updated_at'],
    createOnly: [],
    booleans: ['is_visible', 'is_default'],
    columns: [
      'uuid',
      'name',
      'color',
      'is_visible',
      'is_default',
      'role',
      'keywords',
      'def_repeat',
      'def_notify',
      'sort_key',
      'created_at',
      'updated_at',
    ],
  },
  planner_categories: {
    order: 110,
    readOnly: ['role', 'created_at', 'updated_at'],
    createOnly: [],
    booleans: ['is_hidden'],
    columns: ['uuid', 'name', 'color', 'is_hidden', 'role', 'sort_key', 'created_at', 'updated_at'],
    children: [{ table: 'planner_category_keywords', column: 'category_uuid' }],
  },
  planner_category_keywords: {
    order: 120,
    readOnly: ['created_at', 'updated_at'],
    createOnly: ['category_uuid', 'keyword'],
    booleans: [],
    columns: ['uuid', 'category_uuid', 'keyword', 'created_at', 'updated_at'],
  },
  // le priorità del giorno: una riga per (giorno, posto 1..6), identità UUIDv5 come un check-in
  planner_priorities: {
    order: 105,
    readOnly: ['created_at', 'updated_at'],
    createOnly: ['priority_date', 'position'],
    booleans: ['is_done'],
    columns: [
      'uuid',
      'priority_date',
      'position',
      'content',
      'is_done',
      'created_at',
      'updated_at',
    ],
  },
  planner_routines: {
    order: 106,
    readOnly: ['created_at'],
    createOnly: [],
    booleans: [],
    columns: ['uuid', 'name', 'color', 'sort_key', 'created_at'],
    children: [{ table: 'planner_routine_items', column: 'routine_uuid' }],
  },
  planner_routine_items: {
    order: 107,
    readOnly: [],
    createOnly: ['routine_uuid'],
    booleans: [],
    columns: ['uuid', 'routine_uuid', 'name', 'duration_minutes', 'sort_key'],
  },
  // gli eventi: la riga com'è sul sito. Una serie = un capostipite con `rrule` (la scrive il server dai campi repeat_*);
  // «solo questa volta» / «questa volta no» = una riga con series_uuid + original_date (+ is_cancelled). Le occorrenze
  // non sono righe: si calcolano in lettura (vedi features/planner/recurrence.ts ed events.ts).
  planner_events: {
    order: 130,
    readOnly: ['completed_at', 'rrule', 'sort_order', 'created_at', 'updated_at'],
    createOnly: ['habit_uuid', 'series_uuid', 'original_date', 'routine_uuid', 'routine_group'],
    booleans: [
      'duration_locked',
      'is_all_day',
      'is_completed',
      'is_cancelled',
      'routine_collapsed',
    ],
    columns: [
      'uuid',
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
      'habit_uuid',
      'importance',
      'color',
      'item_type',
      'is_completed',
      'completed_at',
      'notify_type',
      'notify_minutes',
      'repeat_type',
      'repeat_interval',
      'repeat_unit',
      'repeat_until',
      'rrule',
      'series_uuid',
      'original_date',
      'is_cancelled',
      'routine_uuid',
      'routine_group',
      'routine_collapsed',
      'sort_order',
      'created_at',
      'updated_at',
    ],
    children: [{ table: 'planner_events', column: 'series_uuid' }],
  },
};

export const TABLES = Object.keys(MANIFEST) as SyncTable[];

export function isSyncTable(t: string): t is SyncTable {
  return Object.prototype.hasOwnProperty.call(MANIFEST, t);
}
