import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import type { SubjectRow } from '../game';
import { GameRepo } from '../game';
import { FlashcardsRepo } from '../repo';
import { StudyRepo } from '../study';
import {
  accuracyPct,
  buildSubjects,
  groupActivity,
  isTouched,
  sortPlayed,
  sortUntouched,
  visibleSubjects,
} from '../subjects';

describe('groupActivity', () => {
  const perDay = new Map([
    ['2026-11-01', 3],
    ['2026-11-03', 2],
    ['2026-11-08', 5],
  ]);
  test('short periods: one bar per day, empty days included', () => {
    const { step, bars } = groupActivity(perDay, '2026-11-01', '', '2026-11-08');
    expect(step).toBe('day');
    expect(bars).toHaveLength(8);
    expect(bars[0]).toEqual({ d: '2026-11-01', n: 3 });
    expect(bars[1]).toEqual({ d: '2026-11-02', n: 0 });
    expect(bars[7]).toEqual({ d: '2026-11-08', n: 5 });
  });

  test('no start: from the first day with answers', () => {
    const { bars } = groupActivity(perDay, '', '', '2026-11-08');
    expect(bars[0]!.d).toBe('2026-11-01');
    expect(bars).toHaveLength(8);
  });

  test('longer periods: weeks (from the first day), then months', () => {
    const weeks = groupActivity(perDay, '2026-08-01', '', '2026-11-08');
    expect(weeks.step).toBe('week');
    expect(weeks.bars[0]!.d).toBe('2026-08-01');
    expect(weeks.bars.find((b) => b.d === '2026-10-31')).toEqual({ d: '2026-10-31', n: 3 + 2 });
    expect(weeks.bars.at(-1)).toEqual({ d: '2026-11-07', n: 5 });
    const months = groupActivity(perDay, '2025-01-01', '', '2026-11-08');
    expect(months.step).toBe('month');
    expect(months.bars[0]!.d).toBe('2025-01-01');
    expect(months.bars.at(-1)).toEqual({ d: '2026-11-01', n: 10 });
  });

  test('empty data: a single bar for today', () => {
    expect(groupActivity(new Map(), '', '', '2026-11-08')).toEqual({
      step: 'day',
      bars: [{ d: '2026-11-08', n: 0 }],
    });
  });
});

const row = (p: Partial<SubjectRow> & { uuid: string }): SubjectRow => ({
  name: p.uuid,
  parent: null,
  color: null,
  archived: false,
  cards: 0,
  learnt: 0,
  ok: 0,
  ko: 0,
  seconds: 0,
  last: '',
  completion: 0,
  ...p,
});

describe('buildSubjects', () => {
  const rows = [
    row({
      uuid: 'math',
      cards: 2,
      learnt: 1,
      ok: 3,
      ko: 1,
      seconds: 60,
      last: '2026-11-02',
      completion: 1,
    }),
    row({
      uuid: 'algebra',
      parent: 'math',
      cards: 6,
      learnt: 2,
      ok: 4,
      ko: 4,
      seconds: 120,
      last: '2026-11-05',
      completion: 0.5,
    }),
    row({ uuid: 'geo', parent: 'math', cards: 4, learnt: 0 }),
    row({ uuid: 'old', parent: 'math', archived: true, cards: 10, ok: 9, seconds: 999 }),
    row({ uuid: 'oldkid', parent: 'old', cards: 5, ok: 5 }),
    row({ uuid: 'art', cards: 3, learnt: 3, last: '2026-10-01' }),
    row({ uuid: 'empty' }),
  ];
  const tree = buildSubjects(rows);

  test('a subject carries its whole branch, without archived ones', () => {
    const m = tree.nodes.get('math')!.total;
    expect(m.cards).toBe(2 + 6 + 4);
    expect(m.learnt).toBe(3);
    expect([m.ok, m.ko, m.seconds]).toEqual([7, 5, 180]);
    expect(m.last).toBe('2026-11-05');
    expect(m.ids.sort()).toEqual(['algebra', 'geo', 'math']);
    // geo has cards but no answers: one untouched sub-subject
    expect(m.untouched).toBe(1);
    // completion weighted by cards: (1*2 + 0.5*6 + 0*4) / 12
    expect(m.completion).toBeCloseTo(5 / 12);
  });

  test('archived branch is marked, visible lists skip it and empty subjects', () => {
    expect(tree.nodes.get('oldkid')!.archived).toBe(true);
    expect(visibleSubjects(tree, null).sort()).toEqual(['art', 'math']);
    expect(visibleSubjects(tree, 'math').sort()).toEqual(['algebra', 'geo']);
    expect(isTouched(tree.nodes.get('math')!)).toBe(true);
    expect(isTouched(tree.nodes.get('art')!)).toBe(false);
  });

  test('orders', () => {
    expect(sortPlayed(tree, ['algebra', 'math'], 'tempo')).toEqual(['math', 'algebra']);
    expect(sortPlayed(tree, ['math', 'algebra'], 'precisione')).toEqual(['algebra', 'math']);
    expect(sortPlayed(tree, ['algebra', 'math'], 'carte')).toEqual(['math', 'algebra']);
    expect(sortPlayed(tree, ['math', 'algebra'], 'alfa')).toEqual(['algebra', 'math']);
    expect(sortUntouched(tree, ['art', 'geo'], 'tempo_fa')).toEqual(['geo', 'art']);
    expect(sortUntouched(tree, ['art', 'geo'], 'da_imparare')).toEqual(['geo', 'art']);
    expect(sortUntouched(tree, ['geo', 'art'], 'alfa')).toEqual(['art', 'geo']);
  });

  test('accuracy', () => {
    expect(accuracyPct(3, 1)).toBe(75);
    expect(accuracyPct(0, 0)).toBeNull();
  });
});

