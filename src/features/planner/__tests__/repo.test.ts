import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { upsertRow } from '@/core/sync/rows';

import { PlannerRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const repo = new PlannerRepo(
    db,
    () => '2026-11-03T10:00:00Z',
    () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  );
  upsertRow(db, 'planner_calendars', {
    uuid: 'cal-main',
    name: 'Main',
    color: null,
    is_visible: true,
    is_default: true,
    role: null,
    keywords: '',
    def_repeat: 'none',
    def_notify: 'none',
    sort_key: 'a0',
    created_at: null,
    updated_at: null,
  });
  upsertRow(db, 'planner_categories', {
    uuid: 'cat-uni',
    name: 'University',
    color: '#A9C3AE',
    is_hidden: false,
    role: null,
    sort_key: 'a0',
    created_at: null,
    updated_at: null,
  });
  repo.addKeyword('cat-uni', 'Exam');
  db.run('DELETE FROM outbox');
  return { db, repo };
}

const batch = (db: ReturnType<typeof memoryDb>) => nextBatch(db, 50);

describe('creating an event', () => {
  test('fills what the website fills: main calendar, 30 minutes when the end is wrong, category by word', () => {
    const { db, repo } = setup();
    const id = repo.create({
      title: 'Exam of maths',
      date: '2026-11-10',
      start: '10:00',
      end: '09:00',
    });
    const row = repo.row(id)!;
    expect(row).toMatchObject({
      calendar_uuid: 'cal-main',
      category_uuid: 'cat-uni',
      start_time: '10:00',
      end_time: '10:30',
      end_date: null,
    });
    const [m] = batch(db);
    expect(m).toMatchObject({ table: 'planner_events', uuid: id, op: 'upsert' });
    expect(m!.patch).toMatchObject({
      title: 'Exam of maths',
      event_date: '2026-11-10',
      is_all_day: false,
      calendar_uuid: 'cal-main',
    });
  });

  test('an empty title becomes Untitled; an end date equal to the start means one day', () => {
    const { repo } = setup();
    const id = repo.create({ title: '  ', date: '2026-11-10', endDate: '2026-11-10' });
    expect(repo.row(id)).toMatchObject({ title: 'Untitled', end_date: null });
  });

  test('a repeating event gets its rule and is its own series; the week view sees it', () => {
    const { repo } = setup();
    const id = repo.create({
      title: 'Gym',
      date: '2026-11-03',
      repeat: 'weekly',
      repeatUntil: '2026-11-24',
    });
    expect(repo.row(id)).toMatchObject({
      rrule: 'FREQ=WEEKLY;UNTIL=20261124T235959Z',
      series_uuid: id,
    });
    const seen = repo.eventsInRange('2026-11-01', '2026-12-31').map((e) => e.date);
    expect(seen).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  });

  test('custom repeat: every 3 days', () => {
    const { repo } = setup();
    const id = repo.create({
      title: 'Pills',
      date: '2026-11-03',
      repeat: 'custom',
      repeatInterval: 3,
      repeatUnit: 'day',
    });
    expect(repo.row(id)!.rrule).toBe('FREQ=DAILY;INTERVAL=3');
  });
});

describe('changing a series', () => {
  test('only this time: an exception is born, the others stay', () => {
    const { db, repo } = setup();
    const id = repo.create({ title: 'Gym', date: '2026-11-03', repeat: 'weekly' });
    db.run('DELETE FROM outbox');
    const second = repo.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    repo.update(second, { start: '19:00', end: '20:00' }, 'one');
    const days = repo.eventsInRange('2026-11-01', '2026-11-30');
    expect(days.map((e) => `${e.date} ${e.start}`)).toEqual([
      '2026-11-03 09:00',
      '2026-11-10 19:00',
      '2026-11-17 09:00',
      '2026-11-24 09:00',
    ]);
    const [m] = batch(db);
    expect(m!.patch).toMatchObject({
      series_uuid: id,
      original_date: '2026-11-10',
      start_time: '19:00',
      repeat_type: 'none',
    });
  });

  test('the whole series: the master changes, nothing new is born', () => {
    const { db, repo } = setup();
    const id = repo.create({ title: 'Gym', date: '2026-11-03', repeat: 'weekly' });
    db.run('DELETE FROM outbox');
    const occ = repo.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    repo.update(occ, { title: 'Gym class' }, 'all');
    expect(repo.rows()).toHaveLength(1);
    expect(repo.row(id)!.title).toBe('Gym class');
    expect(batch(db)[0]!.patch).toEqual({ title: 'Gym class' });
  });

  test('changing the repeat of a series changes only what changed', () => {
    const { db, repo } = setup();
    const id = repo.create({ title: 'Gym', date: '2026-11-03', repeat: 'weekly' });
    db.run('DELETE FROM outbox');
    const head = repo.eventsInRange('2026-11-03', '2026-11-03')[0]!;
    repo.update(head, { repeat: 'daily' });
    expect(repo.row(id)!.rrule).toBe('FREQ=DAILY');
    expect(batch(db)[0]!.patch).toEqual({ repeat_type: 'daily' });
  });
});

