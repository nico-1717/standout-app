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
  {
    version: 2,
    sql: `
-- categorie delle abitudini: quelle di sistema (is_system = 1, sola lettura) e le proprie
CREATE TABLE habit_categories (
  uuid TEXT PRIMARY KEY NOT NULL,
  slug TEXT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0A84FF',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE habits (
  uuid TEXT PRIMARY KEY NOT NULL,
  category_uuid TEXT,
  preset_key TEXT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '⭐',
  color TEXT NOT NULL DEFAULT '#7C5CFF',
  motivation TEXT,
  kind TEXT NOT NULL DEFAULT 'build',
  goal_type TEXT NOT NULL DEFAULT 'completion',
  target_amount REAL NOT NULL DEFAULT 1,
  step_amount REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '',
  frequency_type TEXT NOT NULL DEFAULT 'daily',
  weekdays TEXT NOT NULL DEFAULT '1111111',
  times_per_week INTEGER NOT NULL DEFAULT 7,
  times_per_month INTEGER NOT NULL DEFAULT 30,
  interval_days INTEGER NOT NULL DEFAULT 1,
  day_part TEXT NOT NULL DEFAULT 'any',
  duration_type TEXT NOT NULL DEFAULT 'forever',
  duration_days INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  planner_minutes INTEGER,
  is_archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  sort_key TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_habits_sort ON habits (is_archived, sort_key);
CREATE INDEX idx_habits_cat ON habits (category_uuid);

-- un check-in = una riga per (abitudine, giorno); l'uuid è un UUIDv5 di quella coppia (vedi uuid5.ts)
CREATE TABLE habit_logs (
  uuid TEXT PRIMARY KEY NOT NULL,
  habit_uuid TEXT NOT NULL,
  log_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'partial',
  amount REAL NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  target_amount REAL NOT NULL DEFAULT 1,
  note TEXT,
  mood INTEGER,
  first_logged_at TEXT,
  updated_at TEXT,
  UNIQUE (habit_uuid, log_date)
);
CREATE INDEX idx_hlogs_day ON habit_logs (log_date);
`,
  },
  {
    version: 3,
    sql: `
-- le terapie delle pastiglie: il ritmo (orari, giorni) è un testo, come sul sito; schedule_from lo decide il server
CREATE TABLE pill_plans (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  dose TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#B7A6D6',
  freq_type TEXT NOT NULL DEFAULT 'daily',
  weekdays TEXT NOT NULL DEFAULT '1111111',
  month_days TEXT NOT NULL DEFAULT '',
  interval_days INTEGER NOT NULL DEFAULT 1,
  times TEXT NOT NULL DEFAULT '08:00x1',
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  schedule_from TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- una presa = una riga per (terapia, giorno, orario, n.); l'uuid è un UUIDv5 di quella chiave (vedi uuid5.ts)
CREATE TABLE pill_doses (
  uuid TEXT PRIMARY KEY NOT NULL,
  plan_uuid TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  taken_at TEXT,
  updated_at TEXT,
  UNIQUE (plan_uuid, due_date, due_time, seq)
);
CREATE INDEX idx_pdoses_day ON pill_doses (due_date);
`,
  },
  {
    version: 4,
    sql: `
-- il diario: il giorno (umore, energia, testo) e le due liste («cose belle», «cose imparate»)
CREATE TABLE habit_daily_journal (
  uuid TEXT PRIMARY KEY NOT NULL,
  entry_date TEXT NOT NULL UNIQUE,
  mood INTEGER,
  energy INTEGER,
  note TEXT,
  note_rev TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE diary_list_items (
  uuid TEXT PRIMARY KEY NOT NULL,
  entry_date TEXT NOT NULL,
  list_type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_dlist_day ON diary_list_items (entry_date, list_type, sort_order);
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
