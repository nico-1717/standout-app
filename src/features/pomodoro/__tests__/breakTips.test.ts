import { BREAK_TIPS, breakTipIndex } from '../breakTips';

describe('breakTipIndex', () => {
  test('is always between 1 and the number of tips, and stable for one break', () => {
    for (const s of ['2026-11-09 10:00:00', '2026-11-09 10:05:07', '2026-01-01 00:00:00', '']) {
      const i = breakTipIndex(s);
      expect(i).toBeGreaterThanOrEqual(1);
      expect(i).toBeLessThanOrEqual(BREAK_TIPS);
      expect(breakTipIndex(s)).toBe(i);
    }
  });
  test('different breaks do not all get the same tip', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, k) =>
        breakTipIndex(`2026-11-09 10:${String(k).padStart(2, '0')}:00`),
      ),
    );
    expect(seen.size).toBeGreaterThan(2);
  });
});
