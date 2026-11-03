import { answerLetter, isKnown, levelOf, levelRank, needsReview } from '../levels';
import golden from './levels.golden.json';

describe('levels match the website', () => {
  // 600 storie casuali, con il livello calcolato da fcv_livello() del sito (PHP)
  const cases = golden as [number, number, string, string, boolean][];
  test.each(cases.map((g, i) => [i, g] as const))('case %i', (_i, g) => {
    const [c, w, recent, level, known] = g;
    expect(levelOf(c, w, recent)).toBe(level);
    expect(isKnown(level, c + w)).toBe(known);
  });
});

describe('level helpers', () => {
  test('the main cases from the website notes', () => {
    expect(levelOf(0, 0, '')).toBe('nuova');
    expect(levelOf(1, 0, 'C')).toBe('sembra_facile');
    expect(levelOf(2, 0, 'CC')).toBe('facile');
    expect(levelOf(0, 2, 'WW')).toBe('da_imparare');
    expect(levelOf(3, 1, 'WCCC')).toBe('la_sai');
  });
  test('rank, review and letters', () => {
    expect(levelRank('difficilissima')).toBe(0);
    expect(levelRank('la_sai')).toBe(9);
    expect(levelRank('boh')).toBe(4);
    expect(needsReview('difficile')).toBe(true);
    expect(needsReview('facile')).toBe(false);
    expect(answerLetter(true, false)).toBe('C');
    expect(answerLetter(false, true)).toBe('w');
  });
});