describe('moving an event by dragging', () => {
  test('keeps the length, stays inside the day and sends only the new times', () => {
    const { db, repo } = setup();
    repo.create({ title: 'Call', date: '2026-11-10', start: '09:00', end: '10:30' });
    db.run('DELETE FROM outbox');
    const ev = repo.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    expect(repo.moveTo(ev, 14 * 60)).toBe(true);
    const moved = repo.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    expect([moved.start, moved.end]).toEqual(['14:00', '15:30']);
    const [m] = batch(db);
    expect(m!.patch).toMatchObject({ start_time: '14:00', end_time: '15:30' });

    // troppo tardi: la fine non supera le 23:59, quindi l'inizio si ferma prima
    expect(repo.moveTo(moved, 23 * 60 + 45)).toBe(true);
    const late = repo.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    expect([late.start, late.end]).toEqual(['22:29', '23:59']);
    // nessun cambio, nessuna scrittura
    db.run('DELETE FROM outbox');
    expect(repo.moveTo(late, 22 * 60 + 29)).toBe(false);
    expect(batch(db)).toHaveLength(0);
  });
  test('one time of a series moves alone; all-day events do not move', () => {
    const { repo } = setup();
    repo.create({ title: 'Gym', date: '2026-11-03', repeat: 'weekly' });
    repo.create({ title: 'Trip', date: '2026-11-10', allDay: true });
    const second = repo.eventsInRange('2026-11-10', '2026-11-10').find((e) => e.title === 'Gym')!;
    expect(repo.moveTo(second, 18 * 60)).toBe(true);
    const days = repo.eventsInRange('2026-11-01', '2026-11-17').filter((e) => e.title === 'Gym');
    expect(days.map((e) => `${e.date} ${e.start}`)).toEqual([
      '2026-11-03 09:00',
      '2026-11-10 18:00',
      '2026-11-17 09:00',
    ]);
    const trip = repo.eventsInRange('2026-11-10', '2026-11-10').find((e) => e.title === 'Trip')!;
    expect(repo.moveTo(trip, 60)).toBe(false);
  });
});

describe('deleting', () => {
  test('one time of a series leaves a cancelled exception; the series stays', () => {
    const { db, repo } = setup();
    repo.create({ title: 'Gym', date: '2026-11-03', repeat: 'weekly' });
    db.run('DELETE FROM outbox');
    repo.remove(repo.eventsInRange('2026-11-10', '2026-11-10')[0]!, 'one');
    expect(repo.eventsInRange('2026-11-01', '2026-11-30').map((e) => e.date)).toEqual([
      '2026-11-03',
      '2026-11-17',
      '2026-11-24',
    ]);
    expect(batch(db)[0]!.patch).toMatchObject({ original_date: '2026-11-10', is_cancelled: true });
  });

  test('a moved time is cancelled by its own row', () => {
    const { db, repo } = setup();
    repo.create({ title: 'Gym', date: '2026-11-03', repeat: 'weekly' });
    repo.update(
      repo.eventsInRange('2026-11-10', '2026-11-10')[0]!,
      { start: '19:00', end: '20:00' },
      'one',
    );
    db.run('DELETE FROM outbox');
    const moved = repo.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    expect(moved.isException).toBe(true);
    repo.remove(moved, 'one');
    expect(repo.eventsInRange('2026-11-10', '2026-11-10')).toEqual([]);
    expect(batch(db)[0]!.patch).toEqual({ is_cancelled: true });
  });

  test('the whole series goes, with its exceptions; the server gets one delete', () => {
    const { db, repo } = setup();
    repo.create({ title: 'Gym', date: '2026-11-03', repeat: 'weekly' });
    repo.remove(repo.eventsInRange('2026-11-10', '2026-11-10')[0]!, 'one');
    db.run('DELETE FROM outbox');
    repo.remove(repo.eventsInRange('2026-11-17', '2026-11-17')[0]!, 'series');
    expect(repo.rows()).toHaveLength(0);
    const out = batch(db);
    expect(out).toHaveLength(1);
    expect(out[0]!.op).toBe('delete');
  });

  test('a normal event is deleted (and never sent, if it was never sent)', () => {
    const { db, repo } = setup();
    const id = repo.create({ title: 'Once', date: '2026-11-03' });
    repo.remove(repo.eventsInRange('2026-11-03', '2026-11-03')[0]!);
    expect(repo.row(id)).toBeNull();
    expect(batch(db)).toHaveLength(0);
  });
});

