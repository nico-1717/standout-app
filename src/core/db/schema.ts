import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
