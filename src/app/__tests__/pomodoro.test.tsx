import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PomodoroRepo } from '@/features/pomodoro/repo';
import { DEFAULT_POMODORO_SETTINGS, type PomodoroSettings } from '@/features/pomodoro/settings';
import { ProjectsRepo } from '@/features/projects/repo';
import { upsertRow } from '@/core/sync/rows';
import { stamp } from '@/features/pomodoro/logic';

import PomodoroScreen from '../pomodoro';

let mockServices: unknown;
let mockVersion = 0;
let mockSettings: PomodoroSettings = DEFAULT_POMODORO_SETTINGS;
const mockBack = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});
const mockUpdate = jest.fn((patch: Partial<PomodoroSettings>) => {
  mockSettings = { ...mockSettings, ...patch };
  mockVersion += 1;
});

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/pomodoro/alarm', () => ({
  scheduleAlarm: jest.fn(async () => undefined),
  cancelAlarm: jest.fn(async () => undefined),
}));
jest.mock('@/features/reminders/notifier', () => ({ askPermission: jest.fn(async () => true) }));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    pomodoroSettings: mockSettings,
    updatePomodoroSettings: mockUpdate,
  }),
}));

function setup() {
  mockVersion = 0;
  mockParams = {};
  mockSettings = DEFAULT_POMODORO_SETTINGS;
  const db = memoryDb();
  migrate(db);
  const pomodoro = new PomodoroRepo(db, 7);
  const projects = new ProjectsRepo(db);
  mockServices = { db, pomodoro, projects };
  return { db, pomodoro, projects };
}
const renderIt = () =>
  render(
    <ThemeProvider>
      <PomodoroScreen />
    </ThemeProvider>,
  );