describe('done, calendars and categories', () => {
  test('ticking one repetition makes an exception that is done; the others are not', () => {
    const { repo } = setup();
    repo.create({ title: 'Task', date: '2026-11-03', repeat: 'weekly', type: 'task' });
    repo.toggleDone(repo.eventsInRange('2026-11-10', '2026-11-10')[0]!);
    const all = repo.eventsInRange('2026-11-01', '2026-11-17');
    expect(all.map((e) => [e.date, e.done])).toEqual([
      ['2026-11-03', false],
      ['2026-11-10', true],
      ['2026-11-17', false],
    ]);
  });

  test('hidden categories and switched-off calendars are not shown', () => {
    const { repo } = setup();
    repo.create({ title: 'Exam day', date: '2026-11-03' });
    repo.create({ title: 'Lunch', date: '2026-11-03' });
    repo.updateCategory('cat-uni', { is_hidden: true });
    expect(repo.visibleEventsInRange('2026-11-03', '2026-11-03').map((e) => e.title)).toEqual([
      'Lunch',
    ]);
    repo.updateCategory('cat-uni', { is_hidden: false });
    repo.updateCalendar('cal-main', { is_visible: false });
    expect(repo.visibleEventsInRange('2026-11-03', '2026-11-03')).toEqual([]);
  });

  test('a word belongs to one category only', () => {
    const { repo } = setup();
    const c2 = repo.addCategory('Work', '#C2B8DC');
    expect(repo.addKeyword(c2, 'exam')).toBe(false);
    expect(repo.addKeyword(c2, 'meeting')).toBe(true);
  });

  test('deleting a calendar moves its events to the main one; the main one cannot be deleted', () => {
    const { repo } = setup();
    const extra = repo.addCalendar('Sport', '#112233');
    const id = repo.create({ title: 'Run', date: '2026-11-03', calendarUuid: extra });
    expect(repo.removeCalendar('cal-main')).toBe(false);
    expect(repo.removeCalendar(extra)).toBe(true);
    expect(repo.row(id)!.calendar_uuid).toBe('cal-main');
  });
});

describe('search by title', () => {
  test('needs 2 letters, ignores case, puts the nearest to today first, escapes % and _', () => {
    const { repo } = setup();
    repo.create({ title: 'Dentist', date: '2026-11-20', start: '09:00', end: '10:00' });
    const near = repo.create({
      title: 'Dentist check',
      date: '2026-11-04',
      start: '15:30',
      end: '16:00',
    });
    repo.create({ title: '100% sure', date: '2026-11-05', start: '09:00', end: '10:00' });
    repo.create({ title: 'a_b', date: '2026-11-05', start: '11:00', end: '12:00' });
    repo.create({ title: 'axb', date: '2026-11-05', start: '12:00', end: '13:00' });

    expect(repo.search('d', '2026-11-03')).toEqual([]);
    const hits = repo.search('DENT', '2026-11-03');
    expect(hits.map((h) => h.title)).toEqual(['Dentist check', 'Dentist']);
    expect(hits[0]).toMatchObject({ uuid: near, date: '2026-11-04', start: '15:30', all_day: 0 });
    expect(repo.search('0% s', '2026-11-03').map((h) => h.title)).toEqual(['100% sure']);
    expect(repo.search('a_b', '2026-11-03').map((h) => h.title)).toEqual(['a_b']); // «_» non vale «un carattere»
    expect(repo.search('zzz', '2026-11-03')).toEqual([]);
  });
});
