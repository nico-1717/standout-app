/**
 * L'interfaccia minima di un database SQLite SINCRONO.
 * Nell'app la implementa expo-sqlite (src/core/db/expoDb.ts); nei test, better-sqlite3.
 * Il motore di sincronizzazione parla solo con questa interfaccia: così gira uguale sul
 * telefono e in Node, e si prova senza telefono.
 */
export type SqlValue = string | number | null;

export interface SqlDb {
  /** Più istruzioni senza parametri (migrazioni). */
  exec(sql: string): void;
  /** Una scrittura. Ritorna quante righe ha toccato. */
  run(sql: string, params?: SqlValue[]): { changes: number };
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[];
  /** Tutto o niente: se `fn` lancia, si annulla tutto. */
  transaction<T>(fn: () => T): T;
}

export function one<T = Record<string, SqlValue>>(
  db: SqlDb,
  sql: string,
  params: SqlValue[] = [],
): T | null {
  return db.all<T>(sql, params)[0] ?? null;
}
