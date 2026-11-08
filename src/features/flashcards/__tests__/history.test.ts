import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { GameRepo } from '../game';
import { filterHistory, historyEntries, summarize, type HistoryFilter } from '../history';
import { deckBranch } from '../logic';
import { FlashcardsRepo } from '../repo';
import { StudyRepo } from '../study';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const clock = () => '2026-11-03T10:00:00Z';
  const flashcards = new FlashcardsRepo(db, clock, id);
  const study = new StudyRepo(
    db,
    7,
    clock,
    id,
    () => '2026-11-03',
    () => '2026-11-03 10:00:00',
  );
  const games = new GameRepo(
    db,
    study,
    clock,
    id,
    () => Date.parse('2026-11-03T10:00:00Z'),
    () => '2026-11-03 10:00:00',
    () => 0.5,
  );
  return { db, flashcards, games };
}
type S = ReturnType<typeof setup>;

const play = (
  s: S,
  deck: string,
  wrongs: number,
  date: string,
  status: 'all' | '0' | '1' = 'all',
) => {
  const r = s.games.start({ decks: [deck], status, order: 'in_order' });
  if (r.kind !== 'started') throw new Error('empty');
  s.db.run('UPDATE fc_games SET game_date = ? WHERE uuid = ?', [date, r.game]);
  const total = s.games.totalPositions(r.game);
  for (let pos = 1; pos <= total; pos++) {
    for (const p of s.games.ensurePosition(r.game, pos)!) {
      s.games.grade(
        r.game,
        pos,
        (p.card_uuid ?? p.child_uuid)!,
        !!p.child_uuid,
        pos <= wrongs ? 'wrong' : 'correct',
      );
    }
  }
  s.games.conclude(r.game);
  return r.game;
};
const none: HistoryFilter = { state: 'all', kind: 'any', sort: 'recent', subject: null, from: '' };

describe('history entries and filters', () => {
  function world() {
    const s = setup();
    const a = s.flashcards.createDeck({ name: 'A' })!;
    const sub = s.flashcards.createDeck({ name: 'A1', parent: a })!;
    const b = s.flashcards.createDeck({ name: 'B' })!;
    for (const d of [a, sub, b])
      for (let i = 0; i < 4; i++) s.flashcards.addCard(d, `q${i}`, `a${i}`);
    const g1 = play(s, a, 1, '2026-11-01 10:00:00'); // 75%
    const g2 = play(s, b, 3, '2026-11-02 10:00:00'); // 25%
    const g3 = play(s, sub, 0, '2026-11-03 09:00:00', '0'); // 100%
    return { s, a, sub, b, g1, g2, g3 };
  }

  test('retries live inside their mother game; empty games stay out', () => {
    const { s, g1, g2, g3, a } = world();
    s.games.start({ decks: [a], status: 'all', order: 'in_order' }); // senza risposte
    const retry = s.games.retry(g2) as { kind: 'started'; game: string };
    const p = s.games.ensurePosition(retry.game, 1)!;
    s.games.grade(retry.game, 1, (p[0]!.card_uuid ?? p[0]!.child_uuid)!, false, 'correct');
    const e = historyEntries(s.games);
    expect(e.map((x) => x.game.uuid).sort()).toEqual([g1, g2, g3].sort());
    const m = e.find((x) => x.game.uuid === g2)!;
    expect(m.retries).toHaveLength(1);
    expect(m.seconds).toBe(0);
    expect(summarize(e)).toMatchObject({ games: 3, correct: 3 + 1 + 4 + 1, wrong: 1 + 3 });
  });

  test('sort: recent, longest, most mistakes, lowest accuracy', () => {
    const { s, g1, g2, g3 } = world();
    const e = historyEntries(s.games);
    const order = (sort: HistoryFilter['sort']) =>
      filterHistory(e, { ...none, sort }).map((x) => x.game.uuid);
    expect(order('recent')).toEqual([g3, g2, g1]);
    expect(order('errors')).toEqual([g2, g1, g3]);
    expect(order('accuracy')).toEqual([g2, g1, g3]);
  });

  test('card kind, subject (with sub-decks) and period', () => {
    const { s, a, g1, g2, g3 } = world();
    const e = historyEntries(s.games);
    expect(filterHistory(e, { ...none, kind: '0' }).map((x) => x.game.uuid)).toEqual([g3]);
    expect(filterHistory(e, { ...none, kind: '1' })).toEqual([]);
    const sub = filterHistory(e, {
      ...none,
      subject: new Set(deckBranch(s.flashcards.decks(), a)),
    });
    expect(sub.map((x) => x.game.uuid).sort()).toEqual([g1, g3].sort());
    expect(filterHistory(e, { ...none, from: '2026-11-02' }).map((x) => x.game.uuid)).toEqual([
      g3,
      g2,
    ]);
  });

  test('a custom range keeps both end days', () => {
    const { s, g1, g2 } = world();
    const e = historyEntries(s.games);
    const ids = (from: string, to: string) =>
      filterHistory(e, { ...none, from, to }).map((x) => x.game.uuid);
    expect(ids('2026-11-01', '2026-11-02')).toEqual([g2, g1]);
    expect(ids('', '2026-11-01')).toEqual([g1]);
    expect(ids('2026-11-02', '2026-11-02')).toEqual([g2]);
  });

  test('state: unfinished needs an answered game with positions left', () => {
    const { s, a } = world();
    const r = s.games.start({ decks: [a], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    s.db.run('UPDATE fc_games SET game_date = ? WHERE uuid = ?', ['2026-11-03 11:00:00', r.game]);
    const p = s.games.ensurePosition(r.game, 1)!;
    s.games.grade(r.game, 1, (p[0]!.card_uuid ?? p[0]!.child_uuid)!, false, 'correct');
    const e = historyEntries(s.games);
    expect(filterHistory(e, { ...none, state: 'open' }).map((x) => x.game.uuid)).toEqual([r.game]);
    expect(filterHistory(e, { ...none, state: 'done' })).toHaveLength(3);
  });
});
