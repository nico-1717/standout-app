import { dateOrNull, occurrences, parseRrule, ruleOf, type RepeatSource } from '../recurrence';
import golden from './fixtures/occurrences.json';

interface Case {
  from: string;
  to: string;
  dates: string[];
}
interface Entry {
  master: RepeatSource;
  parsed: { unit: string; interval: number; until: string | null; count: number | null } | null;
  cases: Case[];
}

describe('repeat rules: golden test against the website (pl_occurrences)', () => {
  const entries = (golden as unknown as { masters: Entry[] }).masters;

  test.each(entries.map((e, i) => [i, JSON.stringify(e.master), e] as const))(
    'master #%i %s',
    (_i, _name, e) => {
      // pl_rrule_parse: when the website cannot read a rule, ours cannot either
      const parsed = parseRrule(e.master.rrule);
      expect(parsed).toEqual(e.parsed);
      for (const c of e.cases) {
        expect({ range: [c.from, c.to], dates: occurrences(e.master, c.from, c.to) }).toEqual({
          range: [c.from, c.to],
          dates: c.dates,
        });
      }
    },
  );

  test('golden file is big enough to mean something', () => {
    expect(entries.length).toBeGreaterThan(25);
    expect(
      entries.reduce((n, e) => n + e.cases.reduce((m, c) => m + c.dates.length, 0), 0),
    ).toBeGreaterThan(800);
  });
});

describe('repeat rules: small checks', () => {
  it('reads dates', () => {
    expect(dateOrNull('2026-11-05')).toBe('2026-11-05');
    expect(dateOrNull('2026-11-05 10:30:00')).toBe('2026-11-05');
    expect(dateOrNull('')).toBeNull();
    expect(dateOrNull('0000-00-00')).toBeNull();
    expect(dateOrNull('2026-02-30')).toBeNull();
    expect(dateOrNull(null)).toBeNull();
  });

  it('old events without RRULE are rebuilt from the columns', () => {
    expect(ruleOf({ repeat_type: 'weekly' })).toEqual({
      unit: 'week',
      interval: 1,
      until: null,
      count: null,
    });
    expect(
      ruleOf({ repeat_type: 'custom', repeat_unit: 'month', repeat_interval: 3 })?.interval,
    ).toBe(3);
    expect(ruleOf({ repeat_type: 'none' })).toBeNull();
  });

  it('the 31st is skipped in short months, never moved', () => {
    expect(
      occurrences({ rrule: 'FREQ=MONTHLY', event_date: '2026-01-31' }, '2026-01-01', '2026-06-30'),
    ).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });
});
