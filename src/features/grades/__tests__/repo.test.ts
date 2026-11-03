import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';

import { DEFAULT_GRADE_SETTINGS } from '../logic';
import { GradesRepo, normalizeExam } from '../repo';
import { GradeSettingsStore, cleanGradeSettings } from '../settings';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const repo = new GradesRepo(
    db,
    () => '2030-01-01T10:00:00Z',
    () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  );
  return { db, repo };
}

describe('exam rules (same as the website)', () => {
  test('honors force 30, pass/fail has no grade, the date only counts when passed, grades stay 18..30', () => {
    const { repo } = setup();
    const a = repo.addExam({
      name: 'A',
      cfu: 9,
      status: 'done',
      grade: 27,
      has_honors: true,
      exam_date: '2030-02-01',
    });
    expect(repo.exam(a)).toMatchObject({ grade: 30, has_honors: 1, exam_date: '2030-02-01' });
    const b = repo.addExam({
      name: 'B',
      cfu: 3,
      status: 'done',
      is_pass_fail: true,
      grade: 25,
      predicted_grade: 22,
    });
    expect(repo.exam(b)).toMatchObject({ grade: null, predicted_grade: null, is_pass_fail: 1 });
    const c = repo.addExam({
      name: 'C',
      cfu: 6,
      status: 'todo',
      grade: 45,
      exam_date: '2030-02-01',
    });
    expect(repo.exam(c)).toMatchObject({ grade: null, exam_date: null });
    expect(repo.updateExam(c, { status: 'done', grade: 24, exam_date: '2030-03-03' })).toBe(true);
    expect(repo.exam(c)).toMatchObject({ status: 'done', grade: 24, exam_date: '2030-03-03' });
    repo.updateExam(c, { status: 'todo' });
    expect(repo.exam(c)!.exam_date).toBeNull();
    expect(repo.updateExam(c, { name: '   ' })).toBe(false);
    expect(repo.updateExam('nope', { name: 'x' })).toBe(false);
    expect(normalizeExam({ ...repo.exam(a)!, cfu: 200 }).cfu).toBe(90);
  });

  test('new exams go last; edits send only what changed; booleans are real booleans on the wire', () => {
    const { db, repo } = setup();
    const a = repo.addExam({ name: 'A', cfu: 6 });
    const b = repo.addExam({ name: 'B', cfu: 6 });
    expect(repo.exams().map((e) => e.name)).toEqual(['A', 'B']);
    db.run('DELETE FROM outbox');
    repo.updateExam(a, { cfu: 7.5, counts_for_graduation: false });
    const [m] = nextBatch(db, 10);
    expect(m).toMatchObject({ table: 'university_exams', uuid: a, op: 'upsert' });
    expect(m!.patch).toEqual({ cfu: 7.5, counts_for_graduation: false });
    repo.updateExam(a, { cfu: 7.5 });
    expect(nextBatch(db, 10)).toHaveLength(0);
    repo.reorderExam(b, null, a);
    expect(repo.exams().map((e) => e.name)).toEqual(['B', 'A']);
    repo.setPrediction(a, 27);
    expect(repo.exam(a)).toMatchObject({ predicted_grade: 27, predicted_honors: 0 });
    repo.setPrediction(a, null, true);
    expect(repo.exam(a)).toMatchObject({ predicted_grade: 30, predicted_honors: 1 });
    repo.removeExams([a, 'nope']);
    expect(repo.exams().map((e) => e.name)).toEqual(['B']);
  });
});

