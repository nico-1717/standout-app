import {
  dayOf,
  levelOf,
  monthRows,
  summarise,
  weekRows,
  yearRows,
  type CompactDay,
  type Insights,
} from '../insights';

const D = (
  m: number | null,
  e: number | null,
  w = 0,
  l = 0,
  hd = 0,
  hu = 0,
  p = 0,
  f = 0,
): CompactDay => [m, e, w, l, hd, hu, p, f];

const data: Insights = {
  year: 2026,
  today: '2026-11-05',
  days: {
    '2026-11-02': D(4, 3, 120, 2, 3, 4, 2, 50),
    '2026-11-03': D(2, null, 0, 0, 1, 4, 0, 0),
    '2026-11-04': D(null, null, 10, 0, 0, 0, 0, 0),
    '2026-10-20': D(5, 5, 200, 1, 4, 4, 1, 25),
  },
  anni: [
    {
      anno: 2025,
      giorni: 365,
      scritti: 100,
      parole: 9000,
      umore: 3.4,
      energia: 3,
      abitudini_pct: 60,
      pomodori: 40,
      minuti: 1000,
    },
    {
      anno: 2026,
      giorni: 309,
      scritti: 50,
      parole: 5000,
      umore: 3.8,
      energia: 3.2,
      abitudini_pct: null,
      pomodori: 12,
      minuti: 300,
    },
  ],
};

describe('insights', () => {
  it('reads a compact day and ignores days with nothing', () => {
    expect(dayOf(data, '2026-11-02')).toEqual({
      m: 4,
      e: 3,
      w: 120,
      l: 2,
      hd: 3,
      hu: 4,
      p: 2,
      f: 50,
    });
    expect(dayOf(data, '2026-11-01')).toBeNull();
  });

  it('the colour level: mood, energy, and habits as a share of what was planned', () => {
    expect(levelOf(dayOf(data, '2026-11-02'), 'm')).toBe(4);
    expect(levelOf(dayOf(data, '2026-11-02'), 'e')).toBe(3);
    expect(levelOf(dayOf(data, '2026-11-02'), 'h')).toBe(4); // 3 of 4 = 75% → 1 + 3
    expect(levelOf(dayOf(data, '2026-11-03'), 'h')).toBe(2); // 25%
    expect(levelOf(dayOf(data, '2026-11-04'), 'h')).toBeNull(); // nothing planned
    expect(levelOf(dayOf(data, '2026-11-03'), 'e')).toBeNull();
    expect(levelOf(null, 'm')).toBeNull();
  });

  it('summarises like the website: written days, averages, habit percent, focus', () => {
    const s = summarise([
      dayOf(data, '2026-11-02'),
      dayOf(data, '2026-11-03'),
      dayOf(data, '2026-11-04'),
      null,
    ]);
    expect(s).toMatchObject({
      giorni: 4,
      scritti: 2,
      parole: 130,
      umore: 3,
      energia: 3,
      pct: 50,
      pomodori: 2,
      minuti: 50,
    });
    expect(summarise([null]).umore).toBeNull();
    expect(summarise([null]).pct).toBeNull();
  });

  it('week rows go from the newest, count only past days, and open on the Monday', () => {
    const rows = weekRows(data);
    expect(rows[0]).toMatchObject({ date: '2026-11-02', from: '2026-11-02', to: '2026-11-08' });
    expect(rows[0].summary.giorni).toBe(4); // Mon 2 … Thu 5 (today)
    expect(rows[1].date).toBe('2026-10-26');
    expect(rows).toHaveLength(16);
    expect(rows[rows.length - 1].date! >= '2026-07-13').toBe(true);
  });

  it('week rows stop at the start of the year', () => {
    const small: Insights = { ...data, today: '2026-01-14', days: {} };
    const rows = weekRows(small);
    expect(rows.map((r) => r.date)).toEqual(['2026-01-12', '2026-01-05', '2025-12-29']);
    expect(rows[2].summary.giorni).toBe(4); // only Jan 1-4 are in 2026 (Jan 1 is a Thursday)
  });

  it('month rows: newest first, only months already started, days up to today', () => {
    const rows = monthRows(data);
    expect(rows[0]).toMatchObject({ date: '2026-11-01' });
    expect(rows[0].summary.giorni).toBe(5);
    expect(rows).toHaveLength(11);
    expect(rows[1].date).toBe('2026-10-01');
    expect(rows[1].summary.giorni).toBe(31);
  });

  it('year rows come from the server lines, newest first', () => {
    const rows = yearRows(data);
    expect(rows.map((r) => r.year)).toEqual([2026, 2025]);
    expect(rows[1].summary).toMatchObject({ scritti: 100, pct: 60, parole: 9000 });
  });
});
