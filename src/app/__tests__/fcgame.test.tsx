import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { formatDuration } from '@/features/flashcards/format';
import { GameRepo } from '@/features/flashcards/game';
import { FlashcardsRepo } from '@/features/flashcards/repo';
import { StatsRepo } from '@/features/flashcards/stats';
import { StudyRepo } from '@/features/flashcards/study';

import GameScreen from '../fc-game';
import HistoryScreen from '../fc-history';
import ResultScreen from '../fc-result';
import SetupScreen from '../fc-setup';
import StatsScreen from '../fc-stats';

let mockServices: unknown;
let mockVersion = 0;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: mockVersion, changed: jest.fn() }),
}));

function setup() {
  mockVersion = 0;
  mockParams = {};
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  const db = memoryDb();
  migrate(db);
  const flashcards = new FlashcardsRepo(db);
  const study = new StudyRepo(db, 7);
  const games = new GameRepo(db, study);
  mockServices = { db, flashcards, study, games, fcStats: new StatsRepo(db) };
  return { db, flashcards, study, games };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

/** Un mazzo con due carte, la seconda con due sottocarte, e una partita avviata. */
function started() {
  const s = setup();
  const deck = s.flashcards.createDeck({ name: 'Maths' })!;
  const c1 = s.flashcards.addCard(deck, 'Q1', 'A1')!;
  const c2 = s.flashcards.addCard(deck, 'Q2', 'A2')!;
  const k1 = s.flashcards.addSubcard(c2, 'q21', 'a21')!;
  const k2 = s.flashcards.addSubcard(c2, 'q22', 'a22')!;
  const r = s.games.start({ decks: [deck], status: 'all', order: 'in_order' });
  if (r.kind !== 'started') throw new Error('empty');
  return { ...s, deck, c1, c2, k1, k2, game: r.game };
}

test('formatDuration', () => {
  expect(formatDuration(0)).toBe('0:00');
  expect(formatDuration(125)).toBe('2:05');
  expect(formatDuration(3725)).toBe('1:02:05');
});

describe('game setup', () => {
  test('nothing to play shows a message; with cards, it starts and opens the game', async () => {
    const { flashcards, games } = setup();
    await render(wrap(<SetupScreen />));
    await fireEvent.press(screen.getByTestId('fcs-play-all'));
    expect(screen.getByTestId('fcs-empty')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();

    const deck = flashcards.createDeck({ name: 'Maths' })!;
    flashcards.addCard(deck, 'Q1', 'A1');
    mockVersion += 1;
    await fireEvent.press(screen.getByTestId('fcs-play-all'));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const call = mockReplace.mock.calls[0]![0] as { pathname: string; params: { game: string } };
    expect(call.pathname).toBe('/fc-game');
    expect(games.game(call.params.game)).not.toBeNull();
  });

  test('«only the hard ones» starts a random game over all statuses', async () => {
    const { db, flashcards, games } = setup();
    const d = flashcards.createDeck({ name: 'A' })!;
    const c = flashcards.addCard(d, 'Q', 'A')!;
    await render(wrap(<SetupScreen />));
    await fireEvent(screen.getByTestId('fcs-hard'), 'valueChange', true);
    // una carta nuova non è «difficile»: niente da giocare
    await fireEvent.press(screen.getByTestId('fcs-play-all'));
    expect(screen.getByTestId('fcs-empty')).toBeTruthy();
    for (let i = 0; i < 3; i++) {
      db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, user_answer, position, play_date) VALUES (?, 'old', ?, 'Wrong', ?, ?)`,
        [`w${i}`, c, i + 1, `2026-11-0${i + 1} 10:00:00`],
      );
    }
    await fireEvent.press(screen.getByTestId('fcs-play-all'));
    const call = mockReplace.mock.calls[0]![0] as { params: { game: string } };
    expect(games.game(call.params.game)).toMatchObject({
      card_status: 'all',
      game_order: 'random',
    });
  });

  test('preselect picks the deck and plays it', async () => {
    const { flashcards, games } = setup();
    const a = flashcards.createDeck({ name: 'A' })!;
    const b = flashcards.createDeck({ name: 'B' })!;
    flashcards.addCard(a, 'QA', 'AA');
    flashcards.addCard(b, 'QB', 'AB');
    mockParams = { preselect: b };
    await render(wrap(<SetupScreen />));
    expect(screen.getByTestId('fcs-multi-count')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcs-multi-play'));
    const call = mockReplace.mock.calls[0]![0] as { params: { game: string } };
    expect(games.gameDecks(call.params.game)).toEqual([b]);
  });
});

describe('playing', () => {
  test('a whole game: grade a card, then a concept with two sub-cards, ends on the result', async () => {
    const { games, game } = started();
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    expect(within(screen.getByTestId('fcg-question')).getByText('Q1')).toBeTruthy();
    expect(screen.queryByTestId('fcg-answer')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    expect(within(screen.getByTestId('fcg-answer')).getByText('A1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-correct'));

    // la seconda carta: padre sbagliato, poi le due sottocarte
    expect(within(screen.getByTestId('fcg-question')).getByText('Q2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-wrong'));
    expect(within(screen.getByTestId('fcg-question')).getByText('q21')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-correct'));
    expect(within(screen.getByTestId('fcg-question')).getByText('q22')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-learnt'));

    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/fc-result', params: { game } });
    expect(games.tally(game)).toMatchObject({ correct: 3, wrong: 1 });
    expect(games.game(game)!.score).toBe(75);
  });

  test('concluding early asks first, then shows the result', async () => {
    const { games, game } = started();
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-wrong'));
    await fireEvent.press(screen.getByTestId('fcg-conclude'));
    await fireEvent.press(screen.getByTestId('fcg-conclude-no'));
    expect(screen.queryByTestId('fcg-conclude-yes')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('fcg-conclude'));
    await fireEvent.press(screen.getByTestId('fcg-conclude-yes'));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/fc-result', params: { game } });
    expect(games.game(game)!.score).toBe(0);
  });

  test('the favourite switch marks the card; the verdict of a graded sub-card can be changed', async () => {
    const { games, study, c1, game } = started();
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    await fireEvent(screen.getByTestId('fcg-favorite'), 'valueChange', true);
    expect(study.isFavorite(c1)).toBe(true);
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-correct'));
    // seconda carta, padre giusto: la riga del padre ha il tasto «cambia verdetto»
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-correct'));
    const father = games.plays(game, 2).find((p) => p.card_uuid)!;
    expect(father.user_answer).toBe('Correct');
    await fireEvent.press(screen.getByTestId(`fcg-verdict-${father.uuid}`));
    expect(games.plays(game, 2).find((p) => p.card_uuid)!.user_answer).toBe('Wrong');
  });

  test('resuming a position behind the first open one jumps to the open one', async () => {
    const { games, game } = started();
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-correct'));
    expect(games.firstUnanswered(game)).toBe(2);
    expect(screen.getByTestId('fcg-progress')).toBeTruthy();
  });
});

describe('result and history', () => {
  test('result shows score, tally, retries the wrong ones and changes a verdict', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'correct');
    games.ensurePosition(game, 2);
    const father2 = games.plays(game, 2).find((p) => p.card_uuid)!;
    games.grade(game, 2, father2.card_uuid!, false, 'wrong');
    for (const k of games.plays(game, 2).filter((p) => p.child_uuid)) {
      games.grade(game, 2, k.child_uuid!, true, 'correct');
    }
    games.conclude(game);
    mockParams = { game };
    await render(wrap(<ResultScreen />));
    expect(screen.getByTestId('fcr-score')).toHaveTextContent('75%');
    expect(screen.getByTestId('fcr-correct')).toBeTruthy();

    await fireEvent(screen.getByTestId('fcr-only-wrong'), 'valueChange', true);
    expect(screen.queryByTestId(`fcr-verdict-${games.plays(game, 1)[0]!.uuid}`)).toBeNull();
    expect(screen.getByTestId(`fcr-verdict-${father2.uuid}`)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('fcr-retry'));
    const call = mockReplace.mock.calls[0]![0] as { pathname: string; params: { game: string } };
    expect(call.pathname).toBe('/fc-game');
    expect(games.game(call.params.game)!.parent_uuid).toBe(game);

    await fireEvent.press(screen.getByTestId(`fcr-verdict-${father2.uuid}`));
    expect(games.tally(game).wrong).toBe(0);
    expect(games.game(game)!.score).toBe(100);
  });

  test('result shows the road to 100% and opens another step', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'wrong');
    games.conclude(game);
    mockParams = { game };
    await render(wrap(<ResultScreen />));
    expect(screen.getByTestId('fcr-road-title')).toBeTruthy();
    expect(screen.getByTestId('fcr-road-0')).toBeTruthy();
    expect(screen.queryByTestId('fcr-compare')).toBeNull(); // nessuna partita prima
  });

  test('result of a game that does not exist says so', async () => {
    setup();
    mockParams = { game: 'nope' };
    await render(wrap(<ResultScreen />));
    expect(screen.getByText(/not found/i)).toBeTruthy();
  });

  test('history lists the game, opens it and deletes it', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'correct');
    games.conclude(game);
    await render(wrap(<HistoryScreen />));
    // la partita è a metà (resta la seconda carta): si riprende dalla posizione aperta
    await fireEvent.press(screen.getByTestId(`fch-game-${game}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/fc-game',
      params: { game, position: '2' },
    });
    await fireEvent.press(screen.getByTestId(`fch-del-${game}`));
    await fireEvent.press(screen.getByTestId(`fch-del-yes-${game}`));
    expect(games.game(game)).toBeNull();
    expect(screen.getByTestId('fch-empty')).toBeTruthy();
  });
});

