import { ACHIEVEMENTS, achievementValues, evaluateAchievements } from '../achievements';
import type { Habit, HabitLog } from '../logic';
import { addDays } from '../logic';

const habit = (uuid: string, over: Partial<Habit> = {}): Habit => ({
  uuid,
  category_uuid: null,
  preset_key: null,
  name: uuid,
  icon: '⭐',
  color: '#007AFF',
  motivation: null,
  kind: 'build',
  goal_type: 'completion',
  target_amount: 1,
  step_amount: 1,
  unit: '',
  frequency_type: 'daily',
  weekdays: '1111111',
  times_per_week: 1,
  times_per_month: 1,
  interval_days: 1,
  day_part: 'any',
  duration_type: 'forever',
  duration_days: null,
  start_date: '2026-01-01',
  end_date: null,
  planner_minutes: null,
  is_archived: 0,
  sort_key: uuid,
  ...over,
});

const log = (h: string, day: string, status: HabitLog['status'] = 'done'): HabitLog => ({
  uuid: `${h}-${day}-${status}`,
  habit_uuid: h,
  log_date: day,
  status,
  amount: 1,
  completions: 1,
  target_amount: 1,
  note: null,
  mood: null,
});

const TODAY = '2026-11-03';
const run = (h: string, n: number) =>
  Array.from({ length: n }, (_, i) => log(h, addDays(TODAY, -i)));

describe('achievements', () => {
  test('the catalog has the 17 rows of the website, with unique codes', () => {
    expect(ACHIEVEMENTS).toHaveLength(17);
    expect(new Set(ACHIEVEMENTS.map((a) => a.code)).size).toBe(17);
  });

  test('nothing is unlocked with no data', () => {
    const all = evaluateAchievements([], [], TODAY);
    expect(all.filter((a) => a.unlocked)).toHaveLength(0);
  });

  test('a 7-day streak unlocks 3 and 7, not 21', () => {
    const all = evaluateAchievements([habit('a')], run('a', 7), TODAY);
    const open = all.filter((a) => a.unlocked).map((a) => a.code);
    expect(open).toEqual(expect.arrayContaining(['streak_3', 'streak_7', 'perfect_1']));
    expect(open).not.toContain('streak_21');
  });

  test('totals, perfect days and the 30-day rate follow the website rules', () => {
    const logs = [...run('a', 10), ...run('b', 5), log('b', addDays(TODAY, -8), 'skipped')];
    const v = achievementValues([habit('a'), habit('b')], logs, TODAY);
    expect(v.total_checkins).toBe(15);
    expect(v.perfect_days).toBe(9); // 10 giorni di «a», meno quello in cui «b» è saltata
    expect(v.habit_count).toBe(2);
    expect(v.completion_rate).toBe(100); // i saltati non contano
  });

  test('a failed log breaks a perfect day and lowers the rate; archived habits are not active', () => {
    const logs = [log('a', TODAY), log('b', TODAY, 'failed')];
    const v = achievementValues([habit('a'), habit('b', { is_archived: 1 })], logs, TODAY);
    expect(v.perfect_days).toBe(0);
    expect(v.completion_rate).toBe(50);
    expect(v.habit_count).toBe(1);
  });

  test('«Ritorno» is never unlocked (the website never awards it)', () => {
    const all = evaluateAchievements(
      [habit('a', { start_date: '2025-01-01' })],
      run('a', 400),
      TODAY,
    );
    expect(all.find((a) => a.code === 'comeback_1')?.unlocked).toBe(false);
    expect(all.find((a) => a.code === 'streak_365')?.unlocked).toBe(true);
  });
});
