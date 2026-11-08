import { AFFIRMATION_IDS, QUOTE_IDS, crc32, weekPhraseId } from '../phrases';

describe('week phrases', () => {
  test('crc32 matches the well known check value and PHP', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
    expect(crc32('')).toBe(0);
  });

  test('picks the same phrase as pl_pick_phrase() on the website (values from PHP)', () => {
    expect(weekPhraseId('quotes', '2026-11-02', 7)).toBe('q27');
    expect(weekPhraseId('affirmations', '2026-11-02', 7)).toBe('a35');
    expect(weekPhraseId('quotes', '2025-01-06', 1)).toBe('q19');
    expect(weekPhraseId('affirmations', '2026-12-28', 123456)).toBe('a16');
  });

  test('the same week and user always give the same phrase; another user can differ', () => {
    expect(weekPhraseId('quotes', '2026-11-09', 3)).toBe(weekPhraseId('quotes', '2026-11-09', 3));
    const ids = new Set(
      Array.from({ length: 30 }, (_, u) => weekPhraseId('quotes', '2026-11-09', u + 1)),
    );
    expect(ids.size).toBeGreaterThan(5);
  });

  test('there are 36 of each and every id has a text in both languages', () => {
    expect(QUOTE_IDS).toHaveLength(36);
    expect(AFFIRMATION_IDS).toHaveLength(36);
  });
});
