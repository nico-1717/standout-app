/**
 * Copia (a mano, per ora) del manifest del server: lib/sync_manifest.php.
 * Sul filo i campi hanno lo STESSO nome delle colonne locali. Quando le tabelle saranno
 * tante, `npm run sync:manifest` la genererà da GET /sync/schema e la CI confronterà.
 */
export type SyncTable =
  'todo_buy_categories' | 'todos' | 'habit_categories' | 'habits' | 'habit_logs';

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
};

export const TABLES = Object.keys(MANIFEST) as SyncTable[];

export function isSyncTable(t: string): t is SyncTable {
  return Object.prototype.hasOwnProperty.call(MANIFEST, t);
}
