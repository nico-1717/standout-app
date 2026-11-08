import { dayLabel, hours, hoursField, parseHours, weekdayName } from '../format';
import { evenSplit, rebalance, rescale, type SplitRow } from '../split';
import golden from './fixtures/split-golden.json';

interface Case {
  kind: 'rebalance' | 'rescale';
  items: { v: number; locked: boolean }[];
  idx: number;
  want: number;
  total: number;
  out: number[];
}

const sum = (rows: SplitRow[]) => rows.reduce((a, r) => a + r.minutes, 0);
const row = (uuid: string, minutes: number, locked = false): SplitRow => ({
  uuid,
  minutes,
  locked,
});

describe('split math = the website (400 random cases)', () => {
  test.each((golden as Case[]).map((c, i) => [i, c] as const))('case %i', (_i, c) => {
    const rows = c.items.map((x, j) => row(String(j), x.v, x.locked));
    const out =
      c.kind === 'rebalance'
        ? rebalance(rows, String(c.idx), c.want, c.total)
        : rescale(rows, c.total);
    expect(out.map((r) => r.minutes)).toEqual(c.out);
  });
});

describe('split helpers', () => {
  test('a locked child cannot be moved and the total stays', () => {
    const rows = [row('a', 50, true), row('b', 50)];
    expect(rebalance(rows, 'a', 10, 100)).toBe(rows);
    const out = rebalance([row('a', 100), row('b', 200), row('c', 100)], 'a', 200, 400);
    expect(sum(out)).toBe(400);
  });

  test('even split shares what the locks leave, in steps of 5 minutes', () => {
    const out = evenSplit([row('a', 40, true), row('b', 0), row('c', 0)], 100);
    expect(out.map((r) => r.minutes)).toEqual([40, 30, 30]);
    expect(sum(evenSplit([row('a', 0), row('b', 0), row('c', 0)], 100))).toBe(100);
  });

  test('never negative, never over the total', () => {
    for (let want = -30; want <= 500; want += 7) {
      const out = rebalance(
        [row('a', 15), row('b', 75), row('c', 5), row('d', 105)],
        'b',
        want,
        200,
      );
      expect(sum(out)).toBe(200);
      expect(out.every((r) => r.minutes >= 0)).toBe(true);
    }
  });
});

describe('format', () => {
  test('hours reads like the website', () => {
    expect(hours(0)).toBe('0 min');
    expect(hours(45)).toBe('45 min');
    expect(hours(120)).toBe('2 h');
    expect(hours(150)).toBe('2 h 30 min');
  });

  test('parseHours accepts decimals, commas and clock style', () => {
    expect(parseHours('2')).toBe(120);
    expect(parseHours('2,5')).toBe(150);
    expect(parseHours('1:30')).toBe(90);
    expect(parseHours('')).toBeNull();
    expect(parseHours('abc')).toBeNull();
    expect(hoursField(150)).toBe('2,5');
    expect(hoursField(120)).toBe('2');
  });

  test('day names', () => {
    expect(weekdayName(1, 'en', 'long')).toBe('Monday');
    expect(weekdayName(7, 'en', 'short')).toBe('Sun');
    expect(dayLabel('2030-03-04', 'en', { weekday: 'long' })).toBe('Monday');
  });
});
