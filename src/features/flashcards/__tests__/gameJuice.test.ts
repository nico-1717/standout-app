import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import type { PlayRow } from '../game';
import {
  CHECKPOINT_STEPS,
  NEW_STATE,
  accuracyOf,
  accuracyTone,
  blockBestStreak,
  checkpointCount,
  checkpointDue,
  checkpointTitleKey,
  checkpointsDone,
  cleanCheckpoint,
  countsForFastest,
  finalStretch,
  levelToast,
  passedMilestone,
  progressColor,
  readJuice,
  stampMs,
  stepKey,
  stepOf,
  stretches,
  summarizeBlock,
  wrongIn,
  writeJuice,
} from '../gameJuice';

/* Numeri ricavati eseguendo le funzioni del sito (fc_game_juice.js, fc_game.php) su questi stessi ingressi. */
describe('streak steps', () => {
  test('a streak reaches a step at 3, 5, 10, 15, 20, 30, 50, 75 and 100', () => {
    expect(
      [0, 2, 3, 4, 5, 9, 10, 14, 15, 29, 30, 49, 50, 74, 75, 99, 100, 250].map(stepOf),
    ).toEqual([0, 0, 3, 3, 5, 5, 10, 10, 15, 20, 30, 30, 50, 50, 75, 75, 100, 100]);
  });
  test('the phrase of a step stops at 50', () => {
    expect(stepKey(3)).toBe('fcv.gj_t3');
    expect(stepKey(100)).toBe('fcv.gj_t50');
  });
});

describe('checkpoints', () => {
  test('the choices are off, 5, 10, 15, 20 and 25; anything else becomes 10', () => {
    expect(CHECKPOINT_STEPS).toEqual([0, 5, 10, 15, 20, 25]);
    expect([0, 5, 25, 7, '10', undefined, null].map(cleanCheckpoint)).toEqual([
      0, 5, 25, 10, 10, 10, 10,
    ]);
  });

  test('one fires when a stretch of 10 is passed, once', () => {
    expect(checkpointDue(9, 30, 10, 0)).toBeNull();
    expect(checkpointDue(10, 30, 10, 0)).toEqual({ k: 1, from: 1, to: 10, end: false });
    expect(checkpointDue(10, 30, 10, 1)).toBeNull();
    expect(checkpointDue(23, 30, 10, 1)).toEqual({ k: 2, from: 11, to: 20, end: false });
  });

  test('the last stretch counts even when shorter, and says it is the end', () => {
    expect(checkpointDue(47, 47, 10, 4)).toEqual({ k: 5, from: 41, to: 47, end: true });
    expect(checkpointDue(40, 41, 10, 4)).toBeNull();
    expect(checkpointDue(41, 41, 10, 4)).toEqual({ k: 5, from: 41, to: 41, end: true });
  });

  test('off means never', () => {
    expect(checkpointDue(50, 50, 0, 0)).toBeNull();
    expect(checkpointsDone(50, 0)).toBe(0);
    expect(checkpointsDone(47, 10)).toBe(4);
  });

  test('the number of checkpoints rounds up and never drops under the current one', () => {
    expect(checkpointCount(47, 10, 2)).toBe(5);
    expect(checkpointCount(10, 10, 3)).toBe(3);
    expect(checkpointCount(10, 0, 1)).toBe(1);
  });

  test('the title follows the accuracy; at the end it is the finishing pair', () => {
    expect(checkpointTitleKey(100, false)).toBe('fcv.ck_perfetto');
    expect(checkpointTitleKey(85, false)).toBe('fcv.ck_ottimo');
    expect(checkpointTitleKey(60, false)).toBe('fcv.ck_buono');
    expect(checkpointTitleKey(59, false)).toBe('fcv.ck_avanti');
    expect(checkpointTitleKey(80, true)).toBe('fcv.ck_fine_top');
    expect(checkpointTitleKey(79, true)).toBe('fcv.ck_fine');
  });

  test('accuracy rounds and the ring is green from 80, yellow from 60', () => {
    expect(accuracyOf(7, 3)).toBe(70);
    expect(accuracyOf(2, 1)).toBe(67);
    expect(accuracyOf(0, 0)).toBe(0);
    expect([100, 80, 79, 60, 59, 0].map(accuracyTone)).toEqual([
      'green',
      'green',
      'yellow',
      'yellow',
      'red',
      'red',
    ]);
  });

  test('a mastered-count milestone is celebrated only when passed, and never the first time', () => {
    expect(passedMilestone(null, 30)).toBeNull();
    expect(passedMilestone(8, 12)).toBe(10);
    expect(passedMilestone(8, 30)).toBe(25);
    expect(passedMilestone(10, 12)).toBeNull();
    expect(passedMilestone(24, 24)).toBeNull();
  });
});

