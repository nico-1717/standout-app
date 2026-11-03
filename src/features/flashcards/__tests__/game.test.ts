import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';

import { GameRepo, isBlankField, isTitleCard } from '../game';
import { FlashcardsRepo } from '../repo';
import { StudyRepo } from '../study';

function setup(rng: () => number = () => 0.5) {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  let ms = Date.parse('2026-11-03T10:00:00Z');
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
    () => ms,
    () => '2026-11-03 10:00:00',
    rng,
  );
  const wait = (s: number) => {
    ms += s * 1000;
  };
  return { db, flashcards, study, games, wait };
}
type S = ReturnType<typeof setup>;

/** Un mazzo con tre carte, la seconda con due sottocarte. */
function deckWithCards(s: S) {
  const deck = s.flashcards.createDeck({ name: 'Maths' })!;
  const c1 = s.flashcards.addCard(deck, 'Q1', 'A1')!;
  const c2 = s.flashcards.addCard(deck, 'Q2', 'A2')!;
  const c3 = s.flashcards.addCard(deck, 'Q3', 'A3')!;
  const k1 = s.flashcards.addSubcard(c2, 'q21', 'a21')!;
  const k2 = s.flashcards.addSubcard(c2, 'q22', 'a22')!;
  s.db.run('DELETE FROM outbox');
  return { deck, c1, c2, c3, k1, k2 };
}
const start = (s: S, d: string[], extra: object = {}) => {
  const r = s.games.start({ decks: d, status: 'all', order: 'in_order', ...extra });
  if (r.kind !== 'started') throw new Error('empty');
  return r.game;
};

describe('blank text and titles', () => {
  test('blank fields', () => {
    expect(isBlankField(null)).toBe(true);
    expect(isBlankField('    ')).toBe(true);
    expect(isBlankField('<b> </b>')).toBe(true);
    expect(isBlankField('{"v":2,"blocks":[{"t":"p","runs":[{"s":"  "}]}]}')).toBe(true);
    expect(isBlankField('{"v":2,"blocks":[{"t":"p","runs":[{"s":"hi"}]}]}')).toBe(false);
    expect(isBlankField('{"v":2,"blocks":[{"t":"fx","tex":"x"}]}')).toBe(false);
    expect(isBlankField('hello')).toBe(false);
  });
  test('a title needs children, a father flag and no answer', () => {
    const c = { is_father: 1, answer_desc: null, answer_image: null, answer_audio: null };
    expect(isTitleCard(c, 1)).toBe(true);
    expect(isTitleCard(c, 0)).toBe(false);
    expect(isTitleCard({ ...c, answer_desc: 'x' }, 2)).toBe(false);
    expect(isTitleCard({ ...c, answer_image: 'a.png' }, 2)).toBe(false);
    expect(isTitleCard({ ...c, is_father: 0 }, 2)).toBe(false);
  });
});

