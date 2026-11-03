import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { ProjectsRepo } from '@/features/projects/repo';

import { PomodoroBar } from '../PomodoroBar';
import { stamp } from '../logic';
import { PomodoroRepo } from '../repo';
import { DEFAULT_POMODORO_SETTINGS, type PomodoroSettings } from '../settings';

let mockServices: unknown;
let mockSettings: PomodoroSettings = DEFAULT_POMODORO_SETTINGS;
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: 0, pomodoroSettings: mockSettings }),
}));

function setup() {
  const db = memoryDb();
  migrate(db);
  const pomodoro = new PomodoroRepo(db, 7);
  mockServices = { pomodoro, projects: new ProjectsRepo(db) };
  mockSettings = DEFAULT_POMODORO_SETTINGS;
  return { pomodoro };
}
const bar = () =>
  render(
    <ThemeProvider>
      <PomodoroBar />
    </ThemeProvider>,
  );

describe('the running-timer bar', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    mockPush.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  test('shows nothing when nothing runs', async () => {
    setup();
    await bar();
    expect(screen.queryByTestId('pomodoro-bar')).toBeNull();
  });

  test('shows the countdown of a running pomodoro and opens the Pomodoro screen', async () => {
    const { pomodoro } = setup();
    pomodoro.start({ mode: 0, plannedMin: 25 });
    await bar();
    expect(screen.getByTestId('pomodoro-bar-clock').props.children).toMatch(/^(24:5\d|25:00)$/);
    await fireEvent.press(screen.getByTestId('pomodoro-bar'));
    expect(mockPush).toHaveBeenCalledWith('/pomodoro');
  });

  test('shows a stopwatch counting up, and a break counting down', async () => {
    const { pomodoro } = setup();
    const id = pomodoro.start({ mode: 1 })!;
    await bar();
    expect(screen.getByTestId('pomodoro-bar-clock').props.children).toBe('00:00');
    pomodoro.stop(id, true);
    mockSettings = {
      ...DEFAULT_POMODORO_SETTINGS,
      current_break: {
        start_time: stamp(new Date(Date.now() - 60000)),
        planned_duration_min: 5,
        project_uuid: null,
      },
    };
    await bar();
    expect(screen.getAllByTestId('pomodoro-bar-clock').pop()!.props.children).toMatch(
      /^0[34]:\d\d$/,
    );
  });
});
