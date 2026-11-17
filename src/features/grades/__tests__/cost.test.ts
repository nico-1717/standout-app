import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { bandName, buildCosts, forecast, perCfuFor, type DoneExamCost } from '../cost';
import { GradesRepo } from '../repo';

const done = (over: Partial<DoneExamCost>): DoneExamCost => ({
  name: 'X',
  cfu: 6,
  grade: 27,
  honors: false,
  pomodori: 60,
  seconds: 90000,
  ...over,
});

describe('cost per credit (same rules as the website)', () => {
  test('bands: ≤6, 7-9, 10-12, 13+', () => {
    expect([6, 6.5, 9, 10, 12, 12.5, 15].map(bandName)).toEqual([
      '≤6',
      '7-9',
      '7-9',
      '10-12',
      '10-12',
      '13+',
      '13+',
    ]);
  });

  test('each exam: hours and pomodoros per credit rounded to one decimal', () => {
    const { exams } = buildCosts([done({ cfu: 9, pomodori: 100, seconds: 100000 })]);
    expect(exams[0]).toMatchObject({ hours: 27.8, perCfu: 11.1 });
  });

  test('a band averages the cost per credit of its exams (not the total) and the grades', () => {
    const { bands } = buildCosts([
      done({ cfu: 6, pomodori: 60, grade: 30 }), // 10 per credit
      done({ cfu: 6, pomodori: 90, grade: 26 }), // 15 per credit
      done({ cfu: 12, pomodori: 360, grade: 24 }), // 30 per credit
      done({ cfu: 6, pomodori: 0 }), // no pomodoros: it says nothing about cost
    ]);
    expect(bands).toEqual([
      { cfu: '≤6', esami: 2, perCfu: 12.5, avgGrade: 28 },
      { cfu: '10-12', esami: 1, perCfu: 30, avgGrade: 24 },
    ]);
  });

  test('forecast: each exam to take at its band price, the average of the others when its band is empty', () => {
    const { bands } = buildCosts([
      done({ cfu: 6, pomodori: 60 }),
      done({ cfu: 12, pomodori: 360 }),
    ]);
    expect(perCfuFor(6, bands)).toBe(10);
    expect(perCfuFor(8, bands)).toBe(20); // (10 + 30) / 2
    const f = forecast(
      [
        { name: 'A', cfu: 6 },
        { name: 'B', cfu: 8 },
        { name: 'No credits', cfu: 0 },
      ],
      bands,
    );
    expect(f).toEqual({
      total: 220,
      rows: [
        { name: 'A', cfu: 6, pomodori: 60 },
        { name: 'B', cfu: 8, pomodori: 160 },
      ],
    });
  });

  test('without any finished exam there is nothing to base an estimate on', () => {
    expect(forecast([{ name: 'A', cfu: 6 }], [])).toBeNull();
  });
});

describe('GradesRepo.doneCosts', () => {
  test('counts the finished pomodoros of the exam project and its children, once', () => {
    const db = memoryDb();
    migrate(db);
    const repo = new GradesRepo(db);
    const exam = repo.addExam({ name: 'Analisi', cfu: 9, status: 'done', grade: 28 });
    repo.addExam({ name: 'Unlinked', cfu: 6, status: 'done', grade: 25 });
    const proj = (uuid: string, parent: string | null) =>
      db.run(
        `INSERT INTO projects (uuid, name, parent_uuid, notes, status, color, color_edited, todo_enabled, is_favorite, sort_key)
         VALUES (?, ?, ?, '', 'in_progress', '#000', 0, 0, 0, 'a0')`,
        [uuid, uuid, parent],
      );
    proj('p1', null);
    proj('p2', 'p1');
    proj('p3', null);
    for (const e of ['e1', 'e2'])
      db.run(
        `INSERT INTO planner_events (uuid, title, event_date, project_uuid, study_exam_uuid) VALUES (?, 'x', '2030-01-01', 'p1', ?)`,
        [e, exam],
      );
    const pomo = (uuid: string, project: string, end: string | null) =>
      db.run(
        `INSERT INTO pomodoro_sessions (uuid, start_time, end_time, duration_seconds, project_uuid) VALUES (?, '2030-01-01T09:00', ?, 1500, ?)`,
        [uuid, end, project],
      );
    pomo('s1', 'p1', '2030-01-01T09:25');
    pomo('s2', 'p2', '2030-01-01T10:25');
    pomo('s3', 'p3', '2030-01-01T11:25'); // another project: not this exam
    pomo('s4', 'p1', null); // still running: not counted
    expect(repo.doneCosts()).toEqual([
      { name: 'Analisi', cfu: 9, grade: 28, honors: false, pomodori: 2, seconds: 3000 },
    ]);
  });
});
