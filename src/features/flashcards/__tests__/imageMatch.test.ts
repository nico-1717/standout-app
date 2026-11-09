import {
  cardsFrom,
  counts,
  initialPairs,
  link,
  needsMatching,
  questionOf,
  singleCards,
  unlink,
} from '../imageMatch';

describe('image matching', () => {
  test('it starts paired in order, up to the shorter list', () => {
    expect(initialPairs(3, 3)).toEqual({ 0: 0, 1: 1, 2: 2 });
    expect(initialPairs(4, 2)).toEqual({ 0: 0, 1: 1 });
    expect(initialPairs(0, 5)).toEqual({});
  });

  test('linking moves an answer that was taken, and replaces the answer of a question', () => {
    const p = link(initialPairs(3, 3), 0, 2);
    // la risposta 2 era di 2: ora è di 0; la domanda 2 resta senza
    expect(p).toEqual({ 0: 2, 1: 1 });
    expect(questionOf(p, 2)).toBe(0);
    expect(questionOf(p, 0)).toBeNull();
  });

  test('unlinking leaves both pictures alone', () => {
    expect(unlink({ 0: 0, 1: 1 }, 0)).toEqual({ 1: 1 });
    expect(unlink({ 1: 1 }, 5)).toEqual({ 1: 1 });
  });

  test('cards: pairs in the order of the questions, then single questions, then single answers', () => {
    const qs = ['q0', 'q1', 'q2'];
    const as = ['a0', 'a1', 'a2', 'a3'];
    const p = { 0: 1, 2: 0 };
    expect(cardsFrom(qs, as, p)).toEqual([
      { q: 'q0', a: 'a1' },
      { q: 'q1', a: null },
      { q: 'q2', a: 'a0' },
      { q: null, a: 'a2' },
      { q: null, a: 'a3' },
    ]);
  });

  test('nine questions and eight answers: the ninth is a card with one picture', () => {
    const qs = Array.from({ length: 9 }, (_, i) => `q${i}`);
    const as = Array.from({ length: 8 }, (_, i) => `a${i}`);
    const out = cardsFrom(qs, as, initialPairs(9, 8));
    expect(out).toHaveLength(9);
    expect(out[8]).toEqual({ q: 'q8', a: null });
  });

  test('counts', () => {
    expect(counts(9, 8, initialPairs(9, 8))).toEqual({ pairs: 8, alone: 1 });
    expect(counts(2, 2, {})).toEqual({ pairs: 0, alone: 4 });
  });

  test('with one group only there is nothing to match: one card per picture', () => {
    expect(needsMatching(3, 0)).toBe(false);
    expect(needsMatching(0, 3)).toBe(false);
    expect(needsMatching(2, 2)).toBe(true);
    expect(singleCards(['a', 'b'], [])).toEqual([
      { q: 'a', a: null },
      { q: 'b', a: null },
    ]);
    expect(singleCards([], ['x'])).toEqual([{ q: null, a: 'x' }]);
  });
});
