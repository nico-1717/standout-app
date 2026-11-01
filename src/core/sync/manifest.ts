/**
 * Copia (a mano, per ora) del manifest del server: lib/sync_manifest.php.
 * Sul filo i campi hanno lo STESSO nome delle colonne locali. Quando le tabelle saranno
 * tante, `npm run sync:manifest` la genererà da GET /sync/schema e la CI confronterà.
 */
export type SyncTable = 'todo_buy_categories' | 'todos';

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
};

export const TABLES = Object.keys(MANIFEST) as SyncTable[];

export function isSyncTable(t: string): t is SyncTable {
  return Object.prototype.hasOwnProperty.call(MANIFEST, t);
}
