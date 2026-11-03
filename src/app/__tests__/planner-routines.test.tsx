import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { upsertRow } from '@/core/sync/rows';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PlannerRepo } from '@/features/planner/repo';

import PlannerRoutines from '../planner-routines';

let mockServices: unknown;
let mockVersion = 0;
const mockBack = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ date: '2030-02-06' }),
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
  }),
}));

function setup() {
  const db = memoryDb();
  migrate(db);
  const repo = new PlannerRepo(db);
  upsertRow(db, 'planner_calendars', {
    uuid: 'cal-main',
    name: 'Main',
    color: null,
    is_visible: true,
    is_default: true,
    role: null,
    keywords: '',
    def_repeat: 'none',
    def_notify: 'none',
    sort_key: 'a0',
    created_at: null,
    updated_at: null,
  });
  mockServices = { db, planner: repo };
  return repo;
}
const renderIt = () =>
  render(
    <ThemeProvider>
      <PlannerRoutines />
    </ThemeProvider>,
  );

describe('Routines screen', () => {
  beforeEach(() => {
    mockVersion = 0;
    mockBack.mockClear();
    mockChanged.mockClear();
    jest.restoreAllMocks();
  });

  test('creates a routine with two steps', async () => {
    const repo = setup();
    await renderIt();
    expect(screen.getByTestId('routines-empty')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('routine-new'));
    await fireEvent.changeText(screen.getByTestId('routine-name'), 'Morning');
    await fireEvent.changeText(screen.getByTestId('step-name-0'), 'Shower');
    await fireEvent.changeText(screen.getByTestId('step-min-0'), '10');
    await fireEvent.press(screen.getByTestId('step-add'));
    await fireEvent.changeText(screen.getByTestId('step-name-1'), 'Breakfast');
    await fireEvent.changeText(screen.getByTestId('step-min-1'), '20');
    await fireEvent.press(screen.getByTestId('routine-save'));
    expect(repo.routines().map((r) => r.name)).toEqual(['Morning']);
    expect(repo.routineItems().map((i) => [i.name, i.duration_minutes])).toEqual([
      ['Shower', 10],
      ['Breakfast', 20],
    ]);
  });

  test('a routine without a name is not saved', async () => {
    const repo = setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderIt();
    await fireEvent.press(screen.getByTestId('routine-new'));
    await fireEvent.press(screen.getByTestId('routine-save'));
    expect(alert).toHaveBeenCalled();
    expect(repo.routines()).toEqual([]);
  });

  test('puts a routine in the chosen day at the chosen time', async () => {
    const repo = setup();
    const id = repo.saveRoutine({
      name: 'Morning',
      color: '#C6B6A6',
      items: [{ name: 'Shower', minutes: 10 }],
    })!;
    await renderIt();
    await fireEvent.press(screen.getByTestId(`routine-insert-${id}`));
    await fireEvent.changeText(screen.getByTestId('routine-start'), '6:30');
    await fireEvent.press(screen.getByTestId('routine-put'));
    expect(repo.rows().map((r) => [r.title, r.event_date, r.start_time])).toEqual([
      ['Shower', '2030-02-06', '06:30'],
    ]);
    expect(mockBack).toHaveBeenCalled();
  });

  test('a time that is not a time inserts nothing', async () => {
    const repo = setup();
    const id = repo.saveRoutine({
      name: 'Morning',
      color: '#C6B6A6',
      items: [{ name: 'Shower', minutes: 10 }],
    })!;
    await renderIt();
    await fireEvent.press(screen.getByTestId(`routine-insert-${id}`));
    await fireEvent.changeText(screen.getByTestId('routine-start'), '25:99');
    await fireEvent.press(screen.getByTestId('routine-put'));
    expect(repo.rows()).toHaveLength(0);
  });
});