describe('discs on the road', () => {
  test.each([
    [10, 10, [[1, 10]]],
    [
      30,
      10,
      [
        [1, 10],
        [11, 20],
        [21, 30],
      ],
    ],
    [
      47,
      10,
      [
        [1, 10],
        [11, 20],
        [21, 30],
        [31, 40],
        [41, 47],
      ],
    ],
    [
      41,
      10,
      [
        [1, 10],
        [11, 20],
        [21, 30],
        [31, 41],
      ],
    ],
    [
      95,
      25,
      [
        [1, 25],
        [26, 50],
        [51, 75],
        [76, 95],
      ],
    ],
    [7, 0, [[1, 7]]],
  ])('%i cards with a stop every %i', (total, every, expected) => {
    expect(stretches(total, every)).toEqual(expected);
  });

  test('too many stretches merge into at most 14 discs', () => {
    expect(stretches(250, 5)).toEqual([
      [1, 20],
      [21, 40],
      [41, 60],
      [61, 80],
      [81, 100],
      [101, 120],
      [121, 140],
      [141, 160],
      [161, 180],
      [181, 200],
      [201, 220],
      [221, 250],
    ]);
    expect(stretches(500, 5)).toHaveLength(12);
    expect(stretches(100, 10)).toHaveLength(10);
  });

  test('mistakes are counted inside a stretch', () => {
    expect(wrongIn([3, 4, 12, 40], 1, 10)).toBe(2);
    expect(wrongIn([3, 4, 12, 40], 11, 20)).toBe(1);
    expect(wrongIn([], 1, 10)).toBe(0);
  });
});

describe('progress colour', () => {
  test.each([
    [0, 'rgb(10,132,255)'],
    [0.1, 'rgb(46,124,252)'],
    [0.25, 'rgb(101,111,249)'],
    [0.5, 'rgb(191,90,242)'],
    [0.65, 'rgb(221,122,133)'],
    [0.82, 'rgb(255,159,10)'],
    [0.9, 'rgb(255,183,10)'],
    [1, 'rgb(255,214,10)'],
  ])('at %f it is %s, like the site', (p, color) => {
    expect(progressColor(p)).toBe(color);
  });

  test('values outside 0..1 are clamped', () => {
    expect(progressColor(-1)).toBe('rgb(10,132,255)');
    expect(progressColor(4)).toBe('rgb(255,214,10)');
  });

  test('the final stretch is the last 10% (at least 5) of games of 20 or more', () => {
    expect(finalStretch(19, 17)).toEqual({ on: false, left: 2 });
    expect(finalStretch(20, 15)).toEqual({ on: true, left: 5 });
    expect(finalStretch(20, 14)).toEqual({ on: false, left: 6 });
    expect(finalStretch(100, 90)).toEqual({ on: true, left: 10 });
    expect(finalStretch(100, 89)).toEqual({ on: false, left: 11 });
    expect(finalStretch(100, 100)).toEqual({ on: false, left: 0 });
  });
});

const play = (
  position: number,
  answer: 'Correct' | 'Wrong',
  time: string,
  card = `card${position}`,
  child: string | null = null,
): PlayRow => ({
  uuid: `p${position}${child ?? ''}`,
  game_uuid: 'g',
  card_uuid: child ? null : card,
  child_uuid: child,
  correct_answer: null,
  user_answer: answer,
  position,
  play_date: `2026-11-09 ${time}`,
});

