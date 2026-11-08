import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { upsertRow } from '@/core/sync/rows';
import type { Habit, HabitLog } from '@/features/habits/logic';
import type { Project } from '@/features/projects/logic';

import { cleanTime, quickLists } from '../quickAdd';
import { PlannerRepo } from '../repo';

const habit = (o: Partial<Habit>): Habit => ({
  uuid: 'h1',
  category_uuid: null,
  preset_key: null,
  name: 'Read',
  icon: '📖',
  color: '#3366CC',
  motivation: null,
  kind: 'build',
  goal_type: 'completion',
  target_amount: 1,
  step_amount: 1,
  unit: '',
  frequency_type: 'daily',
  weekdays: '1111111',
  times_per_week: 7,
  times_per_month: 30,
  interval_days: 1,
  day_part: 'any',
  duration_type: 'forever',
  duration_days: null,
  start_date: '2026-10-01',
  end_date: null,
  planner_minutes: null,
  is_archived: 0,
  sort_key: 'a0',
  ...o,
});
const project = (o: Partial<Project>): Project =>
  ({
    uuid: 'p1',
    parent_uuid: null,
    name: 'Thesis',
    notes: '',
    status: 'active',
    color: '#aa5500',
    color_edited: 0,
    target_date: null,
    due_date: null,
    todo_enabled: 0,
    is_favorite: 1,
    sort_key: 'a0',
    study_event_uuid: null,
    study_start: null,
    study_end: null,
    study_pomodori_stimati: null,
    study_ripasso_di_uuid: null,
    study_ripasso_n: null,
    created_at: null,
    ...o,
  }) as Project;

// 2026-11-04 is a Wednesday
const DATE = '2026-11-04';

describe('quickLists', () => {
  test('daily habits due that day, weekly ones with the week count, favourite projects by name', () => {
    const logs = [
      { uuid: 'l1', habit_uuid: 'w1', log_date: '2026-11-02', status: 'done' },
      { uuid: 'l2', habit_uuid: 'w1', log_date: '2026-11-03', status: 'done' },
      { uuid: 'l3', habit_uuid: 'w1', log_date: '2026-11-03', status: 'skipped' },
      { uuid: 'l4', habit_uuid: 'w1', log_date: '2026-10-30', status: 'done' },
    ] as HabitLog[];
    const r = quickLists({
      date: DATE,
      habits: [
        habit({}),
        habit({ uuid: 'h2', name: 'Not Wednesday', weekdays: '1000000' }),
        habit({ uuid: 'h3', name: 'Quit smoking', kind: 'quit' }),
        habit({ uuid: 'h4', name: 'Old', is_archived: 1 }),
        habit({ uuid: 'h5', name: 'Walk', planner_minutes: 45 }),
        habit({ uuid: 'w1', name: 'Gym', frequency_type: 'weekly', times_per_week: 3 }),
      ],
      logs,
      projects: [
        project({ uuid: 'p2', name: 'Zoo' }),
        project({}),
        project({ uuid: 'p3', name: 'Hidden', is_favorite: 0 }),
      ],
    });
    expect(r.habits.map((h) => h.name)).toEqual(['Read', 'Walk']);
    expect(r.habits[1]!.minutes).toBe(45);
    expect(r.weekly.map((h) => `${h.name} ${h.progress}`)).toEqual(['Gym 2/3']);
    expect(r.projects.map((p) => p.name)).toEqual(['Thesis', 'Zoo']);
  });
});

describe('cleanTime', () => {
  test('accepts H:MM and HH:MM, rejects the rest', () => {
    expect(cleanTime('9:05')).toBe('09:05');
    expect(cleanTime(' 18:30 ')).toBe('18:30');
    expect(cleanTime('24:00')).toBeNull();
    expect(cleanTime('12:60')).toBeNull();
    expect(cleanTime('noon')).toBeNull();
  });
});

describe('PlannerRepo.placeLinked', () => {
  function setup() {
    const db = memoryDb();
    migrate(db);
    let n = 0;
    const repo = new PlannerRepo(
      db,
      () => '2026-11-04T10:00:00Z',
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

  test('a habit becomes a task linked to the habit, and goes to the server with habit_uuid', () => {
    const { db, repo } = setup();
    const id = repo.placeLinked(
      { kind: 'habit', uuid: 'h1', name: 'Read', color: '#3366CC' },
      DATE,
      '08:00',
      30,
    );
    const ev = repo.eventsInRange(DATE, DATE).find((e) => e.uuid === id)!;
    expect(ev).toMatchObject({
      title: 'Read',
      start: '08:00',
      end: '08:30',
      type: 'task',
      habitUuid: 'h1',
      projectUuid: null,
      calendarUuid: 'cal-main',
      notify: 'none',
    });
    const [op] = nextBatch(db, 10);
    expect(op).toMatchObject({ table: 'planner_events', uuid: id, op: 'upsert' });
    expect(op!.patch).toMatchObject({ title: 'Read', item_type: 'task', habit_uuid: 'h1' });
    expect(op!.patch).not.toHaveProperty('project_uuid');
  });

  test('a favourite project becomes an event linked to the project, and goes with project_uuid', () => {
    const { db, repo } = setup();
    const id = repo.placeLinked(
      { kind: 'project', uuid: 'p1', name: 'Thesis', color: '#aa5500' },
      DATE,
      '23:30',
      60,
    );
    const ev = repo.eventsInRange(DATE, DATE).find((e) => e.uuid === id)!;
    expect(ev).toMatchObject({ type: 'event', projectUuid: 'p1', habitUuid: null, end: '23:59' });
    const [op] = nextBatch(db, 10);
    expect(op!.patch).toMatchObject({ item_type: 'event', project_uuid: 'p1', color: '#aa5500' });
    expect(op!.patch).not.toHaveProperty('habit_uuid');
  });
});
