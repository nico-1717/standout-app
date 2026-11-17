import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { landingIndex } from '../ReorderBlocks';
import { GradesRepo } from '../repo';

describe('landingIndex (variable heights)', () => {
  const hs = [60, 120, 60, 60];
  test('stays put until the finger passes the middle of the next block', () => {
    expect(landingIndex(hs, 0, 0)).toBe(0);
    expect(landingIndex(hs, 0, 50)).toBe(0);
    expect(landingIndex(hs, 0, 61)).toBe(1);
    // past the 120-high block: 120 + half of the next
    expect(landingIndex(hs, 0, 150)).toBe(1);
    expect(landingIndex(hs, 0, 190)).toBe(2);
    expect(landingIndex(hs, 0, 999)).toBe(3);
  });
  test('upwards too, and never outside the list', () => {
    expect(landingIndex(hs, 3, -31)).toBe(2);
    expect(landingIndex(hs, 3, -999)).toBe(0);
    expect(landingIndex(hs, 0, -999)).toBe(0);
  });
});

describe('GradesRepo.reorderList', () => {
  const setup = () => {
    const db = memoryDb();
    migrate(db);
    const repo = new GradesRepo(db);
    const ids = ['A', 'B', 'C', 'D'].map((name) => repo.addExam({ name, cfu: 6, status: 'todo' }));
    const names = () => repo.exams().map((e) => e.name);
    return { repo, ids, names };
  };

  test('moves one exam to the bottom and rewrites only its key', () => {
    const { repo, ids, names } = setup();
    const before = repo.exams().map((e) => e.sort_key);
    repo.reorderList([ids[1]!, ids[2]!, ids[3]!, ids[0]!], [ids[0]!]);
    expect(names()).toEqual(['B', 'C', 'D', 'A']);
    expect(repo.exams().filter((e) => before.includes(e.sort_key))).toHaveLength(3);
  });

  test('moves a block of two keeping their order', () => {
    const { repo, ids, names } = setup();
    repo.reorderList([ids[2]!, ids[3]!, ids[0]!, ids[1]!], [ids[2]!, ids[3]!]);
    expect(names()).toEqual(['C', 'D', 'A', 'B']);
  });

  test('moves to the top', () => {
    const { repo, ids, names } = setup();
    repo.reorderList([ids[3]!, ids[0]!, ids[1]!, ids[2]!], [ids[3]!]);
    expect(names()).toEqual(['D', 'A', 'B', 'C']);
  });

  test('interleaved keys (group parts spread in the list): the whole list is rewritten in order', () => {
    const { repo, ids, names } = setup();
    // D sits above the block and B below it, but D's key is greater than B's: no room between them
    repo.reorderList([ids[3]!, ids[0]!, ids[2]!, ids[1]!], [ids[0]!, ids[2]!]);
    expect(names()).toEqual(['D', 'A', 'C', 'B']);
  });
});
