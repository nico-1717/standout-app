import { categoryHints, wordsOf, type HintRow } from '../categoryHints';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const valid = new Set(['health', 'training', 'study']);
const row = (title: string, cat: string | null, at = '2026-10-01 10:00:00'): HintRow => ({
  title,
  category_uuid: cat,
  updated_at: at,
});

describe('wordsOf', () => {
  it('drops short and filler words and accents', () => {
    expect(wordsOf('Visita dal Dentista con la Mamma')).toEqual(['visita', 'dentista', 'mamma']);
    expect(wordsOf('Caffè')).toEqual(['caffe']);
  });
});

describe('categoryHints', () => {
  it('suggests nothing with no history', () => {
    expect(categoryHints([], 'Dentist', valid, NOW)).toEqual({ last: null, suggested: [] });
  });

  it('knows the last used category from the latest save', () => {
    const rows = [
      row('a', 'health', '2026-11-01 10:00:00'),
      row('b', 'study', '2026-11-19 09:00:00'),
    ];
    expect(categoryHints(rows, '', valid, NOW).last).toBe('study');
  });

  it('suggests the category a word points to, best first, at most three', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row('Dentist visit', 'health')),
      row('Dentist', 'study'),
      ...Array.from({ length: 4 }, () => row('Gym chest', 'training')),
      ...Array.from({ length: 3 }, () => row('Gym visit', 'training')),
    ];
    const h = categoryHints(rows, 'Dentist cleaning', valid, NOW);
    expect(h.suggested[0]).toBe('health');
    expect(categoryHints(rows, 'Gym', valid, NOW).suggested).toEqual(['training']);
  });

  it('ignores words that point everywhere', () => {
    const rows = [
      row('Weekly review', 'health'),
      row('Weekly review', 'study'),
      row('Weekly review x', 'training'),
    ];
    expect(categoryHints(rows, 'review', valid, NOW).suggested).toEqual([]);
  });

  it('does not suggest a deleted category or a cancelled event', () => {
    const rows = [row('Dentist', 'gone'), { ...row('Dentist', 'health'), is_cancelled: 1 }];
    expect(categoryHints(rows, 'Dentist', valid, NOW)).toEqual({ last: null, suggested: [] });
  });

  it('follows a category change (the old one stops counting)', () => {
    const before = [row('Yoga', 'health'), row('Yoga class', 'health'), row('Yoga flow', 'health')];
    const after = before.map((r) => ({ ...r, category_uuid: 'training' }));
    expect(categoryHints(before, 'Yoga', valid, NOW).suggested).toEqual(['health']);
    expect(categoryHints(after, 'Yoga', valid, NOW).suggested).toEqual(['training']);
  });
});
