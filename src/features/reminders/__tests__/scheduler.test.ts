import { memoryDb } from '@/core/db/__tests__/testDb';
import { HabitsRepo } from '@/features/habits/repo';
import type { PlanInput } from '@/features/pills/logic';
import { PillsRepo } from '@/features/pills/repo';

import type { Reminder, ReminderSettings } from '../plan';
import { habitsDue, rescheduleAll, type Notifier } from '../scheduler';
import { RemindersStore } from '../store';

const TODAY = '2026-11-05';
const NOW = new Date(2026, 10, 5, 10, 0, 0);
const words = { pillsTitle: 'Pills', habitsTitle: 'Habits' };
const on: ReminderSettings = { pills: true, habits: true, habitTime: '20:00' };

function setup() {
  const db = memoryDb();
  const pills = new PillsRepo(
    db,
    () => TODAY,
    () => `${TODAY} 10:00:00`,
  );
  const habits = new HabitsRepo(db, undefined, undefined, () => TODAY);
  return { db, pills, habits };
}

function fakeNotifier(allowed = true) {
  const scheduled: Reminder[] = [];
  let cancels = 0;
  const n: Notifier = {
    allowed: async () => allowed,
    cancelAll: async () => {
      cancels++;
      scheduled.length = 0;
    },
    schedule: async (r) => void scheduled.push(r),
  };
  return { n, scheduled, cancels: () => cancels };
}

const plan = (o: Partial<PlanInput> = {}): PlanInput => ({
  name: 'Vitamin D',
  dose: '1 tablet',
  notes: '',
  color: '#B7A6D6',
  freq_type: 'daily',
  weekdays: '1111111',
  month_days: '',
  interval_days: 1,
  times: '08:00,20:00',
  start_date: '2026-11-01',
  end_date: null,
  is_active: true,
  ...o,
});

const run = (
  s: ReturnType<typeof setup>,
  f: ReturnType<typeof fakeNotifier>,
  settings = on,
  previous?: string | null,
) =>
  rescheduleAll({
    notifier: f.n,
    settings,
    pills: s.pills,
    habits: s.habits,
    today: TODAY,
    now: NOW,
    words,
    previous,
  });

describe('PillsRepo.upcoming', () => {
  test('lists the doses still to take over the next days without writing anything', () => {
    const s = setup();
    s.pills.createPlan(plan());
    const rows = () => s.db.all('SELECT * FROM pill_doses').length;
    const before = rows();
    const out = s.pills.upcoming(2);
    expect(out.map((d) => `${d.due_date} ${d.due_time}`)).toEqual([
      '2026-11-05 08:00',
      '2026-11-05 20:00',
      '2026-11-06 08:00',
      '2026-11-06 20:00',
    ]);
    expect(rows()).toBe(before);
  });

  test('a dose already taken or skipped is left out; a paused plan makes nothing', () => {
    const s = setup();
    s.pills.createPlan(plan());
    const day = s.pills.day(TODAY);
    s.pills.setStatus(day.doses[0]!.uuid, 'taken');
    s.pills.setStatus(day.doses[1]!.uuid, 'skipped');
    expect(s.pills.upcoming(1)).toEqual([]);
    const s2 = setup();
    s2.pills.createPlan(plan({ is_active: false }));
    expect(s2.pills.upcoming(3)).toEqual([]);
  });
});

describe('habitsDue', () => {
  test("skips quit habits, and today's habit once it is done", () => {
    const s = setup();
    const water = s.habits.create({ name: 'Water', icon: '💧', start_date: '2026-11-01' });
    s.habits.create({ name: 'Read', icon: '📖', start_date: '2026-11-01' });
    s.habits.create({ name: 'No sugar', kind: 'quit', start_date: '2026-11-01' });
    s.habits.checkIn(water, TODAY, 'toggle');
    const out = habitsDue(s.habits, TODAY, 2);
    expect(out.map((h) => `${h.date} ${h.name}`)).toEqual([
      '2026-11-05 Read',
      '2026-11-06 Water',
      '2026-11-06 Read',
    ]);
  });

  test('respects the weekdays of the habit', () => {
    const s = setup();
    // 2026-11-05 is a Thursday: only Mondays
    s.habits.create({ name: 'Gym', start_date: '2026-11-01', weekdays: '1000000' });
    expect(habitsDue(s.habits, TODAY, 3)).toEqual([]);
  });
});

describe('PillsRepo.takeSlot (the notification button)', () => {
  test('marks the dose taken, even one that was never written yet, and not twice', () => {
    const s = setup();
    s.pills.createPlan(plan({ times: '20:00' }));
    const [due] = s.pills.upcoming(2).filter((d) => d.due_date !== TODAY);
    const slot = { plan: due!.plan_uuid, date: due!.due_date, time: due!.due_time, seq: due!.seq };
    expect(s.pills.takeSlot(slot)).toBe(true);
    expect(s.pills.day(slot.date).doses[0]!.status).toBe('taken');
    expect(s.pills.takeSlot(slot)).toBe(true);
    expect(s.pills.upcoming(3).some((d) => d.due_date === slot.date)).toBe(false);
  });

  test('a plan that is gone, or a slot that is not planned, does nothing', () => {
    const s = setup();
    s.pills.createPlan(plan({ times: '20:00' }));
    expect(s.pills.takeSlot({ plan: 'nope', date: TODAY, time: '20:00', seq: 0 })).toBe(false);
    expect(s.pills.takeSlot({ plan: 'nope', date: TODAY, time: '03:33', seq: 9 })).toBe(false);
  });
});

