import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import type { FakeEngine } from '@/core/speech/__tests__/fakeEngine';
import { phoneEngine } from '@/core/speech/recognizer';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { GameRepo } from '@/features/flashcards/game';
import { FlashcardsRepo } from '@/features/flashcards/repo';
import { StatsRepo } from '@/features/flashcards/stats';
import { StudyRepo } from '@/features/flashcards/study';
import { ProjectsRepo } from '@/features/projects/repo';

import GameScreen from '../fc-game';

let mockServices: unknown;
let mockPrefs: Record<string, unknown> = {};
let mockParams: Record<string, string> = {};
const mockReplace = jest.fn();
const mockUpdate = jest.fn();
const mockSpoken: { text: string; lang: string; done?: () => void }[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: 0,
    changed: jest.fn(),
    localPrefs: mockPrefs,
    updateLocalPrefs: mockUpdate,
  }),
}));
jest.mock('@/core/speech/recognizer', () => {
  const actual = jest.requireActual('@/core/speech/recognizer');
  const { FakeEngine: Fake } = jest.requireActual('@/core/speech/__tests__/fakeEngine');
  return { ...actual, phoneEngine: new Fake() };
});
jest.mock('@/core/speech/speak', () => ({
  speak: jest.fn(async (text: string, lang: string, o: { done?: () => void } = {}) => {
    mockSpoken.push({ text, lang, ...o });
  }),
  stopSpeaking: jest.fn(),
}));

const engine = phoneEngine as unknown as FakeEngine;
let clock = 1_000_000;
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

function started() {
  const db = memoryDb();
  migrate(db);
  const flashcards = new FlashcardsRepo(db);
  const study = new StudyRepo(db, 7);
  const games = new GameRepo(db, study);
  mockServices = {
    db,
    flashcards,
    study,
    games,
    projects: new ProjectsRepo(db),
    fcStats: new StatsRepo(db),
  };
  const deck = flashcards.createDeck({ name: 'Maths' })!;
  flashcards.addCard(deck, 'Q1', 'A1');
  flashcards.addCard(deck, 'Q2', 'A2');
  const r = games.start({ decks: [deck], status: 'all', order: 'in_order' });
  if (r.kind !== 'started') throw new Error('empty');
  mockParams = { game: r.game, position: '1' };
  return r.game;
}

/** Dice una frase al microfono e lascia passare il tempo. */
async function say(...alts: string[]) {
  clock += 3000;
  await act(async () => {
    engine.say(alts);
  });
}

/** La voce ha finito di leggere tutto quello che aveva in coda. */
async function finishReading() {
  await act(async () => {
    while (mockSpoken.length) mockSpoken.shift()!.done?.();
  });
  clock += 3000;
}

async function startVoice() {
  await fireEvent.press(screen.getByTestId('fcg-voice'));
  await fireEvent.press(screen.getByTestId('fcg-voice-start'));
}

beforeEach(() => {
  clock = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  mockPrefs = { fcCheckpoint: 10, fcSounds: false, fcVoiceLang: 'en-US', fcVoiceRead: '1100' };
  mockSpoken.length = 0;
  mockReplace.mockClear();
  mockUpdate.mockClear();
  engine.granted = true;
  engine.isAvailable = true;
  engine.starts.length = 0;
});
afterEach(() => jest.restoreAllMocks());

