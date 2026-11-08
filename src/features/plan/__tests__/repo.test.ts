import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { planDayUuid, planGoalUuid, planPaintUuid } from '@/core/sync/uuid5';
import { ProjectsRepo } from '@/features/projects/repo';

import { PlanRepo, summarize } from '../repo';

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
  return { db, projects, repo };
}

const mutations = (db: ReturnType<typeof memoryDb>) => nextBatch(db, 1000);

describe('PlanRepo goals', () => {
  test('saveGoal creates the goal with the UUIDv5 of the project and sets since to today', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'Analisi' })!;
    expect(repo.saveGoal(p, { minutes: 600, kind: 'exam', deadline: '2030-04-01' })).toBe(600);
    const g = repo.goals().get(p)!;
    expect(g).toMatchObject({
      minutes: 600,
      kind: 'exam',
      priority: 'should',
      deadline: '2030-04-01',
      since: '2030-03-04',
      active: true,
    });
    const goalUuid = planGoalUuid(p);
    const m = mutations(db).filter((x) => x.table === 'plan_goals');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ uuid: goalUuid, op: 'upsert' });
    expect(m[0].patch).toMatchObject({ project_uuid: p, minutes: 600, kind: 'exam', active: true });
  });

  test('a count goal is items times minutes per item', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'LeetCode' })!;
    expect(repo.saveGoal(p, { kind: 'count', items: 50, unitMinutes: 30, minutes: 5 })).toBe(1500);
  });

  test('since does not move after the first time', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    repo.saveGoal(p, { minutes: 60 });
    db.run('UPDATE plan_goals SET since = ?', ['2030-01-01']);
    repo.saveGoal(p, { minutes: 120 });
    expect(repo.goals().get(p)!.since).toBe('2030-01-01');
  });

  test('cascade copies kind, priority and dates to the children without touching their minutes', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'Esame' })!;
    const c = projects.create({ name: 'Cap 1', parent: p })!;
    repo.saveGoal(c, { minutes: 90 });
    repo.saveGoal(p, {
      minutes: 600,
      kind: 'exam',
      priority: 'must',
      deadline: '2030-05-01',
      cascade: true,
    });
    expect(repo.goals().get(c)).toMatchObject({
      minutes: 90,
      kind: 'exam',
      priority: 'must',
      deadline: '2030-05-01',
    });
  });

  test('saving the same values again queues nothing new', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    repo.saveGoal(p, { minutes: 60 });
    mutations(db);
    repo.saveGoal(p, { minutes: 60 });
    expect(mutations(db).filter((x) => x.table === 'plan_goals')).toHaveLength(0);
  });

  test('saveSplit fixes the sum on the biggest unlocked child', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'Fisica' })!;
    const a = projects.create({ name: 'a', parent: p })!;
    const b = projects.create({ name: 'b', parent: p })!;
    const out = repo.saveSplit(p, 100, [
      { uuid: a, minutes: 30, locked: true },
      { uuid: b, minutes: 50, locked: false },
    ]);
    expect(out.find((x) => x.uuid === b)!.minutes).toBe(70);
    expect(repo.goals().get(p)!.minutes).toBe(100);
    expect(repo.goals().get(a)).toMatchObject({ minutes: 30, locked: true });
    expect(repo.goals().get(b)).toMatchObject({ minutes: 70, locked: false });
  });

  test('saveSplit ignores items that are not children', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'P' })!;
    const other = projects.create({ name: 'Other' })!;
    expect(repo.saveSplit(p, 100, [{ uuid: other, minutes: 100, locked: false }])).toEqual([]);
  });

  test('resplit shares a new total among the children and goes down the tree', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'Corso' })!;
    const a = projects.create({ name: 'a', parent: p })!;
    const b = projects.create({ name: 'b', parent: p })!;
    const a1 = projects.create({ name: 'a1', parent: a })!;
    const a2 = projects.create({ name: 'a2', parent: a })!;
    repo.saveGoal(p, { minutes: 600 });
    repo.resplit(p, 600);
    const g = repo.goals();
    expect(g.get(a)!.minutes + g.get(b)!.minutes).toBe(600);
    expect(g.get(a)!.minutes).toBe(300);
    expect(g.get(a1)!.minutes + g.get(a2)!.minutes).toBe(300);
    // un figlio bloccato non si tocca
    repo.saveSplit(p, 600, [
      { uuid: a, minutes: 100, locked: true },
      { uuid: b, minutes: 500, locked: false },
    ]);
    repo.resplit(p, 800);
    expect(repo.goals().get(a)!.minutes).toBe(100);
    expect(repo.goals().get(b)!.minutes).toBe(700);
  });
});

