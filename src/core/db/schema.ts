import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Lo schema tipizzato per le query dell'interfaccia (Drizzle). Le tabelle vere le crea
 * migrations.ts; un test controlla che le colonne coincidano, così le due cose non si separano.
 */
export const todoBuyCategories = sqliteTable('todo_buy_categories', {
  uuid: text('uuid').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sortKey: text('sort_key').notNull(),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const todos = sqliteTable('todos', {
  uuid: text('uuid').primaryKey(),
  listType: text('list_type').notNull().default('todo'),
  parentUuid: text('parent_uuid'),
  buyCategoryUuid: text('buy_category_uuid'),
  projectUuid: text('project_uuid'),
  buyPriority: integer('buy_priority').notNull().default(3),
  buyPriceCents: integer('buy_price_cents'),
  buyUrl: text('buy_url'),
  buyImage: text('buy_image'),
  title: text('title').notNull(),
  isDone: integer('is_done').notNull().default(0),
  doneAt: text('done_at'),
  dueDate: text('due_date'),
  dueTime: text('due_time'),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  sortKey: text('sort_key').notNull(),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const habitCategories = sqliteTable('habit_categories', {
  uuid: text('uuid').primaryKey(),
  slug: text('slug'),
  name: text('name').notNull(),
  icon: text('icon').notNull().default(''),
  color: text('color').notNull().default('#0A84FF'),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: integer('is_system').notNull().default(0),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const habits = sqliteTable('habits', {
  uuid: text('uuid').primaryKey(),
  categoryUuid: text('category_uuid'),
  presetKey: text('preset_key'),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('⭐'),
  color: text('color').notNull().default('#7C5CFF'),
  motivation: text('motivation'),
  kind: text('kind').notNull().default('build'),
  goalType: text('goal_type').notNull().default('completion'),
  targetAmount: real('target_amount').notNull().default(1),
  stepAmount: real('step_amount').notNull().default(1),
  unit: text('unit').notNull().default(''),
  frequencyType: text('frequency_type').notNull().default('daily'),
  weekdays: text('weekdays').notNull().default('1111111'),
  timesPerWeek: integer('times_per_week').notNull().default(7),
  timesPerMonth: integer('times_per_month').notNull().default(30),
  intervalDays: integer('interval_days').notNull().default(1),
  dayPart: text('day_part').notNull().default('any'),
  durationType: text('duration_type').notNull().default('forever'),
  durationDays: integer('duration_days'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  plannerMinutes: integer('planner_minutes'),
  isArchived: integer('is_archived').notNull().default(0),
  archivedAt: text('archived_at'),
  sortKey: text('sort_key').notNull(),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const habitLogs = sqliteTable('habit_logs', {
  uuid: text('uuid').primaryKey(),
  habitUuid: text('habit_uuid').notNull(),
  logDate: text('log_date').notNull(),
  status: text('status').notNull().default('partial'),
  amount: real('amount').notNull().default(0),
  completions: integer('completions').notNull().default(0),
  targetAmount: real('target_amount').notNull().default(1),
  note: text('note'),
  mood: integer('mood'),
  firstLoggedAt: text('first_logged_at'),
  updatedAt: text('updated_at'),
});

export const pillPlans = sqliteTable('pill_plans', {
  uuid: text('uuid').primaryKey(),
  name: text('name').notNull(),
  dose: text('dose').notNull().default(''),
  notes: text('notes').notNull().default(''),
  color: text('color').notNull().default('#B7A6D6'),
  freqType: text('freq_type').notNull().default('daily'),
  weekdays: text('weekdays').notNull().default('1111111'),
  monthDays: text('month_days').notNull().default(''),
  intervalDays: integer('interval_days').notNull().default(1),
  times: text('times').notNull().default('08:00x1'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  isActive: integer('is_active').notNull().default(1),
  scheduleFrom: text('schedule_from'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const pillDoses = sqliteTable('pill_doses', {
  uuid: text('uuid').primaryKey(),
  planUuid: text('plan_uuid').notNull(),
  dueDate: text('due_date').notNull(),
  dueTime: text('due_time').notNull(),
  seq: integer('seq').notNull().default(1),
  status: text('status').notNull().default('pending'),
  takenAt: text('taken_at'),
  updatedAt: text('updated_at'),
});