describe('starting a game', () => {
  test('in order: by chosen deck order then card order; totals count the children', () => {
    const s = setup();
    const a = s.flashcards.createDeck({ name: 'A' })!;
    const b = s.flashcards.createDeck({ name: 'B' })!;
    const a1 = s.flashcards.addCard(a, 'a1', 'x')!;
    const b1 = s.flashcards.addCard(b, 'b1', 'x')!;
    const b2 = s.flashcards.addCard(b, 'b2', 'x')!;
    s.flashcards.addSubcard(b2, 'k', 'k');
    s.db.run('DELETE FROM outbox');
    const g = start(s, [b, a]);
    const game = s.games.game(g)!;
    expect(game).toMatchObject({
      type: 'fc',
      card_status: 'all',
      game_order: 'in_order',
      total_father_words: 3,
      total_words_with_children: 4,
      score: 0,
      parent_uuid: null,
    });
    const seq = s.db.all<{ position: number; card_uuid: string }>(
      'SELECT position, card_uuid FROM fc_study_sequence WHERE game_uuid = ? ORDER BY position',
      [g],
    );
    expect(seq.map((r) => r.card_uuid)).toEqual([b1, b2, a1]);
    expect(seq.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(s.games.gameDecks(g)).toEqual([b, a]);
    expect(s.games.totalPositions(g)).toBe(3);
  });

  test('an empty choice creates nothing; unknown decks are ignored', () => {
    const s = setup();
    const deck = s.flashcards.createDeck({ name: 'Empty' })!;
    expect(s.games.start({ decks: [deck], status: 'all', order: 'random' })).toEqual({
      kind: 'empty',
    });
    expect(s.games.start({ decks: ['nope'], status: 'all', order: 'random' })).toEqual({
      kind: 'empty',
    });
    expect(s.games.games()).toHaveLength(0);
  });

  test('random uses the random source; "learnt only" gives type fc_L', () => {
    const s = setup(() => 0); // sempre 0: lo scambio porta il primo in fondo
    const { deck, c1, c2, c3 } = deckWithCards(s);
    s.study.setLearnt(c1, false, true);
    s.study.setLearnt(c2, false, true);
    const g = start(s, [deck], { status: '1', order: 'random' });
    const game = s.games.game(g)!;
    expect(game.type).toBe('fc_L');
    expect(game.card_status).toBe('1');
    expect(game.total_father_words).toBe(2);
    const seq = s.db
      .all<{ card_uuid: string }>(
        'SELECT card_uuid FROM fc_study_sequence WHERE game_uuid = ? ORDER BY position',
        [g],
      )
      .map((r) => r.card_uuid);
    expect(new Set(seq)).toEqual(new Set([c1, c2]));
    expect(seq).not.toContain(c3);
  });

  test('status "to learn": a card enters if the father or any child is not learnt; titles do not count', () => {
    const s = setup();
    const { deck, c1, c2, c3, k1, k2 } = deckWithCards(s);
    s.study.setLearnt(c1, false, true);
    s.study.setLearnt(c2, false, true);
    s.study.setLearnt(k1, true, true);
    const pick = () => s.games.select({ decks: [deck], status: '0', order: 'in_order' }).fathers;
    // c1 imparata: fuori; c2: padre imparato ma k2 no: dentro; c3: dentro
    expect(pick()).toEqual([c2, c3]);
    s.study.setLearnt(k2, true, true);
    expect(pick()).toEqual([c3]);
    // un titolo (risposta vuota con figli) non si impara: conta solo per le figlie
    s.flashcards.updateCard(c3, { answer: '' });
    s.flashcards.addSubcard(c3, 'q', 'a');
    expect(pick()).toEqual([c3]);
  });

  test('only hard cards: needs a history, always mixed, all states', () => {
    const s = setup();
    const { deck, c1, c2, c3 } = deckWithCards(s);
    // una partita in cui c1 è sbagliata due volte, c2 giusta
    const g = start(s, [deck]);
    for (const [pos, ans] of [
      [1, 'wrong'],
      [2, 'correct'],
      [3, 'correct'],
    ] as const) {
      const plays = s.games.ensurePosition(g, pos)!;
      for (const p of plays)
        s.games.grade(g, pos, (p.card_uuid ?? p.child_uuid)!, !!p.child_uuid, ans);
    }
    const g2 = start(s, [deck]);
    const plays = s.games.ensurePosition(g2, 1)!;
    s.games.grade(g2, 1, plays[0]!.card_uuid!, false, 'wrong');
    const hard = s.games.select({
      decks: [deck],
      status: 'all',
      order: 'in_order',
      onlyHard: true,
    });
    expect(hard.fathers).toContain(c1);
    expect(hard.fathers).not.toContain(c3);
    expect(c2).toBeTruthy();
  });

  test('everything that is created is sent: game, time, decks, sequence', () => {
    const s = setup();
    const { deck } = deckWithCards(s);
    start(s, [deck]);
    const tables = nextBatch(s.db, 100).map((o) => o.table);
    expect(tables.filter((t) => t === 'fc_games')).toHaveLength(1);
    expect(tables.filter((t) => t === 'fc_game_durations')).toHaveLength(1);
    expect(tables.filter((t) => t === 'fc_study_game_decks')).toHaveLength(1);
    expect(tables.filter((t) => t === 'fc_study_sequence')).toHaveLength(3);
  });
});

describe('playing', () => {
  test('a position creates the father first then the children; the answers follow the vote rules', () => {
    const s = setup();
    const { deck, c1, c2, k1, k2 } = deckWithCards(s);
    const g = start(s, [deck]);
    const one = s.games.ensurePosition(g, 1)!;
    expect(one.map((p) => p.card_uuid)).toEqual([c1]);
    expect(one[0]!.user_answer).toBe('');
    const two = s.games.ensurePosition(g, 2)!;
    expect(two.map((p) => p.card_uuid ?? p.child_uuid)).toEqual([c2, k1, k2]);
    // la stessa posizione chiesta due volte non duplica le righe
    expect(s.games.ensurePosition(g, 2)).toHaveLength(3);
    expect(s.games.ensurePosition(g, 9)).toBeNull();

    // c1: voto sbagliato -> si passa alla posizione dopo
    expect(s.games.grade(g, 1, c1, false, 'wrong')).toEqual({ ok: true, unanswered: 0, next: 2 });
    // posizione 2: finché restano righe vuote si resta lì
    expect(s.games.grade(g, 2, c2, false, 'correct')).toMatchObject({ unanswered: 2, next: 2 });
    expect(s.games.grade(g, 2, k1, true, 'learnt')).toMatchObject({ unanswered: 1, next: 2 });
    expect(s.study.isLearnt(k1)).toBe(true);
    expect(s.study.isLearnt(c2)).toBe(false);
    expect(s.games.grade(g, 2, k2, true, 'wrong')).toEqual({ ok: true, unanswered: 0, next: 3 });
    expect(s.games.tally(g)).toMatchObject({ correct: 2, wrong: 2, played: 4, score: 50 });
    expect(s.games.grade(g, 5, 'nope', false, 'correct').ok).toBe(false);
  });

  test('a title starts closed and is never counted', () => {
    const s = setup();
    const deck = s.flashcards.createDeck({ name: 'T' })!;
    const title = s.flashcards.addCard(deck, 'Chapter 1', null)!;
    const k = s.flashcards.addSubcard(title, 'q', 'a')!;
    s.db.run('DELETE FROM outbox');
    const g = start(s, [deck]);
    const plays = s.games.ensurePosition(g, 1)!;
    expect(plays.map((p) => p.user_answer)).toEqual(['Titolo', '']);
    s.games.grade(g, 1, k, true, 'correct');
    expect(s.games.tally(g)).toMatchObject({ played: 1, correct: 1, score: 100 });
  });

  test('in a "to learn" game the learnt parts are only looked at', () => {
    const s = setup();
    const { deck, c2, k1 } = deckWithCards(s);
    s.study.setLearnt(k1, true, true);
    const g = start(s, [deck], { status: '0' });
    const plays = s.games.ensurePosition(g, 2)!;
    expect(plays.find((p) => p.child_uuid === k1)!.user_answer).toBe('Visione');
    expect(plays.find((p) => p.card_uuid === c2)!.user_answer).toBe('');
    s.games.grade(g, 2, c2, false, 'correct');
    // quella da guardare non richiede risposta: resta aperta solo k2, ancora da imparare
    expect(s.games.plays(g, 2).filter((p) => (p.user_answer ?? '') === '')).toHaveLength(1);
  });

  test('changing a verdict never advances; "wrong" also un-learns the card', () => {
    const s = setup();
    const { deck, c1 } = deckWithCards(s);
    const g = start(s, [deck]);
    s.games.ensurePosition(g, 1);
    s.games.grade(g, 1, c1, false, 'learnt');
    expect(s.study.isLearnt(c1)).toBe(true);
    expect(s.games.changeVerdict(g, 1, c1, false, 'wrong')).toBe(true);
    expect(s.study.isLearnt(c1)).toBe(false);
    expect(s.games.plays(g, 1)[0]!.user_answer).toBe('Wrong');
    expect(s.games.changeVerdict(g, 1, 'nope', false, 'wrong')).toBe(false);
  });

  test('going back to a position behind the front returns straight to the front', () => {
    const s = setup();
    const { deck, c1, c2, c3 } = deckWithCards(s);
    const g = start(s, [deck]);
    for (const [pos, card] of [
      [1, c1],
      [2, c2],
      [3, c3],
    ] as const) {
      s.games.ensurePosition(g, pos);
      if (pos === 2) {
        const [, kk1, kk2] = s.games.plays(g, 2);
        s.games.grade(g, 2, c2, false, 'correct');
        s.games.grade(g, 2, kk1!.child_uuid!, true, 'correct');
        s.games.grade(g, 2, kk2!.child_uuid!, true, 'correct');
      } else s.games.grade(g, pos, card, false, 'correct');
    }
    expect(s.games.frontier(g)).toBe(3);
    // si riapre la 1 e si cambia opinione da "vuoto": la riga torna da rispondere
    const p1 = s.games.plays(g, 1)[0]!;
    s.db.run(`UPDATE fc_study_plays SET user_answer = '' WHERE uuid = ?`, [p1.uuid]);
    expect(s.games.firstUnanswered(g)).toBe(1);
    expect(s.games.effectivePosition(g, 3)).toBe(1);
    expect(s.games.grade(g, 1, c1, false, 'wrong').next).toBe(3);
  });
});

describe('time', () => {
  test('adds the time between actions, at most 5 minutes; a long pause starts a new session', () => {
    const s = setup();
    const { deck, c1 } = deckWithCards(s);
    const g = start(s, [deck]);
    s.games.ensurePosition(g, 1);
    s.wait(20);
    s.games.touch(g);
    expect(s.games.playedSeconds(g)).toBe(20);
    s.wait(100);
    s.games.grade(g, 1, c1, false, 'correct');
    expect(s.games.playedSeconds(g)).toBe(120);
    s.wait(3600);
    s.games.touch(g);
    expect(s.games.playedSeconds(g)).toBe(120);
    expect(s.db.all('SELECT 1 FROM fc_game_durations WHERE game_uuid = ?', [g])).toHaveLength(2);
    s.wait(40);
    s.games.touch(g);
    expect(s.games.playedSeconds(g)).toBe(160);
  });
});

describe('resume, conclude, retry, remove', () => {
  function played(s: S) {
    const d = deckWithCards(s);
    const g = start(s, [d.deck]);
    s.games.ensurePosition(g, 1);
    s.games.grade(g, 1, d.c1, false, 'wrong');
    s.games.ensurePosition(g, 2); // precaricata e mai giocata
    return { ...d, g };
  }

  test('resume goes to the first open position; an unfinished game is found', () => {
    const s = setup();
    const { g, deck } = played(s);
    expect(s.games.resumePosition(g)).toBe(2);
    const un = s.games.unfinished()!;
    expect(un).toMatchObject({ position: 2, closed: 1, total: 3, label: 'Maths' });
    expect(un.game.uuid).toBe(g);
    expect(deck).toBeTruthy();
  });

  test('concluding drops the preloaded positions nobody answered and writes the score', () => {
    const s = setup();
    const { g } = played(s);
    expect(s.games.conclude(g)).toBe(0);
    expect(s.games.plays(g, 2)).toHaveLength(0);
    expect(s.games.plays(g, 1)).toHaveLength(1);
    expect(s.games.game(g)!.score).toBe(0);
    expect(s.games.resumePosition(g)).toBe(2);
  });

  test('score is correct / played, rounded to 2 decimals and sent', () => {
    const s = setup();
    const { g, c1, c2, c3 } = played(s);
    s.games.changeVerdict(g, 1, c1, false, 'correct');
    s.games.ensurePosition(g, 3);
    s.games.grade(g, 3, c3, false, 'wrong');
    for (const p of s.games.ensurePosition(g, 2)!) {
      s.games.grade(
        g,
        2,
        (p.card_uuid ?? p.child_uuid)!,
        !!p.child_uuid,
        p.card_uuid === c2 ? 'correct' : 'correct',
      );
    }
    s.db.run('DELETE FROM outbox');
    expect(s.games.conclude(g)).toBeCloseTo((4 / 5) * 100);
    expect(s.games.game(g)!.score).toBe(80);
    const sent = nextBatch(s.db, 10);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ table: 'fc_games', patch: { score: 80 } });
  });

  test('retry: the fathers of positions with a wrong card, mixed, linked to the parent game', () => {
    const s = setup();
    const { g, deck, c2, k2 } = (() => {
      const d = deckWithCards(s);
      const game = start(s, [d.deck]);
      s.games.ensurePosition(game, 1);
      s.games.grade(game, 1, d.c1, false, 'correct');
      for (const p of s.games.ensurePosition(game, 2)!) {
        s.games.grade(
          game,
          2,
          (p.card_uuid ?? p.child_uuid)!,
          !!p.child_uuid,
          p.child_uuid === d.k2 ? 'wrong' : 'correct',
        );
      }
      return { ...d, g: game };
    })();
    const r = s.games.retry(g);
    expect(r.kind).toBe('started');
    const r2 = (r as { kind: 'started'; game: string }).game;
    const game2 = s.games.game(r2)!;
    expect(game2).toMatchObject({
      parent_uuid: g,
      game_order: 'random',
      total_father_words: 1,
      total_words_with_children: 3,
      type: 'fc',
    });
    expect(s.games.gameDecks(r2)).toEqual([deck]);
    const seq = s.db.all<{ card_uuid: string }>(
      'SELECT card_uuid FROM fc_study_sequence WHERE game_uuid = ?',
      [r2],
    );
    expect(seq.map((x) => x.card_uuid)).toEqual([c2]);
    // la carta già giusta nella partita di origine parte "giusta"
    const plays = s.games.ensurePosition(r2, 1)!;
    expect(plays.find((p) => p.card_uuid === c2)!.user_answer).toBe('Correct');
    expect(plays.find((p) => p.child_uuid === k2)!.user_answer).toBe('');
    // il ripasso conta in minuscolo nella storia
    s.games.grade(r2, 1, k2, true, 'wrong');
    expect(s.games.histories().get(`c${k2}`)!.u).toBe('Ww');
  });

  test('retry with no mistakes creates nothing', () => {
    const s = setup();
    const { g, c1 } = played(s);
    s.games.changeVerdict(g, 1, c1, false, 'correct');
    expect(s.games.retry(g)).toEqual({ kind: 'empty' });
    expect(s.games.retry('nope')).toEqual({ kind: 'empty' });
  });

  test('removing a game removes its parts and leaves the retries alone', () => {
    const s = setup();
    const { g } = played(s);
    const r = s.games.retry(g) as { kind: 'started'; game: string };
    s.games.remove(g);
    expect(s.games.game(g)).toBeNull();
    expect(s.db.all('SELECT 1 FROM fc_study_plays WHERE game_uuid = ?', [g])).toHaveLength(0);
    expect(s.db.all('SELECT 1 FROM fc_study_sequence WHERE game_uuid = ?', [g])).toHaveLength(0);
    expect(s.games.game(r.game)!.parent_uuid).toBeNull();
  });
});