describe('playing by voice', () => {
  test('the mic button opens the introduction; nothing listens until "Got it"', async () => {
    started();
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-voice'));
    expect(screen.getByTestId('fcg-voice-intro')).toBeTruthy();
    expect(screen.queryByTestId('fcg-voice-bar')).toBeNull();
    expect(engine.starts).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('fcg-voice-start'));
    expect(screen.getByTestId('fcg-voice-bar')).toBeTruthy();
    expect(engine.starts[0]).toMatchObject({ lang: 'en-US' });
  });

  test('the question is read in the command language and the bar says what to say', async () => {
    started();
    await render(wrap(<GameScreen />));
    await startVoice();
    expect(mockSpoken[0]).toMatchObject({ text: 'Q1', lang: 'en-US' });
    expect(screen.getByTestId('fcg-voice-hint')).toBeTruthy();
  });

  test('"answer" shows the answer and reads it; "correct" grades and moves on to the next card', async () => {
    const game = started();
    await render(wrap(<GameScreen />));
    await startVoice();
    await finishReading();

    await say('show the answer');
    expect(within(screen.getByTestId('fcg-answer')).getByText('A1')).toBeTruthy();
    expect(mockSpoken.map((s) => s.text)).toContain('A1');
    await finishReading();

    await say('correct');
    expect(within(screen.getByTestId('fcg-question')).getByText('Q2')).toBeTruthy();
    expect(mockSpoken.map((s) => s.text)).toContain('Q2');
    const { games } = mockServices as { games: GameRepo };
    expect(games.tally(game)).toMatchObject({ correct: 1, wrong: 0 });
  });

  test('"wrong" grades the card wrong', async () => {
    const game = started();
    await render(wrap(<GameScreen />));
    await startVoice();
    await finishReading();
    await say('answer');
    await finishReading();
    await say('wrong');
    const { games } = mockServices as { games: GameRepo };
    expect(games.tally(game)).toMatchObject({ correct: 0, wrong: 1 });
  });

  test('Italian commands work too', async () => {
    started();
    await render(wrap(<GameScreen />));
    await startVoice();
    await finishReading();
    await say('risposta');
    expect(screen.getByTestId('fcg-answer')).toBeTruthy();
  });

  test('the voice reading the card is not taken for a command', async () => {
    started();
    await render(wrap(<GameScreen />));
    await startVoice();
    // la voce sta ancora leggendo «Q1» e il microfono sente «q1»: niente
    await say('q1');
    expect(screen.queryByTestId('fcg-answer')).toBeNull();
  });

  test('a whole game by voice: checkpoint, boss round for the missed card, continue → result', async () => {
    started();
    await render(wrap(<GameScreen />));
    await startVoice();
    await finishReading();

    await say('answer');
    await finishReading();
    await say('correct');
    await finishReading();
    await say('answer');
    await finishReading();
    await say('wrong');
    // la pausa con i risultati
    expect(screen.getByTestId('fcg-checkpoint')).toBeTruthy();
    expect(mockSpoken.map((s) => s.text).join(' ')).toMatch(/Checkpoint/);
    await finishReading();
    await say('boss');
    expect(within(screen.getByTestId('fcg-boss-prompt')).getByText('Q2')).toBeTruthy();
    await finishReading();
    await say('show me');
    expect(within(screen.getByTestId('fcg-boss-reveal')).getByText('A2')).toBeTruthy();
    await finishReading();
    await say('i got it');
    expect(screen.getByTestId('fcg-boss-result')).toBeTruthy();
    await say('continue');
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/fc-result' }));
  });

  test('"continue" at the checkpoint skips the boss', async () => {
    started();
    await render(wrap(<GameScreen />));
    await startVoice();
    await finishReading();
    for (const verdict of ['correct', 'correct']) {
      await say('answer');
      await finishReading();
      await say(verdict);
      await finishReading();
    }
    expect(screen.getByTestId('fcg-checkpoint')).toBeTruthy();
    await say('continue');
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/fc-result' }));
  });

  test('the ✕ on the bar turns the voice off', async () => {
    started();
    await render(wrap(<GameScreen />));
    await startVoice();
    await fireEvent.press(screen.getByTestId('fcg-voice-off'));
    expect(screen.queryByTestId('fcg-voice-bar')).toBeNull();
    expect(engine.aborts).toBeGreaterThan(0);
    await say('answer');
    expect(screen.queryByTestId('fcg-answer')).toBeNull();
  });

  test('microphone refused: the bar explains and the voice stays off', async () => {
    started();
    engine.granted = false;
    await render(wrap(<GameScreen />));
    await startVoice();
    expect(screen.getByTestId('fcg-voice-status')).toBeTruthy();
    expect(engine.starts).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('fcg-voice-off'));
    expect(screen.queryByTestId('fcg-voice-bar')).toBeNull();
  });

  test('the choices in the introduction are saved on this phone', async () => {
    started();
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-voice'));
    await fireEvent.press(screen.getByTestId('fcg-voice-lang-it-IT'));
    expect(mockUpdate).toHaveBeenCalledWith({ fcVoiceLang: 'it-IT' });
    // un mazzo di studio non ha le scelte «cosa legge»
    expect(screen.queryByTestId('fcg-read-q-1')).toBeNull();
  });
});
