import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import type { FakeEngine } from '@/core/speech/__tests__/fakeEngine';
import { phoneEngine } from '@/core/speech/recognizer';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { GameRepo } from '@/features/flashcards/game';
import { FlashcardsRepo } from '@/features/flashcards/repo';
import { StudyRepo } from '@/features/flashcards/study';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import GameScreen from '../fc-game';

let mockServices: unknown;
let mockParams: Record<string, string> = {};
let mockPrefs: Record<string, unknown> = {};
const mockUpdate = jest.fn();
const mockSpoken: { text: string; lang: string; done?: () => void }[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
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
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

function started() {
  const db = memoryDb();
  migrate(db);
  const projects = new ProjectsRepo(db);
  const languages = new LanguagesRepo(db, 7, projects);
  const study = new StudyRepo(db, 7);
  mockServices = {
    db,
    languages,
    projects,
    study,
    flashcards: new FlashcardsRepo(db),
    games: new GameRepo(db, study),
  };
  const course = languages.addCourse('fr', 'en-GB', 'en') as string;
  const deck = languages.createDeck(course, { name: 'Home' })!;
  languages.addWord(deck, {
    word: 'to give up',
    translation: 'abandonner',
    meaning: 'to stop trying',
  });
  languages.addWord(deck, { word: 'run', translation: 'courir' });
  const games = languages.games(course);
  const r = games.start({ decks: [deck], status: 'all', order: 'in_order', direction: 't2w' });
  if (r.kind !== 'started') throw new Error('not started');
  mockParams = { game: r.game, position: '1' };
  return { games, game: r.game };
}

const say = async (...alts: string[]) => {
  await act(async () => {
    jest.advanceTimersByTime(2000);
    engine.say(alts);
  });
};
const finishReading = async () => {
  await act(async () => {
    while (mockSpoken.length) mockSpoken.shift()!.done?.();
  });
};
const wait = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockPrefs = { fcCheckpoint: 0, fcSounds: false, fcVoiceLang: 'en-US', fcVoiceRead: '1100' };
  mockSpoken.length = 0;
  engine.granted = true;
  engine.starts.length = 0;
});
afterEach(() => jest.useRealTimers());

describe('words by voice', () => {
  test('the meaning is read, you say the word, it is shown, read, and marked correct after 3 seconds', async () => {
    const { games, game } = started();
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-voice'));
    // le parole hanno le scelte «cosa legge»
    expect(screen.getByTestId('fcg-read-a-1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-voice-start'));
    expect(mockSpoken[0]).toMatchObject({ text: 'abandonner' });
    await finishReading();

    await say('to give up');
    expect(screen.getByText('to give up')).toBeTruthy();
    expect(mockSpoken.map((s) => s.text)).toEqual(['to give up']);
    await finishReading();
    await wait(1000);
    expect(games.tally(game)).toMatchObject({ correct: 0 });
    await wait(2500);
    expect(games.tally(game)).toMatchObject({ correct: 1, wrong: 0 });
    // e parte la parola dopo
    expect(screen.getByText('courir')).toBeTruthy();
  });

  test('a wrong word is ignored; "correct" before seeing the answer only shows it', async () => {
    const { games, game } = started();
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-voice'));
    await fireEvent.press(screen.getByTestId('fcg-voice-start'));
    await finishReading();

    await say('take off');
    expect(screen.queryByTestId('fcg-answer')).toBeNull();
    await say('correct');
    expect(screen.getByTestId('fcg-answer')).toBeTruthy();
    await finishReading();
    await wait(5000);
    expect(games.tally(game)).toMatchObject({ correct: 0, wrong: 0 }); // niente voto d'ufficio

    await say('wrong');
    expect(games.tally(game)).toMatchObject({ correct: 0, wrong: 1 });
  });

  test('"wrong" while the correct mark is on its way wins', async () => {
    const { games, game } = started();
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-voice'));
    await fireEvent.press(screen.getByTestId('fcg-voice-start'));
    await finishReading();
    await say('give up');
    await finishReading();
    await wait(1500);
    await say('wrong');
    expect(games.tally(game)).toMatchObject({ correct: 0, wrong: 1 });
    await wait(5000);
    expect(games.tally(game)).toMatchObject({ correct: 0, wrong: 1 });
  });

  test('the reading choices are saved', async () => {
    started();
    await render(wrap(<GameScreen />));
    await fireEvent.press(screen.getByTestId('fcg-voice'));
    await fireEvent.press(screen.getByTestId('fcg-read-a-2'));
    expect(mockUpdate).toHaveBeenCalledWith({ fcVoiceRead: '1200' });
    await fireEvent.press(screen.getByTestId('fcg-read-m-1'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ fcVoiceRead: '1110' });
  });
});
