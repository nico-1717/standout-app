import { finishForecast, learningCurve } from '../forecast';

const trend = [
  { date: '2026-10-01', count: 4 },
  { date: '2026-10-15', count: 6 },
];

describe('finish forecast', () => {
  test('rate is learnt cards over the days between the first and last new card', () => {
    // 10 carte in 14 giorni = 5 a settimana; ne mancano 20 = 4 settimane
    expect(finishForecast(trend, 10, 30, '2026-11-01')).toEqual({
      weeks: 4,
      date: '29/11/2026',
    });
  });
  test('no forecast without two days, without a rate, or when everything is learnt', () => {
    expect(finishForecast(trend.slice(0, 1), 4, 30, '2026-11-01')).toBeNull();
    expect(finishForecast(trend, 0, 30, '2026-11-01')).toBeNull();
    expect(finishForecast(trend, 30, 30, '2026-11-01')).toBeNull();
    expect(finishForecast(trend, 1, 30, '2026-11-01')).not.toBeNull();
    expect(
      finishForecast(
        [
          { date: '2020-01-01', count: 1 },
          { date: '2026-10-01', count: 0 },
        ],
        1,
        30,
        '2026-11-01',
      ),
    ).toBeNull();
  });
});

describe('learning curve', () => {
  test('cumulates the history and then adds one point a week up to the total', () => {
    const c = learningCurve(trend, 30);
    expect(c.hist).toEqual([4, 10]);
    expect(c.proj).toEqual([15, 20, 25, 30]);
    expect(c.labels).toHaveLength(6);
    expect(c.labels[2]).toBe('2026-10-22');
  });
  test('too little history: no curve; already at the total: no projection', () => {
    expect(learningCurve(trend.slice(0, 1), 30)).toEqual({ hist: [], proj: [], labels: [] });
    expect(learningCurve(trend, 10).proj).toEqual([]);
  });
});