describe('PlanRepo painting and blocks', () => {
  test('paint add / remove / clear use the UUIDv5 of project and day', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    expect(repo.paint(p, 'add', ['2030-03-05', '2030-03-06', '2030-03-05', 'boh'])).toBe(2);
    expect(repo.painted('2030-03-01').get(p)).toEqual(new Set(['2030-03-05', '2030-03-06']));
    const m = mutations(db).filter((x) => x.table === 'plan_paint');
    expect(m.map((x) => x.uuid).sort()).toEqual(
      [planPaintUuid(p, '2030-03-05'), planPaintUuid(p, '2030-03-06')].sort(),
    );
    expect(repo.paint(p, 'remove', ['2030-03-05'])).toBe(1);
    expect(repo.paint(p, 'clear')).toBe(0);
    expect(repo.painted('2030-03-01').size).toBe(0);
  });

  test('painting a day twice does not queue twice', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    repo.paint(p, 'add', ['2030-03-05']);
    mutations(db);
    repo.paint(p, 'add', ['2030-03-05']);
    expect(mutations(db)).toHaveLength(0);
  });

  test('setDay writes a manual block and 0 removes it', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    expect(repo.setDay(p, '2030-03-06', 45)).toBe(true);
    expect(repo.blocks('2030-03-06', '2030-03-06')).toEqual([
      { project: p, day: '2030-03-06', kind: 'study', minutes: 45, source: 'manual' },
    ]);
    const m = mutations(db).filter((x) => x.table === 'plan_days');
    expect(m[0].uuid).toBe(planDayUuid(p, '2030-03-06', 'study'));
    repo.setDay(p, '2030-03-06', 0);
    expect(repo.blocks('2030-03-06', '2030-03-06')).toEqual([]);
    expect(repo.setDay(p, 'boh', 10)).toBe(false);
  });
});

describe('PlanRepo autoplan', () => {
  test('preview writes nothing, apply writes auto blocks and keeps manual ones', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'Esame' })!;
    repo.saveSettings({
      weekdayMin: 120,
      weekendMin: 120,
      restDow: 0,
      bufferDays: 0,
      floorMin: 15,
      maxSubjects: 3,
      reviews: false,
      overrides: {},
    });
    repo.saveGoal(p, { minutes: 600, kind: 'exam', deadline: '2030-03-14' });
    repo.setDay(p, '2030-03-05', 60);
    const preview = repo.autoplan(null, false);
    expect(preview.applied).toBe(false);
    expect(preview.fits).toBe(true);
    expect(preview.totalMin).toBe(540);
    expect(repo.blocks('2030-03-04', '2030-03-20')).toHaveLength(1);

    const done = repo.autoplan(null, true);
    expect(done.applied).toBe(true);
    const blocks = repo.blocks('2030-03-04', '2030-03-20');
    const study = blocks.filter((b) => b.kind === 'study');
    expect(study.find((b) => b.day === '2030-03-05')).toMatchObject({
      minutes: 60,
      source: 'manual',
    });
    // come sul sito: dove c'è già un blocco a mano, quello vince e la parte automatica dello stesso giorno non si scrive
    expect(study.reduce((a, b) => a + b.minutes, 0)).toBe(545);
    expect(blocks.every((b) => b.day < '2030-03-14')).toBe(true);

    // applicare di nuovo lo stesso piano non cambia niente
    mutations(db);
    repo.autoplan(null, true);
    expect(mutations(db).filter((x) => x.table === 'plan_days')).toHaveLength(0);
  });

  test('summarize adds up weeks and missing time', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'Esame' })!;
    repo.saveSettings({
      weekdayMin: 60,
      weekendMin: 0,
      restDow: 0,
      bufferDays: 0,
      floorMin: 15,
      maxSubjects: 3,
      reviews: false,
      overrides: {},
    });
    repo.saveGoal(p, { minutes: 1000, kind: 'exam', deadline: '2030-03-08' });
    const s = summarize(repo.compute(null));
    expect(s.fits).toBe(false);
    expect(s.missingMin).toBeGreaterThan(0);
    expect(s.warnings[0].project).toBe(p);
    expect(Object.keys(s.weeks)).toEqual(['2030-03-04']);
  });
});

