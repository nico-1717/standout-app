import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { ProjectsRepo } from '@/features/projects/repo';

import { PlanRepo } from '../repo';
import { calendarView, masterView, todayView } from '../view';

const TODAY = new Date(2030, 2, 4, 10, 0, 0); // lunedì 4 marzo 2030

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const projects = new ProjectsRepo(db, () => '2030-03-04T09:00:00Z', ids);
  const repo = new PlanRepo(
    db,
    7,
    () => TODAY,
    () => '2030-03-04T09:00:00Z',
    ids,
  );
  repo.saveSettings({
    weekdayMin: 120,
    weekendMin: 60,
    restDow: 0,
    bufferDays: 0,
    floorMin: 15,
    maxSubjects: 3,
    reviews: false,
    overrides: {},
  });
  return { db, projects, repo };
}

const session = (
  db: ReturnType<typeof memoryDb>,
  id: string,
  project: string,
  day: string,
  secs: number,
) =>
  db.run(
    "INSERT INTO pomodoro_sessions (uuid, start_time, end_time, duration_seconds, project_uuid, status) VALUES (?, ?, ?, ?, ?, 'archiviato')",
    [id, `${day} 10:00:00`, `${day} 11:00:00`, secs, project],
  );

describe('todayView', () => {
  test('lists today blocks with the minutes already done, the next exam and the week', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'Analisi' })!;
    repo.saveGoal(p, { minutes: 300, kind: 'exam', deadline: '2030-03-20' });
    repo.setDay(p, '2030-03-04', 60);
    repo.setDay(p, '2030-03-05', 30);
    session(db, 's1', p, '2030-03-04', 1200);
    const v = todayView(repo, projects.all());
    expect(v.blocks).toHaveLength(1);
    expect(v.blocks[0]).toMatchObject({
      project: p,
      minutes: 60,
      done: 20,
      kind: 'study',
      daily: false,
    });
    expect(v.week).toEqual({ planned: 90, done: 20 });
    expect(v.nextExam).toEqual({ project: p, name: 'Analisi', date: '2030-03-20', days: 16 });
  });

  test('yesterday skipped block is offered with the nearest day that has room', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    repo.saveGoal(p, { minutes: 300 });
    repo.setDay(p, '2030-03-03', 60); // ieri, domenica: niente fatto
    repo.setDay(p, '2030-03-04', 100); // oggi: capienza 120 → restano solo 20
    const v = todayView(repo, projects.all());
    expect(v.skipped).toHaveLength(1);
    expect(v.skipped[0]).toMatchObject({ project: p, missing: 60, planned: 60, done: 0 });
    expect(v.skipped[0].moveTo).toBe('2030-03-05');
  });

  test('half done yesterday is not a skipped block', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    repo.setDay(p, '2030-03-03', 60);
    session(db, 's1', p, '2030-03-03', 1800);
    expect(todayView(repo, projects.all()).skipped).toEqual([]);
  });
});

describe('masterView', () => {
  test('goals against free time, weeks by goal, and the projects that could be added', () => {
    const { projects, repo } = setup();
    const a = projects.create({ name: 'Esame A' })!;
    const b = projects.create({ name: 'Altro' })!;
    const a1 = projects.create({ name: 'Cap 1', parent: a })!;
    repo.saveGoal(a, { kind: 'exam', deadline: '2030-03-14', priority: 'must' });
    repo.saveSplit(a, 400, [{ uuid: a1, minutes: 400, locked: false }]);
    const v = masterView(repo, projects.all());
    expect(v.goals).toHaveLength(1);
    expect(v.goals[0]).toMatchObject({ project: a, minutes: 400, kids: 1, missing: 0 });
    expect(v.goals[0].planned).toBe(400);
    expect(v.available.map((x) => x.project)).toEqual([b]);
    expect(v.fits).toBe(true);
    expect(v.neededMin).toBe(400);
    expect(v.units).toBe(1);
    expect(v.weeks[0].start).toBe('2030-03-04');
    expect(
      Object.values(v.weeks[0].parts).reduce((x, y) => x + y, 0) +
        Object.values(v.weeks[1]?.parts ?? {}).reduce((x, y) => x + y, 0),
    ).toBe(400);
  });

  test('time that does not fit shows up as missing', () => {
    const { projects, repo } = setup();
    const a = projects.create({ name: 'Esame' })!;
    repo.saveGoal(a, { minutes: 5000, kind: 'exam', deadline: '2030-03-10' });
    const v = masterView(repo, projects.all());
    expect(v.fits).toBe(false);
    expect(v.missingMin).toBeGreaterThan(0);
    expect(v.goals[0].missing).toBe(v.missingMin);
  });
});

describe('calendarView', () => {
  test('collects the branch, painted days, blocks, done minutes and capacity', () => {
    const { db, projects, repo } = setup();
    const a = projects.create({ name: 'A' })!;
    const a1 = projects.create({ name: 'A1', parent: a })!;
    const z = projects.create({ name: 'Z' })!;
    repo.saveGoal(a, { minutes: 200, deadline: '2030-04-01' });
    repo.paint(a1, 'add', ['2030-03-06']);
    repo.paint(z, 'add', ['2030-03-07']);
    repo.setDay(a1, '2030-03-06', 45);
    session(db, 's1', a1, '2030-03-05', 600);
    const v = calendarView(repo, projects.all(), a, '2030-03-01', '2030-03-10');
    expect(v.nodes.map((n) => n.project)).toEqual([a, a1]);
    expect(v.nodes[1].deadlineEff).toBe('2030-04-01');
    expect(v.paint.get(a1)).toEqual(new Set(['2030-03-06']));
    expect(v.paint.has(z)).toBe(false);
    expect(v.plan).toHaveLength(1);
    expect(v.done.get('2030-03-05')?.get(a1)).toBe(10);
    expect(v.cap.get('2030-03-06')).toEqual({ cap: 120, busy: 0 });
    expect(v.cap.get('2030-03-09')).toEqual({ cap: 60, busy: 0 });
    expect(v.cap.size).toBe(10);
  });
});
