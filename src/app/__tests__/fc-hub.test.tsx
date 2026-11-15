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
  return { languages };
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
