import { smartParse } from '../smart';
import { nextDayOfMonth, smartAsk, smartKeepNumber, smartRewrite } from '../smartAsk';

const ctx = { today: '2026-11-20', focusDate: '2026-11-20' };

describe('smartAsk: is a bare number a day or an hour?', () => {
  test('a bare number asks, offering both readings', () => {
    const ask = smartAsk('19 shower', ctx);
    expect(ask).toMatchObject({
      n: 19,
      index: 0,
      options: ['date', 'time'],
      dateIso: '2026-12-19',
    });
    expect(smartAsk('shower 19', ctx)).toMatchObject({ n: 19, index: 1 });
  });

  test('a number that already says what it is does not ask', () => {
    for (const phrase of [
      'dentista oggi 15',
      'domani 15 dentista',
      'alle 19 doccia',
      'doccia at 7 pm',
      '13 agosto compleanno',
      'agosto 13 compleanno',
      '19:30 doccia',
      '13/8 cena',
      'palestra',
      '25 doccia',
    ])
      expect(smartAsk(phrase, ctx)).toBeNull();
  });

  test('a day already written leaves only the hour to ask, and the other way round', () => {
    expect(smartAsk('19 doccia domani', ctx)?.options).toEqual(['time']);
    expect(smartAsk('19 doccia alle 8:30', ctx)?.options).toEqual(['date']);
    expect(smartAsk('19 doccia domani alle 8:30', ctx)).toBeNull();
  });

  test('the date answer is the next such day of the month', () => {
    expect(nextDayOfMonth('2026-11-20', 25)).toBe('2026-11-25');
    expect(nextDayOfMonth('2026-11-20', 20)).toBe('2026-11-20');
    expect(nextDayOfMonth('2026-11-20', 5)).toBe('2026-12-05');
    expect(nextDayOfMonth('2026-12-20', 5)).toBe('2027-01-05');
    expect(nextDayOfMonth('2026-01-31', 30)).toBe('2026-03-30');
  });

  test('answers rewrite the phrase so the normal reader understands it', () => {
    const ask = smartAsk('19 shower', ctx)!;
    const asDate = smartParse(smartRewrite('19 shower', ask, 'date'), ctx);
    expect(asDate).toMatchObject({ title: 'Shower', date: '2026-12-19', allDay: true });
    const asTime = smartParse(smartRewrite('19 shower', ask, 'time'), ctx);
    expect(asTime).toMatchObject({ title: 'Shower', date: '2026-11-20', time: '19:00' });
    expect(smartKeepNumber('19 shower', ask, ctx).title).toBe('19 shower');
    expect(smartKeepNumber('read chapter 5', smartAsk('read chapter 5', ctx)!, ctx).title).toBe(
      'Read chapter 5',
    );
  });
});
