import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { vocabRecordUuid } from '@/core/sync/uuid5';
import { directionAt, directionOfType } from '@/features/flashcards/game';
import { ProjectsRepo } from '@/features/projects/repo';

import { LanguagesRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const clock = () => '2026-11-03T10:00:00Z';
  const repo = new LanguagesRepo(
    db,
    7,
    new ProjectsRepo(db, clock, id),
    clock,
    id,
    () => '2026-11-03',
    () => '2026-11-03 10:00:00',
  );
  const course = repo.addCourse('fr', 'en-GB', 'en') as string;
  const deck = repo.createDeck(course, { name: 'Home' })!;
  const w1 = repo.addWord(deck, { word: 'house', translation: 'maison' })!;
  const w2 = repo.addWord(deck, { word: 'run', translation: 'courir' })!;
  const kid = repo.addChild(w1, { word: 'houses', translation: 'maisons' })!;
  db.run('DELETE FROM outbox');
  return { db, repo, course, deck, w1, w2, kid };
}

describe('language game', () => {
  test('directions', () => {
    expect(directionOfType('w2t_L')).toBe('w2t');
    expect(directionOfType('mix')).toBe('mix');
    expect(directionAt('t2w', 'abc', 3)).toBe('t2w');
    expect(directionAt('mix', 'abc', 0)).not.toBe(directionAt('mix', 'abc', 1));
  });

  test('a game starts for the course, with its kind, type and rows', () => {
    const s = setup();
    const g = s.repo.games(s.course);
    const r = g.start({ decks: [s.deck], status: 'all', order: 'in_order', direction: 't2w' });
    if (r.kind !== 'started') throw new Error('not started');
    expect(g.game(r.game)).toMatchObject({ kind: 'vocab', course_uuid: s.course, type: 't2w' });
    const out = nextBatch(s.db, 200);
    expect(out.map((o) => o.table)).toEqual(
      expect.arrayContaining(['fc_games', 'fc_vocab_game_decks', 'fc_vocab_sequence']),
    );
    expect(out.find((o) => o.table === 'fc_games')!.patch).toMatchObject({
      kind: 'vocab',
      course_uuid: s.course,
      type: 't2w',
    });
    expect(g.totalPositions(r.game)).toBe(2);
  });

  test('the right answer follows the direction, and the study game does not see it', () => {
    const s = setup();
    const g = s.repo.games(s.course);
    const a = g.start({ decks: [s.deck], status: 'all', order: 'in_order', direction: 'w2t' });
    const b = g.start({ decks: [s.deck], status: 'all', order: 'in_order', direction: 't2w' });
    if (a.kind !== 'started' || b.kind !== 'started') throw new Error('not started');
    expect(g.ensurePosition(a.game, 1)!.map((p) => p.correct_answer)).toEqual([
      'maison',
      'maisons',
    ]);
    expect(g.ensurePosition(b.game, 1)!.map((p) => p.correct_answer)).toEqual(['house', 'houses']);
    expect(g.games()).toHaveLength(2);
    const other = s.repo.games('00000000-0000-4000-8000-00000000ffff');
    expect(other.games()).toHaveLength(0);
    expect(other.game(a.game)).toBeNull();
    expect(s.db.all('SELECT 1 FROM fc_study_plays')).toHaveLength(0);
  });

  test('grading, finishing and the course record', () => {
    const s = setup();
    const g = s.repo.games(s.course);
    const r = g.start({ decks: [s.deck], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('not started');
    const plays = g.ensurePosition(r.game, 1)!;
    for (const p of plays)
      g.grade(r.game, 1, p.card_uuid ?? p.child_uuid!, !p.card_uuid, 'correct');
    expect(g.tally(r.game).correct).toBe(2);
    g.conclude(r.game);
    const rec = s.repo.records(s.course);
    expect(Object.keys(rec).length).toBeGreaterThan(0);
    const kind = Object.keys(rec)[0]!;
    const row = nextBatch(s.db, 500).find(
      (o) => o.table === 'fc_vocab_records' && o.patch?.kind === kind,
    )!;
    expect(row.uuid).toBe(vocabRecordUuid(7, s.course, kind));
    expect(row.patch).toMatchObject({ course_uuid: s.course });
  });

  test('removing a word, a deck or the course removes its game rows', () => {
    const s = setup();
    const g = s.repo.games(s.course);
    const r = g.start({ decks: [s.deck], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('not started');
    g.ensurePosition(r.game, 1);
    s.repo.removeWord(s.w2);
    expect(s.db.all('SELECT 1 FROM fc_vocab_sequence WHERE card_uuid = ?', [s.w2])).toHaveLength(0);
    s.repo.removeWord(s.w1);
    s.repo.removeDeck(s.deck);
    expect(s.db.all('SELECT 1 FROM fc_vocab_game_decks')).toHaveLength(0);
    expect(s.db.all('SELECT 1 FROM fc_vocab_plays')).toHaveLength(0);
    expect(s.db.all('SELECT 1 FROM fc_games')).toHaveLength(1);
    s.db.run('DELETE FROM outbox');
    s.repo.removeCourse(s.course);
    for (const t of ['fc_games', 'fc_vocab_records', 'fc_vocab_sequence']) {
      expect(s.db.all(`SELECT 1 FROM ${t}`)).toHaveLength(0);
    }
    expect(nextBatch(s.db, 50).map((o) => o.table)).toEqual(['fc_vocab_courses']);
  });
});
