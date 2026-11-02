import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { pendingCount } from '@/core/sync/outbox';
import { TasksRepo } from '@/features/tasks/repo';

import { CategoriesRepo } from '../categoriesRepo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const clock = () => `2026-11-02T10:00:${String(n++).padStart(2, '0')}Z`;
  let id = 0;
  const newId = () => `u${++id}`;
  return { db, cats: new CategoriesRepo(db, clock, newId), tasks: new TasksRepo(db, clock, newId) };
}

test('create keeps order and queues one mutation each', () => {
  const { db, cats } = setup();
  cats.create('spesa', '#E8B86B');
  cats.create('casa');
  expect(cats.list().map((c) => [c.name, c.color])).toEqual([
    ['spesa', '#E8B86B'],
    ['casa', '#B7AEA3'],
  ]);
  expect(pendingCount(db)).toBe(2);
});

test('rename and recolor coalesce into the pending create', () => {
  const { db, cats } = setup();
  const id = cats.create('spesa');
  cats.update(id, { name: 'cibo', color: '#000000' });
  expect(cats.list()[0]).toMatchObject({ name: 'cibo', color: '#000000' });
  expect(pendingCount(db)).toBe(1);
});

test('removing a category frees its items and queues the delete', () => {
  const { db, cats, tasks } = setup();
  const c = cats.create('spesa');
  const t = tasks.create(
    { title: 'latte', buy_category_uuid: c, buy_price_cents: 189 },
    { listType: 'buy' },
  );
  expect(tasks.get(t)).toMatchObject({ buy_category_uuid: c, buy_price_cents: 189 });
  cats.remove(c);
  expect(cats.list()).toEqual([]);
  expect(tasks.get(t)?.buy_category_uuid).toBeNull();
  expect(pendingCount(db)).toBeGreaterThan(0);
});
