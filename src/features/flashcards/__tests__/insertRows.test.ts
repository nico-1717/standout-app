import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { loadInsertDraft, rowsToCreate, saveInsertDraft } from '../insertRows';

describe('insert rows', () => {
  test('a row with only a photo counts; an empty one does not', () => {
    expect(
      rowsToCreate([
        { q: '', a: '' },
        { q: '', a: '', qi: 'file:///a.jpg' },
        { q: ' ', a: '', ai: 'file:///b.jpg' },
      ]),
    ).toEqual([
      { q: '', a: '', kid: false, qi: 'file:///a.jpg' },
      { q: ' ', a: '', kid: false, ai: 'file:///b.jpg' },
    ]);
  });

  test('a child needs a father that has something (text or photo)', () => {
    expect(
      rowsToCreate([
        { q: '', a: '' },
        { q: 'kid', a: '', kid: true },
        { q: '', a: '', qi: 'file:///p.jpg' },
        { q: '', a: '', kid: true, ai: 'file:///k.jpg' },
      ]),
    ).toEqual([
      { q: '', a: '', kid: false, qi: 'file:///p.jpg' },
      { q: '', a: '', kid: true, ai: 'file:///k.jpg' },
    ]);
  });

  test('photos survive in the draft; a draft of only empty rows is dropped', () => {
    const db = memoryDb();
    migrate(db);
    saveInsertDraft(db, 'd1', [
      { q: '', a: '', qi: 'file:///a.jpg' },
      { q: 'x', a: 'y', kid: true },
    ]);
    expect(loadInsertDraft(db, 'd1')).toEqual([
      { q: '', a: '', qi: 'file:///a.jpg' },
      { q: 'x', a: 'y', kid: true },
    ]);
    saveInsertDraft(db, 'd1', [{ q: '', a: '' }]);
    expect(loadInsertDraft(db, 'd1')).toBeNull();
  });
});
