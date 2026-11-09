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
import { PomodoroRepo } from '@/features/pomodoro/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import GameScreen from '../fc-game';
import HistoryScreen from '../fc-history';
import ResultScreen from '../fc-result';
import SetupScreen from '../fc-setup';
import StatsScreen from '../fc-stats';

let mockServices: unknown;
let mockVersion = 0;
let mockPrefs = { fcCheckpoint: 10, fcSounds: false } as Record<string, unknown>;
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
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: jest.fn(),
    localPrefs: mockPrefs,
    updateLocalPrefs: jest.fn(),
  }),
}));

function setup() {
  mockVersion = 0;
  mockPrefs = { fcCheckpoint: 10, fcSounds: false };
  mockParams = {};
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  const db = memoryDb();
  migrate(db);
  const flashcards = new FlashcardsRepo(db);
  const study = new StudyRepo(db, 7);
  const games = new GameRepo(db, study);
  const projects = new ProjectsRepo(db);
  mockServices = { db, flashcards, study, games, projects, fcStats: new StatsRepo(db) };
  return { db, flashcards, study, games, projects };
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

    // l'ultimo tratto chiude con la pausa dei risultati; si va alla pagina del risultato quando la si chiude
    expect(screen.getByTestId('fcg-checkpoint')).toBeTruthy();
    expect(screen.getByLabelText(/75%/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('fcg-ck-continue'));

    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/fc-result', params: { game } });
    expect(games.tally(game)).toMatchObject({ correct: 3, wrong: 1 });
    expect(games.game(game)!.score).toBe(75);
  });

  test('with checkpoints off the last answer goes straight to the result', async () => {
    const { game } = started();
    mockPrefs = { fcCheckpoint: 0, fcSounds: false };
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    for (const id of ['fcg-correct', 'fcg-correct', 'fcg-correct', 'fcg-correct']) {
      await fireEvent.press(screen.getByTestId('fcg-reveal'));
      await fireEvent.press(screen.getByTestId(id));
    }
    expect(screen.queryByTestId('fcg-checkpoint')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/fc-result', params: { game } });
  });

  test('the checkpoint offers the boss round for the missed card; winning it, then continuing, ends the game', async () => {
    const { games, game } = started();
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    for (const id of ['fcg-correct', 'fcg-wrong', 'fcg-correct', 'fcg-correct']) {
      await fireEvent.press(screen.getByTestId('fcg-reveal'));
      await fireEvent.press(screen.getByTestId(id));
    }
    expect(screen.getByTestId('fcg-ck-boss')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-ck-boss'));
    expect(within(screen.getByTestId('fcg-boss-prompt')).getByText('Q2')).toBeTruthy();
    expect(screen.queryByTestId('fcg-boss-reveal')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcg-boss-show'));
    expect(within(screen.getByTestId('fcg-boss-reveal')).getByText('A2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-boss-yes'));
    expect(screen.getByTestId('fcg-boss-result')).toBeTruthy();
    expect(screen.getByText('Boss defeated!')).toBeTruthy();
    // il boss non cambia i voti della partita
    expect(games.tally(game)).toMatchObject({ correct: 3, wrong: 1 });
    await fireEvent.press(screen.getByTestId('fcg-boss-end'));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/fc-result', params: { game } });
  });

  test('three right answers in a row celebrate the streak with a toast', async () => {
    const s = setup();
    const deck = s.flashcards.createDeck({ name: 'Streak' })!;
    for (let i = 1; i <= 5; i++) s.flashcards.addCard(deck, `Q${i}`, `A${i}`);
    const r = s.games.start({ decks: [deck], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    mockPrefs = { fcCheckpoint: 0, fcSounds: false };
    mockParams = { game: r.game, position: '1' };
    await render(wrap(<GameScreen />));
    for (let i = 0; i < 3; i++) {
      expect(screen.queryByTestId('fcg-toast')).toBeNull();
      await fireEvent.press(screen.getByTestId('fcg-reveal'));
      await fireEvent.press(screen.getByTestId('fcg-correct'));
    }
    expect(within(screen.getByTestId('fcg-toast')).getByText(/on fire/i)).toBeTruthy();
    expect(screen.getByTestId('fcg-streak')).toBeTruthy();
  });

  test('the gear opens the settings with the checkpoint steps', async () => {
    const { game } = started();
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-gear'));
    expect(screen.getByTestId('fcg-settings')).toBeTruthy();
    expect(screen.getByTestId('fcg-ck-step-25')).toBeTruthy();
    expect(screen.getByTestId('fcg-sounds')).toBeTruthy();
  });

  test('a recorded audio plays from the question; the answer one shows after the reveal', async () => {
    const { db, c1, game } = started();
    db.run('UPDATE fc_study_cards SET question_audio = ?, answer_audio = ? WHERE uuid = ?', [
      'q1.m4a',
      'a1.m4a',
      c1,
    ]);
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    expect(screen.getByTestId('fcg-question-audio')).toBeTruthy();
    expect(screen.queryByTestId('fcg-answer-audio')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    expect(screen.getByTestId('fcg-answer-audio')).toBeTruthy();
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
  test('the details switch shows the mistakes button, which opens the result on the mistakes', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'wrong');
    games.conclude(game);
    await render(wrap(<HistoryScreen />));
    expect(screen.queryByTestId(`fch-errors-${game}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('fch-density'));
    await fireEvent.press(screen.getByTestId(`fch-errors-${game}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/fc-result',
      params: { game, errors: '1' },
    });
  });
  test('detailed rows list each review: open it, or delete one left half way', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'wrong');
    games.ensurePosition(game, 2);
    games.grade(game, 2, games.plays(game, 2).find((p) => p.card_uuid)!.card_uuid!, false, 'wrong');
    games.conclude(game);
    const r = games.retry(game) as { kind: 'started'; game: string };
    games.ensurePosition(r.game, 1);
    games.grade(r.game, 1, games.plays(r.game, 1)[0]!.card_uuid!, false, 'correct');
    await render(wrap(<HistoryScreen />));
    expect(screen.queryByTestId(`fch-retries-${game}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('fch-density'));
    await fireEvent.press(screen.getByTestId(`fch-retry-${r.game}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/fc-game',
      params: { game: r.game, position: expect.any(String) },
    });
    await fireEvent.press(screen.getByTestId(`fch-retry-del-${r.game}`));
    expect(games.game(r.game)).toBeNull();
    expect(screen.queryByTestId(`fch-retry-${r.game}`)).toBeNull();
    expect(games.game(game)).not.toBeNull();
  });
  /** Gioca tutte le posizioni di una partita: sbagliate le prime `wrongs`, giuste le altre; poi la conclude. */
  function playAll(games: ReturnType<typeof setup>['games'], game: string, wrongs: number): void {
    for (let pos = 1; pos <= games.totalPositions(game); pos++) {
      for (const p of games.ensurePosition(game, pos)!)
        games.grade(
          game,
          pos,
          (p.card_uuid ?? p.child_uuid)!,
          !!p.child_uuid,
          pos <= wrongs ? 'wrong' : 'correct',
        );
    }
    games.conclude(game);
  }
  function plain(n: number) {
    const s = setup();
    const deck = s.flashcards.createDeck({ name: 'Plain' })!;
    for (let i = 0; i < n; i++) s.flashcards.addCard(deck, `Q${i}`, `A${i}`);
    const r = s.games.start({ decks: [deck], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    return { games: s.games, game: r.game };
  }
  test('mistakes left: a label says how many, and "Fix N mistakes" starts a review from the last step', async () => {
    const { games, game } = plain(4);
    playAll(games, game, 2);
    mockPush.mockClear();
    await render(wrap(<HistoryScreen />));
    expect(screen.getByTestId(`fch-plate-${game}`)).toHaveTextContent(/2 mistakes to fix/);
    expect(screen.queryByTestId(`fch-gold-${game}`)).toBeNull();
    expect(screen.queryByTestId(`fch-fix-${game}`)).toBeNull(); // il tasto sta nel dettaglio
    await fireEvent.press(screen.getByTestId('fch-density'));
    expect(screen.getByTestId(`fch-road-${game}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`fch-fix-${game}`));
    const call = mockPush.mock.calls.at(-1)![0] as { pathname: string; params: { game: string } };
    expect(call.pathname).toBe('/fc-game');
    expect(games.game(call.params.game)!.parent_uuid).toBe(game);
  });
  test('a game won by reviews is gold: star badge, plate, and no more fix button', async () => {
    const { games, game } = plain(3);
    playAll(games, game, 1);
    const r = games.retry(game) as { kind: 'started'; game: string };
    playAll(games, r.game, 0);
    await render(wrap(<HistoryScreen />));
    expect(screen.getByTestId(`fch-gold-${game}`)).toHaveTextContent('★ 100%');
    expect(screen.getByTestId(`fch-plate-${game}`)).toHaveTextContent(/Taken to 100% in 1 review/);
    await fireEvent.press(screen.getByTestId('fch-density'));
    expect(screen.queryByTestId(`fch-fix-${game}`)).toBeNull();
    expect(screen.getByTestId(`fch-road-${game}`)).toBeTruthy();
  });
  test('the dates button opens a from/to range and the list follows it', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'correct');
    games.conclude(game);
    await render(wrap(<HistoryScreen />));
    expect(screen.queryByTestId('fch-from')).toBeNull();
    await fireEvent.press(screen.getByTestId('fch-dates'));
    expect(screen.getByTestId('fch-from')).toBeTruthy();
    expect(screen.getByTestId('fch-to')).toBeTruthy();
    expect(screen.getByTestId(`fch-game-${game}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fch-period-7'));
    expect(screen.queryByTestId('fch-from')).toBeNull();
  });
  test('tapping a review row opens its answer; tapping again closes it', async () => {
    const { flashcards, games } = setup();
    const deck = flashcards.createDeck({ name: 'Open' })!;
    flashcards.addCard(deck, 'Capital of Italy', 'Rome');
    const r = games.start({ decks: [deck], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    const p = games.ensurePosition(r.game, 1)!;
    games.grade(r.game, 1, p[0]!.card_uuid!, false, 'wrong');
    games.conclude(r.game);
    mockParams = { game: r.game };
    await render(wrap(<ResultScreen />));
    const row = `fcr-open-${games.plays(r.game, 1)[0]!.uuid}`;
    expect(screen.queryByText('Rome')).toBeNull();
    await fireEvent.press(screen.getByTestId(row));
    expect(screen.getByText('Rome')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(row));
    expect(screen.queryByText('Rome')).toBeNull();
  });
  test('the full-screen viewer flips a card, goes next and closes', async () => {
    const { flashcards, games } = setup();
    const deck = flashcards.createDeck({ name: 'View' })!;
    flashcards.addCard(deck, 'First question', 'First answer');
    flashcards.addCard(deck, 'Second question', 'Second answer');
    const r = games.start({ decks: [deck], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    for (const pos of [1, 2]) {
      const p = games.ensurePosition(r.game, pos)!;
      games.grade(r.game, pos, p[0]!.card_uuid!, false, 'correct');
    }
    games.conclude(r.game);
    mockParams = { game: r.game };
    await render(wrap(<ResultScreen />));
    expect(screen.queryByTestId('fcr-viewer')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcr-browse'));
    expect(screen.getByTestId('fcr-viewer-count')).toHaveTextContent('1 / 2');
    expect(screen.getByTestId('fcr-viewer-question')).toHaveTextContent('First question');
    await fireEvent.press(screen.getByTestId('fcr-viewer-card'));
    expect(screen.getByTestId('fcr-viewer-answer')).toHaveTextContent('First answer');
    await fireEvent.press(screen.getByTestId('fcr-viewer-next'));
    expect(screen.getByTestId('fcr-viewer-count')).toHaveTextContent('2 / 2');
    expect(screen.getByTestId('fcr-viewer-question')).toHaveTextContent('Second question');
    await fireEvent.press(screen.getByTestId('fcr-viewer-prev'));
    expect(screen.getByTestId('fcr-viewer-count')).toHaveTextContent('1 / 2');
    await fireEvent.press(screen.getByTestId('fcr-viewer-close'));
    expect(screen.queryByTestId('fcr-viewer')).toBeNull();
  });
  test('a long review shows 20 cards and loads more on request', async () => {
    const { flashcards, games } = setup();
    const deck = flashcards.createDeck({ name: 'Big' })!;
    for (let i = 0; i < 25; i++) flashcards.addCard(deck, `Q${i}`, `A${i}`);
    const r = games.start({ decks: [deck], status: 'all', order: 'in_order' });
    if (r.kind !== 'started') throw new Error('empty');
    for (let pos = 1; pos <= 25; pos++) {
      const p = games.ensurePosition(r.game, pos)!;
      games.grade(r.game, pos, p[0]!.card_uuid!, false, 'correct');
    }
    games.conclude(r.game);
    mockParams = { game: r.game };
    await render(wrap(<ResultScreen />));
    expect(screen.getAllByText(/^Q\d+$/)).toHaveLength(20);
    expect(screen.getByTestId('fcr-more')).toHaveTextContent(/5 left/);
    await fireEvent.press(screen.getByTestId('fcr-more'));
    expect(screen.getAllByText(/^Q\d+$/)).toHaveLength(25);
    expect(screen.queryByTestId('fcr-more')).toBeNull();
  });
  test('result opened with errors=1 starts on the wrong ones', async () => {
    const { games, game } = started();
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'correct');
    games.ensurePosition(game, 2);
    const p2 = games.plays(game, 2).find((p) => p.card_uuid)!;
    games.grade(game, 2, p2.card_uuid!, false, 'wrong');
    games.conclude(game);
    mockParams = { game, errors: '1' };
    await render(wrap(<ResultScreen />));
    expect(screen.queryByTestId(`fcr-verdict-${games.plays(game, 1)[0]!.uuid}`)).toBeNull();
    expect(screen.getByTestId(`fcr-verdict-${p2.uuid}`)).toBeTruthy();
  });
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

describe('cards added after the start', () => {
  test('resuming asks about them: yes joins them at the end, no keeps the game as is', async () => {
    const { flashcards, games, deck, game } = started();
    flashcards.addCard(deck, 'Q3', 'A3');
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    expect(screen.getByTestId('fcg-nc-title')).toHaveTextContent('You added 1 card');
    expect(screen.getByText('Q3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-nc-yes'));
    expect(games.totalPositions(game)).toBe(3);
    expect(screen.queryByTestId('fcg-nc-title')).toBeNull();
    expect(screen.getByTestId('fcg-question')).toBeTruthy();
  });
  test('no keeps the sequence and does not ask again for the same cards', async () => {
    const { flashcards, games, deck, game } = started();
    flashcards.addCard(deck, 'Q3', 'A3');
    mockParams = { game, position: '1' };
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-nc-no'));
    expect(games.totalPositions(game)).toBe(2);
    expect(games.newCards(game)).toEqual([]);
  });
  test('nc=1 skips the question', async () => {
    const { flashcards, deck, game } = started();
    flashcards.addCard(deck, 'Q3', 'A3');
    mockParams = { game, position: '1', nc: '1' };
    await render(wrap(<GameScreen />));
    expect(screen.queryByTestId('fcg-nc-title')).toBeNull();
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

describe('history: activity and subjects', () => {
  test('the activity chart shows today; the Subjects view lists played and untouched subjects', async () => {
    const { games, game, flashcards } = started();
    flashcards.createDeck({ name: 'Untouched' });
    const other = flashcards.createDeck({ name: 'Other' })!;
    flashcards.addCard(other, 'Qo', 'Ao');
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'correct');
    await render(wrap(<HistoryScreen />));
    expect(screen.getByTestId('fch-activity')).toBeTruthy();
    expect(screen.getByTestId('fch-activity-bar-0')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('fch-view-subjects'));
    expect(screen.queryByTestId('fch-filters')).toBeNull();
    // Maths was played; Other has cards but no answers; "Untouched" has no cards, so it is hidden
    expect(screen.getByTestId('fch-subjects-summary')).toHaveTextContent(/^1 of 2 subjects/);
    expect(screen.getByText('Maths')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.queryByText('Untouched')).toBeNull();
  });

  test('tapping a played subject goes to its games; Play on an untouched one opens the game setup', async () => {
    const { games, game, deck, flashcards } = started();
    const other = flashcards.createDeck({ name: 'Other' })!;
    flashcards.addCard(other, 'Qo', 'Ao');
    games.ensurePosition(game, 1);
    games.grade(game, 1, games.plays(game, 1)[0]!.card_uuid!, false, 'correct');
    await render(wrap(<HistoryScreen />));
    await fireEvent.press(screen.getByTestId('fch-view-subjects'));
    await fireEvent.press(screen.getByTestId(`fch-subject-play-${other}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-setup', params: { preselect: other } });
    await fireEvent.press(screen.getByTestId(`fch-subject-main-${deck}`));
    // back on the games view, filtered by Maths: the game is there
    expect(screen.getByTestId(`fch-game-${game}`)).toBeTruthy();
    expect(screen.getByTestId('fch-filters')).toBeTruthy();
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
    expect(screen.getByTestId('fcst-mastery-pct')).toBeTruthy();
    expect(screen.getByTestId('fcst-forecast')).toHaveTextContent(/Keep playing/);
    expect(screen.getByTestId('fcst-curve-empty')).toBeTruthy();
    expect(screen.getByTestId('fcst-mastery-tried')).toBeTruthy();
    // il calendario: il giorno di oggi ha una carta; toccandolo si leggono i numeri
    const iso = stamp.slice(0, 10);
    expect(screen.getByTestId('cal-info')).toHaveTextContent(/Tap a day/);
    await fireEvent.press(screen.getByTestId(`cal-day-${iso}`));
    expect(screen.getByTestId('cal-info')).toHaveTextContent(/1 cards, 100% accuracy/);
    await fireEvent.press(screen.getByTestId('cal-prev'));
    expect(screen.queryByTestId(`cal-day-${iso}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('cal-next'));
    expect(screen.getByTestId(`cal-day-${iso}`)).toBeTruthy();
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

  test('answer speed: average, trend over the games, the next-game estimate; and the linked project', async () => {
    const s = setup();
    const deck = s.flashcards.createDeck({ name: 'Speed' })!;
    s.flashcards.addCard(deck, 'Q1', 'A1');
    s.flashcards.addCard(deck, 'Q2', 'A2');
    const secs = [120, 120, 90, 60, 30, 30];
    for (const sec of secs) {
      const r = s.games.start({ decks: [deck], status: 'all', order: 'in_order' });
      if (r.kind !== 'started') throw new Error('empty');
      for (let pos = 1; pos <= s.games.totalPositions(r.game); pos++) {
        const p = s.games.ensurePosition(r.game, pos)!;
        s.games.grade(r.game, pos, p[0]!.card_uuid!, false, 'correct');
      }
      s.db.run('UPDATE fc_game_durations SET duration_seconds = ? WHERE game_uuid = ?', [
        sec,
        r.game,
      ]);
    }
    const project = s.projects.create({ name: 'Maths project' })!;
    s.flashcards.linkDeck(project, deck);
    new PomodoroRepo(s.db, 7).addManual({
      day: '2026-10-01',
      from: '09:00',
      to: '10:00',
      projectUuid: project,
    });
    await render(wrap(<StatsScreen />));
    expect(screen.getByTestId('fcst-pace')).toHaveTextContent('15s/card');
    expect(screen.getByTestId('fcst-pace-trend')).toHaveTextContent(/75% faster/);
    expect(screen.getByTestId('fcst-pace-next')).toHaveTextContent(/typical next game of 2 cards/);
    expect(screen.queryByTestId('fcst-link-pomo')).toBeNull(); // nessun mazzo scelto
    await fireEvent.press(screen.getByTestId(`fcst-focus-${deck}`));
    expect(screen.getByTestId('fcst-link-pomo')).toHaveTextContent(/Maths project: 1:00:00/);
    expect(screen.getByTestId('fcst-link-total')).toBeTruthy();
  });

  test('empty history shows the message', async () => {
    setup();
    await render(wrap(<StatsScreen />));
    expect(screen.getByTestId('fcst-empty')).toBeTruthy();
  });
});
