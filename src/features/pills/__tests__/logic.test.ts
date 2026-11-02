import golden from './fixtures/pillsGolden.json';
import {
  cleanPlan,
  daysBefore,
  dosesFor,
  historyOf,
  isDue,
  markAll,
  parseTimes,
  rhythmChanged,
  scheduleFromFor,
  setDayCount,
  type PillPlan,
  type PlanInput,
} from '../logic';

/* Test d'oro: i risultati sono quelli del codice vero del sito (lib/pills_core.php), in fuso Europe/Rome,
   catturati con un piccolo script PHP. Se questo test si rompe, l'app e il sito non fanno più le stesse prese. */

test('parseTimes gives the same list as the website for every sample', () => {
  for (const t of golden.times) {
    const mine = parseTimes(t.in).map((s) => [`${s.time}:00`, s.n]);
    expect(mine).toEqual(t.out);
  }
});

test('isDue gives the same days as the website for every plan, across a whole year (DST included)', () => {
  const plans = golden.plans as { plan: PillPlan; due: string[] }[];
  expect(plans.length).toBeGreaterThan(80);
  let total = 0;
  for (const { plan, due } of plans) {
    const got: string[] = [];
    for (let d = new Date(2025, 11, 20); d <= new Date(2027, 0, 10); d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (isDue(plan, iso)) got.push(iso);
    }
    expect({ plan, got }).toEqual({ plan, got: due });
    total += due.length;
  }
  expect(total).toBeGreaterThan(5000);
});

const plan = (o: Partial<PillPlan> = {}): PillPlan => ({
  uuid: 'p1',
  name: 'Vitamin D',
  dose: '',
  notes: '',
  color: '#B7A6D6',
  freq_type: 'daily',
  weekdays: '1111111',
  month_days: '',
  interval_days: 1,
  times: '08:00x1,20:00x2',
  start_date: '2026-11-01',
  end_date: null,
  is_active: 1,
  schedule_from: null,
  created_at: null,
  ...o,
});

test('dosesFor writes one dose per time and number, in clock order', () => {
  const r = dosesFor([plan()], ['2026-11-02']);
  expect(r.map((d) => `${d.due_time}#${d.seq}`)).toEqual(['08:00#1', '20:00#1', '20:00#2']);
});

test('dosesFor skips inactive plans, days before the start and days before the schedule start', () => {
  expect(dosesFor([plan({ is_active: 0 })], ['2026-11-02'])).toEqual([]);
  expect(dosesFor([plan()], ['2026-10-31'])).toEqual([]);
  // l'orario è cambiato il 2 novembre: i giorni prima non si rigenerano (il bug delle prese che ritornavano)
  const p = plan({ schedule_from: '2026-11-02' });
  expect(dosesFor([p], ['2026-11-01'])).toEqual([]);
  expect(dosesFor([p], ['2026-11-02']).length).toBe(3);
});

test('daysBefore counts back from today', () => {
  expect(daysBefore('2026-11-02', 3)).toEqual(['2026-11-01', '2026-10-31', '2026-10-30']);
});

test('scheduleFrom: new plan from its start; changed rhythm from today, or tomorrow if a dose was signed today', () => {
  const before = { schedule_from: '2026-11-01', start_date: '2026-11-01' };
  const base = { before, startDate: '2026-11-01', today: '2026-11-02' };
  expect(scheduleFromFor({ ...base, before: null, changed: false, signedToday: false })).toBe(
    '2026-11-01',
  );
  expect(scheduleFromFor({ ...base, changed: false, signedToday: true })).toBe('2026-11-01');
  expect(scheduleFromFor({ ...base, changed: true, signedToday: false })).toBe('2026-11-02');
  expect(scheduleFromFor({ ...base, changed: true, signedToday: true })).toBe('2026-11-03');
  expect(
    scheduleFromFor({
      ...base,
      before: { schedule_from: null, start_date: '2026-10-01' },
      changed: false,
      signedToday: false,
    }),
  ).toBe('2026-10-01');
});

test('rhythmChanged ignores name and colour, sees times and days', () => {
  const a = plan();
  expect(rhythmChanged(a, plan({ name: 'Other', color: '#000000' }))).toBe(false);
  expect(rhythmChanged(a, plan({ times: '09:00x1' }))).toBe(true);
  expect(rhythmChanged(a, plan({ weekdays: '1111100' }))).toBe(true);
  expect(rhythmChanged(a, plan({ interval_days: 3 }))).toBe(true);
});

const d = (
  uuid: string,
  due_time: string,
  status: 'pending' | 'taken' | 'skipped' = 'pending',
) => ({
  uuid,
  due_time,
  status,
  due_date: '2026-11-01',
});

