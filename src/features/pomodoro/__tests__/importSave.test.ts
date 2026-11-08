import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { ProjectsRepo } from '@/features/projects/repo';

import { parsePomodoroRows } from '../importFile';
import { autoLink, savePomodoroImport } from '../importSave';
import { PomodoroRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  return {
    db,
    projects: new ProjectsRepo(db),
    pomodoro: new PomodoroRepo(db, 'u1'),
  };
}
const FILE = parsePomodoroRows([
  ['StartTime', 'Type', 'Title', 'Duration', 'List'],
  ['2026-11-01 10:00', 'Pomodoro', 'Algebra', '25', 'Maths'],
  ['2026-11-01 11:00', 'Stopwatch', 'Algebra', '50', 'Maths'],
  ['2026-11-02 11:00', 'Pomodoro', 'Notes', '25', 'Physics'],
  ['2026-11-02 12:00', 'Pomodoro', '/', '25', '/'],
])!;

describe('pomodoro import: save', () => {
  test('names that already exist are linked by themselves, under the right parent', () => {
    const { projects } = setup();
    const maths = projects.create({ name: 'maths' })!;
    const algebra = projects.create({ name: 'Algebra', parent: maths })!;
    projects.create({ name: 'Notes', parent: projects.create({ name: 'Other' })! });
    const plan = autoLink(FILE, projects.all());
    expect(plan.lists).toEqual({ L0: maths, L1: null });
    expect(plan.titles).toEqual({ T0: algebra, T1: null }); // «Notes» sta sotto un altro padre: non è questo
  });

  test('new projects are created (titles under their list); sessions are written closed and manual', () => {
    const { db, projects, pomodoro } = setup();
    const r = savePomodoroImport(db, projects, pomodoro, FILE, { lists: {}, titles: {} });
    expect(r).toEqual({ projects: 4, sessions: 4 });
    const all = projects.all();
    const maths = all.find((p) => p.name === 'Maths')!;
    const algebra = all.find((p) => p.name === 'Algebra')!;
    expect(maths.parent_uuid).toBeNull();
    expect(algebra.parent_uuid).toBe(maths.uuid);
    const rows = db.all<{
      start_time: string;
      end_time: string;
      duration_seconds: number;
      mode: number;
      project_uuid: string | null;
      is_manual: number;
      status: string;
    }>('SELECT * FROM pomodoro_sessions ORDER BY start_time');
    expect(rows.map((s) => [s.start_time, s.end_time, s.duration_seconds, s.mode])).toEqual([
      ['2026-11-01 10:00:00', '2026-11-01 10:25:00', 1500, 0],
      ['2026-11-01 11:00:00', '2026-11-01 11:50:00', 3000, 1],
      ['2026-11-02 11:00:00', '2026-11-02 11:25:00', 1500, 0],
      ['2026-11-02 12:00:00', '2026-11-02 12:25:00', 1500, 0],
    ]);
    expect(rows[0]).toMatchObject({
      project_uuid: algebra.uuid,
      is_manual: 1,
      status: 'archiviato',
    });
    expect(rows[3]!.project_uuid).toBeNull();
  });

  test('a linked project is used and not created again', () => {
    const { db, projects, pomodoro } = setup();
    const maths = projects.create({ name: 'Maths' })!;
    const plan = autoLink(FILE, projects.all());
    const r = savePomodoroImport(db, projects, pomodoro, FILE, plan);
    expect(r.projects).toBe(3); // Algebra, Physics e Notes
    expect(projects.all().filter((p) => p.name === 'Maths')).toHaveLength(1);
    expect(projects.all().find((p) => p.name === 'Algebra')!.parent_uuid).toBe(maths);
  });
});
