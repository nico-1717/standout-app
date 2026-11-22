import { shortDate } from '../Pick';

const month = (n: number) =>
  [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][n - 1]!;
const weekday = (n: number) =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][n - 1]!;

describe('shortDate', () => {
  test('shows the weekday, day, month and two-digit year', () => {
    expect(shortDate('2026-11-20', month, weekday)).toBe('Fri, 20 Nov 26');
    expect(shortDate('2026-11-22', month, weekday)).toBe('Sun, 22 Nov 26');
    expect(shortDate('2026-11-23', month, weekday)).toBe('Mon, 23 Nov 26');
  });

  test('without a weekday it keeps the old short form', () => {
    expect(shortDate('2026-11-20', month)).toBe('20 Nov 26');
  });
});