describe('Pomodoro screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['Date'] });
  });
  afterEach(() => jest.useRealTimers());

  test('coming from the Plan with min and auto, a timer of that length starts by itself, once', async () => {
    const { pomodoro, projects } = setup();
    const a = projects.create({ name: 'Podcast' })!;
    mockParams = { project: a, min: '10', auto: '1' };
    await renderIt();
    const s = pomodoro.active();
    expect(s).toMatchObject({ project_uuid: a, planned_duration_min: 10, mode: 0 });
    expect(mockUpdate).toHaveBeenCalledWith({ last_mode: 0, last_pomodoro_duration_min: 10 });
  });

  test('coming from the Plan with only min, the length is set but nothing starts', async () => {
    const { pomodoro, projects } = setup();
    const a = projects.create({ name: 'Analisi' })!;
    mockParams = { project: a, min: '40' };
    await renderIt();
    expect(pomodoro.active()).toBeNull();
    expect(screen.getByTestId('pomodoro-start')).toBeTruthy();
  });

  test('starts a 50 minute pomodoro on a project, remembers the choice, pauses and resumes', async () => {
    const { pomodoro, projects } = setup();
    const proj = projects.create({ name: 'Maths' })!;
    const view = await renderIt();
    await fireEvent.press(screen.getByTestId('dur-pomodoro-50'));
    await fireEvent.press(screen.getByTestId('pick-project'));
    await fireEvent.press(screen.getByTestId(`project-pick-${proj}`));
    await fireEvent.press(screen.getByTestId('pomodoro-start'));
    const s = pomodoro.active()!;
    expect(s).toMatchObject({ mode: 0, planned_duration_min: 50, project_uuid: proj });
    expect(mockUpdate).toHaveBeenCalledWith({ last_mode: 0, last_pomodoro_duration_min: 50 });
    await view.rerender(
      <ThemeProvider>
        <PomodoroScreen />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('pomodoro-clock').props.children).toMatch(/^(49:5\d|50:00)$/);
    await fireEvent.press(screen.getByTestId('pomodoro-pause'));
    expect(pomodoro.active()!.status).toBe('pausa');
    await view.rerender(
      <ThemeProvider>
        <PomodoroScreen />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('pomodoro-resume'));
    expect(pomodoro.active()!.status).toBeNull();
  });

  test('opening it from a project starts on that project', async () => {
    const { pomodoro, projects } = setup();
    const proj = projects.create({ name: 'Maths' })!;
    mockParams = { project: proj };
    await renderIt();
    await fireEvent.press(screen.getByTestId('pomodoro-start'));
    expect(pomodoro.active()).toMatchObject({ project_uuid: proj });
  });

  test('a stopwatch can start with no project', async () => {
    const { pomodoro } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('mode-1'));
    await fireEvent.press(screen.getByTestId('pomodoro-start'));
    expect(pomodoro.active()).toMatchObject({ mode: 1, planned_duration_min: null });
    expect(mockUpdate).toHaveBeenCalledWith({ last_mode: 1 });
  });

  test('stopping a very short session asks first: save keeps it, discard removes it', async () => {
    const { pomodoro } = setup();
    const id = pomodoro.start({ mode: 1 })!;
    const view = await renderIt();
    await fireEvent.press(screen.getByTestId('pomodoro-stop'));
    await fireEvent.press(screen.getByTestId('stop-end'));
    expect(screen.getByTestId('short-save')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('short-save'));
    expect(pomodoro.get(id)).toMatchObject({ status: 'interrotto' });

    const id2 = pomodoro.start({ mode: 1 })!;
    mockVersion += 1;
    await view.rerender(
      <ThemeProvider>
        <PomodoroScreen />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('pomodoro-stop'));
    await fireEvent.press(screen.getByTestId('stop-end'));
    await fireEvent.press(screen.getByTestId('short-discard'));
    expect(pomodoro.get(id2)).toBeNull();
  });

  test('a long session stops straight into a break', async () => {
    const { db, pomodoro } = setup();
    const startedAt = stamp(new Date(Date.now() - 30 * 60000));
    upsertRow(db, 'pomodoro_sessions', {
      uuid: 's1',
      mode: 1,
      start_time: startedAt,
      end_time: null,
      status: null,
      resume_time: null,
      duration_seconds: 0,
      planned_duration_min: null,
      project_uuid: null,
      is_manual: 0,
      updated_at: null,
    });
    await renderIt();
    await fireEvent.press(screen.getByTestId('pomodoro-stop'));
    await fireEvent.press(screen.getByTestId('stop-break'));
    expect(pomodoro.get('s1')).toMatchObject({ status: 'interrotto' });
    expect(mockSettings.current_break).toMatchObject({ planned_duration_min: 5 });
  });

  test('a finished pomodoro offers a break, more time, or to close it', async () => {
    const { db, pomodoro } = setup();
    upsertRow(db, 'pomodoro_sessions', {
      uuid: 's2',
      mode: 0,
      start_time: '2030-01-01 10:00:00',
      end_time: '2030-01-01 10:25:00',
      status: 'completato',
      resume_time: null,
      duration_seconds: 1500,
      planned_duration_min: 25,
      project_uuid: null,
      is_manual: 0,
      updated_at: null,
    });
    await renderIt();
    expect(screen.getByTestId('pomodoro-clock').props.children).toBe('25:00');
    await fireEvent.press(screen.getByTestId('done-close'));
    expect(pomodoro.get('s2')!.status).toBe('archiviato');
  });

  test('a break counts down and can be ended', async () => {
    setup();
    mockSettings = {
      ...DEFAULT_POMODORO_SETTINGS,
      current_break: {
        start_time: stamp(new Date(Date.now() - 60000)),
        planned_duration_min: 5,
        project_uuid: null,
      },
    };
    await renderIt();
    expect(screen.getByTestId('pomodoro-clock').props.children).toMatch(/^0[34]:\d\d$/);
    await fireEvent.press(screen.getByTestId('break-end'));
    expect(mockUpdate).toHaveBeenCalledWith({ current_break: null });
  });

  test('saves a custom duration and deletes it again', async () => {
    const { pomodoro } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('dur-add-pomodoro'));
    await fireEvent.changeText(screen.getByTestId('dur-input'), '40');
    await fireEvent.press(screen.getByTestId('dur-save'));
    expect(pomodoro.presets('pomodoro')).toEqual([25, 40, 50]);
    await fireEvent.press(screen.getByTestId('dur-manage'));
    await fireEvent.press(screen.getByTestId('dur-del-pomodoro-40'));
    expect(pomodoro.presets('pomodoro')).toEqual([25, 50]);
  });
});
