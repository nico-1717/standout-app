import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { GameRepo } from '@/features/flashcards/game';
import { FlashcardsRepo } from '@/features/flashcards/repo';
import { StatsRepo } from '@/features/flashcards/stats';
import { StudyRepo } from '@/features/flashcards/study';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import FlashcardsHub from '../fc-hub';

let mockServices: unknown;
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: 0,
    changed: jest.fn(),
    authState: { status: 'signedIn', user: { username: 'nico' } },
  }),
}));

function setup() {
  mockPush.mockClear();
  const db = memoryDb();
  migrate(db);
  const flashcards = new FlashcardsRepo(db);
  const study = new StudyRepo(db, 7);
  const languages = new LanguagesRepo(db, 7, new ProjectsRepo(db));
  mockServices = {
    db,
    flashcards,
    study,
    languages,
    games: new GameRepo(db, study),
    fcStats: new StatsRepo(db),
  };
  return { languages, flashcards, study, db };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('Flashcards hub', () => {
  test('shows the two roads, the day and the start-of-streak phrase', async () => {
    setup();
    await render(wrap(<FlashcardsHub />));
    expect(screen.getByTestId('hub-study')).toBeTruthy();
    expect(screen.getByTestId('hub-vocab')).toBeTruthy();
    expect(screen.getByTestId('hub-phrase').props.children).toMatch(/streak begins/);
    expect(screen.getByTestId('hub-today-n').props.children).toBe(0);
  });

  test('Study opens the decks, Play opens the history, the chart opens the statistics', async () => {
    setup();
    await render(wrap(<FlashcardsHub />));
    await fireEvent.press(screen.getByTestId('hub-study-open'));
    expect(mockPush).toHaveBeenLastCalledWith('/flashcards');
    await fireEvent.press(screen.getByTestId('hub-study-play'));
    expect(mockPush).toHaveBeenLastCalledWith('/fc-history');
    await fireEvent.press(screen.getByTestId('hub-stats'));
    expect(mockPush).toHaveBeenLastCalledWith('/fc-stats');
  });

  test('a language gets its own row that opens the course', async () => {
    const { languages } = setup();
    const course = languages.addCourse('en', 'de') as string;
    const deck = languages.createDeck(course, { name: 'Food' })!;
    languages.addWord(deck, { word: 'Brot' });
    await render(wrap(<FlashcardsHub />));
    expect(screen.getByTestId(`hub-course-${course}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`hub-course-open-${course}`));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/lang-course', params: { id: course } });
    await fireEvent.press(screen.getByTestId(`hub-course-play-${course}`));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/fc-history',
      params: { course },
    });
  });
});

describe('cards you know chart', () => {
  test('shows the tapped cards on their day, with the +N chips and the type tiles', async () => {
    const { db, flashcards, study, languages } = setup();
    const deck = flashcards.createDeck({ name: 'D' })!;
    const card = flashcards.addCard(deck, 'Q', 'A')!;
    study.setLearnt(card, false, true);
    const course = languages.addCourse('fr', 'en-GB', 'en') as string;
    const ldeck = languages.createDeck(course, { name: 'Home' })!;
    const word = languages.addWord(ldeck, { word: 'house', translation: 'maison' })!;
    languages.setLearnt(word, false, true);
    // both learnt today (the repos stamp today), so today's bar and chips show 2
    await render(wrap(<FlashcardsHub />));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+2/);
    expect(screen.getByTestId('fc-learned-bar-13')).toBeTruthy();
    // tile "study" keeps only the study cards, tapping again shows all
    await fireEvent.press(screen.getByTestId('fc-learned-tile-study'));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+1/);
    await fireEvent.press(screen.getByTestId('fc-learned-tile-vocab'));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+1/);
    await fireEvent.press(screen.getByTestId('fc-learned-tile-vocab'));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+2/);
    // weeks and months: 8 and 6 bars
    await fireEvent.press(screen.getByTestId('fc-learned-step-week'));
    expect(screen.getByTestId('fc-learned-bar-7')).toBeTruthy();
    expect(screen.queryByTestId('fc-learned-bar-8')).toBeNull();
    await fireEvent.press(screen.getByTestId('fc-learned-step-month'));
    expect(screen.getByTestId('fc-learned-bar-5')).toBeTruthy();
    expect(screen.queryByTestId('fc-learned-bar-6')).toBeNull();
    void db;
  });

  test('without a language course there is no languages tile', async () => {
    setup();
    await render(wrap(<FlashcardsHub />));
    expect(screen.queryByTestId('fc-learned-tile-vocab')).toBeNull();
    expect(screen.getByTestId('fc-learned-tile-study')).toBeTruthy();
  });
});
