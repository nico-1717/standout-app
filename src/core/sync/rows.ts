import type { SqlDb, SqlValue } from '../db/sqldb';
import { MANIFEST, type SyncTable } from './manifest';
import type { WireRow, WireValue } from './types';

/** Dal valore sul filo alla colonna locale (i booleani sono 0/1). */
export function toColumn(table: SyncTable, field: string, v: WireValue): SqlValue {
  if (MANIFEST[table].booleans.includes(field)) return v ? 1 : 0;
  return v === undefined ? null : (v as SqlValue);
}

/** Salva una riga arrivata dal server (sostituisce quella che c'era). */
export function upsertRow(db: SqlDb, table: SyncTable, row: WireRow): void {
  const cols = MANIFEST[table].columns;
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  db.run(
    sql,
    cols.map((c) => toColumn(table, c, (row[c] ?? null) as WireValue)),
  );
}

/** Cambia solo i campi nominati di una riga che c'è già. Ritorna se la riga esisteva. */
export function patchRow(
  db: SqlDb,
  table: SyncTable,
  uuid: string,
  patch: Record<string, WireValue>,
): boolean {
  const cols = MANIFEST[table].columns;
  const keys = Object.keys(patch).filter((k) => cols.includes(k) && k !== 'uuid');
  if (!keys.length) return db.all(`SELECT 1 FROM ${table} WHERE uuid = ?`, [uuid]).length > 0;
  const r = db.run(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE uuid = ?`, [
    ...keys.map((k) => toColumn(table, k, patch[k])),
    uuid,
  ]);
  return r.changes > 0;
}

export function deleteRow(db: SqlDb, table: SyncTable, uuid: string): void {
  db.run(`DELETE FROM ${table} WHERE uuid = ?`, [uuid]);
}

export function rowExists(db: SqlDb, table: SyncTable, uuid: string): boolean {
  return db.all(`SELECT 1 FROM ${table} WHERE uuid = ?`, [uuid]).length > 0;
}
