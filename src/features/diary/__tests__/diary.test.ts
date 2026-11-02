import { memoryDb } from '@/core/db/__tests__/testDb';
import { FakeServer } from '@/core/sync/__tests__/fakeServer';
import { SyncEngine } from '@/core/sync/engine';
import { nextBatch, pendingCount } from '@/core/sync/outbox';
import { diaryDayUuid } from '@/core/sync/uuid5';
import type { Habit, HabitLog } from '@/features/habits/logic';

import { diaryRings, habitsOfTheDay, summariseMonth, weeklyOfTheDay } from '../logic';
import { DiaryRepo, EMPTY_NOTE_REV } from '../repo';
import {
  cleanDiarySettings,
  DiarySettingsStore,
  type DiarySettings,
  type DiarySettingsApi,
} from '../settings';

function phone(server: FakeServer, userId = 7) {
  const db = memoryDb();
  let t = 0;
  const clock = () => `2026-11-05T10:00:${String(t++).padStart(2, '0')}Z`;
  let n = 0;
  const newId = () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
  return {
    db,
    engine: new SyncEngine(db, server, clock),
    diary: new DiaryRepo(db, userId, clock, newId),
  };
}

describe('diary: the day', () => {
  it('writes mood, energy and text; an unknown day starts empty', () => {
    const a = phone(new FakeServer());
    expect(a.diary.day('2026-11-05')).toMatchObject({
      mood: null,
      note: '',
      good: [],
      learned: [],
    });
    a.diary.setMood('2026-11-05', 4);
    a.diary.setEnergy('2026-11-05', 2);
    a.diary.setNote('2026-11-05', 'A calm day');
    expect(a.diary.day('2026-11-05')).toMatchObject({ mood: 4, energy: 2, note: 'A calm day' });
    // one row per day, one pending change (they merge)
    expect(pendingCount(a.db)).toBe(1);
  });

  it('mood 0 or null removes it; strange numbers stay between 1 and 5', () => {
    const a = phone(new FakeServer());
    a.diary.setMood('2026-11-05', 9);
    expect(a.diary.day('2026-11-05').mood).toBe(5);
    a.diary.setMood('2026-11-05', 0);
    expect(a.diary.day('2026-11-05').mood).toBeNull();
  });

  it('the day row has the identity the server expects (UUIDv5 of user and day)', async () => {
    const server = new FakeServer();
    const a = phone(server, 7);
    a.diary.setNote('2026-11-05', 'x');
    await a.engine.syncOnce();
    expect(server.rows.get(`habit_daily_journal|${diaryDayUuid(7, '2026-11-05')}`)).toMatchObject({
      entry_date: '2026-11-05',
      note: 'x',
    });
  });

  it('a note never seen before is sent with the hash of the empty text', () => {
    const a = phone(new FakeServer());
    a.diary.setNote('2026-11-05', 'hello');
    const [m] = nextBatch(a.db, 10);
    expect(m.patch).toMatchObject({
      note: 'hello',
      note_rev: EMPTY_NOTE_REV,
      entry_date: '2026-11-05',
    });
  });

  it('a note on a known day is sent with the hash the server gave; mood alone sends no hash', () => {
    const a = phone(new FakeServer());
    a.db.run(
      `INSERT INTO habit_daily_journal (uuid, entry_date, note, note_rev) VALUES (?,?,?,?)`,
      [diaryDayUuid(7, '2026-11-04'), '2026-11-04', 'server text', 'abc123'],
    );
    a.diary.setMood('2026-11-04', 3);
    a.diary.setNote('2026-11-04', 'server text + mine');
    const [m] = nextBatch(a.db, 10);
    expect(m.patch).toMatchObject({ mood: 3, note: 'server text + mine', note_rev: 'abc123' });
    expect(m.patch).not.toHaveProperty('entry_date'); // the day cannot change
  });

  it('writing the same text again sends nothing', () => {
    const a = phone(new FakeServer());
    a.diary.setNote('2026-11-05', 'same');
    nextBatch(a.db, 10);
    const before = pendingCount(a.db);
    a.diary.setNote('2026-11-05', 'same');
    expect(pendingCount(a.db)).toBe(before);
  });

  it('a second phone receives the day', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const b = phone(server);
    a.diary.setMood('2026-11-05', 5);
    a.diary.setNote('2026-11-05', 'Great');
    a.diary.addItem('2026-11-05', 'good', 'Coffee with Anna');
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.diary.day('2026-11-05')).toMatchObject({ mood: 5, note: 'Great' });
    expect(b.diary.day('2026-11-05').good.map((i) => i.content)).toEqual(['Coffee with Anna']);
  });
});

