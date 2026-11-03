import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { GameRepo } from '../game';
import { FlashcardsRepo } from '../repo';
import { badges, StatsRepo, streaks, weekdayOf } from '../stats';
import { StudyRepo } from '../study';

describe('streaks', () => {
  test('best run and the current one (today or yesterday counts)', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-11'];
    expect(streaks(days, '2026-10-11')).toEqual({ best: 3, current: 2, next: 3 });
    expect(streaks(days, '2026-10-12').current).toBe(2); // ieri
    expect(streaks(days, '2026-10-13').current).toBe(0); // due giorni fa: finita
    expect(streaks([], '2026-10-13')).toEqual({ best: 0, current: 0, next: 3 });
    const long = Array.from({ length: 8 }, (_, i) => `2026-09-${String(10 + i).padStart(2, '0')}`);
    expect(streaks(long, '2026-09-17')).toEqual({ best: 8, current: 8, next: 14 });
    expect(streaks(['2026-10-01', '2026-10-01'], '2026-10-01').best).toBe(1);
  });

  test('crossing a month and a year', () => {
    expect(streaks(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01').best).toBe(3);
  });
});

test('weekday: 0 is Monday', () => {
  expect(weekdayOf('2026-01-05')).toBe(0); // un lunedì
  expect(weekdayOf('2026-01-11')).toBe(6);
});

test('badges', () => {
  const b = badges(600, 8, 60, false);
  expect(b.filter((x) => x.done).map((x) => x.key)).toEqual([
    '10_giocate',
    'streak3',
    'streak7',
    '50_imparate',
    '500_giocate',
  ]);
});

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const clock = () => '2026-11-03T10:00:00Z';
  const flashcards = new FlashcardsRepo(db, clock, id);
  const study = new StudyRepo(db, 7, clock, id);
  const games = new GameRepo(db, study, clock, id);
  return { db, flashcards, study, games, stats: new StatsRepo(db) };
}

describe('activity and per-deck numbers', () => {
  test('counts by day, hour, weekday and time; decks sum their branch', () => {
    const s = setup();
    const parent = s.flashcards.createDeck({ name: 'Maths' })!;
    const kid = s.flashcards.createDeck({ name: 'Algebra', parent })!;
    const c1 = s.flashcards.addCard(kid, 'Q1', 'A1')!;
    const c2 = s.flashcards.addCard(kid, 'Q2', 'A2')!;
    const g = s.games.start({ decks: [kid], status: 'all', order: 'in_order' });
    if (g.kind !== 'started') throw new Error('empty');
    s.db.run(
      `INSERT INTO fc_game_durations (uuid, game_uuid, start_time, duration_seconds) VALUES ('d1', ?, '2026-11-02 09:00:00', 90)`,
      [g.game],
    );
    const put = (card: string, ans: string, when: string, pos: number) =>
      s.db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, user_answer, position, play_date) VALUES (?, ?, ?, ?, ?, ?)`,
        [`p${pos}`, g.game, card, ans, pos, when],
      );
    put(c1, 'Correct', '2026-11-02 09:10:00', 1); // lunedì
    put(c2, 'Wrong', '2026-11-02 21:30:00', 2);
    put(c1, 'Correct', '2026-11-03 09:00:00', 3);
    put(c2, 'Titolo', '2026-11-03 09:01:00', 4); // non conta

    const a = s.stats.activity();
    expect(a.totalPlayed).toBe(3);
    expect(a.daily.get('2026-11-02')).toEqual({ played: 2, correct: 1 });
    expect(a.daily.get('2026-11-03')).toEqual({ played: 1, correct: 1 });
    expect(a.hours[9]).toBe(2);
    expect(a.hours[21]).toBe(1);
    expect(a.weekdays[0]).toBe(2); // lunedì 2 novembre 2026
    expect(a.weekdays[1]).toBe(1);
    expect(a.totalSeconds).toBe(90);
    expect(a.time.get('2026-11-02')).toBe(90);

    const all = s.stats.byDeck();
    expect(all.get(kid)).toEqual({ played: 3, correct: 2, seconds: 90 });
    expect(all.get(parent)).toEqual({ played: 3, correct: 2, seconds: 90 });
    const day = s.stats.byDeck('2026-11-03', '2026-11-03');
    expect(day.get(parent)).toEqual({ played: 1, correct: 1, seconds: 0 });
  });
});

describe('drill: most missed cards and improvement after a mistake', () => {
  test('missed needs two tries and a mistake; after-error counts the next try on the same card', () => {
    const s = setup();
    const maths = s.flashcards.createDeck({ name: 'Maths' })!;
    const other = s.flashcards.createDeck({ name: 'Other' })!;
    const hard = s.flashcards.addCard(maths, 'hard', 'a')!;
    const easy = s.flashcards.addCard(maths, 'easy', 'a')!;
    const once = s.flashcards.addCard(maths, 'once', 'a')!;
    const far = s.flashcards.addCard(other, 'far', 'a')!;
    const g = s.games.start({ decks: [maths], status: 'all', order: 'in_order' });
    if (g.kind !== 'started') throw new Error('empty');
    let n = 0;
    const put = (card: string, ans: string) =>
      s.db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, user_answer, position, play_date) VALUES (?, ?, ?, ?, ?, ?)`,
        [`p${++n}`, g.game, card, ans, n, `2026-11-02 09:${String(10 + n)}:00`],
      );
    // hard: W W C  → 2 errori, dopo il 1° errore sbaglia ancora, dopo il 2° indovina
    put(hard, 'Wrong');
    put(hard, 'Wrong');
    put(hard, 'Correct');
    // easy: C C
    put(easy, 'Correct');
    put(easy, 'Correct');
    // once: W (un solo tentativo)
    put(once, 'Wrong');
    // far: W C (altra materia)
    put(far, 'Wrong');
    put(far, 'Correct');

    const all = s.stats.drill(null);
    expect(all.missed.map((m) => [m.card_uuid, m.played, m.wrong, m.accuracy])).toEqual([
      [hard, 3, 2, 33],
      [far, 2, 1, 50],
    ]);
    expect(all.afterError).toEqual({ opportunities: 3, fixed: 2 });

    const only = s.stats.drill(new Set([maths]));
    expect(only.missed.map((m) => m.card_uuid)).toEqual([hard]);
    expect(only.afterError).toEqual({ opportunities: 2, fixed: 1 });
    expect(s.stats.drill(new Set(['nope'])).missed).toEqual([]);
  });

  test("a sub-card counts on its own, in its father's deck", () => {
    const s = setup();
    const d = s.flashcards.createDeck({ name: 'D' })!;
    const father = s.flashcards.addCard(d, 'f', 'a')!;
    const kid = s.flashcards.addSubcard(father, 'k', 'a')!;
    const g = s.games.start({ decks: [d], status: 'all', order: 'in_order' });
    if (g.kind !== 'started') throw new Error('empty');
    for (let i = 1; i <= 2; i++) {
      s.db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, child_uuid, user_answer, position, play_date) VALUES (?, ?, ?, ?, 'Wrong', ?, ?)`,
        [`k${i}`, g.game, father, kid, i, `2026-11-02 09:0${i}:00`],
      );
    }
    const r = s.stats.drill(new Set([d]));
    expect(r.missed).toHaveLength(1);
    expect(r.missed[0]).toMatchObject({ child_uuid: kid, card_uuid: null, wrong: 2 });
  });
});
