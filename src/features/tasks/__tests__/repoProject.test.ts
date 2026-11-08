import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';

import { TasksRepo } from '../repo';

describe('a task linked to a project', () => {
  function setup() {
    const db = memoryDb();
    migrate(db);
    return { db, repo: new TasksRepo(db) };
  }

  test('is created with the project and the server gets project_uuid', () => {
    const { db, repo } = setup();
    const id = repo.create({ title: 'Write intro', project_uuid: 'proj-1' });
    expect(repo.get(id)!.project_uuid).toBe('proj-1');
    expect(nextBatch(db, 10)[0]!.patch).toMatchObject({
      title: 'Write intro',
      project_uuid: 'proj-1',
    });
  });

  test('changing and clearing the project is sent as an update, null included', () => {
    const { db, repo } = setup();
    const id = repo.create({ title: 'Task' });
    repo.update(id, { project_uuid: 'proj-2' });
    expect(repo.get(id)!.project_uuid).toBe('proj-2');
    repo.update(id, { project_uuid: null });
    expect(repo.get(id)!.project_uuid).toBeNull();
    const patches = nextBatch(db, 10).map((m) => m.patch);
    expect(patches.some((p) => p && 'project_uuid' in p && p.project_uuid === null)).toBe(true);
  });
});
