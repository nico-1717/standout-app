import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import type { Services } from '@/core/app/AppProvider';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import { GameRepo } from '../game';
import { homeCards, nextDeck } from '../homeCards';
import { FlashcardsRepo } from '../repo';
import { StatsRepo } from '../stats';
import { StudyRepo } from '../study';

const TODAY = '2026-11-03';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const clock = () => `${TODAY}T10:00:00Z`;
  const flashcards = new FlashcardsRepo(db, clock, id);
  const study = new StudyRepo(
    db,
    7,
    clock,
    id,
    () => TODAY,
    () => `${TODAY} 10:00:00`,
  );
  const games = new GameRepo(
    db,
    study,
    clock,
    id,
    () => Date.parse(`${TODAY}T10:00:00Z`),
    () => `${TODAY} 10:00:00`,
    () => 0.5,
  );
  const s = {
    db,
    flashcards,
    study,
    games,
    fcStats: new StatsRepo(db),
    languages: new LanguagesRepo(db, 7, new ProjectsRepo(db)),
  } as unknown as Services;
  return { db, flashcards, games, s };
}

describe('nextDeck', () => {
  test('nothing to play without decks that have cards', () => {
    const { s, flashcards } = setup();
    expect(nextDeck(s, TODAY)).toBeNull();
    flashcards.createDeck({ name: 'Empty' });
    expect(nextDeck(s, TODAY)).toBeNull();
  });

  test('the deck with the nearest exam wins; archived decks and past exams do not count', () => {
    const { s, flashcards } = setup();
    const a = flashcards.createDeck({ name: 'Plain' })!;
    const b = flashcards.createDeck({ name: 'Exam soon', exam_date: '2026-11-13' })!;
    const c = flashcards.createDeck({ name: 'Old', exam_date: '2026-10-01' })!;
    for (const d of [a, b, c]) flashcards.addCard(d, 'q', 'a');
    expect(nextDeck(s, TODAY)).toMatchObject({ name: 'Exam soon', examDays: 10, daysAgo: null });
    flashcards.setArchived(b, true);
    expect(nextDeck(s, TODAY)?.examDays).toBeNull();
  });

  test('a deck played today is not offered again', () => {
    const { s, flashcards, games } = setup();
    const d = flashcards.createDeck({ name: 'Maths' })!;
    const c = flashcards.addCard(d, 'q', 'a')!;
    const r = games.start({ decks: [d], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    games.ensurePosition(r.game, 1);
    games.grade(r.game, 1, c, false, 'correct');
    expect(nextDeck(s, TODAY)).toBeNull();
    expect(nextDeck(s, '2026-11-05')).toMatchObject({ name: 'Maths', daysAgo: 2 });
  });
});

describe('homeCards', () => {
  test('goal, today count, an open game and no language yet', () => {
    const { s, flashcards, games } = setup();
    const d = flashcards.createDeck({ name: 'Maths' })!;
    const c1 = flashcards.addCard(d, 'q1', 'a1')!;
    flashcards.addCard(d, 'q2', 'a2');
    const r = games.start({ decks: [d], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    games.ensurePosition(r.game, 1);
    games.grade(r.game, 1, c1, false, 'correct');
    games.ensurePosition(r.game, 2);
    const h = homeCards(s, TODAY, 'en');
    expect(h.today).toBe(1);
    expect(h.goal).toBe(20);
    expect(h.study.open).toMatchObject({ position: 2, closed: 1, total: 2, label: 'Maths' });
    expect(h.vocab).toEqual({ open: null, course: null });
  });

  test('the language row points at the first course', () => {
    const { s } = setup();
    const id = s.languages.addCourse('it', 'en-GB');
    expect(typeof id).toBe('string');
    const h = homeCards(s, TODAY, 'en');
    expect(h.vocab.course).toMatchObject({ name: 'English', uuid: id });
    expect(h.vocab.course?.flag).toBeTruthy();
  });
});
