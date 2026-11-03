import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { upsertRow } from '@/core/sync/rows';

import { byId, flatten, inheritedColor, nextStatus, subtreeIds, wouldCycle } from '../logic';
import { ProjectsRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const repo = new ProjectsRepo(
    db,
    () => '2026-11-03T10:00:00Z',
    () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  );
  return { db, repo };
}

describe('projects tree', () => {
  test('a new project is first, a "last" one goes to the end, and colour follows the parent', () => {
    const { repo } = setup();
    const a = repo.create({ name: 'A', color: '#336699' })!;
    const b = repo.create({ name: 'B' })!;
    expect(repo.all().map((p) => p.name)).toEqual(['B', 'A']);
    const c = repo.create({ name: 'C', position: 'last' })!;
    expect(repo.all().map((p) => p.name)).toEqual(['B', 'A', 'C']);
    const kid = repo.create({ name: 'Kid', parent: a })!;
    expect(repo.get(kid)).toMatchObject({ color: '#336699', color_edited: 0, parent_uuid: a });
    expect(repo.get(b)!.color).toBe('#8E8E93');
    expect(repo.get(c)!.color).toBe('#8E8E93');
    expect(repo.create({ name: '   ' })).toBeNull();
    expect(repo.create({ name: 'x', parent: 'nope' })).toBeNull();
  });

  test('changing a colour passes it down to automatic children only', () => {
    const { repo } = setup();
    const root = repo.create({ name: 'Root', color: '#111111' })!;
    const auto = repo.create({ name: 'Auto', parent: root })!;
    const own = repo.create({ name: 'Own', parent: root, color: '#222222' })!;
    const deep = repo.create({ name: 'Deep', parent: auto })!;
    const deepOwn = repo.create({ name: 'DeepOwn', parent: own })!;
    repo.update(root, { color: '#AA0000' });
    expect(repo.get(auto)!.color).toBe('#AA0000');
    expect(repo.get(deep)!.color).toBe('#AA0000');
    expect(repo.get(own)!.color).toBe('#222222');
    expect(repo.get(deepOwn)!.color).toBe('#222222');
    // tornare automatico: riprende il colore del padre
    repo.update(own, { color: null });
    expect(repo.get(own)).toMatchObject({ color: '#AA0000', color_edited: 0 });
    expect(repo.get(deepOwn)!.color).toBe('#AA0000');
  });

  test('moving: no cycles, goes last under the new parent, automatic colour follows', () => {
    const { repo } = setup();
    const a = repo.create({ name: 'A', color: '#111111' })!;
    const b = repo.create({ name: 'B', color: '#222222' })!;
    const a1 = repo.create({ name: 'A1', parent: a })!;
    const a2 = repo.create({ name: 'A2', parent: a1 })!;
    expect(repo.move(a, a2)).toBe(false);
    expect(repo.move(a, a)).toBe(false);
    expect(repo.move(a1, b)).toBe(true);
    expect(repo.get(a1)).toMatchObject({ parent_uuid: b, color: '#222222' });
    expect(repo.get(a2)!.color).toBe('#222222');
    expect(repo.move(a1, null)).toBe(true);
    expect(repo.get(a1)).toMatchObject({ parent_uuid: null, color: '#8E8E93' });
  });

  test('status cycles in_progress → completed → planned and completes the whole branch, restorable', () => {
    const { repo } = setup();
    const a = repo.create({ name: 'A' })!;
    const k1 = repo.create({ name: 'K1', parent: a })!;
    const k2 = repo.create({ name: 'K2', parent: a })!;
    repo.cycleStatus(k2); // K2 → completed
    const r = repo.cycleStatus(a)!;
    expect(r.status).toBe('completed');
    expect(repo.get(k1)!.status).toBe('completed');
    expect(r.snapshot).toEqual(
      expect.arrayContaining([
        { uuid: k1, status: 'in_progress' },
        { uuid: k2, status: 'completed' },
      ]),
    );
    const out = repo.cycleStatus(a, r.snapshot)!;
    expect(out.status).toBe('planned');
    expect(repo.get(k1)!.status).toBe('in_progress');
    expect(repo.get(k2)!.status).toBe('completed');
    expect(nextStatus('planned')).toBe('in_progress');
  });

  test('edits go to the outbox as a minimal patch, and an empty name is refused', () => {
    const { db, repo } = setup();
    const a = repo.create({ name: 'A' })!;
    db.run('DELETE FROM outbox');
    expect(repo.update(a, { name: ' ' })).toBe(false);
    repo.update(a, { name: 'A2', is_favorite: true, due_date: '2030-01-01' });
    const [m] = nextBatch(db, 10);
    expect(m).toMatchObject({ table: 'projects', uuid: a, op: 'upsert' });
    expect(m!.patch).toEqual({ name: 'A2', is_favorite: true, due_date: '2030-01-01' });
    repo.update(a, { name: 'A2' }); // nessun cambiamento: niente di nuovo in coda
    expect(nextBatch(db, 10)).toHaveLength(0);
  });

  test('removing sends one delete for the root; sessions stay (no project) or go away', () => {
    const { db, repo } = setup();
    const a = repo.create({ name: 'A' })!;
    const k = repo.create({ name: 'K', parent: a })!;
    const other = repo.create({ name: 'Other' })!;
    const sess = (id: string, project: string) =>
      upsertRow(db, 'pomodoro_sessions', {
        uuid: id,
        mode: 0,
        start_time: '2030-01-01 10:00:00',
        end_time: '2030-01-01 10:25:00',
        status: 'completato',
        resume_time: null,
        duration_seconds: 1500,
        planned_duration_min: 25,
        project_uuid: project,
        is_manual: 0,
        updated_at: null,
      });
    sess('s1', k);
    sess('s2', other);
    db.run('DELETE FROM outbox');
    repo.remove(a);
    expect(repo.all().map((p) => p.uuid)).toEqual([other]);
    expect(db.all('SELECT project_uuid FROM pomodoro_sessions WHERE uuid = ?', ['s1'])[0]).toEqual({
      project_uuid: null,
    });
    expect(nextBatch(db, 10)).toHaveLength(1);

    const b = repo.create({ name: 'B' })!;
    sess('s3', b);
    db.run('DELETE FROM outbox');
    repo.remove(b, true);
    expect(db.all('SELECT 1 FROM pomodoro_sessions WHERE uuid = ?', ['s3'])).toHaveLength(0);
    const tables = nextBatch(db, 10).map((m) => `${m.table}:${m.op}`);
    expect(tables).toEqual(['pomodoro_sessions:delete', 'projects:delete']);
  });
});

