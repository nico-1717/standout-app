import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { parseHabitSheets } from '../importFile';
import { planImport, saveImport } from '../importSave';
import { HabitsRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  const habits = new HabitsRepo(db, undefined, undefined, () => '2026-11-08');
  return { db, habits };
}

const FILE = parseHabitSheets([
  {
    name: 'All',
    rows: [
      ['Habit', 'Date', 'Time', 'Mood', 'Habit Log'],
      ['Run', '2026-11-01', '07:30', '5', 'fast'],
      ['Run', '2026-11-01', '18:00', '', ''],
      ['Run', '2026-11-02', '', '', ''],
      ['Run', '2027-01-01', '', '', ''], // nel futuro: si scarta
      ['Read', '2026-11-03', '', '', ''],
    ],
  },
]);

describe('habit import: save', () => {
  test('plan: new vs existing habits, check-ins and days counted', () => {
    const { habits } = setup();
    const read = habits.create({ name: 'read!' });
    const plan = planImport(FILE, habits.list());
    expect(plan).toEqual([
      { key: 'H0', name: 'Run', checkins: 4, days: 3, existing: null },
      { key: 'H1', name: 'Read', checkins: 1, days: 1, existing: read },
    ]);
  });

  test('new habits are created, rows of one day add up, the future is dropped', () => {
    const { db, habits } = setup();
    const r = saveImport(db, habits, FILE, {});
    expect(r).toEqual({ habits: 2, days: 3, checkins: 5 });
    const run = habits.list().find((h) => h.name === 'Run')!;
    expect(run.start_date).toBe('2026-11-01');
    expect(run.goal_type).toBe('completion');
    const logs = habits.logsOf(run.uuid);
    expect(logs.map((l) => [l.log_date, l.status, l.completions, l.mood, l.note])).toEqual([
      ['2026-11-01', 'done', 2, 5, 'fast'],
      ['2026-11-02', 'done', 1, null, null],
    ]);
    expect(logs[0]!.first_logged_at).toBe('2026-11-01 07:30:00');
    expect(logs[1]!.first_logged_at).toBeNull();
  });

  test('a linked habit is used; importing twice changes nothing; a real check-in is kept', () => {
    const { db, habits } = setup();
    const run = habits.create({
      name: 'Running',
      goal_type: 'quantity',
      target_amount: 3,
      step_amount: 1,
    });
    habits.checkIn(run, '2026-11-02', 'increment');
    habits.setNote(run, '2026-11-02', { note: 'mine' });
    saveImport(db, habits, FILE, { H0: run });
    const once = habits
      .logsOf(run)
      .map((l) => [l.log_date, l.amount, l.completions, l.status, l.note]);
    expect(once).toEqual([
      ['2026-11-01', 2, 2, 'partial'.replace('partial', 'done'), 'fast'],
      ['2026-11-02', 1, 1, 'partial', 'mine'],
    ]);
    saveImport(db, habits, FILE, { H0: run });
    const twice = habits
      .logsOf(run)
      .map((l) => [l.log_date, l.amount, l.completions, l.status, l.note]);
    expect(twice).toEqual(once);
    expect(habits.list().filter((h) => h.name === 'Running')).toHaveLength(1);
  });
});