describe('PlanRepo settings and measured pace', () => {
  test('without data the pace is the prudent default, with data it is the average of the worked days', () => {
    const { db, repo } = setup();
    expect(repo.settings()).toMatchObject({ weekdayEff: 120, weekendEff: 120 });
    // 5 giorni feriali da 90 minuti negli ultimi 60 giorni
    for (let i = 1; i <= 5; i++)
      db.run(
        "INSERT INTO pomodoro_sessions (uuid, start_time, end_time, duration_seconds, status) VALUES (?, ?, ?, 5400, 'archiviato')",
        [`s${i}`, `2030-02-0${i} 10:00:00`, `2030-02-0${i} 11:30:00`],
      );
    expect(repo.settings().measured.days).toBe(5);
    // 1-5 febbraio 2030: venerdì 1, sabato 2, domenica 3, lunedì 4, martedì 5 → 3 feriali e 2 weekend: pochi dati (<4) per entrambi
    expect(repo.settings().weekdayEff).toBe(120);
  });

  test('a chosen value beats the measured one; day overrides are kept', () => {
    const { repo } = setup();
    repo.saveSettings({
      weekdayMin: 200,
      weekendMin: null,
      restDow: 7,
      bufferDays: 2,
      floorMin: 20,
      maxSubjects: 2,
      reviews: true,
      overrides: {},
    });
    repo.setDayCapacity('2030-03-09', 30);
    const s = repo.settings();
    expect(s).toMatchObject({
      weekdayEff: 200,
      weekendEff: 120,
      restDow: 7,
      bufferDays: 2,
      floorMin: 20,
      maxSubjects: 2,
      reviews: true,
    });
    expect(s.overrides).toEqual({ '2030-03-09': 30 });
    repo.setDayCapacity('2030-03-09', null);
    expect(repo.settings().overrides).toEqual({});
  });

  test('busy counts timed events and weights all-day ones; recurring and project events are left out', () => {
    const { db, repo } = setup();
    const ev = (uuid: string, date: string, extra: Record<string, string | number | null> = {}) => {
      const cols = {
        uuid,
        event_date: date,
        start_time: '09:00',
        end_time: '10:30',
        item_type: 'event',
        ...extra,
      };
      db.run(
        `INSERT INTO planner_events (${Object.keys(cols).join(',')}) VALUES (${Object.keys(cols)
          .map(() => '?')
          .join(',')})`,
        Object.values(cols),
      );
    };
    ev('a', '2030-03-05');
    ev('b', '2030-03-05', { start_time: '14:00', end_time: '15:00' });
    ev('c', '2030-03-06', { is_all_day: 1, importance: 'highest' });
    ev('d', '2030-03-06', { is_all_day: 1, importance: 'normal' });
    ev('e', '2030-03-07', { rrule: 'FREQ=DAILY' });
    ev('f', '2030-03-07', { project_uuid: 'x' });
    ev('g', '2030-03-07', { is_cancelled: 1 });
    ev('h', '2030-03-07', { item_type: 'task' });
    const busy = repo.busy('2030-03-04', '2030-03-10');
    expect(busy.get('2030-03-05')).toBe(150);
    expect(busy.get('2030-03-06')).toBe(240);
    expect(busy.has('2030-03-07')).toBe(false);
  });
});

