import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { upsertRow } from '@/core/sync/rows';
import { plannerPriorityUuid } from '@/core/sync/uuid5';

import { PlannerRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const repo = new PlannerRepo(
    db,
    () => '2026-11-03T10:00:00Z',
    () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    undefined,
    7,
  );
  upsertRow(db, 'planner_calendars', {
    uuid: 'cal-main',
    name: 'Main',
    color: null,
    is_visible: true,
    is_default: true,
    role: null,
    keywords: '',
    def_repeat: 'none',
    def_notify: 'none',
    sort_key: 'a0',
    created_at: null,
    updated_at: null,
  });
  db.run('DELETE FROM outbox');
  return { db, repo };
}
const batch = (db: ReturnType<typeof memoryDb>) => nextBatch(db, 50);

describe('priorities', () => {
  test('the id of a slot is the same one the server computes', () => {
    // valore calcolato dal PHP del sito: sync_uuid_priorita(7, '2030-02-04', 2)
    expect(plannerPriorityUuid(7, '2030-02-04', 2)).toBe('62673f31-b1d8-53d1-b81e-f109fd876716');
  });

  test('writes a slot, edits it, ticks it and removes it when it is empty and not ticked', () => {
    const { db, repo } = setup();
    expect(repo.setPriority('2030-02-04', 2, '  Study  ')).toBe(true);
    const id = plannerPriorityUuid(7, '2030-02-04', 2);
    expect(repo.priorities('2030-02-04')).toEqual([
      { uuid: id, priority_date: '2030-02-04', position: 2, content: 'Study', is_done: 0 },
    ]);
    const first = batch(db)[0]!;
    expect(first).toMatchObject({ table: 'planner_priorities', uuid: id, op: 'upsert' });
    expect(first.patch).toEqual({
      priority_date: '2030-02-04',
      position: 2,
      content: 'Study',
      is_done: false,
    });
    repo.setPriority('2030-02-04', 2, 'Study', true);
    expect(repo.priorities('2030-02-04')[0]!.is_done).toBe(1);
    repo.setPriority('2030-02-04', 2, '', false);
    expect(repo.priorities('2030-02-04')).toEqual([]);
    expect(batch(db).some((m) => m.op === 'delete')).toBe(true);
  });

  test('refuses slots outside 1..6; an unchanged value sends nothing', () => {
    const { db, repo } = setup();
    expect(repo.setPriority('2030-02-04', 7, 'x')).toBe(false);
    expect(repo.setPriority('2030-02-04', 0, 'x')).toBe(false);
    repo.setPriority('2030-02-04', 1, 'x');
    db.run('DELETE FROM outbox');
    repo.setPriority('2030-02-04', 1, 'x');
    expect(batch(db)).toHaveLength(0);
  });

  test('prioritiesInRange groups by day', () => {
    const { repo } = setup();
    repo.setPriority('2030-02-04', 1, 'a');
    repo.setPriority('2030-02-04', 2, 'b');
    repo.setPriority('2030-02-06', 1, 'c');
    const m = repo.prioritiesInRange('2030-02-04', '2030-02-10');
    expect(m.get('2030-02-04')!.map((p) => p.content)).toEqual(['a', 'b']);
    expect(m.get('2030-02-06')!).toHaveLength(1);
  });
});

