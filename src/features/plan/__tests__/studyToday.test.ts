import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { studyToday } from '../studyToday';

function setup() {
  const db = memoryDb();
  migrate(db);
  db.run(
    `INSERT INTO planner_calendars (uuid, name, role) VALUES ('cal-study', 'To study', 'study')`,
  );
  db.run(`INSERT INTO planner_calendars (uuid, name, role) VALUES ('cal-main', 'Main', NULL)`);
  db.run(`INSERT INTO projects (uuid, name, color) VALUES ('math', 'Analysis 1', '#3366ff')`);
  const ev = (
    uuid: string,
    cal: string,
    from: string,
    to: string | null,
    o: { cancelled?: number; rrule?: string; completed?: number } = {},
  ) =>
    db.run(
      `INSERT INTO planner_events (uuid, title, event_date, end_date, calendar_uuid, project_uuid, color, is_cancelled, rrule, is_completed)
       VALUES (?, ?, ?, ?, ?, 'math', '#999999', ?, ?, ?)`,
      [uuid, `Block ${uuid}`, from, to, cal, o.cancelled ?? 0, o.rrule ?? null, o.completed ?? 0],
    );
  const topic = (
    uuid: string,
    block: string,
    from: string,
    to: string | null,
    o: { status?: string; est?: number | null; review?: string | null } = {},
  ) =>
    db.run(
      `INSERT INTO projects (uuid, name, color, status, sort_key, study_event_uuid, study_start, study_end, study_pomodori_stimati, study_ripasso_di_uuid)
       VALUES (?, ?, '#3366ff', ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        `Topic ${uuid}`,
        o.status ?? 'in_progress',
        uuid,
        block,
        from,
        to,
        o.est ?? null,
        o.review ?? null,
      ],
    );
  const session = (project: string, n: number, open = false) => {
    for (let i = 0; i < n; i++)
      db.run(
        `INSERT INTO pomodoro_sessions (uuid, start_time, end_time, project_uuid) VALUES (?, '2030-03-10 10:00:00', ?, ?)`,
        [`${project}-${i}-${open}`, open ? null : '2030-03-10 10:25:00', project],
      );
  };
  return { db, ev, topic, session };
}

describe('studyToday', () => {
  test('lists the study blocks that cover the day, with the subject colour and name', () => {
    const { db, ev } = setup();
    ev('b1', 'cal-study', '2030-03-08', '2030-03-12');
    ev('far', 'cal-study', '2030-04-01', null);
    ev('plain', 'cal-main', '2030-03-10', null); // non è del calendario studio
    const blocks = studyToday(db, '2030-03-10');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      uuid: 'b1',
      title: 'Block b1',
      subject: 'Analysis 1',
      color: '#3366ff',
      completed: false,
      topics: [],
    });
    expect(studyToday(db, '2030-03-13')).toEqual([]);
  });

  test('a single-day block (no end date) covers its own day only', () => {
    const { db, ev } = setup();
    ev('b1', 'cal-study', '2030-03-10', null);
    expect(studyToday(db, '2030-03-10')).toHaveLength(1);
    expect(studyToday(db, '2030-03-11')).toHaveLength(0);
  });

  test('topics: only those touching the day and not completed, with pomodoros done and the estimate', () => {
    const { db, ev, topic, session } = setup();
    ev('b1', 'cal-study', '2030-03-08', '2030-03-12');
    topic('t1', 'b1', '2030-03-10', '2030-03-11', { est: 4 });
    topic('t2', 'b1', '2030-03-10', null);
    topic('t3', 'b1', '2030-03-12', null); // un altro giorno
    topic('t4', 'b1', '2030-03-10', null, { status: 'completed' });
    topic('t5', 'b1', '2030-03-09', '2030-03-10', { review: 't1' });
    session('t1', 3);
    session('t1', 2, true); // pomodoro non finito: non conta
    const [b] = studyToday(db, '2030-03-10');
    expect(b!.topics.map((x) => x.uuid)).toEqual(['t5', 't1', 't2']); // per inizio, poi ordine
    const t1 = b!.topics.find((x) => x.uuid === 't1')!;
    expect(t1).toMatchObject({ estimated: 4, done: 3, review: false });
    expect(b!.topics.find((x) => x.uuid === 't5')!.review).toBe(true);
    expect(b!.topics.find((x) => x.uuid === 't2')).toMatchObject({ estimated: null, done: 0 });
  });

  test('cancelled and repeating events are left out; a completed block is marked', () => {
    const { db, ev } = setup();
    ev('c1', 'cal-study', '2030-03-10', null, { cancelled: 1 });
    ev('r1', 'cal-study', '2030-03-10', null, { rrule: 'FREQ=WEEKLY' });
    ev('d1', 'cal-study', '2030-03-10', null, { completed: 1 });
    const blocks = studyToday(db, '2030-03-10');
    expect(blocks.map((b) => b.uuid)).toEqual(['d1']);
    expect(blocks[0]!.completed).toBe(true);
  });

  test('without a subject the block colour is used', () => {
    const { db } = setup();
    db.run(
      `INSERT INTO planner_events (uuid, title, event_date, calendar_uuid, color) VALUES ('x', 'Alone', '2030-03-10', 'cal-study', '#abcdef')`,
    );
    expect(studyToday(db, '2030-03-10')[0]).toMatchObject({ subject: null, color: '#abcdef' });
  });
});