describe('diary: the two lists', () => {
  it('adds in order, edits, and removes; empty text is ignored or removes', () => {
    const a = phone(new FakeServer());
    const x = a.diary.addItem('2026-11-05', 'good', '  First  ')!;
    const y = a.diary.addItem('2026-11-05', 'good', 'Second')!;
    a.diary.addItem('2026-11-05', 'learned', 'Sleep helps');
    expect(a.diary.addItem('2026-11-05', 'good', '   ')).toBeNull();
    expect(a.diary.day('2026-11-05').good.map((i) => i.content)).toEqual(['First', 'Second']);
    a.diary.editItem(y, 'Second!');
    expect(a.diary.day('2026-11-05').good[1].content).toBe('Second!');
    a.diary.editItem(x, '   '); // empty = remove, like the website
    expect(a.diary.day('2026-11-05').good.map((i) => i.content)).toEqual(['Second!']);
    a.diary.removeItem(y);
    expect(a.diary.day('2026-11-05').good).toEqual([]);
    expect(a.diary.day('2026-11-05').learned).toHaveLength(1);
  });

  it('a new item sends day and list once; an edit sends only the text', () => {
    const a = phone(new FakeServer());
    const x = a.diary.addItem('2026-11-05', 'learned', 'Idea')!;
    expect(nextBatch(a.db, 10)[0].patch).toEqual({
      entry_date: '2026-11-05',
      list_type: 'learned',
      content: 'Idea',
    });
    expect(x).toBeTruthy();
  });

  it('keeps at most 100 items per list and 300 characters per item', () => {
    const a = phone(new FakeServer());
    for (let i = 0; i < 100; i++) a.diary.addItem('2026-11-05', 'good', `n${i}`);
    expect(a.diary.addItem('2026-11-05', 'good', 'one more')).toBeNull();
    expect(
      a.diary.addItem('2026-11-05', 'learned', 'x'.repeat(500)) &&
        a.diary.day('2026-11-05').learned[0].content,
    ).toHaveLength(300);
  });

  it('a deleted item disappears on the other phone', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const b = phone(server);
    const x = a.diary.addItem('2026-11-05', 'good', 'Gone soon')!;
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.diary.day('2026-11-05').good).toHaveLength(1);
    a.diary.removeItem(x);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.diary.day('2026-11-05').good).toHaveLength(0);
  });
});

describe('diary: the month', () => {
  it('counts written days, averages and learned things like the website', () => {
    const a = phone(new FakeServer());
    a.diary.setMood('2026-11-02', 4);
    a.diary.setEnergy('2026-11-02', 3);
    a.diary.setNote('2026-11-02', 'text');
    a.diary.setMood('2026-11-03', 4);
    a.diary.setMood('2026-11-04', 2);
    a.diary.addItem('2026-11-04', 'learned', 'Stretch');
    a.diary.addItem('2026-11-10', 'good', 'Walk');
    a.diary.setMood('2026-10-31', 1); // another month
    const m = a.diary.month('2026-11');
    expect(m.stats).toEqual({ mood_mode: 4, mood_avg: 3.33, energy_avg: 3, filled: 3, total: 30 });
    expect(m.days['2026-11-04']).toMatchObject({ mood: 2, has_text: false, has_lists: true });
    expect(m.days['2026-11-10']).toMatchObject({ mood: null, has_lists: true });
    expect(m.days['2026-10-31']).toBeUndefined();
    expect(m.learned).toEqual([{ date: '2026-11-04', content: 'Stretch' }]);
  });

  it('a day with only spaces is not counted as written', () => {
    const m = summariseMonth(
      '2026-02',
      [{ entry_date: '2026-02-01', mood: null, energy: null, note: '   ' }],
      [],
    );
    expect(m.stats.filled).toBe(0);
    expect(m.stats.total).toBe(28);
  });

  it('lists the days that have something, newest first', () => {
    const a = phone(new FakeServer());
    a.diary.setNote('2026-11-02', 'a');
    a.diary.addItem('2026-11-04', 'good', 'b');
    a.diary.setNote('2026-11-03', '   ');
    expect(a.diary.writtenDays()).toEqual(['2026-11-04', '2026-11-02']);
  });
});

const habit = (o: Partial<Habit>): Habit =>
  ({
    uuid: 'h',
    kind: 'build',
    name: 'H',
    icon: '⭐',
    color: '#000',
    frequency_type: 'daily',
    weekdays: '1111111',
    times_per_week: 1,
    times_per_month: 1,
    interval_days: 1,
    start_date: '2026-10-01',
    end_date: null,
    is_archived: 0,
    ...o,
  }) as Habit;
const log = (h: string, d: string, o: Partial<HabitLog> = {}): HabitLog =>
  ({
    uuid: h + d,
    habit_uuid: h,
    log_date: d,
    status: 'done',
    amount: 1,
    target_amount: 1,
    ...o,
  }) as HabitLog;

