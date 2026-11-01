import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { SqlDb, SqlValue } from './sqldb';

/**
 * Il database vero del telefono: expo-sqlite (SQLCipher) dietro l'interfaccia SqlDb.
 *
 * PERCHÉ la chiave sta in SecureStore: il file del database è cifrato (SQLCipher, AES-256);
 * la chiave è casuale, nasce al primo avvio e vive nel Keychain (iOS) / Keystore (Android),
 * cioè fuori dal file. Chi copia il file senza il telefono sbloccato non legge nulla.
 * Non dipende da una password dell'utente: così non si perde il database se la cambia.
 */
const KEY_NAME = 'standout.db.key.v1';
const DB_NAME = 'standout.db';

async function loadOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, hex, {
    // Solo dopo il primo sblocco e solo su questo telefono (non finisce nei backup in chiaro).
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return hex;
}

export class DbNotEncryptedError extends Error {
  constructor() {
    super('SQLCipher non attivo: il database NON sarebbe cifrato');
  }
}

/** Adatta un database expo-sqlite all'interfaccia SqlDb (tutta sincrona: il motore di sync non aspetta). */
export function wrapExpoDb(raw: SQLite.SQLiteDatabase): SqlDb {
  let depth = 0;
  return {
    exec(sql) {
      raw.execSync(sql);
    },
    run(sql, params: SqlValue[] = []) {
      const r = raw.runSync(sql, params);
      return { changes: r.changes };
    },
    all<T>(sql: string, params: SqlValue[] = []) {
      return raw.getAllSync(sql, params) as T[];
    },
    transaction<T>(fn: () => T): T {
      // Transazioni annidate = punti di salvataggio, così un `transaction` dentro un altro non rompe.
      const name = `sp${depth}`;
      raw.execSync(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${name}`);
      depth++;
      try {
        const out = fn();
        depth--;
        raw.execSync(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
        return out;
      } catch (e) {
        depth--;
        raw.execSync(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
        throw e;
      }
    },
  };
}

/**
 * Apre (o crea) il database cifrato. Se SQLCipher non c'è (Expo Go, build sbagliata) si ferma:
 * senza questo controllo `PRAGMA key` non darebbe errore e i dati finirebbero in chiaro.
 */
export async function openEncryptedDb(): Promise<{ db: SqlDb; close: () => void }> {
  const key = await loadOrCreateKey();
  const raw = await SQLite.openDatabaseAsync(DB_NAME);
  // La chiave è esadecimale (solo 0-9a-f): nessun carattere da proteggere nel PRAGMA.
  raw.execSync(`PRAGMA key = "x'${key}'"`);
  const v = raw.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!v || !v.cipher_version) {
    raw.closeSync();
    throw new DbNotEncryptedError();
  }
  raw.execSync('PRAGMA journal_mode = WAL');
  raw.execSync('PRAGMA foreign_keys = ON');
  return { db: wrapExpoDb(raw), close: () => raw.closeSync() };
}

/** Per il logout con cancellazione: chiude e rimuove il file e la chiave. */
export async function destroyDatabase(): Promise<void> {
  await SQLite.deleteDatabaseAsync(DB_NAME);
  await SecureStore.deleteItemAsync(KEY_NAME);
}
