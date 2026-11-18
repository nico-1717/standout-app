import type { Deck } from '../logic';
import { movePickGroup, pickGroups } from '../pickOrder';

const deck = (uuid: string, parent: string | null): Deck => ({ uuid, parent_uuid: parent }) as Deck;
// A ─ A1, B, C ─ C1
const decks = [deck('A', null), deck('A1', 'A'), deck('B', null), deck('C', null), deck('C1', 'C')];

describe('picked categories as groups', () => {
  test('a picked category carries its picked descendants', () => {
    expect(pickGroups(decks, ['A', 'A1', 'B'])).toEqual([['A', 'A1'], ['B']]);
    expect(pickGroups(decks, ['A1', 'C', 'C1'])).toEqual([['A1'], ['C', 'C1']]);
    expect(pickGroups(decks, [])).toEqual([]);
  });
  test('moving a group moves everything under it, and the edges stay put', () => {
    const picked = ['A', 'A1', 'B', 'C'];
    expect(movePickGroup(decks, picked, 0, 1)).toEqual(['B', 'A', 'A1', 'C']);
    expect(movePickGroup(decks, picked, 2, -1)).toEqual(['A', 'A1', 'C', 'B']);
    expect(movePickGroup(decks, picked, 0, -1)).toBe(picked);
    expect(movePickGroup(decks, picked, 2, 1)).toBe(picked);
  });
});
