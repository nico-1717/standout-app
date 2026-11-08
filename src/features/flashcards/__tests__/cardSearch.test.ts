import { excerptAround, searchCardRows, type SearchRow } from '../cardSearch';

const doc = (s: string): string => JSON.stringify({ v: 2, blocks: [{ t: 'p', runs: [{ s }] }] });
const row = (uuid: string, q: string, a: string, child = false): SearchRow => ({
  uuid,
  deck: 'd1',
  child,
  question_desc: doc(q),
  answer_desc: doc(a),
});

describe('card text search', () => {
  test('finds the word in the question or the answer, ignoring case and accents', () => {
    const rows = [row('a', 'Perché il cielo è blu?', 'Rayleigh'), row('b', 'Other', 'Nothing')];
    expect(searchCardRows(rows, 'PERCHE').map((h) => h.uuid)).toEqual(['a']);
    expect(searchCardRows(rows, 'rayleigh').map((h) => h.uuid)).toEqual(['a']);
  });

  test('looks at the text people read, not the structure of the document', () => {
    const rows = [row('a', 'Hello', 'World')];
    expect(searchCardRows(rows, 'runs')).toEqual([]);
    expect(searchCardRows(rows, 'blocks')).toEqual([]);
  });

  test('needs two letters, keeps sub-cards, and stops at the limit', () => {
    const rows = [row('a', 'alpha', 'x'), row('b', 'alpha', 'y', true), row('c', 'alpha', 'z')];
    expect(searchCardRows(rows, 'a')).toEqual([]);
    expect(searchCardRows(rows, 'al').map((h) => [h.uuid, h.child])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ]);
    expect(searchCardRows(rows, 'al', 2)).toHaveLength(2);
  });

  test('the excerpt is cut around the word with dots', () => {
    const long = `${'x'.repeat(60)} needle ${'y'.repeat(60)}`;
    const e = excerptAround(long, 'needle');
    expect(e.startsWith('…')).toBe(true);
    expect(e.endsWith('…')).toBe(true);
    expect(e).toContain('needle');
    expect(excerptAround('short needle', 'needle')).toBe('short needle');
  });
});
