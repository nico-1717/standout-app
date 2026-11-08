import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { FlashcardsRepo } from '@/features/flashcards/repo';
import { GameRepo } from '@/features/flashcards/game';
import { StudyRepo } from '@/features/flashcards/study';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import LangCourseScreen from '../lang-course';
import GameScreen from '../fc-game';
import SetupScreen from '../fc-setup';
import ResultScreen from '../fc-result';

let mockServices: unknown;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
const mockSpeak = jest.fn();
jest.mock('@/core/speech/speak', () => ({
  speak: (...a: unknown[]) => mockSpeak(...a),
  stopSpeaking: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: 0, changed: jest.fn() }),
}));

function setup() {
  mockParams = {};
  mockPush.mockClear();
  mockReplace.mockClear();
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
  const word = languages.addWord(deck, {
    word: 'house',
    translation: 'maison',
    meaning: 'a building',
  })!;
  languages.addWord(deck, { word: 'run', translation: 'courir' });
  return { db, languages, course, deck, word };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('language game screens', () => {
  test('the course page has Play and History for that course', async () => {
    const { course } = setup();
    mockParams = { id: course };
    await render(wrap(<LangCourseScreen />));
    await fireEvent.press(screen.getByTestId('lcourse-play'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-setup', params: { course } });
    await fireEvent.press(screen.getByTestId('lcourse-history'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-history', params: { course } });
  });

  test('setup: pick a direction and play; the game belongs to the course', async () => {
    const { languages, course } = setup();
    mockParams = { course };
    await render(wrap(<SetupScreen />));
    await fireEvent.press(screen.getByTestId('fcs-direction-t2w'));
    await fireEvent.press(screen.getByTestId('fcs-status-all'));
    await fireEvent.press(screen.getByTestId('fcs-play-all'));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const arg = mockReplace.mock.calls[0]![0] as { params: { game: string } };
    const g = languages.games(course).game(arg.params.game)!;
    expect(g).toMatchObject({ kind: 'vocab', course_uuid: course, type: 't2w' });
  });

  test('play: the translation is the question, the word is the answer; finishing goes to the result', async () => {
    const { languages, course, deck } = setup();
    const games = languages.games(course);
    const r = games.start({ decks: [deck], status: 'all', order: 'in_order', direction: 't2w' });
    if (r.kind !== 'started') throw new Error('not started');
    mockParams = { game: r.game, position: '1' };
    await render(wrap(<GameScreen />));
    expect(screen.getByTestId('fcg-question')).toBeTruthy();
    expect(screen.getByText('maison')).toBeTruthy();
    expect(screen.queryByText('house')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    expect(screen.getByText('house')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-correct'));
    expect(games.tally(r.game).correct).toBe(1);
  });

  async function startGame(mode?: 'aperto' | 'tocco' | 'dopo') {
    const { languages, course, deck } = setup();
    if (mode) (mockServices as { study: StudyRepo }).study.saveSettings({ vocab_meaning: mode });
    const r = languages
      .games(course)
      .start({ decks: [deck], status: 'all', order: 'in_order', direction: 'w2t' });
    if (r.kind !== 'started') throw new Error('not started');
    mockParams = { game: r.game, position: '1' };
    await render(wrap(<GameScreen />));
  }

  test('hints: open at once by default', async () => {
    await startGame();
    expect(screen.getByTestId('fcg-hint-meaning').props.children).toBe('a building');
  });

  test('hints: on a tap', async () => {
    await startGame('tocco');
    expect(screen.queryByTestId('fcg-hint-meaning')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcg-hint-meaning-show'));
    expect(screen.getByTestId('fcg-hint-meaning')).toBeTruthy();
  });

  test('hints: only after the answer', async () => {
    await startGame('dopo');
    expect(screen.queryByTestId('fcg-hint-meaning')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    expect(screen.getByTestId('fcg-hint-meaning')).toBeTruthy();
  });

  test('examples: the word is blank until the answer, then filled in (also another form of it)', async () => {
    const { languages, course, deck, word } = setup();
    languages.addExample(word, false, 'The house is big');
    languages.addExample(word, false, 'Two houses here');
    (mockServices as { study: StudyRepo }).study.saveSettings({ vocab_examples: 'aperto' });
    const r = languages
      .games(course)
      .start({ decks: [deck], status: 'all', order: 'in_order', direction: 'w2t' });
    if (r.kind !== 'started') throw new Error('not started');
    mockParams = { game: r.game, position: '1' };
    await render(wrap(<GameScreen />));
    expect(screen.getByTestId('fcg-example-0')).toHaveTextContent('The ________ is big');
    expect(screen.getByTestId('fcg-example-1')).toHaveTextContent('Two ________ here');
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    expect(screen.getByTestId('fcg-example-0')).toHaveTextContent('The house is big');
    expect(screen.getByTestId('fcg-example-1')).toHaveTextContent('Two houses here');
  });

  test('examples: a hand-picked hidden part wins over the automatic one', async () => {
    const { languages, course, deck, word } = setup();
    const ex = languages.addExample(word, false, 'The house is big')!;
    languages.setExampleGap(ex, 'is big');
    (mockServices as { study: StudyRepo }).study.saveSettings({ vocab_examples: 'aperto' });
    const r = languages
      .games(course)
      .start({ decks: [deck], status: 'all', order: 'in_order', direction: 'w2t' });
    if (r.kind !== 'started') throw new Error('not started');
    mockParams = { game: r.game, position: '1' };
    await render(wrap(<GameScreen />));
    expect(screen.getByTestId('fcg-example-0')).toHaveTextContent('The house ________');
  });

  test('listen: the word in the studied language, the meaning in the known one, examples only after the answer', async () => {
    mockSpeak.mockClear();
    const { languages, course, deck, word } = setup();
    languages.addExample(word, false, 'The house is big');
    const r = languages
      .games(course)
      .start({ decks: [deck], status: 'all', order: 'in_order', direction: 'w2t' });
    if (r.kind !== 'started') throw new Error('not started');
    mockParams = { game: r.game, position: '1' };
    await render(wrap(<GameScreen />));
    // before the answer: only the question can be heard, never the example (it holds the word to guess)
    expect(screen.queryByTestId('fcg-speak-example-0')).toBeNull();
    expect(screen.queryByTestId('fcg-speak-answer')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcg-speak-question'));
    expect(mockSpeak).toHaveBeenLastCalledWith(
      'house',
      'en-GB',
      expect.objectContaining({ once: false }),
    );
    await fireEvent.press(screen.getByTestId('fcg-reveal'));
    await fireEvent.press(screen.getByTestId('fcg-speak-answer'));
    expect(mockSpeak).toHaveBeenLastCalledWith(
      'maison',
      'fr-FR',
      expect.objectContaining({ once: true }),
    );
    await fireEvent.press(screen.getByTestId('fcg-speak-example-0'));
    expect(mockSpeak).toHaveBeenLastCalledWith(
      'The house is big',
      'en-GB',
      expect.objectContaining({ once: true }),
    );
  });

  test('result: shows the course words', async () => {
    const { languages, course, deck } = setup();
    const games = languages.games(course);
    const r = games.start({ decks: [deck], status: 'all', order: 'in_order', direction: 'w2t' });
    if (r.kind !== 'started') throw new Error('not started');
    const plays = games.ensurePosition(r.game, 1)!;
    games.grade(r.game, 1, plays[0]!.card_uuid!, false, 'wrong');
    mockParams = { game: r.game };
    await render(wrap(<ResultScreen />));
    expect(screen.getByText('house → maison')).toBeTruthy();
    const play = games.allPlays(r.game).find((x) => x.card_uuid)!;
    await fireEvent.press(screen.getByTestId(`fcr-speak-q-${play.uuid}`));
    expect(mockSpeak).toHaveBeenLastCalledWith('house', 'en-GB', expect.anything());
    expect(screen.getByTestId(`fcr-speak-a-${play.uuid}`)).toBeTruthy();
  });
});