describe('PlanRepo templates, old estimates, daily log, skipped', () => {
  test('a template saves the shape by name and applies to another project', () => {
    const { projects, repo } = setup();
    const a = projects.create({ name: 'Esame 2029' })!;
    const a1 = projects.create({ name: 'Limiti', parent: a })!;
    repo.saveGoal(a, { minutes: 300, kind: 'exam', priority: 'must' });
    repo.saveGoal(a1, { minutes: 120, kind: 'exam', priority: 'must', locked: true });
    expect(repo.saveTemplate(a, '  Sessione  ')).toBe(2);
    expect(repo.saveTemplate(a, '  ')).toBe(-1);
    const t = repo.templates();
    expect(t.map((x) => x.name)).toEqual(['Sessione']);

    const b = projects.create({ name: 'Esame 2030' })!;
    const b1 = projects.create({ name: 'Limiti', parent: b })!;
    const b2 = projects.create({ name: 'Altro', parent: b })!;
    expect(repo.applyTemplate(t[0].uuid, b)).toBe(2);
    expect(repo.goals().get(b)).toMatchObject({ minutes: 300, kind: 'exam', priority: 'must' });
    expect(repo.goals().get(b1)).toMatchObject({ minutes: 120, locked: true });
    expect(repo.goals().get(b2)).toBeUndefined();

    repo.removeTemplate(t[0].uuid);
    expect(repo.templates()).toEqual([]);
    expect(repo.applyTemplate('nope', b)).toBe(-1);
  });

  test('importOld turns estimated pomodoros into minutes, once', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'Vecchio' })!;
    const q = projects.create({ name: 'Nuovo' })!;
    db.run('UPDATE projects SET study_pomodori_stimati = 10, study_end = ? WHERE uuid = ?', [
      '2030-06-01',
      p,
    ]);
    db.run('UPDATE projects SET study_pomodori_stimati = 4 WHERE uuid = ?', [q]);
    repo.saveGoal(q, { minutes: 50 });
    expect(repo.oldEstimateCount()).toBe(1);
    expect(repo.importOld(25)).toBe(1);
    expect(repo.goals().get(p)).toMatchObject({ minutes: 250, deadline: '2030-06-01' });
    expect(repo.goals().get(q)!.minutes).toBe(50);
    expect(repo.oldEstimateCount()).toBe(0);
  });

  test('dailyLog creates a manual session as long as the daily goal', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'Podcast' })!;
    expect(repo.dailyLog(p, '20:00')).toBeNull();
    repo.saveGoal(p, { kind: 'daily', minutes: 30 });
    expect(repo.dailyLog(p, '25:00')).toBeNull();
    expect(repo.dailyLog(p, '23:45')).toBe(30);
    const s = db.all<Record<string, unknown>>('SELECT * FROM pomodoro_sessions')[0];
    expect(s).toMatchObject({
      start_time: '2030-03-04 23:45:00',
      end_time: '2030-03-05 00:15:00',
      duration_seconds: 1800,
      is_manual: 1,
      project_uuid: p,
      status: 'archiviato',
    });
    expect(repo.done('2030-03-04').get(p)?.get('2030-03-04')).toBe(30);
  });

  test('skipFix shrinks yesterday to what was done and can move the rest', () => {
    const { db, projects, repo } = setup();
    const p = projects.create({ name: 'A' })!;
    repo.setDay(p, '2030-03-03', 60);
    db.run(
      "INSERT INTO pomodoro_sessions (uuid, start_time, end_time, duration_seconds, project_uuid, status) VALUES ('s', '2030-03-03 10:00:00', '2030-03-03 10:20:00', 1200, ?, 'archiviato')",
      [p],
    );
    repo.skipFix(p, 'move', '2030-03-06');
    const blocks = repo.blocks('2030-03-03', '2030-03-07');
    expect(blocks.find((b) => b.day === '2030-03-03')).toMatchObject({
      minutes: 20,
      source: 'manual',
    });
    expect(blocks.find((b) => b.day === '2030-03-06')).toMatchObject({
      minutes: 40,
      source: 'manual',
    });
  });

  test('skipFix on a daily goal never moves, and with nothing done it drops yesterday', () => {
    const { projects, repo } = setup();
    const p = projects.create({ name: 'Daily' })!;
    repo.saveGoal(p, { kind: 'daily', minutes: 10 });
    repo.setDay(p, '2030-03-03', 10);
    repo.skipFix(p, 'move');
    expect(repo.blocks('2030-03-03', '2030-03-10')).toEqual([]);
  });
});

describe('PlanRepo important events', () => {
  test('multi-day events appear on each day of the window; normal and cancelled ones do not', () => {
    const { db, repo } = setup();
    const ev = (uuid: string, extra: Record<string, string | number | null>) => {
      const cols = {
        uuid,
        event_date: '2030-03-05',
        start_time: '09:00',
        end_time: '10:00',
        item_type: 'event',
        importance: 'high',
        ...extra,
      };
      db.run(
        `INSERT INTO planner_events (${Object.keys(cols).join(',')}) VALUES (${Object.keys(cols)
          .map(() => '?')
          .join(',')})`,
        Object.values(cols),
      );
    };
    ev('trip', {
      title: 'Viaggio',
      event_date: '2030-03-05',
      end_date: '2030-03-07',
      importance: 'highest',
      is_all_day: 1,
    });
    ev('plain', { title: 'Normale', importance: 'normal' });
    ev('gone', { title: 'Annullato', is_cancelled: 1 });
    ev('late', { title: 'Fuori', event_date: '2030-05-01' });
    const out = repo.importantEvents('2030-03-06', '2030-03-31');
    expect(out.map((e) => [e.day, e.title, e.importance, e.allDay])).toEqual([
      ['2030-03-06', 'Viaggio', 'highest', true],
      ['2030-03-07', 'Viaggio', 'highest', true],
    ]);
  });
});