describe('rescheduleAll', () => {
  test('cancels the old ones and schedules the new, in time order', async () => {
    const s = setup();
    s.pills.createPlan(plan());
    s.habits.create({ name: 'Water', icon: '💧', start_date: '2026-11-01' });
    const f = fakeNotifier();
    const r = await run(s, f);
    expect(f.cancels()).toBe(1);
    expect(r.count).toBe(f.scheduled.length);
    const times = f.scheduled.map((x) => x.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(f.scheduled.find((x) => x.kind === 'pill')).toMatchObject({
      id: expect.stringMatching(/^pill-.*-2026-11-05-20:00-\d+$/),
      title: 'Pills',
    });
    expect(f.scheduled.some((x) => x.kind === 'habits')).toBe(true);
    expect(f.scheduled.length).toBeLessThanOrEqual(60);
  });

  test('the same list as last time touches nothing', async () => {
    const s = setup();
    s.pills.createPlan(plan());
    const f = fakeNotifier();
    const first = await run(s, f);
    const again = await run(s, f, on, first.signature);
    expect(f.cancels()).toBe(1);
    expect(again.signature).toBe(first.signature);
  });

  test('a taken dose disappears from the next run', async () => {
    const s = setup();
    s.pills.createPlan(plan({ times: '20:00' }));
    const f = fakeNotifier();
    const first = await run(s, f);
    const tonight = (x: { id: string }) => x.id.includes('2026-11-05-20:00');
    expect(f.scheduled.some(tonight)).toBe(true);
    s.pills.setStatus(s.pills.day(TODAY).doses[0]!.uuid, 'taken');
    await run(s, f, on, first.signature);
    expect(f.scheduled.some(tonight)).toBe(false);
  });

  test('without the phone permission, or with everything off, nothing is scheduled', async () => {
    const s = setup();
    s.pills.createPlan(plan());
    const denied = fakeNotifier(false);
    expect((await run(s, denied)).count).toBe(0);
    expect(denied.scheduled).toEqual([]);
    const off = fakeNotifier();
    expect((await run(s, off, { ...on, pills: false, habits: false })).count).toBe(0);
    expect(off.cancels()).toBe(1); // turning off removes what was there
  });
});

describe('notifications already on the phone', () => {
  function shownNotifier() {
    const f = fakeNotifier();
    const shown: { id: string; pill: { plan: string; date: string; time: string; seq: number } }[] =
      [];
    const dismissed: string[] = [];
    f.n.delivered = async () => [...shown];
    f.n.dismiss = async (ids) => void dismissed.push(...ids);
    return { f, shown, dismissed };
  }

  test('a shown pill notification goes away once the dose is taken or skipped, even with the same list', async () => {
    const s = setup();
    s.pills.createPlan(plan({ times: '08:00,09:00,09:30' }));
    const doses = s.pills.day(TODAY).doses;
    const [a, b, c] = doses;
    const { f, shown, dismissed } = shownNotifier();
    for (const d of [a!, b!, c!])
      shown.push({
        id: `n-${d.uuid}`,
        pill: { plan: d.plan_uuid, date: d.due_date, time: d.due_time, seq: d.seq },
      });
    const first = await run(s, f);
    expect(dismissed).toEqual([]); // all still to do: they stay
    s.pills.setStatus(a!.uuid, 'taken');
    s.pills.setStatus(b!.uuid, 'skipped');
    await run(s, f, on, first.signature); // the planned list is the same (all of it is in the past)
    expect(dismissed.sort()).toEqual([`n-${a!.uuid}`, `n-${b!.uuid}`].sort());
  });

  test('a dose that is not written yet, or still pending, is left alone', async () => {
    const s = setup();
    s.pills.createPlan(plan({ times: '08:00' }));
    const { f, shown, dismissed } = shownNotifier();
    shown.push({ id: 'ghost', pill: { plan: 'nope', date: TODAY, time: '08:00', seq: 0 } });
    expect(s.pills.slotStatus(shown[0]!.pill)).toBeNull();
    await run(s, f);
    expect(dismissed).toEqual([]);
  });

  test('a notifier without those two functions is fine', async () => {
    const s = setup();
    s.pills.createPlan(plan());
    await expect(run(s, fakeNotifier())).resolves.toBeDefined();
  });
});

describe('RemindersStore', () => {
  test('starts off, keeps what is saved and cleans bad values', () => {
    const db = memoryDb();
    const store = new RemindersStore(db);
    expect(store.read()).toEqual({ pills: false, habits: false, habitTime: '20:00' });
    store.update({ pills: true, habitTime: '07:15' });
    expect(new RemindersStore(db).read()).toEqual({
      pills: true,
      habits: false,
      habitTime: '07:15',
    });
    store.update({ habitTime: 'abc' });
    expect(store.read().habitTime).toBe('20:00');
  });
});