describe('GameRepo: answersByDay and subjectRows', () => {
  function setup() {
    const db = memoryDb();
    migrate(db);
    let n = 0;
    const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    const clock = () => '2026-11-03T10:00:00Z';
    const flashcards = new FlashcardsRepo(db, clock, id);
    const study = new StudyRepo(db, 7, clock, id);
    const games = new GameRepo(db, study, clock, id);
    return { db, flashcards, study, games };
  }

  test('answers per day and per-subject numbers (child answers go to the father deck)', () => {
    const s = setup();
    const maths = s.flashcards.createDeck({ name: 'Maths' })!;
    const other = s.flashcards.createDeck({ name: 'Other' })!;
    const c1 = s.flashcards.addCard(maths, 'Q1', 'A1')!;
    const c2 = s.flashcards.addCard(maths, 'Q2', 'A2')!;
    const kid = s.flashcards.addSubcard(c2, 'K', 'k')!;
    s.flashcards.addCard(other, 'Q3', 'A3');
    s.study.setLearnt(c1, false, true);
    const g = s.games.start({ decks: [maths], status: 'all', order: 'in_order' });
    if (g.kind !== 'started') throw new Error('empty');
    s.db.run(
      `INSERT INTO fc_game_durations (uuid, game_uuid, start_time, duration_seconds) VALUES ('d1', ?, '2026-11-02 09:00:00', 100)`,
      [g.game],
    );
    let pos = 0;
    const put = (card: string | null, child: string | null, ans: string, when: string) =>
      s.db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, child_uuid, user_answer, position, play_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`p${++pos}`, g.game, card, child, ans, pos, when],
      );
    put(c1, null, 'Correct', '2026-11-02 09:10:00');
    put(c2, null, 'Wrong', '2026-11-02 09:11:00');
    put(null, kid, 'Correct', '2026-11-03 09:00:00');
    put(c1, null, 'Titolo', '2026-11-03 09:05:00'); // non conta

    const days = s.games.answersByDay();
    expect([...days]).toEqual([
      ['2026-11-02', 2],
      ['2026-11-03', 1],
    ]);
    expect([...s.games.answersByDay('2026-11-03', '')]).toEqual([['2026-11-03', 1]]);

    const rows = new Map(s.games.subjectRows().map((r) => [r.uuid, r]));
    const m = rows.get(maths)!;
    expect([m.cards, m.learnt, m.ok, m.ko]).toEqual([2, 1, 2, 1]);
    expect(m.seconds).toBe(100);
    expect(m.last).toBe('2026-11-03 09:00:00');
    expect(m.completion).toBe(1); // 3 positions answered, capped to the 2 cards
    const o = rows.get(other)!;
    expect([o.cards, o.ok, o.ko, o.seconds, o.last, o.completion]).toEqual([1, 0, 0, 0, '', 0]);

    // a period that excludes day 2: only the child answer; the time (day 2) is out
    const late = new Map(s.games.subjectRows('2026-11-03', '').map((r) => [r.uuid, r]));
    expect([late.get(maths)!.ok, late.get(maths)!.ko, late.get(maths)!.seconds]).toEqual([1, 0, 0]);
  });
});
