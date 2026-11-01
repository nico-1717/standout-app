import Database from 'better-sqlite3';

import { migrate } from '../migrations';
import type { SqlDb, SqlValue } from '../sqldb';

/** Un SqlDb vero in memoria (better-sqlite3): stesso SQLite del telefono, senza telefono. */
export function memoryDb(): SqlDb {
  const d = new Database(':memory:');
  const db: SqlDb = {
    exec: (sql) => void d.exec(sql),
    run: (sql, params: SqlValue[] = []) => ({ changes: d.prepare(sql).run(...params).changes }),
    all: <T>(sql: string, params: SqlValue[] = []) => d.prepare(sql).all(...params) as T[],
    transaction: <T>(fn: () => T) => {
      // transazioni annidate (una operazione dentro un'altra): la più esterna comanda
      if (d.inTransaction) return fn();
      return d.transaction(fn)();
    },
  };
  migrate(db);
  return db;
}
