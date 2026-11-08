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
  | 'planner_weeks'
  | 'projects'
  | 'pomodoro_sessions'
  | 'pomodoro_custom_durations'
  | 'plan_goals'
  | 'plan_paint'
  | 'plan_days'
  | 'plan_settings'
  | 'plan_templates'
  | 'university_exam_groups'
  | 'university_exams'
  | 'university_bonuses'
  | 'planner_events'
  | 'contacts'
  | 'planner_places'
  | 'event_guests'
  | 'fc_vocab_courses'
  | 'fc_vocab_decks'
  | 'fc_vocab_cards'
  | 'fc_vocab_subcards'
  | 'fc_vocab_favorites'
  | 'fc_vocab_learnt'
  | 'fc_vocab_examples'
  | 'fc_study_decks'
  | 'fc_study_cards'
  | 'fc_study_subcards'
  | 'fc_quick_drafts'
  | 'fc_study_deck_projects'
  | 'fc_study_favorites'
  | 'fc_study_learnt'
  | 'fc_study_examples'
  | 'fc_games'
  | 'fc_game_durations'
  | 'fc_study_plays'
  | 'fc_study_game_decks'
  | 'fc_study_sequence'
  | 'fc_study_records'
  | 'fc_vocab_plays'
  | 'fc_vocab_game_decks'
  | 'fc_vocab_sequence'
  | 'fc_vocab_records'
  | 'fc_settings'
  | 'fc_goals';

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
  children?: { table: SyncTable; column: string; setNull?: boolean }[];
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
      'project_uuid',
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
  // la settimana: una riga per (utente, lunedì). Il numero lo calcola il telefono come il sito; se lo scrivi tu, il server lo segna «a mano».
  planner_weeks: {
    order: 108,
    readOnly: ['number_edited', 'created_at', 'updated_at'],
    createOnly: ['week_start'],
    booleans: ['number_edited', 'is_completed'],
    columns: [
      'uuid',
      'week_start',
      'week_number',
      'number_edited',
      'is_completed',
      'learned_note',
      'created_at',
      'updated_at',
    ],
  },
  // gli eventi: la riga com'è sul sito. Una serie = un capostipite con `rrule` (la scrive il server dai campi repeat_*);
  // «solo questa volta» / «questa volta no» = una riga con series_uuid + original_date (+ is_cancelled). Le occorrenze
  // non sono righe: si calcolano in lettura (vedi features/planner/recurrence.ts ed events.ts).
  planner_events: {
    order: 130,
    readOnly: ['completed_at', 'rrule', 'sort_order', 'created_at', 'updated_at'],
    createOnly: [
      'habit_uuid',
      'project_uuid',
      'series_uuid',
      'original_date',
      'routine_uuid',
      'routine_group',
    ],
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
      'project_uuid',
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
    children: [
      { table: 'planner_events', column: 'series_uuid' },
      { table: 'event_guests', column: 'event_uuid' },
    ],
  },
  // la rubrica: un indirizzo e-mail solo per utente. Se un contatto sparisce, gli invitati restano scritti a mano.
  contacts: {
    order: 120,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: [],
    columns: ['uuid', 'name', 'email', 'created_at', 'updated_at'],
    children: [{ table: 'event_guests', column: 'contact_uuid', setNull: true }],
  },
  // i luoghi salvati: nome, parole d'aggancio, indirizzo e, se ci sono, le coordinate (vanno in coppia)
  planner_places: {
    order: 121,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: [],
    columns: [
      'uuid',
      'label',
      'keywords',
      'place_name',
      'address',
      'place_lat',
      'place_lon',
      'place_ref',
      'sort_key',
      'created_at',
      'updated_at',
    ],
  },
  // gli invitati di un evento: l'evento non si cambia dopo la creazione
  event_guests: {
    order: 131,
    readOnly: ['created_at', 'updated_at'],
    createOnly: ['event_uuid', 'email'],
    booleans: [],
    columns: ['uuid', 'event_uuid', 'contact_uuid', 'email', 'name', 'created_at', 'updated_at'],
  },
  // i progetti: un albero. Il colore si eredita dal padre finché non lo scegli tu (color_edited). I campi study_* li scrive il
  // piano di studio del sito: qui si leggono e basta (tranne la stima dei pomodori).
  projects: {
    order: 140,
    readOnly: [
      'study_event_uuid',
      'study_start',
      'study_end',
      'study_ripasso_di_uuid',
      'study_ripasso_n',
      'created_at',
      'updated_at',
    ],
    createOnly: [],
    booleans: ['color_edited', 'todo_enabled', 'is_favorite'],
    columns: [
      'uuid',
      'parent_uuid',
      'name',
      'notes',
      'status',
      'color',
      'color_edited',
      'target_date',
      'due_date',
      'todo_enabled',
      'is_favorite',
      'sort_key',
      'study_event_uuid',
      'study_start',
      'study_end',
      'study_pomodori_stimati',
      'study_ripasso_di_uuid',
      'study_ripasso_n',
      'created_at',
      'updated_at',
    ],
    // i figli se ne vanno col padre; le sessioni restano, senza progetto
    children: [
      { table: 'projects', column: 'parent_uuid' },
      { table: 'pomodoro_sessions', column: 'project_uuid', setNull: true },
      { table: 'todos', column: 'project_uuid', setNull: true },
      { table: 'fc_study_deck_projects', column: 'project_uuid' },
      { table: 'fc_vocab_courses', column: 'project_uuid', setNull: true },
      { table: 'plan_goals', column: 'project_uuid' },
      { table: 'plan_paint', column: 'project_uuid' },
      { table: 'plan_days', column: 'project_uuid' },
    ],
  },
  // le sessioni del Pomodoro e del cronometro: date e ore come sul sito, «AAAA-MM-GG HH:MM:SS» ora locale
  pomodoro_sessions: {
    order: 150,
    readOnly: ['updated_at'],
    createOnly: ['mode'],
    booleans: [],
    columns: [
      'uuid',
      'mode',
      'start_time',
      'end_time',
      'status',
      'resume_time',
      'duration_seconds',
      'planned_duration_min',
      'project_uuid',
      'is_manual',
      'updated_at',
    ],
  },
  // le durate salvate (25, 50, 90...): una riga per (tipo, minuti), identità UUIDv5
  pomodoro_custom_durations: {
    order: 160,
    readOnly: ['updated_at'],
    createOnly: ['type', 'minutes'],
    booleans: [],
    columns: ['uuid', 'type', 'minutes', 'updated_at'],
  },
  // il piano dei progetti: un obiettivo per progetto (UUIDv5 del progetto), giorni evidenziati, blocchi del giorno, «il tuo tempo», modelli
  plan_goals: {
    order: 155,
    readOnly: ['updated_at'],
    createOnly: ['project_uuid'],
    booleans: ['active', 'locked'],
    columns: [
      'uuid',
      'project_uuid',
      'active',
      'minutes',
      'locked',
      'kind',
      'priority',
      'start_date',
      'deadline',
      'since',
      'items',
      'unit_minutes',
      'updated_at',
    ],
  },
  plan_paint: {
    order: 156,
    readOnly: [],
    createOnly: ['project_uuid', 'day'],
    booleans: [],
    columns: ['uuid', 'project_uuid', 'day'],
  },
  plan_days: {
    order: 157,
    readOnly: ['updated_at'],
    createOnly: ['project_uuid', 'day', 'kind'],
    booleans: [],
    columns: ['uuid', 'project_uuid', 'day', 'kind', 'minutes', 'source', 'updated_at'],
  },
  plan_settings: {
    order: 158,
    readOnly: ['updated_at'],
    createOnly: [],
    booleans: ['reviews'],
    columns: [
      'uuid',
      'weekday_min',
      'weekend_min',
      'rest_dow',
      'buffer_days',
      'floor_min',
      'max_subjects',
      'reviews',
      'overrides',
      'updated_at',
    ],
  },
  plan_templates: {
    order: 159,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: [],
    columns: ['uuid', 'name', 'body', 'created_at', 'updated_at'],
  },
  // i voti: gruppi di esami, esami (puntano al gruppo) e bonus di laurea
  university_exam_groups: {
    order: 170,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: ['overall_honors', 'overall_predicted_honors'],
    columns: [
      'uuid',
      'name',
      'group_type',
      'cfu',
      'overall_grade',
      'overall_honors',
      'overall_predicted_grade',
      'overall_predicted_honors',
      'sort_key',
      'created_at',
      'updated_at',
    ],
    children: [{ table: 'university_exams', column: 'group_uuid', setNull: true }],
  },
  university_exams: {
    order: 171,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: ['has_honors', 'is_pass_fail', 'counts_for_graduation', 'predicted_honors'],
    columns: [
      'uuid',
      'name',
      'cfu',
      'status',
      'grade',
      'has_honors',
      'is_pass_fail',
      'counts_for_graduation',
      'exam_date',
      'predicted_grade',
      'predicted_honors',
      'catalog_code',
      'ssd',
      'study_year',
      'national_avg',
      'group_uuid',
      'sort_key',
      'created_at',
      'updated_at',
    ],
  },
  university_bonuses: {
    order: 172,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: ['is_enabled'],
    columns: [
      'uuid',
      'name',
      'bonus_type',
      'points',
      'threshold_value',
      'cap_points',
      'is_enabled',
      'sort_key',
      'created_at',
      'updated_at',
    ],
  },
  // le lingue. Un corso nasce con il suo progetto (lo crea il server se il telefono non ne indica uno).
  // Togliere un corso toglie mazzi, parole e tutto il resto: il telefono rifà lo stesso giro.
  fc_vocab_courses: {
    order: 300,
    readOnly: ['created_at', 'updated_at'],
    createOnly: ['known_lang'],
    booleans: [],
    columns: [
      'uuid',
      'known_lang',
      'learn_lang',
      'project_uuid',
      'sort_key',
      'created_at',
      'updated_at',
    ],
    children: [
      { table: 'fc_vocab_decks', column: 'course_uuid' },
      { table: 'fc_games', column: 'course_uuid' },
      { table: 'fc_vocab_records', column: 'course_uuid' },
    ],
  },
  fc_vocab_decks: {
    order: 301,
    readOnly: ['updated_at'],
    createOnly: ['course_uuid'],
    booleans: ['color_edited', 'archived', 'pinned'],
    columns: [
      'uuid',
      'course_uuid',
      'parent_uuid',
      'name',
      'color',
      'color_edited',
      'archived',
      'icon',
      'notes',
      'pinned',
      'exam_date',
      'updated_at',
    ],
    children: [
      { table: 'fc_vocab_decks', column: 'parent_uuid' },
      { table: 'fc_vocab_cards', column: 'category_uuid' },
      { table: 'fc_vocab_game_decks', column: 'deck_uuid' },
    ],
  },
  fc_vocab_cards: {
    order: 302,
    readOnly: ['image', 'is_father', 'custom_order', 'updated_at'],
    createOnly: [],
    booleans: ['is_father'],
    columns: [
      'uuid',
      'category_uuid',
      'word',
      'translation',
      'meaning',
      'notes',
      'image',
      'is_father',
      'custom_order',
      'updated_at',
    ],
    children: [
      { table: 'fc_vocab_subcards', column: 'parent_uuid' },
      { table: 'fc_vocab_favorites', column: 'card_uuid' },
      { table: 'fc_vocab_learnt', column: 'target_uuid' },
      { table: 'fc_vocab_examples', column: 'card_uuid' },
      { table: 'fc_vocab_plays', column: 'card_uuid' },
      { table: 'fc_vocab_sequence', column: 'card_uuid' },
    ],
  },
  fc_vocab_subcards: {
    order: 303,
    readOnly: ['image', 'custom_order', 'updated_at'],
    createOnly: ['parent_uuid'],
    booleans: [],
    columns: [
      'uuid',
      'parent_uuid',
      'word',
      'translation',
      'meaning',
      'notes',
      'image',
      'custom_order',
      'updated_at',
    ],
    children: [
      { table: 'fc_vocab_favorites', column: 'child_uuid' },
      { table: 'fc_vocab_learnt', column: 'target_uuid' },
      { table: 'fc_vocab_examples', column: 'child_uuid' },
      { table: 'fc_vocab_plays', column: 'child_uuid' },
    ],
  },
  fc_vocab_favorites: {
    order: 304,
    readOnly: [],
    createOnly: ['card_uuid', 'child_uuid', 'favorited_date'],
    booleans: [],
    columns: ['uuid', 'card_uuid', 'child_uuid', 'favorited_date'],
  },
  fc_vocab_learnt: {
    order: 305,
    readOnly: ['updated_at'],
    createOnly: ['target_uuid', 'is_child'],
    booleans: ['is_child'],
    columns: ['uuid', 'target_uuid', 'is_child', 'learnt_date', 'updated_at'],
  },
  fc_vocab_examples: {
    order: 306,
    readOnly: ['example_image', 'example_audio', 'updated_at'],
    createOnly: ['card_uuid', 'child_uuid'],
    booleans: [],
    columns: [
      'uuid',
      'card_uuid',
      'child_uuid',
      'example_text',
      'gap_text',
      'example_image',
      'example_audio',
      'updated_at',
    ],
  },
  // le flashcard di studio: mazzi ad albero, carte (nel mazzo) e carte figlie (sotto una carta)
  fc_study_decks: {
    order: 200,
    readOnly: ['updated_at'],
    createOnly: [],
    booleans: ['color_edited', 'archived', 'pinned'],
    columns: [
      'uuid',
      'parent_uuid',
      'name',
      'color',
      'color_edited',
      'archived',
      'icon',
      'notes',
      'pinned',
      'exam_date',
      'updated_at',
    ],
    // il sito cancella solo il mazzo e lascia le carte orfane: il telefono toglie il ramo intero
    children: [
      { table: 'fc_study_decks', column: 'parent_uuid' },
      { table: 'fc_study_cards', column: 'category_uuid' },
      { table: 'fc_study_game_decks', column: 'deck_uuid' },
      { table: 'fc_study_deck_projects', column: 'deck_uuid' },
    ],
  },
  fc_study_cards: {
    order: 201,
    readOnly: [
      'question_image',
      'answer_image',
      'question_audio',
      'answer_audio',
      'is_father',
      'custom_order',
      'updated_at',
    ],
    createOnly: [],
    booleans: ['is_father'],
    columns: [
      'uuid',
      'category_uuid',
      'question_desc',
      'answer_desc',
      'question_image',
      'answer_image',
      'question_audio',
      'answer_audio',
      'is_father',
      'custom_order',
      'updated_at',
    ],
    // il server toglie con la carta anche preferiti, imparate, esempi, risposte e posti in sequenza
    children: [
      { table: 'fc_study_subcards', column: 'parent_uuid' },
      { table: 'fc_study_favorites', column: 'card_uuid' },
      { table: 'fc_study_learnt', column: 'target_uuid' },
      { table: 'fc_study_examples', column: 'card_uuid' },
      { table: 'fc_study_plays', column: 'card_uuid' },
      { table: 'fc_study_sequence', column: 'card_uuid' },
    ],
  },
  fc_study_subcards: {
    order: 202,
    readOnly: [
      'question_image',
      'answer_image',
      'question_audio',
      'answer_audio',
      'custom_order',
      'updated_at',
    ],
    createOnly: ['parent_uuid'],
    booleans: [],
    columns: [
      'uuid',
      'parent_uuid',
      'question_desc',
      'answer_desc',
      'question_image',
      'answer_image',
      'question_audio',
      'answer_audio',
      'custom_order',
      'updated_at',
    ],
    children: [
      { table: 'fc_study_favorites', column: 'child_uuid' },
      { table: 'fc_study_learnt', column: 'target_uuid' },
      { table: 'fc_study_examples', column: 'child_uuid' },
      { table: 'fc_study_plays', column: 'child_uuid' },
    ],
  },
  // le bozze veloci della Home (solo il fronte, il resto si completa dopo)
  fc_quick_drafts: {
    order: 213,
    readOnly: ['created_at', 'updated_at'],
    createOnly: [],
    booleans: [],
    columns: ['uuid', 'front', 'back', 'deck_uuid', 'created_at', 'updated_at'],
  },
  // il mazzo di studio collegato a un progetto (uno solo per progetto: per cambiarlo si toglie la riga e se ne crea un'altra)
  fc_study_deck_projects: {
    order: 214,
    readOnly: ['created_at'],
    createOnly: ['project_uuid', 'deck_uuid'],
    booleans: [],
    columns: ['uuid', 'project_uuid', 'deck_uuid', 'created_at'],
  },
  // i dati di studio: preferiti, imparate, esempi (di una carta o di una carta figlia)
  fc_study_favorites: {
    order: 210,
    readOnly: [],
    createOnly: ['card_uuid', 'child_uuid', 'favorited_date'],
    booleans: [],
    columns: ['uuid', 'card_uuid', 'child_uuid', 'favorited_date'],
  },
  // una riga per (carta o figlia): l'uuid è UUIDv5 di utente + target + flag (vedi learntUuid)
  fc_study_learnt: {
    order: 211,
    readOnly: ['updated_at'],
    createOnly: ['target_uuid', 'is_child'],
    booleans: ['is_child'],
    columns: ['uuid', 'target_uuid', 'is_child', 'learnt_date', 'updated_at'],
  },
  fc_study_examples: {
    order: 212,
    readOnly: ['example_image', 'example_audio'],
    createOnly: ['card_uuid', 'child_uuid'],
    booleans: [],
    columns: ['uuid', 'card_uuid', 'child_uuid', 'example_text', 'example_image', 'example_audio'],
  },
  // le partite, di studio e di lingua (kind; quelle di lingua hanno anche il corso)
  fc_games: {
    order: 220,
    readOnly: [],
    createOnly: ['kind', 'course_uuid', 'game_date', 'type', 'card_status', 'parent_uuid'],
    booleans: [],
    columns: [
      'uuid',
      'kind',
      'course_uuid',
      'game_date',
      'score',
      'type',
      'card_status',
      'parent_uuid',
      'total_father_words',
      'game_order',
      'total_words_with_children',
      'max_card_uuid',
    ],
    // togliere una partita toglie tempo, risposte, mazzi e sequenza; i ripassi restano senza legame
    children: [
      { table: 'fc_game_durations', column: 'game_uuid' },
      { table: 'fc_study_plays', column: 'game_uuid' },
      { table: 'fc_study_game_decks', column: 'game_uuid' },
      { table: 'fc_study_sequence', column: 'game_uuid' },
      { table: 'fc_vocab_plays', column: 'game_uuid' },
      { table: 'fc_vocab_game_decks', column: 'game_uuid' },
      { table: 'fc_vocab_sequence', column: 'game_uuid' },
      { table: 'fc_games', column: 'parent_uuid', setNull: true },
      { table: 'fc_study_records', column: 'game_uuid', setNull: true },
      { table: 'fc_vocab_records', column: 'game_uuid', setNull: true },
    ],
  },
  fc_game_durations: {
    order: 221,
    readOnly: ['updated_at'],
    createOnly: ['game_uuid', 'start_time'],
    booleans: [],
    columns: ['uuid', 'game_uuid', 'start_time', 'duration_seconds', 'updated_at'],
  },
  fc_study_plays: {
    order: 222,
    readOnly: [],
    createOnly: ['game_uuid', 'card_uuid', 'child_uuid', 'position'],
    booleans: [],
    columns: [
      'uuid',
      'game_uuid',
      'card_uuid',
      'child_uuid',
      'correct_answer',
      'user_answer',
      'position',
      'play_date',
    ],
  },
  fc_study_game_decks: {
    order: 223,
    readOnly: [],
    createOnly: ['game_uuid', 'deck_uuid', 'category_order'],
    booleans: [],
    columns: ['uuid', 'game_uuid', 'deck_uuid', 'category_order'],
  },
  fc_study_sequence: {
    order: 224,
    readOnly: [],
    createOnly: ['game_uuid', 'position', 'card_uuid'],
    booleans: [],
    columns: ['uuid', 'game_uuid', 'position', 'card_uuid'],
  },
  // un record per (utente, tipo); l'uuid è UUIDv5 (vedi studyRecordUuid)
  fc_study_records: {
    order: 230,
    readOnly: ['updated_at'],
    createOnly: ['kind'],
    booleans: [],
    columns: ['uuid', 'kind', 'value', 'game_uuid', 'achieved_at', 'updated_at'],
  },
  // il gioco delle lingue: come lo studio, con parole e mazzi del corso
  fc_vocab_plays: {
    order: 307,
    readOnly: [],
    createOnly: ['game_uuid', 'card_uuid', 'child_uuid', 'position'],
    booleans: [],
    columns: [
      'uuid',
      'game_uuid',
      'card_uuid',
      'child_uuid',
      'correct_answer',
      'user_answer',
      'position',
      'play_date',
    ],
  },
  fc_vocab_game_decks: {
    order: 308,
    readOnly: [],
    createOnly: ['game_uuid', 'deck_uuid', 'category_order'],
    booleans: [],
    columns: ['uuid', 'game_uuid', 'deck_uuid', 'category_order'],
  },
  fc_vocab_sequence: {
    order: 309,
    readOnly: [],
    createOnly: ['game_uuid', 'position', 'card_uuid'],
    booleans: [],
    columns: ['uuid', 'game_uuid', 'position', 'card_uuid'],
  },
  // un record per (utente, corso, tipo); l'uuid è UUIDv5 (vedi vocabRecordUuid)
  fc_vocab_records: {
    order: 310,
    readOnly: ['updated_at'],
    createOnly: ['kind', 'course_uuid'],
    booleans: [],
    columns: ['uuid', 'course_uuid', 'kind', 'value', 'game_uuid', 'achieved_at', 'updated_at'],
  },
  // una riga per utente: impostazioni di studio e obiettivo di ogni giorno
  fc_settings: {
    order: 240,
    readOnly: ['updated_at'],
    createOnly: [],
    booleans: [],
    columns: ['uuid', 'vocab_meaning', 'vocab_examples', 'voice_read', 'updated_at'],
  },
  fc_goals: {
    order: 241,
    readOnly: ['updated_at'],
    createOnly: [],
    booleans: [],
    columns: ['uuid', 'daily_goal', 'updated_at'],
  },
};

export const TABLES = Object.keys(MANIFEST) as SyncTable[];

export function isSyncTable(t: string): t is SyncTable {
  return Object.prototype.hasOwnProperty.call(MANIFEST, t);
}