describe('routines', () => {
  const steps = [
    { name: 'Shower', minutes: 10 },
    { name: 'Breakfast', minutes: 20 },
  ];

  test('saves a routine with its steps, then edits it (same steps keep their id)', () => {
    const { db, repo } = setup();
    expect(repo.saveRoutine({ name: ' ', color: '#E3D9EE', items: steps })).toBeNull();
    const id = repo.saveRoutine({ name: 'Morning', color: '#E3D9EE', items: steps })!;
    expect(repo.routines().map((r) => r.name)).toEqual(['Morning']);
    const before = repo.routineItems(id);
    expect(before.map((i) => [i.name, i.duration_minutes])).toEqual([
      ['Shower', 10],
      ['Breakfast', 20],
    ]);
    expect(batch(db).map((m) => m.table)).toEqual([
      'planner_routines',
      'planner_routine_items',
      'planner_routine_items',
    ]);
    db.run('DELETE FROM outbox');
    repo.saveRoutine({
      uuid: id,
      name: 'Morning',
      color: '#E3D9EE',
      items: [
        { name: 'Shower', minutes: 15 },
        { name: '', minutes: 5 },
      ],
    });
    const after = repo.routineItems(id);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ uuid: before[0]!.uuid, duration_minutes: 15 });
    const out = batch(db);
    expect(out.find((m) => m.uuid === before[0]!.uuid)!.patch).toEqual({ duration_minutes: 15 });
    expect(out.some((m) => m.uuid === before[1]!.uuid && m.op === 'delete')).toBe(true);
  });

  test('inserting a routine makes one block per step, in a row, with the same group', () => {
    const { db, repo } = setup();
    const id = repo.saveRoutine({ name: 'Morning', color: '#C6B6A6', items: steps })!;
    db.run('DELETE FROM outbox');
    expect(repo.insertRoutine(id, '2030-02-06', '07:00')).toBe(2);
    const rows = repo.rows().sort((a, b) => a.start_time.localeCompare(b.start_time));
    expect(rows.map((r) => [r.title, r.start_time, r.end_time])).toEqual([
      ['Shower', '07:00', '07:10'],
      ['Breakfast', '07:10', '07:30'],
    ]);
    expect(rows[0]!.routine_group).toMatch(/^[0-9a-f]{32}$/);
    expect(rows[0]!.routine_group).toBe(rows[1]!.routine_group);
    expect(rows[0]).toMatchObject({
      routine_uuid: id,
      calendar_uuid: 'cal-main',
      color: '#C6B6A6',
      notify_type: 'none',
    });
    const m = batch(db)[0]!;
    expect(m.patch).toMatchObject({
      routine_uuid: id,
      routine_group: rows[0]!.routine_group,
      routine_collapsed: true,
    });
  });

  test('a routine with no steps inserts nothing; the day stops at 23:59', () => {
    const { repo } = setup();
    const empty = repo.saveRoutine({ name: 'Empty', color: '#C6B6A6', items: [] })!;
    expect(repo.insertRoutine(empty, '2030-02-06', '07:00')).toBe(0);
    const long = repo.saveRoutine({
      name: 'Long',
      color: '#C6B6A6',
      items: [
        { name: 'A', minutes: 600 },
        { name: 'B', minutes: 600 },
        { name: 'C', minutes: 600 },
      ],
    })!;
    expect(repo.insertRoutine(long, '2030-02-07', '08:00')).toBeLessThanOrEqual(2);
  });

  test('open / close a routine block touches every piece; removing the routine keeps the blocks', () => {
    const { db, repo } = setup();
    const id = repo.saveRoutine({ name: 'Morning', color: '#C6B6A6', items: steps })!;
    repo.insertRoutine(id, '2030-02-06', '07:00');
    const group = repo.rows()[0]!.routine_group!;
    db.run('DELETE FROM outbox');
    repo.setRoutineCollapsed(group, false);
    expect(repo.rows().every((r) => r.routine_collapsed === 0)).toBe(true);
    expect(batch(db)).toHaveLength(2);
    repo.removeRoutine(id);
    expect(repo.routines()).toEqual([]);
    expect(repo.routineItems()).toEqual([]);
    expect(repo.rows()).toHaveLength(2);
  });

  test('deleting a routine block removes every piece', () => {
    const { repo } = setup();
    const id = repo.saveRoutine({ name: 'Morning', color: '#C6B6A6', items: steps })!;
    repo.insertRoutine(id, '2030-02-06', '07:00');
    const group = repo.rows()[0]!.routine_group!;
    expect(repo.removeRoutineBlock(group)).toBe(2);
    expect(repo.rows()).toHaveLength(0);
  });
});