describe('diary: the rings', () => {
  const D = '2026-11-05'; // a Thursday
  it('one ring per family that has at least one habit, tightest first', () => {
    const hs = [
      habit({ uuid: 'a' }),
      habit({ uuid: 'b', frequency_type: 'weekly', times_per_week: 3 }),
      habit({ uuid: 'c', frequency_type: 'monthly', times_per_month: 2 }),
    ];
    const ls = [
      log('a', D),
      log('b', '2026-11-02'),
      log('b', '2026-11-03'),
      log('c', '2026-11-01'),
    ];
    expect(diaryRings(hs, ls, D)).toEqual([
      { key: 'daily', done: 1, total: 1 },
      { key: 'weekly', done: 2, total: 3 },
      { key: 'monthly', done: 1, total: 2 },
    ]);
  });

  it('beyond the goal the ring does not grow; quit, archived and not-yet-started habits are left out', () => {
    const hs = [
      habit({ uuid: 'w', frequency_type: 'weekly', times_per_week: 1 }),
      habit({ uuid: 'q', kind: 'quit' }),
      habit({ uuid: 'z', is_archived: 1 }),
      habit({ uuid: 'f', start_date: '2026-12-01' }),
    ];
    const ls = [log('w', '2026-11-02'), log('w', '2026-11-03'), log('w', '2026-11-04')];
    expect(diaryRings(hs, ls, D)).toEqual([{ key: 'weekly', done: 1, total: 1 }]);
  });

  it('a quantity habit counts as done when the goal is reached', () => {
    const hs = [habit({ uuid: 'a' })];
    expect(
      diaryRings(hs, [log('a', D, { status: 'partial', amount: 8, target_amount: 8 })], D)[0].done,
    ).toBe(1);
    expect(
      diaryRings(hs, [log('a', D, { status: 'partial', amount: 3, target_amount: 8 })], D)[0].done,
    ).toBe(0);
  });

  it('an every-N-days habit is due only on its days', () => {
    const hs = [
      habit({ uuid: 'i', frequency_type: 'interval', interval_days: 2, start_date: '2026-11-03' }),
    ];
    expect(diaryRings(hs, [], '2026-11-05')).toEqual([{ key: 'interval', done: 0, total: 1 }]);
    expect(diaryRings(hs, [], '2026-11-04')).toEqual([]);
  });

  it("the day's habit list and the week list", () => {
    const hs = [
      habit({ uuid: 'a', name: 'Run' }),
      habit({ uuid: 'b', frequency_type: 'weekly', times_per_week: 4 }),
    ];
    const ls = [log('a', D), log('b', '2026-11-03')];
    expect(habitsOfTheDay(hs, ls, D)).toEqual([
      { uuid: 'a', name: 'Run', icon: '⭐', color: '#000', done: true },
    ]);
    expect(weeklyOfTheDay(hs, ls, D)).toMatchObject([{ uuid: 'b', done: 1, target: 4 }]);
  });
});

describe('diary settings', () => {
  const fake = (server: DiarySettings) => {
    const calls: Partial<DiarySettings>[] = [];
    const api: DiarySettingsApi = {
      getDiarySettings: async () => server,
      patchDiarySettings: async (p) => {
        calls.push(p);
        server = { ...server, ...p };
        return server;
      },
    };
    return { api, calls };
  };

  it('cleans strange values like the server', () => {
    expect(cleanDiarySettings({ font: 'comic', size: 99, paper: 'checked' })).toEqual({
      font: 'caveat',
      size: 26,
      paper: 'lined',
    });
    expect(cleanDiarySettings({ font: 'std-jost', size: 16, paper: 'dotted' })).toEqual({
      font: 'std-jost',
      size: 16,
      paper: 'dotted',
    });
  });

  it('changes at once offline, sends only what changed, keeps what is still unsent', async () => {
    const s = new DiarySettingsStore(memoryDb());
    const f = fake({ font: 'kalam', size: 20, paper: 'plain' });
    s.update({ size: 22 });
    expect(s.hasPending()).toBe(true);
    const merged = await s.sync(f.api);
    expect(f.calls).toEqual([{ size: 22 }]);
    expect(merged).toEqual({ font: 'kalam', size: 22, paper: 'plain' });
    expect(s.hasPending()).toBe(false);
  });

  it('without changes it just downloads', async () => {
    const s = new DiarySettingsStore(memoryDb());
    const merged = await s.sync(fake({ font: 'jost', size: 15, paper: 'dotted' }).api);
    expect(merged.font).toBe('jost');
    expect(s.read().paper).toBe('dotted');
  });
});
