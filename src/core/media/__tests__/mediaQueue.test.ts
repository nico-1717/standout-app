import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { ApiError } from '@/core/api/httpApi';
import { enqueue } from '@/core/sync/outbox';

import { MAX_NOT_FOUND, MediaQueue, isMediaSlot, type MediaApi } from '../mediaQueue';

function setup() {
  const db = memoryDb();
  migrate(db);
  db.run(`INSERT INTO fc_study_decks (uuid, name) VALUES ('d1', 'Maths')`);
  db.run(
    `INSERT INTO fc_study_cards (uuid, category_uuid, question_desc, is_father, custom_order) VALUES ('c1', 'd1', 'q', 0, 1)`,
  );
  db.run('DELETE FROM outbox');
  const deleted: string[] = [];
  const calls: string[] = [];
  let fail: Error | null = null;
  const api: MediaApi = {
    async put(table, uuid, slot, file) {
      calls.push(`put ${table} ${uuid} ${slot} ${file.uri} ${file.mime}`);
      if (fail) throw fail;
      return { name: 'srv_1.jpg' };
    },
    async remove(table, uuid, slot) {
      calls.push(`remove ${table} ${uuid} ${slot}`);
      if (fail) throw fail;
    },
  };
  const q = new MediaQueue(
    db,
    api,
    { delete: (u) => deleted.push(u) },
    () => '2026-11-08T10:00:00Z',
  );
  return {
    db,
    q,
    deleted,
    calls,
    failWith: (e: Error | null) => {
      fail = e;
    },
  };
}
const imageOf = (db: ReturnType<typeof setup>['db']) =>
  db.all<{ v: string | null }>(
    `SELECT question_image AS v FROM fc_study_cards WHERE uuid = 'c1'`,
  )[0]!.v;

describe('MediaQueue', () => {
  test('only known fields are accepted', () => {
    expect(isMediaSlot('fc_study_cards', 'question_image')).toBe(true);
    expect(isMediaSlot('fc_study_cards', 'question_desc')).toBe(false);
    expect(isMediaSlot('users', 'avatar')).toBe(false);
    expect(isMediaSlot('__proto__', 'x')).toBe(false);
    const { q } = setup();
    expect(() => q.putFile('fc_study_cards', 'c1', 'question_desc', 'f', 'image/jpeg')).toThrow();
  });

  test('a put waits in the queue, shows as pending, then sends and writes the name on the row', async () => {
    const { q, db, calls, deleted } = setup();
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    expect(q.count()).toBe(1);
    expect(q.pending('fc_study_cards', 'c1', 'question_image')).toEqual({
      op: 'put',
      uri: 'file:///a.jpg',
    });
    expect(await q.run()).toEqual({ done: 1, waiting: 0, dropped: 0 });
    expect(calls).toEqual(['put fc_study_cards c1 question_image file:///a.jpg image/jpeg']);
    expect(imageOf(db)).toBe('srv_1.jpg');
    expect(q.count()).toBe(0);
    expect(deleted).toEqual(['file:///a.jpg']); // il file sul telefono non serve più
    // la scrittura locale non passa dalla coda delle modifiche
    expect(db.all('SELECT 1 FROM outbox')).toHaveLength(0);
  });

  test('the last choice wins and the discarded file is deleted', async () => {
    const { q, calls, deleted } = setup();
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///b.jpg', 'image/jpeg');
    expect(deleted).toEqual(['file:///a.jpg']);
    expect(q.count()).toBe(1);
    q.removeFile('fc_study_cards', 'c1', 'question_image');
    expect(deleted).toEqual(['file:///a.jpg', 'file:///b.jpg']);
    expect(q.pending('fc_study_cards', 'c1', 'question_image')).toEqual({
      op: 'delete',
      uri: null,
    });
    await q.run();
    expect(calls).toEqual(['remove fc_study_cards c1 question_image']);
  });

  test('a remove clears the name on the row', async () => {
    const { q, db } = setup();
    db.run(`UPDATE fc_study_cards SET question_image = 'old.jpg' WHERE uuid = 'c1'`);
    q.removeFile('fc_study_cards', 'c1', 'question_image');
    await q.run();
    expect(imageOf(db)).toBeNull();
  });

  test('waits while the row still has changes to send', async () => {
    const { q, db, calls } = setup();
    enqueue(
      db,
      { table: 'fc_study_cards', uuid: 'c1', op: 'upsert', patch: { question_desc: 'x' } },
      'now',
    );
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    expect(await q.run()).toEqual({ done: 0, waiting: 1, dropped: 0 });
    expect(calls).toEqual([]);
    db.run('DELETE FROM outbox');
    expect((await q.run()).done).toBe(1);
  });

  test('a row that is gone drops its entry and file', async () => {
    const { q, db, deleted } = setup();
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    db.run(`DELETE FROM fc_study_cards WHERE uuid = 'c1'`);
    expect(await q.run()).toEqual({ done: 0, waiting: 0, dropped: 1 });
    expect(q.count()).toBe(0);
    expect(deleted).toEqual(['file:///a.jpg']);
  });

  test('404 retries a few times, then gives up', async () => {
    const { q, failWith, deleted } = setup();
    failWith(new ApiError(404, 'not_found', 'Row not found'));
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    for (let i = 0; i < MAX_NOT_FOUND - 1; i++) expect((await q.run()).waiting).toBe(1);
    expect(q.count()).toBe(1);
    expect(await q.run()).toEqual({ done: 0, waiting: 0, dropped: 1 });
    expect(q.count()).toBe(0);
    expect(deleted).toEqual(['file:///a.jpg']);
  });

  test('422 means the file is refused: dropped at once', async () => {
    const { q, failWith } = setup();
    failWith(new ApiError(422, 'validation', 'bad file'));
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    expect(await q.run()).toEqual({ done: 0, waiting: 0, dropped: 1 });
  });

  test('network errors stop the run and keep everything for later', async () => {
    const { q, failWith, db } = setup();
    failWith(new TypeError('Network request failed'));
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    await expect(q.run()).rejects.toThrow('Network');
    expect(q.count()).toBe(1);
    expect(imageOf(db)).toBeNull();
    failWith(null);
    expect((await q.run()).done).toBe(1);
  });

  test('two runs at once are one run', async () => {
    const { q, calls } = setup();
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    const [a, b] = await Promise.all([q.run(), q.run()]);
    expect(a).toBe(b);
    expect(calls).toHaveLength(1);
  });

  test('dropRow forgets the entries of a deleted row', () => {
    const { q, deleted } = setup();
    q.putFile('fc_study_cards', 'c1', 'question_image', 'file:///a.jpg', 'image/jpeg');
    q.dropRow('c1');
    expect(q.count()).toBe(0);
    expect(deleted).toEqual(['file:///a.jpg']);
  });
});
