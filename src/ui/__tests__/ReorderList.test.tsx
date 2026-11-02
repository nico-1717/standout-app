import { dropIndex, reorderKeys } from '../ReorderList';

describe('ReorderList helpers', () => {
  test('dropIndex rounds to the nearest row and stays inside the list', () => {
    expect(dropIndex(1, 0, 68, 4)).toBe(1);
    expect(dropIndex(1, 40, 68, 4)).toBe(2); // più di mezza riga giù
    expect(dropIndex(1, 30, 68, 4)).toBe(1); // meno di mezza riga: resta
    expect(dropIndex(2, -500, 68, 4)).toBe(0);
    expect(dropIndex(2, 500, 68, 4)).toBe(3);
  });

  test('reorderKeys moves one item', () => {
    expect(reorderKeys(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderKeys(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});