describe('deck counts for the setup screen', () => {
  test('counts the cards each deck would play, by status', () => {
    const s = setup();
    const { deck, c1 } = deckWithCards(s);
    const other = s.flashcards.createDeck({ name: 'Other' })!;
    s.flashcards.addCard(other, 'X', 'Y');
    expect(s.games.deckCounts('all').byDeck.get(deck)).toBe(3);
    expect(s.games.deckCounts('all').all).toBe(4);
    s.study.setLearnt(c1, false, true);
    expect(s.games.deckCounts('0').byDeck.get(deck)).toBe(2);
    expect(s.games.deckCounts('1').byDeck.get(deck)).toBe(1);
    expect(s.games.deckCounts('1').byDeck.get(other) ?? 0).toBe(0);
  });
});

describe('deck stats (the numbers under each deck)', () => {
  test('levels, known, hard, games and last date roll up through the branch', () => {
    const s = setup();
    const parent = s.flashcards.createDeck({ name: 'Maths' })!;
    const kid = s.flashcards.createDeck({ name: 'Algebra', parent })!;
    const a = s.flashcards.addCard(kid, 'A', 'a')!;
    const b = s.flashcards.addCard(kid, 'B', 'b')!;
    s.flashcards.addCard(kid, 'C', 'c');
    s.flashcards.addCard(parent, 'D', 'd');
    // «A» imparata col tastino; «B» sbagliata due volte
    s.study.setLearnt(a, false, true);
    const g = start(s, [kid]);
    s.games.ensurePosition(g, 1);
    const seq = s.db.all<{ position: number; card_uuid: string }>(
      'SELECT position, card_uuid FROM fc_study_sequence WHERE game_uuid = ?',
      [g],
    );
    const posB = seq.find((r) => r.card_uuid === b)!.position;
    s.games.ensurePosition(g, posB);
    s.games.grade(g, posB, b, false, 'wrong');
    const st = s.games.deckStats();
    expect(st.get(kid)!.total).toBe(3);
    expect(st.get(parent)!.total).toBe(4); // il ramo comprende le carte dei sottomazzi
    expect(st.get(kid)!.known).toBe(1);
    expect(st.get(kid)!.levels.nuova).toBe(2);
    expect(st.get(kid)!.games).toBe(1);
    expect(st.get(parent)!.games).toBe(1); // la partita sul figlio conta anche per chi lo contiene
    expect(st.get(kid)!.last).toBe('2026-11-03 10:00:00');
    expect(st.get(parent)!.hard).toBe(st.get(kid)!.hard);
    expect(st.get(kid)!.hard).toBe(1);
  });
});
