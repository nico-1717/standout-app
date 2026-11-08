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
import { GradesRepo } from '@/features/grades/repo';
import { DEFAULT_GRADE_SETTINGS as mockGradeSettings } from '@/features/grades/logic';
import { HabitsRepo } from '@/features/habits/repo';
import { DEFAULT_HOME_LAYOUT, type HomeWidget } from '@/features/home/layout';
import { QuickNoteStore } from '@/features/notes/quickNote';
import { PillsRepo } from '@/features/pills/repo';
import { PlannerRepo } from '@/features/planner/repo';
import { ProjectsRepo } from '@/features/projects/repo';
import { localToday } from '@/features/tasks/groups';
import { TasksRepo } from '@/features/tasks/repo';

import HomeScreen, { greetingKey } from '../(tabs)/home';

let mockServices: unknown;
let mockVersion = 0;
let mockLayout: HomeWidget[] = DEFAULT_HOME_LAYOUT;
const mockPush = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});
const mockUpdateLayout = jest.fn((l: HomeWidget[]) => {
  mockLayout = l;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    uiStyle: 'standard',
    authState: { status: 'signedIn', user: { id: 7, username: 'Nico' } },
    homeLayout: mockLayout,
    updateHomeLayout: mockUpdateLayout,
    gradeSettings: mockGradeSettings,
  }),
}));

function setup() {
  mockVersion = 0;
  mockLayout = DEFAULT_HOME_LAYOUT;
  mockPush.mockClear();
  mockUpdateLayout.mockClear();
  const db = memoryDb();
  migrate(db);
  const today = localToday();
  const planner = new PlannerRepo(db, undefined, undefined, undefined, 7);
  const tasks = new TasksRepo(db);
  const habits = new HabitsRepo(db, undefined, undefined, localToday);
  const pills = new PillsRepo(
    db,
    () => localToday(),
    () => `${localToday()} 10:00:00`,
  );
  const projects = new ProjectsRepo(db);
  const flashcards = new FlashcardsRepo(db);
  const study = new StudyRepo(db, 7);
  mockServices = {
    db,
    planner,
    tasks,
    habits,
    pills,
    projects,
    grades: new GradesRepo(db),
    flashcards,
    study,
    games: new GameRepo(db, study),
    fcStats: new StatsRepo(db),
    languages: new LanguagesRepo(db, 7, projects),
    notes: new QuickNoteStore(db),
    categories: { list: () => [] },
  };
  return { db, planner, tasks, habits, pills, projects, today, flashcards, study };
}
const renderIt = () =>
  render(
    <ThemeProvider>
      <HomeScreen />
    </ThemeProvider>,
  );

describe('greeting', () => {
  test('changes with the hour', () => {
    expect(greetingKey(2)).toBe('home.saluto_notte');
    expect(greetingKey(9)).toBe('home.saluto_mattina');
    expect(greetingKey(15)).toBe('home.saluto_pomeriggio');
    expect(greetingKey(21)).toBe('home.saluto_sera');
  });
});

