import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import { GameRepo } from '../game';
import { learnedBars, learnedChips, learnedDays } from '../learned';
import { FlashcardsRepo } from '../repo';
import { StudyRepo } from '../study';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const clock = () => '2026-11-03T10:00:00Z';
  const flashcards = new FlashcardsRepo(db, clock, id);
  const study = new StudyRepo(db, 7, clock, id);
  const games = new GameRepo(db, study, clock, id);
  return { db, flashcards, study, games, clock, id };
}

describe('learnedDays', () => {
  test('study: the day a card reached "you know it", or the day of the tap if earlier; wrong cards never', () => {
    const s = setup();
    const deck = s.flashcards.createDeck({ name: 'D' })!;
    const a = s.flashcards.addCard(deck, 'A', 'a')!;
    const b = s.flashcards.addCard(deck, 'B', 'b')!;
    const c = s.flashcards.addCard(deck, 'C', 'c')!;
    const g = s.games.start({ decks: [deck], status: 'all', order: 'in_order' });
    if (g.kind !== 'started') throw new Error('empty');
    let pos = 0;
    const put = (card: string, ans: string, day: string) =>
      s.db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, user_answer, position, play_date) VALUES (?, ?, ?, ?, ?, ?)`,
        [`p${++pos}`, g.game, card, ans, pos, `${day} 10:00:00`],
      );
    // A: three right answers on three days → known on the third
    put(a, 'Correct', '2026-11-01');
    put(a, 'Correct', '2026-11-02');
    put(a, 'Correct', '2026-11-03');
    // B: tapped "learnt" on day 1, three right answers later → counts on day 1
    s.study.setLearnt(b, false, true);
    s.db.run(`UPDATE fc_study_learnt SET learnt_date = '2026-11-01'`);
    put(b, 'Correct', '2026-11-05');
    put(b, 'Correct', '2026-11-05');
    put(b, 'Correct', '2026-11-05');
    // C: wrong twice → never known
    put(c, 'Wrong', '2026-11-04');
    put(c, 'Wrong', '2026-11-04');

    const days = learnedDays(s.db, 'study');
    expect([...days]).toEqual([
      ['2026-11-01', 1],
      ['2026-11-03', 1],
    ]);
    expect(learnedDays(s.db, 'vocab').size).toBe(0);
  });

  test('a card with children: the father is only a title, the children count', () => {
    const s = setup();
    const deck = s.flashcards.createDeck({ name: 'D' })!;
    const father = s.flashcards.addCard(deck, 'Group', '')!;
    const kid = s.flashcards.addSubcard(father, 'Kid', 'k')!;
    s.study.setLearnt(father, false, true);
    s.study.setLearnt(kid, true, true);
    s.db.run(`UPDATE fc_study_learnt SET learnt_date = '2026-11-02'`);
    expect([...learnedDays(s.db, 'study')]).toEqual([['2026-11-02', 1]]);
  });

  test('languages: words with the tap are counted on the tap day', () => {
    const s = setup();
    const languages = new LanguagesRepo(s.db, 7, new ProjectsRepo(s.db));
    const course = languages.addCourse('fr', 'en-GB', 'en') as string;
    const deck = languages.createDeck(course, { name: 'Home' })!;
    const w1 = languages.addWord(deck, { word: 'house', translation: 'maison' })!;
    languages.addWord(deck, { word: 'run', translation: 'courir' });
    languages.setLearnt(w1, false, true);
    s.db.run(`UPDATE fc_vocab_learnt SET learnt_date = '2026-11-06'`);
    expect([...learnedDays(s.db, 'vocab')]).toEqual([['2026-11-06', 1]]);
  });
});

describe('learnedBars and learnedChips', () => {
  const days = new Map([
    ['2026-11-08', 2], // oggi (domenica)
    ['2026-11-03', 1], // martedì della stessa settimana
    ['2026-11-02', 4], // lunedì
    ['2026-10-30', 5], // la settimana prima, mese prima
    ['2026-06-10', 7], // fuori da 6 mesi? giugno è 5 mesi fa: dentro
    ['2026-05-31', 9], // fuori
  ]);
  const month = (d: Date) => String(d.getMonth() + 1);

  test('days: 14 bars ending today', () => {
    const b = learnedBars(days, 'day', '2026-11-08', month);
    expect(b).toHaveLength(14);
    expect(b[13]).toEqual({ v: 2, label: '8', now: true });
    expect(b[8]).toEqual({ v: 1, label: '3', now: false });
    expect(b[0]!.label).toBe('26');
  });

  test('weeks start on Monday', () => {
    const b = learnedBars(days, 'week', '2026-11-08', month);
    expect(b).toHaveLength(8);
    expect(b[7]).toEqual({ v: 7, label: '2/11', now: true });
    expect(b[6]).toEqual({ v: 5, label: '26/10', now: false });
  });

  test('months: 6 bars', () => {
    const b = learnedBars(days, 'month', '2026-11-08', month);
    expect(b.map((x) => x.v)).toEqual([7, 0, 0, 0, 5, 7]);
    expect(b.map((x) => x.label)).toEqual(['6', '7', '8', '9', '10', '11']);
  });

  test('chips: today, this week (from Monday), this month', () => {
    expect(learnedChips(days, '2026-11-08')).toEqual({ today: 2, week: 7, month: 7 });
  });
});