describe('groups', () => {
  test('a group needs two exams; split adds the credits, choice takes the chosen quota (never above the sum)', () => {
    const { repo } = setup();
    const a = repo.addExam({ name: 'A', cfu: 6 });
    const b = repo.addExam({ name: 'B', cfu: 9 });
    const c = repo.addExam({ name: 'C', cfu: 3 });
    expect(repo.createGroup({ exams: [a] })).toBeNull();
    const g = repo.createGroup({ name: 'Choice', exams: [a, b], cfu: 12 })!;
    expect(repo.group(g)).toMatchObject({ group_type: 'choice', cfu: 12, name: 'Choice' });
    expect(repo.exam(a)!.group_uuid).toBe(g);
    const s = repo.createGroup({ type: 'split', exams: [b, c] })!;
    expect(repo.group(s)).toMatchObject({ group_type: 'split', cfu: 12, name: 'Gruppo' });
    expect(repo.updateGroup(g, { exams: [a, b, c], cfu: 99 })).toBe(true);
    expect(repo.group(g)!.cfu).toBe(18);
    expect(repo.updateGroup(g, { exams: [a] })).toBe(false);
    repo.updateGroup(g, { group_type: 'split' });
    expect(repo.group(g)!.cfu).toBe(18);
    repo.updateGroup(g, { overall_grade: 27, overall_honors: false });
    expect(repo.group(g)).toMatchObject({ overall_grade: 27, overall_honors: 0 });
  });

  test('dissolve keeps the exams, delete removes them, "clear todo" keeps the passed one', () => {
    const { db, repo } = setup();
    const a = repo.addExam({ name: 'A', cfu: 6 });
    const b = repo.addExam({ name: 'B', cfu: 6 });
    const c = repo.addExam({ name: 'C', cfu: 6 });
    const g1 = repo.createGroup({ exams: [a, b] })!;
    db.run('DELETE FROM outbox');
    repo.dissolveGroup(g1);
    expect(repo.groups()).toHaveLength(0);
    expect(repo.exams().every((e) => e.group_uuid === null)).toBe(true);
    const ops = nextBatch(db, 20).map((m) => `${m.table}:${m.op}`);
    expect(ops[ops.length - 1]).toBe('university_exam_groups:delete');
    const g2 = repo.createGroup({ exams: [a, b, c] })!;
    repo.updateExam(a, { status: 'done', grade: 28 });
    repo.clearGroupTodo(g2, a);
    expect(repo.exams().map((e) => e.name)).toEqual(['A']);
    expect(repo.groups()).toHaveLength(0);
    const d = repo.addExam({ name: 'D', cfu: 6 });
    const e = repo.addExam({ name: 'E', cfu: 6 });
    const g3 = repo.createGroup({ exams: [d, e] })!;
    repo.deleteGroup(g3);
    expect(repo.exams().map((x) => x.name)).toEqual(['A']);
  });
});

describe('bonuses and catalog', () => {
  test('bonus rules and toggling', () => {
    const { repo } = setup();
    const b = repo.addBonus({
      name: 'Lodi',
      bonus_type: 'honors_each',
      points: 0.5,
      cap_points: 2,
    });
    expect(repo.bonuses()[0]).toMatchObject({ name: 'Lodi', points: 0.5, is_enabled: 1 });
    repo.updateBonus(b, { is_enabled: false, points: 99 });
    expect(repo.bonuses()[0]).toMatchObject({ is_enabled: 0, points: 20 });
    expect(repo.updateBonus('nope', { name: 'x' })).toBe(false);
    repo.removeBonus(b);
    expect(repo.bonuses()).toHaveLength(0);
  });

  test('importing a programme replaces or appends', () => {
    const { repo } = setup();
    repo.addExam({ name: 'Old', cfu: 6 });
    const list = [
      { name: 'Analisi', cfu: 9, ssd: 'MAT/05', year: 1, code: 'AN1', national_avg: 25.5 },
      { name: 'Inglese', cfu: 3, pass_fail: true },
    ];
    expect(repo.importProgram(list, 'append')).toBe(2);
    expect(repo.exams().map((e) => e.name)).toEqual(['Old', 'Analisi', 'Inglese']);
    expect(repo.importProgram(list)).toBe(2);
    expect(repo.exams().map((e) => e.name)).toEqual(['Analisi', 'Inglese']);
    expect(repo.exams()[0]).toMatchObject({
      catalog_code: 'AN1',
      study_year: 1,
      national_avg: 25.5,
    });
    expect(repo.exams()[1]!.is_pass_fail).toBe(1);
  });
});

describe('settings', () => {
  test('cleaned like the server, kept on the phone and sent once', async () => {
    expect(
      cleanGradeSettings({ thesis_min_points: 5, thesis_max_points: 2, grade_base: 5 }),
    ).toMatchObject({
      thesis_min_points: 5,
      thesis_max_points: 5,
      grade_base: 30,
    });
    expect(cleanGradeSettings(null)).toEqual(DEFAULT_GRADE_SETTINGS);
    const { db } = setup();
    const store = new GradeSettingsStore(db);
    store.update({ total_cfu: 120, round_half_up: false });
    expect(store.hasPending()).toBe(true);
    const patch = jest.fn(async (p: object) => ({
      ...DEFAULT_GRADE_SETTINGS,
      ...p,
      total_cfu: 120,
    }));
    const get = jest.fn(async () => DEFAULT_GRADE_SETTINGS);
    const out = await store.sync({ getGradeSettings: get, patchGradeSettings: patch as never });
    expect(patch).toHaveBeenCalledWith({ total_cfu: 120, round_half_up: false });
    expect(out.total_cfu).toBe(120);
    expect(store.hasPending()).toBe(false);
  });
});