describe('Home', () => {
  test('greets by name and shows the widgets that exist in the app', async () => {
    setup();
    await renderIt();
    expect(screen.getByTestId('home-greeting').props.children).toMatch(/Nico/);
    for (const id of [
      'shortcuts',
      'agenda',
      'note',
      'projects',
      'grades',
      'trivia',
      'cards',
      'stats',
    ])
      expect(screen.getByTestId(`home-w-${id}`)).toBeTruthy();
  });

  test('your numbers: mastery ring, streak, accuracy and the last 7 days', async () => {
    const { db, flashcards, study, today } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const a = flashcards.addCard(deck, 'QA', 'AA')!;
    flashcards.addCard(deck, 'QB', 'AB');
    study.setLearnt(a, false, true);
    const game = 'g1';
    for (const [i, ans] of ['Correct', 'Correct', 'Wrong', 'Correct'].entries()) {
      db.run(
        `INSERT INTO fc_study_plays (uuid, game_uuid, card_uuid, position, user_answer, play_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`p${i}`, game, a, i + 1, ans, `${today} 10:0${i}:00`],
      );
    }
    await renderIt();
    expect(screen.getByTestId('home-numbers-mastery')).toHaveTextContent('50%');
    expect(screen.getByTestId('home-numbers')).toHaveTextContent(/75%/);
    expect(screen.getByTestId(`home-numbers-bar-${today}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-numbers'));
    expect(mockPush).toHaveBeenCalledWith('/fc-stats');
  });

  test('shortcuts open the app pages', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('home-go-projects'));
    expect(mockPush).toHaveBeenCalledWith('/projects');
    await fireEvent.press(screen.getByTestId('home-go-pomodoro'));
    expect(mockPush).toHaveBeenCalledWith('/pomodoro');
  });

  test('today shows what is on now, a due task can be ticked off, a late pill can be taken', async () => {
    const { planner, tasks, pills, today } = setup();
    const n = new Date();
    // un evento che dura tutto il giorno «in corso»: comincia a mezzanotte e finisce a mezzanotte
    planner.create({ title: 'Long day', date: today, start: '00:00', end: '23:59' });
    const task = tasks.create({ title: 'Pay rent', due_date: today });
    pills.createPlan({
      name: 'Vitamin',
      dose: '1',
      notes: '',
      color: '#FF0000',
      freq_type: 'daily',
      weekdays: '1111111',
      month_days: '',
      interval_days: 1,
      times: '00:01',
      start_date: today,
      end_date: null,
      is_active: true,
    });
    const view = await renderIt();
    expect(n.getHours() * 60 + n.getMinutes()).toBeGreaterThan(1);
    expect(screen.getByText('Long day', { exact: false })).toBeTruthy();
    expect(screen.getByText('Pay rent')).toBeTruthy();
    // la pastiglia delle 00:01 è in ritardo
    const dose = pills.day(today).doses[0]!;
    await fireEvent.press(screen.getByTestId(`home-pill-take-${dose.uuid}`));
    expect(pills.day(today).doses[0]!.status).toBe('taken');
    await fireEvent.press(screen.getByTestId(`home-todo-${task}`));
    expect(tasks.get(task)!.is_done).toBe(1);
    expect(mockChanged).toHaveBeenCalled();
    await view.rerender(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );
    expect(screen.queryByText('Pay rent')).toBeNull();
    expect(screen.queryByTestId(`home-pill-take-${dose.uuid}`)).toBeNull();
  });

  test('projects widget lists favourites and opens one', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Thesis' })!;
    projects.create({ name: 'Other' });
    projects.update(a, { is_favorite: true });
    await renderIt();
    expect(screen.queryByText('Other')).toBeNull();
    await fireEvent.press(screen.getByTestId(`home-project-${a}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/project', params: { id: a } });
  });

  test('trivia is hidden until tapped; the answer then shows', async () => {
    setup();
    await renderIt();
    expect(screen.queryByTestId('home-trivia-answer')).toBeNull();
    await fireEvent.press(screen.getByTestId('home-trivia'));
    expect(screen.getByTestId('home-trivia-answer')).toBeTruthy();
  });

  test('customise: hide, move and reset save the layout', async () => {
    setup();
    const view = await renderIt();
    await fireEvent.press(screen.getByTestId('home-customise'));
    await fireEvent.press(screen.getByTestId('home-toggle-trivia'));
    expect(mockUpdateLayout).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ id: 'trivia', on: false }]),
    );
    const again = () =>
      view.rerender(
        <ThemeProvider>
          <HomeScreen />
        </ThemeProvider>,
      );
    await again();
    await fireEvent.press(screen.getByTestId('home-down-shortcuts'));
    expect(mockLayout.map((w) => w.id).slice(0, 2)).toEqual(['agenda', 'shortcuts']);
    await again();
    await fireEvent.press(screen.getByTestId('home-sc-right-tabsplanner'));
    const sc = mockLayout.find((w) => w.id === 'shortcuts')!;
    expect(sc.order?.slice(0, 2)).toEqual(['planner/todo.php', 'planner/planner.php']);
    await again();
    await fireEvent.press(screen.getByTestId('home-reset'));
    expect(mockLayout).toEqual(DEFAULT_HOME_LAYOUT);
    await fireEvent.press(screen.getByTestId('home-done'));
    await view.rerender(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('home-w-trivia')).toBeTruthy();
  });

  test('a widget switched off disappears', async () => {
    setup();
    mockLayout = DEFAULT_HOME_LAYOUT.map((w) => (w.id === 'trivia' ? { ...w, on: false } : w));
    await renderIt();
    expect(screen.queryByTestId('home-w-trivia')).toBeNull();
  });

  test('Quick card: save only the front for later, then finish it into a deck', async () => {
    const { db } = setup();
    const flash = (mockServices as { flashcards: FlashcardsRepo }).flashcards;
    const deck = flash.createDeck({ name: 'Biology' })!;
    await renderIt();
    await fireEvent.changeText(screen.getByTestId('draft-input'), 'mitochondria');
    await fireEvent.press(screen.getByTestId('draft-add'));
    expect(flash.drafts().map((d) => d.front)).toEqual(['mitochondria']);
    expect(screen.getByTestId('draft-saved')).toBeTruthy();
    await renderIt();
    const id = flash.drafts()[0].uuid;
    await fireEvent.press(screen.getAllByTestId(`draft-finish-${id}`)[0]);
    expect(screen.getByTestId('draft-sheet')).toBeTruthy();
    // senza retro non si salva
    await fireEvent.press(screen.getByTestId('draft-save'));
    expect(screen.getByTestId('draft-error')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('draft-back'), 'makes energy');
    await fireEvent.press(screen.getByText('Biology'));
    await fireEvent.press(screen.getByTestId('draft-save'));
    expect(flash.drafts()).toEqual([]);
    expect(flash.cards(deck).map((c) => c.answer_desc)).toEqual(['makes energy']);
    void db;
  });
});
