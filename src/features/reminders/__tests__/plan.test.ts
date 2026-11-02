import {
  cleanReminders,
  localDate,
  planReminders,
  validTime,
  type ReminderSettings,
} from '../plan';

const words = { pillsTitle: 'Pills', habitsTitle: 'Habits' };
const NOW = new Date(2026, 10, 5, 10, 0, 0);
const on: ReminderSettings = { pills: true, habits: true, habitTime: '20:00' };
const pill = (due_date: string, due_time: string, name = 'Vitamin D', plan_dose = '1 tablet') => ({
  due_date,
  due_time,
  name,
  plan_dose,
});

describe('cleanReminders', () => {
  test('anything odd falls back to off and 20:00', () => {
    expect(cleanReminders(null)).toEqual({ pills: false, habits: false, habitTime: '20:00' });
    expect(cleanReminders({ pills: 'yes', habitTime: '25:99' })).toEqual({
      pills: false,
      habits: false,
      habitTime: '20:00',
    });
    expect(cleanReminders({ pills: true, habits: true, habitTime: '07:05' })).toEqual({
      pills: true,
      habits: true,
      habitTime: '07:05',
    });
  });
  test('validTime', () => {
    expect(['00:00', '23:59', '09:30'].every(validTime)).toBe(true);
    expect(['24:00', '9:30', '12:60', '', 5].some(validTime)).toBe(false);
  });
});

describe('planReminders', () => {
  test('pills at the same time make one notification; past ones are dropped', () => {
    const out = planReminders({
      now: NOW,
      settings: on,
      pills: [
        pill('2026-11-05', '09:00'), // already past
        pill('2026-11-05', '13:00', 'Zinc', ''),
        pill('2026-11-05', '13:00', 'Vitamin D'),
        pill('2026-11-05', '13:00', 'Vitamin D'), // second dose of the same drug: written once
      ],
      habits: [],
      words,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'pill-2026-11-05 13:00',
      kind: 'pill',
      title: 'Pills',
      body: 'Zinc, Vitamin D (1 tablet)',
    });
    expect(out[0]!.at).toEqual(new Date(2026, 10, 5, 13, 0));
  });

  test('habits make one notification per day at the chosen time', () => {
    const out = planReminders({
      now: NOW,
      settings: { ...on, habitTime: '18:30' },
      pills: [],
      habits: [
        { date: '2026-11-05', icon: '💧', name: 'Water' },
        { date: '2026-11-05', icon: '📖', name: 'Read' },
        { date: '2026-11-06', icon: '💧', name: 'Water' },
      ],
      words,
    });
    expect(out.map((r) => r.id)).toEqual(['habits-2026-11-05', 'habits-2026-11-06']);
    expect(out[0]!.body).toBe('💧 Water, 📖 Read');
    expect(out[0]!.at).toEqual(new Date(2026, 10, 5, 18, 30));
  });

  test("today's habit reminder is skipped once its time has passed", () => {
    const out = planReminders({
      now: new Date(2026, 10, 5, 21, 0),
      settings: on,
      pills: [],
      habits: [{ date: '2026-11-05', icon: '', name: 'Water' }],
      words,
    });
    expect(out).toEqual([]);
  });

  test('a switched-off kind makes nothing', () => {
    const args = {
      now: NOW,
      pills: [pill('2026-11-05', '13:00')],
      habits: [{ date: '2026-11-05', icon: '', name: 'Water' }],
      words,
    };
    expect(
      planReminders({ ...args, settings: { ...on, pills: false } }).map((r) => r.kind),
    ).toEqual(['habits']);
    expect(
      planReminders({ ...args, settings: { ...on, habits: false } }).map((r) => r.kind),
    ).toEqual(['pill']);
    expect(planReminders({ ...args, settings: { ...on, pills: false, habits: false } })).toEqual(
      [],
    );
  });

  test('sorted by time, and cut to the limit keeping the nearest', () => {
    const pills = ['15:00', '11:00', '19:00'].map((h) => pill('2026-11-05', h));
    const out = planReminders({ now: NOW, settings: on, pills, habits: [], words, limit: 2 });
    expect(out.map((r) => r.id)).toEqual(['pill-2026-11-05 11:00', 'pill-2026-11-05 15:00']);
  });

  test('localDate reads the day and hour as local time', () => {
    expect(localDate('2026-12-31', '23:45')).toEqual(new Date(2026, 11, 31, 23, 45));
  });
});
