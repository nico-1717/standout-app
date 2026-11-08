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
  {
    version: 5,
    sql: `
-- il planner: calendari, categorie (con le parole che le agganciano) ed eventi
CREATE TABLE planner_calendars (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  is_visible INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  keywords TEXT NOT NULL DEFAULT '',
  def_repeat TEXT NOT NULL DEFAULT 'none',
  def_notify TEXT NOT NULL DEFAULT 'none',
  sort_key TEXT NOT NULL DEFAULT 'a0',
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE planner_categories (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#C8DAD3',
  is_hidden INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  sort_key TEXT NOT NULL DEFAULT 'a0',
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE planner_category_keywords (
  uuid TEXT PRIMARY KEY NOT NULL,
  category_uuid TEXT NOT NULL,
  keyword TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_pkw_cat ON planner_category_keywords (category_uuid);
CREATE TABLE planner_events (
  uuid TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT,
  location TEXT,
  place_name TEXT,
  place_lat REAL,
  place_lon REAL,
  place_ref TEXT,
  duration_locked INTEGER NOT NULL DEFAULT 1,
  event_date TEXT NOT NULL,
  end_date TEXT,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '10:00',
  is_all_day INTEGER NOT NULL DEFAULT 0,
  category_uuid TEXT,
  calendar_uuid TEXT,
  habit_uuid TEXT,
  importance TEXT NOT NULL DEFAULT 'normal',
  color TEXT,
  item_type TEXT NOT NULL DEFAULT 'event',
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  notify_type TEXT NOT NULL DEFAULT 'h1',
  notify_minutes INTEGER NOT NULL DEFAULT 60,
  repeat_type TEXT NOT NULL DEFAULT 'none',
  repeat_interval INTEGER NOT NULL DEFAULT 1,
  repeat_unit TEXT NOT NULL DEFAULT 'week',
  repeat_until TEXT,
  rrule TEXT,
  series_uuid TEXT,
  original_date TEXT,
  is_cancelled INTEGER NOT NULL DEFAULT 0,
  routine_group TEXT,
  routine_collapsed INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_pev_date ON planner_events (event_date);
CREATE INDEX idx_pev_series ON planner_events (series_uuid, original_date);
`,
  },
  {
    version: 6,
    sql: `
-- le priorità del giorno (fino a 6 per giorno), le routine e i loro passaggi; gli eventi ricordano la routine d'origine
CREATE TABLE planner_priorities (
  uuid TEXT PRIMARY KEY NOT NULL,
  priority_date TEXT NOT NULL,
  position INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX idx_ppri_slot ON planner_priorities (priority_date, position);
CREATE TABLE planner_routines (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#E3D9EE',
  sort_key TEXT NOT NULL DEFAULT 'a0',
  created_at TEXT
);
CREATE TABLE planner_routine_items (
  uuid TEXT PRIMARY KEY NOT NULL,
  routine_uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 5,
  sort_key TEXT NOT NULL DEFAULT 'a0'
);
CREATE INDEX idx_pri_routine ON planner_routine_items (routine_uuid);
ALTER TABLE planner_events ADD COLUMN routine_uuid TEXT;
`,
  },
  {
    version: 7,
    sql: `
CREATE TABLE planner_weeks (
  uuid TEXT PRIMARY KEY NOT NULL,
  week_start TEXT NOT NULL,
  week_number INTEGER NOT NULL DEFAULT 1,
  number_edited INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  learned_note TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX idx_pweek_start ON planner_weeks (week_start);
`,
  },
  {
    version: 8,
    sql: `
CREATE TABLE projects (
  uuid TEXT PRIMARY KEY NOT NULL,
  parent_uuid TEXT,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in_progress',
  color TEXT NOT NULL DEFAULT '#8E8E93',
  color_edited INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  due_date TEXT,
  todo_enabled INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  sort_key TEXT NOT NULL DEFAULT 'a0',
  study_event_uuid TEXT,
  study_start TEXT,
  study_end TEXT,
  study_pomodori_stimati INTEGER,
  study_ripasso_di_uuid TEXT,
  study_ripasso_n INTEGER,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_projects_parent ON projects (parent_uuid);
CREATE TABLE pomodoro_sessions (
  uuid TEXT PRIMARY KEY NOT NULL,
  mode INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL,
  end_time TEXT,
  status TEXT,
  resume_time TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  planned_duration_min INTEGER,
  project_uuid TEXT,
  is_manual INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE INDEX idx_pomo_start ON pomodoro_sessions (start_time);
CREATE INDEX idx_pomo_project ON pomodoro_sessions (project_uuid);
CREATE TABLE pomodoro_custom_durations (
  uuid TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  updated_at TEXT
);
CREATE UNIQUE INDEX idx_pcd_key ON pomodoro_custom_durations (type, minutes);
`,
  },
  {
    version: 9,
    sql: `
CREATE TABLE university_exam_groups (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT 'Gruppo',
  group_type TEXT NOT NULL DEFAULT 'choice',
  cfu REAL NOT NULL DEFAULT 0,
  overall_grade INTEGER,
  overall_honors INTEGER NOT NULL DEFAULT 0,
  overall_predicted_grade INTEGER,
  overall_predicted_honors INTEGER NOT NULL DEFAULT 0,
  sort_key TEXT NOT NULL DEFAULT 'a0',
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE university_exams (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  cfu REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo',
  grade INTEGER,
  has_honors INTEGER NOT NULL DEFAULT 0,
  is_pass_fail INTEGER NOT NULL DEFAULT 0,
  counts_for_graduation INTEGER NOT NULL DEFAULT 1,
  exam_date TEXT,
  predicted_grade INTEGER,
  predicted_honors INTEGER NOT NULL DEFAULT 0,
  catalog_code TEXT,
  ssd TEXT,
  study_year INTEGER,
  national_avg REAL,
  group_uuid TEXT,
  sort_key TEXT NOT NULL DEFAULT 'a0',
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_uni_exams_group ON university_exams (group_uuid);
CREATE TABLE university_bonuses (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT 'Bonus',
  bonus_type TEXT NOT NULL DEFAULT 'fixed',
  points REAL NOT NULL DEFAULT 0,
  threshold_value INTEGER,
  cap_points REAL NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  sort_key TEXT NOT NULL DEFAULT 'a0',
  created_at TEXT,
  updated_at TEXT
);
`,
  },
  {
    version: 10,
    sql: `
CREATE TABLE fc_study_decks (
  uuid TEXT PRIMARY KEY NOT NULL,
  parent_uuid TEXT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#A0A0A0',
  color_edited INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  notes TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  exam_date TEXT,
  updated_at TEXT
);
CREATE INDEX idx_fc_decks_parent ON fc_study_decks (parent_uuid);
CREATE TABLE fc_study_cards (
  uuid TEXT PRIMARY KEY NOT NULL,
  category_uuid TEXT NOT NULL,
  question_desc TEXT,
  answer_desc TEXT,
  question_image TEXT,
  answer_image TEXT,
  question_audio TEXT,
  answer_audio TEXT,
  is_father INTEGER NOT NULL DEFAULT 0,
  custom_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE INDEX idx_fc_cards_deck ON fc_study_cards (category_uuid, custom_order);
CREATE TABLE fc_study_subcards (
  uuid TEXT PRIMARY KEY NOT NULL,
  parent_uuid TEXT NOT NULL,
  question_desc TEXT,
  answer_desc TEXT,
  question_image TEXT,
  answer_image TEXT,
  question_audio TEXT,
  answer_audio TEXT,
  custom_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE INDEX idx_fc_subcards_parent ON fc_study_subcards (parent_uuid, custom_order);
`,
  },
  {
    version: 11,
    sql: `
CREATE TABLE fc_study_favorites (
  uuid TEXT PRIMARY KEY NOT NULL,
  card_uuid TEXT,
  child_uuid TEXT,
  favorited_date TEXT
);
CREATE INDEX idx_fc_fav_card ON fc_study_favorites (card_uuid);
CREATE INDEX idx_fc_fav_child ON fc_study_favorites (child_uuid);
CREATE TABLE fc_study_learnt (
  uuid TEXT PRIMARY KEY NOT NULL,
  target_uuid TEXT NOT NULL,
  is_child INTEGER NOT NULL DEFAULT 0,
  learnt_date TEXT,
  updated_at TEXT
);
CREATE INDEX idx_fc_learnt_target ON fc_study_learnt (target_uuid);
CREATE TABLE fc_study_examples (
  uuid TEXT PRIMARY KEY NOT NULL,
  card_uuid TEXT,
  child_uuid TEXT,
  example_text TEXT,
  example_image TEXT,
  example_audio TEXT
);
CREATE INDEX idx_fc_ex_card ON fc_study_examples (card_uuid);
CREATE INDEX idx_fc_ex_child ON fc_study_examples (child_uuid);
CREATE TABLE fc_games (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_date TEXT,
  score REAL,
  type TEXT NOT NULL DEFAULT 'fc',
  card_status TEXT,
  parent_uuid TEXT,
  total_father_words INTEGER NOT NULL DEFAULT 0,
  game_order TEXT,
  total_words_with_children INTEGER NOT NULL DEFAULT 1,
  max_card_uuid TEXT
);
CREATE INDEX idx_fc_games_date ON fc_games (game_date);
CREATE INDEX idx_fc_games_parent ON fc_games (parent_uuid);
CREATE TABLE fc_game_durations (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_uuid TEXT NOT NULL,
  start_time TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE INDEX idx_fc_dur_game ON fc_game_durations (game_uuid);
CREATE TABLE fc_study_plays (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_uuid TEXT NOT NULL,
  card_uuid TEXT,
  child_uuid TEXT,
  correct_answer TEXT,
  user_answer TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  play_date TEXT
);
CREATE INDEX idx_fc_plays_game ON fc_study_plays (game_uuid, position);
CREATE INDEX idx_fc_plays_card ON fc_study_plays (card_uuid);
CREATE INDEX idx_fc_plays_child ON fc_study_plays (child_uuid);
CREATE TABLE fc_study_game_decks (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_uuid TEXT NOT NULL,
  deck_uuid TEXT NOT NULL,
  category_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_fc_gdecks_game ON fc_study_game_decks (game_uuid);
CREATE TABLE fc_study_sequence (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_uuid TEXT NOT NULL,
  position INTEGER NOT NULL,
  card_uuid TEXT NOT NULL
);
CREATE INDEX idx_fc_seq_game ON fc_study_sequence (game_uuid, position);
CREATE TABLE fc_study_records (
  uuid TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  game_uuid TEXT,
  achieved_at TEXT,
  updated_at TEXT
);
CREATE TABLE fc_settings (
  uuid TEXT PRIMARY KEY NOT NULL,
  vocab_meaning TEXT NOT NULL DEFAULT 'aperto',
  vocab_examples TEXT NOT NULL DEFAULT 'aperto',
  voice_read TEXT,
  updated_at TEXT
);
CREATE TABLE fc_goals (
  uuid TEXT PRIMARY KEY NOT NULL,
  daily_goal INTEGER NOT NULL DEFAULT 20,
  updated_at TEXT
);
`,
  },
  {
    version: 12,
    // un evento messo in agenda da un progetto preferito porta con sé il progetto (come sul sito: project_id)
    sql: `ALTER TABLE planner_events ADD COLUMN project_uuid TEXT;`,
  },
  {
    version: 13,
    // l'attività (to do) collegata a un progetto, come todos.project_id del sito
    sql: `ALTER TABLE todos ADD COLUMN project_uuid TEXT;`,
  },
  {
    version: 14,
    // il piano dei progetti: obiettivi (tempo, tipo, priorità, date), giorni evidenziati, blocchi del giorno, «il tuo tempo», modelli
    sql: `
CREATE TABLE plan_goals (
  uuid TEXT PRIMARY KEY NOT NULL,
  project_uuid TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  minutes INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'plain',
  priority TEXT NOT NULL DEFAULT 'should',
  start_date TEXT,
  deadline TEXT,
  since TEXT,
  items INTEGER,
  unit_minutes INTEGER,
  updated_at TEXT
);
CREATE UNIQUE INDEX idx_plan_goals_project ON plan_goals (project_uuid);
CREATE TABLE plan_paint (
  uuid TEXT PRIMARY KEY NOT NULL,
  project_uuid TEXT NOT NULL,
  day TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_plan_paint_key ON plan_paint (project_uuid, day);
CREATE INDEX idx_plan_paint_day ON plan_paint (day);
CREATE TABLE plan_days (
  uuid TEXT PRIMARY KEY NOT NULL,
  project_uuid TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'study',
  minutes INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'auto',
  updated_at TEXT
);
CREATE UNIQUE INDEX idx_plan_days_key ON plan_days (project_uuid, day, kind);
CREATE INDEX idx_plan_days_day ON plan_days (day);
CREATE TABLE plan_settings (
  uuid TEXT PRIMARY KEY NOT NULL,
  weekday_min INTEGER,
  weekend_min INTEGER,
  rest_dow INTEGER NOT NULL DEFAULT 0,
  buffer_days INTEGER NOT NULL DEFAULT 0,
  floor_min INTEGER NOT NULL DEFAULT 15,
  max_subjects INTEGER NOT NULL DEFAULT 3,
  reviews INTEGER NOT NULL DEFAULT 0,
  overrides TEXT,
  updated_at TEXT
);
CREATE TABLE plan_templates (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
`,
  },
  {
    version: 15,
    // le bozze veloci della Home e il mazzo di studio collegato a un progetto
    sql: `
CREATE TABLE fc_quick_drafts (
  uuid TEXT PRIMARY KEY NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL DEFAULT '',
  deck_uuid TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE fc_study_deck_projects (
  uuid TEXT PRIMARY KEY NOT NULL,
  project_uuid TEXT NOT NULL,
  deck_uuid TEXT NOT NULL,
  created_at TEXT
);
CREATE INDEX idx_fc_deckproj_project ON fc_study_deck_projects (project_uuid);
CREATE INDEX idx_fc_deckproj_deck ON fc_study_deck_projects (deck_uuid);
`,
  },
  {
    version: 16,
    // la rubrica, gli invitati degli eventi e i luoghi salvati
    sql: `
CREATE TABLE contacts (
  uuid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_contacts_email ON contacts (email);
CREATE TABLE event_guests (
  uuid TEXT PRIMARY KEY NOT NULL,
  event_uuid TEXT NOT NULL,
  contact_uuid TEXT,
  email TEXT NOT NULL,
  name TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_event_guests_event ON event_guests (event_uuid);
CREATE TABLE planner_places (
  uuid TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  place_name TEXT,
  address TEXT NOT NULL DEFAULT '',
  place_lat REAL,
  place_lon REAL,
  place_ref TEXT,
  sort_key TEXT NOT NULL DEFAULT '',
  created_at TEXT,
  updated_at TEXT
);
`,
  },
  {
    version: 17,
    // le lingue: corsi, mazzi, parole (con le figlie), esempi, preferiti e imparate
    sql: `
CREATE TABLE fc_vocab_courses (
  uuid TEXT PRIMARY KEY NOT NULL,
  known_lang TEXT NOT NULL,
  learn_lang TEXT NOT NULL,
  project_uuid TEXT,
  sort_key TEXT NOT NULL DEFAULT '',
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE fc_vocab_decks (
  uuid TEXT PRIMARY KEY NOT NULL,
  course_uuid TEXT NOT NULL,
  parent_uuid TEXT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#A0A0A0',
  color_edited INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  notes TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  exam_date TEXT,
  updated_at TEXT
);
CREATE INDEX idx_fc_vdecks_course ON fc_vocab_decks (course_uuid);
CREATE INDEX idx_fc_vdecks_parent ON fc_vocab_decks (parent_uuid);
CREATE TABLE fc_vocab_cards (
  uuid TEXT PRIMARY KEY NOT NULL,
  category_uuid TEXT NOT NULL,
  word TEXT NOT NULL,
  translation TEXT,
  meaning TEXT,
  notes TEXT,
  image TEXT,
  is_father INTEGER NOT NULL DEFAULT 0,
  custom_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE INDEX idx_fc_vcards_deck ON fc_vocab_cards (category_uuid, custom_order);
CREATE TABLE fc_vocab_subcards (
  uuid TEXT PRIMARY KEY NOT NULL,
  parent_uuid TEXT NOT NULL,
  word TEXT NOT NULL,
  translation TEXT,
  meaning TEXT,
  notes TEXT,
  image TEXT,
  custom_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE INDEX idx_fc_vsub_parent ON fc_vocab_subcards (parent_uuid, custom_order);
CREATE TABLE fc_vocab_favorites (
  uuid TEXT PRIMARY KEY NOT NULL,
  card_uuid TEXT,
  child_uuid TEXT,
  favorited_date TEXT
);
CREATE INDEX idx_fc_vfav_card ON fc_vocab_favorites (card_uuid);
CREATE INDEX idx_fc_vfav_child ON fc_vocab_favorites (child_uuid);
CREATE TABLE fc_vocab_learnt (
  uuid TEXT PRIMARY KEY NOT NULL,
  target_uuid TEXT NOT NULL,
  is_child INTEGER NOT NULL DEFAULT 0,
  learnt_date TEXT,
  updated_at TEXT
);
CREATE INDEX idx_fc_vlearnt_target ON fc_vocab_learnt (target_uuid);
CREATE TABLE fc_vocab_examples (
  uuid TEXT PRIMARY KEY NOT NULL,
  card_uuid TEXT,
  child_uuid TEXT,
  example_text TEXT,
  gap_text TEXT,
  example_image TEXT,
  example_audio TEXT,
  updated_at TEXT
);
CREATE INDEX idx_fc_vex_card ON fc_vocab_examples (card_uuid);
CREATE INDEX idx_fc_vex_child ON fc_vocab_examples (child_uuid);
`,
  },
  {
    version: 18,
    // il gioco delle lingue: le partite stanno in fc_games (kind + corso), risposte, mazzi scelti, sequenza e record in tabelle loro
    sql: `
ALTER TABLE fc_games ADD COLUMN kind TEXT NOT NULL DEFAULT 'study';
ALTER TABLE fc_games ADD COLUMN course_uuid TEXT;
CREATE INDEX idx_fc_games_kind ON fc_games (kind, course_uuid, game_date);
CREATE TABLE fc_vocab_plays (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_uuid TEXT NOT NULL,
  card_uuid TEXT,
  child_uuid TEXT,
  correct_answer TEXT,
  user_answer TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  play_date TEXT
);
CREATE INDEX idx_fc_vplays_game ON fc_vocab_plays (game_uuid, position);
CREATE INDEX idx_fc_vplays_card ON fc_vocab_plays (card_uuid);
CREATE INDEX idx_fc_vplays_child ON fc_vocab_plays (child_uuid);
CREATE TABLE fc_vocab_game_decks (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_uuid TEXT NOT NULL,
  deck_uuid TEXT NOT NULL,
  category_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_fc_vgdecks_game ON fc_vocab_game_decks (game_uuid);
CREATE INDEX idx_fc_vgdecks_deck ON fc_vocab_game_decks (deck_uuid);
CREATE TABLE fc_vocab_sequence (
  uuid TEXT PRIMARY KEY NOT NULL,
  game_uuid TEXT NOT NULL,
  position INTEGER NOT NULL,
  card_uuid TEXT NOT NULL
);
CREATE INDEX idx_fc_vseq_game ON fc_vocab_sequence (game_uuid, position);
CREATE INDEX idx_fc_vseq_card ON fc_vocab_sequence (card_uuid);
CREATE TABLE fc_vocab_records (
  uuid TEXT PRIMARY KEY NOT NULL,
  course_uuid TEXT NOT NULL,
  kind TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  game_uuid TEXT,
  achieved_at TEXT,
  updated_at TEXT
);
CREATE INDEX idx_fc_vrec_course ON fc_vocab_records (course_uuid);
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