describe('logic', () => {
  const mk = (rows: [string, string | null, string?, number?][]) => {
    const { repo, db } = setup();
    for (const [uuid, parent, key = 'a0', edited = 0] of rows)
      upsertRow(db, 'projects', {
        uuid,
        parent_uuid: parent,
        name: uuid,
        notes: '',
        status: 'in_progress',
        color: edited ? '#123456' : '#8E8E93',
        color_edited: edited,
        target_date: null,
        due_date: null,
        todo_enabled: 0,
        is_favorite: 0,
        sort_key: key,
        study_event_uuid: null,
        study_start: null,
        study_end: null,
        study_pomodori_stimati: null,
        study_ripasso_di_uuid: null,
        study_ripasso_n: null,
        created_at: null,
        updated_at: null,
      });
    return repo.all();
  };

  test('inherited colour is the first hand-picked ancestor', () => {
    const all = mk([
      ['r', null, 'a0', 1],
      ['m', 'r', 'a0', 0],
      ['l', 'm', 'a0', 0],
    ]);
    expect(inheritedColor(byId(all), 'l')).toBe('#123456');
    expect(inheritedColor(byId(all), null)).toBe('#8E8E93');
    expect(inheritedColor(byId(all), 'nope')).toBe('#8E8E93');
  });

  test('subtree and cycle checks', () => {
    const all = mk([
      ['r', null],
      ['m', 'r'],
      ['l', 'm'],
      ['x', null],
    ]);
    expect(subtreeIds(all, 'r').sort()).toEqual(['l', 'm', 'r']);
    expect(wouldCycle(all, 'r', 'l')).toBe(true);
    expect(wouldCycle(all, 'm', 'x')).toBe(false);
    expect(wouldCycle(all, 'm', null)).toBe(false);
  });

  test('flatten respects order, completed and collapsed', () => {
    const all = mk([
      ['b', null, 'a1'],
      ['a', null, 'a0'],
      ['a1', 'a', 'a0'],
      ['a2', 'a', 'a1'],
    ]);
    const o = {
      showCompleted: true,
      onlyActive: false,
      order: 'manuale',
      collapsed: new Set<string>(),
    } as const;
    expect(flatten(all, o).map((r) => `${r.depth}${r.project.uuid}`)).toEqual([
      '0a',
      '1a1',
      '1a2',
      '0b',
    ]);
    expect(flatten(all, { ...o, collapsed: new Set(['a']) }).map((r) => r.project.uuid)).toEqual([
      'a',
      'b',
    ]);
    expect(flatten(all, { ...o, order: 'alfabetico' }).map((r) => r.project.uuid)).toEqual([
      'a',
      'a1',
      'a2',
      'b',
    ]);
    const done = all.map((p) => (p.uuid === 'a1' ? { ...p, status: 'completed' as const } : p));
    expect(flatten(done, { ...o, showCompleted: false }).map((r) => r.project.uuid)).toEqual([
      'a',
      'a2',
      'b',
    ]);
    expect(flatten(done, o).find((r) => r.project.uuid === 'a')).toMatchObject({
      total: 2,
      done: 1,
    });
  });
});