describe('summary of a stretch', () => {
  test('parses a local stamp', () => {
    expect(stampMs('2026-11-09 10:00:30')! - stampMs('2026-11-09 10:00:00')!).toBe(30000);
    expect(stampMs(null)).toBeNull();
    expect(stampMs('boh')).toBeNull();
  });

  const plays = [
    play(1, 'Correct', '10:00:00'),
    play(2, 'Correct', '10:00:05'),
    play(3, 'Wrong', '10:00:15'),
    play(4, 'Correct', '10:00:20'),
    play(5, 'Correct', '10:05:20'), // una pausa lunga: pesa un minuto, non cinque
    play(6, 'Correct', '10:05:30'), // fuori dal tratto
  ];

  test('counts, time per card (each gap at most a minute, starting from the answer before) and the lists', () => {
    const s = summarizeBlock(plays, 3, 5);
    expect([s.correct, s.wrong]).toEqual([2, 1]);
    // intervalli: 10:00:05→15 = 10, 15→20 = 5, 20→05:20 = 60 (tetto) ⇒ 75 s su 3
    expect(s.perCard).toBe(25);
    expect(s.missed.map((m) => m.target)).toEqual(['card3']);
    expect(s.nailed.map((m) => m.target)).toEqual(['card4', 'card5']);
  });

  test('the first stretch has no answer before: the time starts at its first answer', () => {
    const s = summarizeBlock(plays, 1, 2);
    expect(s.perCard).toBe(5);
  });

  test('one answer alone gives no time', () => {
    expect(summarizeBlock(plays, 1, 1).perCard).toBeNull();
  });

  test('a card missed in the stretch is not "nailed", even if it was right once too', () => {
    const p = [
      play(1, 'Wrong', '10:00:00', 'a'),
      play(2, 'Correct', '10:00:10', 'a'),
      play(3, 'Correct', '10:00:20', 'b'),
    ];
    const s = summarizeBlock(p, 1, 3);
    expect(s.nailed.map((m) => m.target)).toEqual(['b']);
    expect(s.missed.map((m) => m.target)).toEqual(['a']);
  });

  test('sub-cards are told apart from their parents and keep their flag', () => {
    const p = [play(1, 'Wrong', '10:00:00', 'a'), play(1, 'Wrong', '10:00:03', 'a', 'kid')];
    const s = summarizeBlock(p, 1, 1);
    expect(s.missed).toEqual([
      { target: 'a', isChild: false, position: 1 },
      { target: 'kid', isChild: true, position: 1 },
    ]);
  });

  test('titles and look-only rows are ignored', () => {
    const p = [
      { ...play(1, 'Correct', '10:00:00'), user_answer: 'Titolo' },
      play(2, 'Correct', '10:00:09'),
    ];
    const s = summarizeBlock(p, 1, 2);
    expect(s.correct).toBe(1);
  });

  test('the lists are capped: 12 to replay, 8 nailed', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      play(i + 1, i % 2 ? 'Wrong' : 'Correct', `10:00:${String(i).padStart(2, '0')}`),
    );
    const s = summarizeBlock(many, 1, 30);
    expect(s.missed).toHaveLength(12);
    expect(s.nailed).toHaveLength(8);
  });

  test('the fastest-level record needs 5 answers, 80% right and a time', () => {
    const base = { nailed: [], missed: [] };
    expect(countsForFastest({ correct: 4, wrong: 1, perCard: 3, ...base })).toBe(true);
    expect(countsForFastest({ correct: 3, wrong: 1, perCard: 3, ...base })).toBe(false);
    expect(countsForFastest({ correct: 3, wrong: 2, perCard: 3, ...base })).toBe(false);
    expect(countsForFastest({ correct: 5, wrong: 0, perCard: null, ...base })).toBe(false);
  });
});

describe('game state on the phone', () => {
  test('is saved per game and read back; a game never seen has none', () => {
    const db = memoryDb();
    migrate(db);
    expect(readJuice(db, 'g1')).toBeNull();
    writeJuice(db, 'g1', { ...NEW_STATE, ckDone: 3, recordHit: true, comboToSave: 7 });
    expect(readJuice(db, 'g1')).toEqual({
      ...NEW_STATE,
      ckDone: 3,
      recordHit: true,
      comboToSave: 7,
    });
    expect(readJuice(db, 'g2')).toBeNull();
  });
});

describe('levelToast (livelloDopoVoto del sito)', () => {
  test('reaching "la sai", "quasi" or "in ripresa" is news', () => {
    expect(levelToast('insidiosa', 'la_sai')).toEqual({ key: 'fcv.gj_liv_la_sai', up: true });
    expect(levelToast('difficile', 'in_ripresa')).toEqual({ key: 'fcv.gj_liv_ripresa', up: true });
    expect(levelToast('insidiosa', 'quasi')).toEqual({ key: 'fcv.gj_liv_su', up: true });
  });
  test('falling into "difficile" is news; other changes are not', () => {
    expect(levelToast('insidiosa', 'difficile')).toEqual({
      key: 'fcv.gj_liv_difficile',
      up: false,
    });
    expect(levelToast('nuova', 'sembra_facile')).toBeNull();
    expect(levelToast('facile', 'insidiosa')).toBeNull();
    expect(levelToast('facile', 'facile')).toBeNull();
  });
});

describe('blockBestStreak', () => {
  const row = (position: number, a: string, sec: number): PlayRow => ({
    uuid: `u${position}-${sec}`,
    game_uuid: 'g',
    card_uuid: `c${position}`,
    child_uuid: null,
    correct_answer: '',
    user_answer: a,
    position,
    play_date: `2026-11-09 10:00:${String(sec).padStart(2, '0')}`,
  });
  test('longest run of right answers inside the stretch only', () => {
    const plays = [
      row(1, 'Correct', 1),
      row(2, 'Correct', 2),
      row(3, 'Wrong', 3),
      row(4, 'Correct', 4),
      row(5, 'Correct', 5),
      row(6, 'Correct', 6),
      row(7, 'Correct', 7),
    ];
    expect(blockBestStreak(plays, 1, 6)).toBe(3);
    expect(blockBestStreak(plays, 1, 3)).toBe(2);
    expect(blockBestStreak(plays, 8, 9)).toBe(0);
  });
});