test('setDayCount on a past day: the first n taken, the rest skipped', () => {
  const doses = [d('a', '08:00'), d('b', '14:00'), d('c', '20:00')];
  const r = setDayCount(doses, 1, '2026-11-01', '2026-11-02', '2026-11-02 10:00:00');
  expect(r.taken).toBe(1);
  expect(r.tot).toBe(3);
  expect(r.changes).toEqual([
    { uuid: 'b', status: 'skipped', taken_at: null },
    { uuid: 'c', status: 'skipped', taken_at: null },
    { uuid: 'a', status: 'taken', taken_at: '2026-11-01 08:00:00' },
  ]);
});

test('setDayCount today: the rest stays pending, and a dose is never taken in the future', () => {
  const doses = [d('a', '08:00'), d('b', '20:00')];
  const r = setDayCount(doses, 2, '2026-11-02', '2026-11-02', '2026-11-02 12:00:00');
  expect(r.changes).toEqual([
    { uuid: 'a', status: 'taken', taken_at: '2026-11-02 08:00:00' },
    { uuid: 'b', status: 'taken', taken_at: '2026-11-02 12:00:00' },
  ]);
  // meno prese di prima: l'ultima spuntata torna in sospeso (oggi)
  const back = setDayCount(
    [d('a', '08:00', 'taken'), d('b', '20:00', 'taken')],
    1,
    '2026-11-02',
    '2026-11-02',
    '2026-11-02 21:00:00',
  );
  expect(back.changes).toEqual([{ uuid: 'b', status: 'pending', taken_at: null }]);
});

test('setDayCount keeps skipped doses last and does nothing on an empty day', () => {
  const r = setDayCount(
    [d('a', '08:00', 'skipped'), d('b', '20:00')],
    1,
    '2026-11-01',
    '2026-11-02',
    '2026-11-02 10:00:00',
  );
  expect(r.changes.find((c) => c.status === 'taken')!.uuid).toBe('b');
  expect(setDayCount([], 2, '2026-11-01', '2026-11-02', '2026-11-02 10:00:00')).toEqual({
    taken: 0,
    tot: 0,
    changes: [],
  });
});

test('markAll: only the not-yet-taken ones, on time or now, never in the future', () => {
  const doses = [
    { uuid: 'a', status: 'taken' as const, due_date: '2026-11-02', due_time: '08:00' },
    { uuid: 'b', status: 'pending' as const, due_date: '2026-11-02', due_time: '10:00' },
    { uuid: 'c', status: 'skipped' as const, due_date: '2026-11-02', due_time: '23:00' },
  ];
  expect(markAll(doses, 'on_time', '2026-11-02 12:00:00')).toEqual([
    { uuid: 'b', status: 'taken', taken_at: '2026-11-02 10:00:00' },
    { uuid: 'c', status: 'taken', taken_at: '2026-11-02 12:00:00' },
  ]);
  expect(markAll(doses, 'now', '2026-11-02 12:00:00').map((c) => c.taken_at)).toEqual([
    '2026-11-02 12:00:00',
    '2026-11-02 12:00:00',
  ]);
});

test('historyOf counts per day and ignores days outside the range', () => {
  const doses = [
    { due_date: '2026-11-01', status: 'taken' as const },
    { due_date: '2026-11-01', status: 'skipped' as const },
    { due_date: '2026-11-02', status: 'pending' as const },
    { due_date: '2026-10-01', status: 'taken' as const },
  ];
  expect(historyOf(doses, '2026-11-01', '2026-11-30')).toEqual([
    { date: '2026-11-01', taken: 1, skipped: 1, pending: 0 },
    { date: '2026-11-02', taken: 0, skipped: 0, pending: 1 },
  ]);
});

test('cleanPlan applies the same rules as the server', () => {
  const ok: PlanInput = {
    name: '  Iron ',
    dose: '',
    notes: '',
    color: '#B7A6D6',
    freq_type: 'daily',
    weekdays: '1111111',
    month_days: '',
    interval_days: 1,
    times: '20:00x2,08:00',
    start_date: '2026-11-02',
    end_date: null,
    is_active: true,
  };
  const r = cleanPlan(ok);
  expect(r.ok && r.plan.name).toBe('Iron');
  expect(r.ok && r.plan.times).toBe('08:00x1,20:00x2');
  const bad = (o: Partial<PlanInput>) => {
    const x = cleanPlan({ ...ok, ...o });
    return x.ok ? null : x.error.field;
  };
  expect(bad({ name: ' ' })).toBe('name');
  expect(bad({ color: 'red' })).toBe('color');
  expect(bad({ weekdays: '0000000' })).toBe('weekdays');
  expect(bad({ freq_type: 'monthly' })).toBe('month_days');
  expect(bad({ freq_type: 'monthly', month_days: '32' })).toBe('month_days');
  expect(bad({ interval_days: 0 })).toBe('interval_days');
  expect(bad({ times: '25:00x1' })).toBe('times');
  expect(bad({ times: '8:00' })).toBe('times');
  expect(bad({ start_date: '2026-02-30' })).toBe('start_date');
  expect(bad({ end_date: '2026-11-01' })).toBe('end_date');
});