describe('history filters', () => {
  test('the filter panel narrows the list and the summary follows', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'wrong');
    games.conclude(game);
    await render(wrap(<HistoryScreen />));
    expect(screen.getByTestId(`fch-game-${game}`)).toBeTruthy();
    expect(screen.getByTestId('fch-summary')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fch-filters'));
    await fireEvent.press(screen.getByTestId('fch-f-kind-1')); // solo imparate: nessuna
    expect(screen.queryByTestId(`fch-game-${game}`)).toBeNull();
    expect(screen.getByTestId('fch-empty')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fch-f-kind-any'));
    expect(screen.getByTestId(`fch-game-${game}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fch-f-sort-errors'));
    expect(screen.getByTestId(`fch-game-${game}`)).toBeTruthy();
  });
});

describe('statistics screen', () => {
  test('shows totals, streak, goal and changes the goal', async () => {
    const s = started();
    const { games, game, study } = s;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())} 10:00:00`;
    games.ensurePosition(game, 1);
    const p1 = games.plays(game, 1)[0]!;
    games.grade(game, 1, p1.card_uuid!, false, 'correct');
    s.db.run('UPDATE fc_study_plays SET play_date = ?', [stamp]);
    await render(wrap(<StatsScreen />));
    expect(screen.getByTestId('fcst-played').props.children).toBe('1');
    expect(screen.getByTestId('fcst-accuracy').props.children).toBe('100%');
    expect(screen.getByTestId('fcst-goal').props.children.join('')).toBe('1 / 20');
    expect(screen.getByTestId('fcst-badge-10_giocate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcst-goal-more'));
    expect(study.goal()).toBe(25);
    await fireEvent.press(screen.getByTestId('fcst-period-7'));
    expect(screen.getByTestId('fcst-played').props.children).toBe('1');
  });

  test('most missed cards and the focus on one deck', async () => {
    const s = started();
    const { games, game, db } = s;
    games.ensurePosition(game, 1);
    const card = games.plays(game, 1)[0]!.card_uuid!;
    const deck = games.gameDecks(game)[0]!;
    const put = (n: number, ans: string) =>
      db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, user_answer, position, play_date) VALUES (?, ?, ?, ?, ?, ?)`,
        [`x${n}`, game, card, ans, 50 + n, `2026-11-02 09:0${n}:00`],
      );
    put(1, 'Wrong');
    put(2, 'Wrong');
    put(3, 'Correct');
    await render(wrap(<StatsScreen />));
    expect(screen.getByTestId(`fcst-missed-p${card}`)).toBeTruthy();
    expect(screen.getByTestId('fcst-retry-pct').props.children).toBe('—'); // poche ripetizioni
    await fireEvent.press(screen.getByTestId(`fcst-focus-${deck}`));
    expect(screen.getByTestId(`fcst-missed-p${card}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcst-focus-all'));
    expect(screen.getByTestId(`fcst-missed-p${card}`)).toBeTruthy();
  });

  test('empty history shows the message', async () => {
    setup();
    await render(wrap(<StatsScreen />));
    expect(screen.getByTestId('fcst-empty')).toBeTruthy();
  });
});
