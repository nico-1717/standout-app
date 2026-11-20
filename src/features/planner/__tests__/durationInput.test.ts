import { parseDuration } from '../durationInput';

describe('parseDuration', () => {
  test.each([
    ['45', 45],
    ['1:30', 90],
    ['1h30', 90],
    ['1h', 60],
    ['1 h 30 m', 90],
    ['90m', 90],
    ['2h15min', 135],
    [' 25 ', 25],
  ])('%s → %i minutes', (txt, mins) => expect(parseDuration(txt)).toBe(mins));

  test.each(['', 'abc', '0', '-5', '1h99x'])('%j is nothing', (txt) =>
    expect(parseDuration(txt)).toBe(0),
  );

  test('never more than a day', () => expect(parseDuration('30h')).toBe(1439));
});
