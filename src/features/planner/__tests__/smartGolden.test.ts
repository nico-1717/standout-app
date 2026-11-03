import { firstFreeMinute, smartEvent, smartParse, type SmartParsed } from '../smart';
import fixture from './fixtures/smart.json';

interface Case {
  today: string;
  phrase: string;
  withContacts: boolean;
  result: SmartParsed;
}

describe('planner smart bar against the website code', () => {
  const cases = (fixture as { cases: Case[] }).cases;
  const contacts = (fixture as { contacts: { name: string; email: string }[] }).contacts;

  test('has plenty of cases', () => {
    expect(cases.length).toBeGreaterThan(500);
  });

  test.each(cases.map((c, i) => [i, c.today, c.phrase, c.withContacts] as const))(
    '#%i %s «%s» (contacts: %s)',
    (i) => {
      const c = cases[i]!;
      const got = smartParse(c.phrase, {
        today: c.today,
        focusDate: c.today,
        contacts: c.withContacts ? contacts : [],
      });
      expect(got).toEqual(c.result);
    },
  );
});

describe('from a phrase to an event', () => {
  const p = (phrase: string) =>
    smartParse(phrase, { today: '2026-11-03', focusDate: '2026-11-03' });

  test('with a time: one hour from there; without: the first free hour of the day', () => {
    expect(smartEvent(p('dentista domani 15'), [])).toMatchObject({
      title: 'Dentista',
      date: '2026-11-04',
      start: '15:00',
      end: '16:00',
      allDay: false,
      notify: 'h1',
    });
    // «dentista» alone: no time, no meal → all day
    expect(smartEvent(p('dentista'), [])).toMatchObject({
      allDay: true,
      start: '00:00',
      end: '23:59',
      notify: 'none',
    });
  });

  test('a meal with no time picks its hour; the free slot skips what is already there', () => {
    expect(smartEvent(p('pranzo domani'), []).start).toBe('12:30');
    expect(firstFreeMinute([], 60)).toBe(8 * 60);
    expect(firstFreeMinute([{ start: '08:00', end: '09:30' }], 60)).toBe(9 * 60 + 30);
    expect(
      firstFreeMinute(
        [
          { start: '08:00', end: '09:30' },
          { start: '10:00', end: '11:00' },
        ],
        60,
      ),
    ).toBe(11 * 60);
    expect(firstFreeMinute([{ start: '00:00', end: '23:59' }], 60)).toBe(8 * 60);
  });
});
