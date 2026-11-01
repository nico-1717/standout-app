import type { SqlDb } from './sqldb';

/**
 * Migrazioni del database sul telefono: versionate (PRAGMA user_version), ognuna dentro una
 * transazione. REGOLE: non si modifica mai una migrazione già uscita (se ne aggiunge una nuova);
 * nessuna migrazione tocca `outbox` in modo da perdere modifiche non ancora inviate.
 * Le colonne riflettono il manifest del server (docs/ARCHITETTURA_APP.md §3.6); un test controlla
 * che lo schema Drizzle (src/core/db/schema.ts) e queste tabelle abbiano le stesse colonne.
 */
export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE todo_buy_categories (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_cat_sort ON todo_buy_categories (sort_key);

CREATE TABLE todos (
  uuid TEXT PRIMARY KEY NOT NULL,
  list_type TEXT NOT NULL DEFAULT 'todo',
  parent_uuid TEXT,
  buy_category_uuid TEXT,
  buy_priority INTEGER NOT NULL DEFAULT 3,
  buy_price_cents INTEGER,
  buy_url TEXT,
  buy_image TEXT,
  title TEXT NOT NULL,
  is_done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  due_date TEXT,
  due_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  sort_key TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_todos_lista ON todos (list_type, is_done, sort_key);
CREATE INDEX idx_todos_padre ON todos (parent_uuid);
CREATE INDEX idx_todos_data ON todos (due_date);
CREATE INDEX idx_todos_cat ON todos (buy_category_uuid);

-- le modifiche fatte sul telefono e non ancora arrivate al server, in ordine di creazione
CREATE TABLE outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_id TEXT NOT NULL UNIQUE,
  tbl TEXT NOT NULL,
  uuid TEXT NOT NULL,
  op TEXT NOT NULL,                 -- upsert | delete
  is_create INTEGER NOT NULL DEFAULT 0, -- 1 = la riga non esiste ancora sul server (nasce con questa modifica)
  patch TEXT NOT NULL DEFAULT '{}', -- JSON: solo i campi cambiati
  state TEXT NOT NULL DEFAULT 'pending', -- pending | sending
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_outbox_riga ON outbox (tbl, uuid);

-- durante la copia completa: le righe già viste, per togliere alla fine quelle che il server non ha più
CREATE TABLE snapshot_seen (
  tbl TEXT NOT NULL,
  uuid TEXT NOT NULL,
  PRIMARY KEY (tbl, uuid)
);

-- cursore e date dell'ultima sincronizzazione
CREATE TABLE sync_state (
  k TEXT PRIMARY KEY NOT NULL,
  v TEXT NOT NULL
);

-- modifiche che il server non ha accettato (o che hanno perso contro una cancellazione): l'utente le vede e decide
CREATE TABLE sync_problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl TEXT NOT NULL,
  uuid TEXT NOT NULL,
  code TEXT NOT NULL,
  field TEXT,
  message TEXT,
  patch TEXT NOT NULL DEFAULT '{}',
  op TEXT NOT NULL DEFAULT 'upsert',
  created_at TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0
);
`,
  },
];

export function currentVersion(db: SqlDb): number {
  return Number(db.all<{ user_version: number }>('PRAGMA user_version')[0]?.user_version ?? 0);
}

/** Porta il database all'ultima versione. Ogni passo è una transazione: o tutto o niente. */
export function migrate(db: SqlDb, migrations: Migration[] = MIGRATIONS): number {
  let v = currentVersion(db);
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= v) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
    });
    v = m.version;
  }
  return v;
}
