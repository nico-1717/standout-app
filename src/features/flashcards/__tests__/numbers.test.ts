import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import type { Services } from '@/core/app/AppProvider';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import { GameRepo } from '../game';
import { homeNumbers } from '../numbers';
import { FlashcardsRepo } from '../repo';
import { StatsRepo } from '../stats';
import { StudyRepo } from '../study';

function setup() {
  const db = memoryDb();
  migrate(db);
  const study = new StudyRepo(db, 7);
  const flashcards = new FlashcardsRepo(db);
  const s = {
    flashcards,
    games: new GameRepo(db, study),
    fcStats: new StatsRepo(db),
    languages: new LanguagesRepo(db, 7, new ProjectsRepo(db)),
  } as unknown as Services;
  return { db, s };
}

const play = (
  db: ReturnType<typeof setup>['db'],
  table: string,
  i: number,
  ans: string,
  day: string,
) =>
  db.run(
    `INSERT INTO ${table} (uuid, game_uuid, user_answer, position, play_date) VALUES (?, 'g', ?, 1, ?)`,
    [`${table}${i}`, ans, `${day} 09:00:00`],
  );

describe('homeNumbers', () => {
  test('empty account is all zeros with 7 empty days', () => {
    const { s } = setup();
    const n = homeNumbers(s, '2026-11-08');
    expect(n).toMatchObject({ mastery: 0, streak: 0, record: 0, accuracy: 0, cardsTotal: 0 });
    expect(n.week).toHaveLength(7);
    expect(n.week[6]).toEqual({ day: '2026-11-08', n: 0 });
    expect(n.week[0]!.day).toBe('2026-11-02');
  });

  test('study and language answers count together: streak, best run, accuracy, week', () => {
    const { db, s } = setup();
    play(db, 'fc_study_plays', 1, 'Correct', '2026-11-08');
    play(db, 'fc_vocab_plays', 2, 'Wrong', '2026-11-08');
    play(db, 'fc_study_plays', 3, 'Correct', '2026-11-07');
    play(db, 'fc_vocab_plays', 4, 'Correct', '2026-11-06');
    play(db, 'fc_study_plays', 5, 'Correct', '2026-10-01'); // old run, outside the 30 days
    play(db, 'fc_study_plays', 6, '', '2026-11-08'); // skipped answers do not count
    const n = homeNumbers(s, '2026-11-08');
    expect(n.streak).toBe(3);
    expect(n.record).toBe(3);
    expect(n.accuracy).toBe(75);
    expect(n.week.map((w) => w.n)).toEqual([0, 0, 0, 0, 1, 1, 2]);
  });
});
