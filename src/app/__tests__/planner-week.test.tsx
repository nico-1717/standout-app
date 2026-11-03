import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { DiaryRepo } from '@/features/diary/repo';
import { PillsRepo } from '@/features/pills/repo';
import { PlannerRepo } from '@/features/planner/repo';
import { localToday } from '@/features/tasks/groups';
import { TasksRepo } from '@/features/tasks/repo';

import PlannerWeek from '../planner-week';

let mockServices: unknown;
let mockVersion = 0;
let mockDate = '2030-02-06';
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ date: mockDate }),
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
    plannerSettings: { first_week_start: '2030-01-28', first_week_number: 1 },
  }),
}));

function setup() {
  const db = memoryDb();
  migrate(db);
  const tasks = new TasksRepo(db);
  const planner = new PlannerRepo(db, undefined, undefined, undefined, 7);
  const pills = new PillsRepo(
    db,
    () => localToday(),
    () => `${localToday()} 10:00:00`,
  );
  const diary = new DiaryRepo(db, 7);
  mockServices = { db, tasks, planner, pills, diary };
  return { tasks, planner, pills, diary };
}
const renderIt = () =>
  render(
    <ThemeProvider>
      <PlannerWeek />
    </ThemeProvider>,
  );

beforeEach(() => {
  mockVersion = 0;
  mockDate = '2030-02-06';
  mockBack.mockClear();
  mockPush.mockClear();
});

describe('the week panel', () => {
  test('shows the week number and saves a number written by hand', async () => {
    const { planner } = setup();
    await renderIt();
    expect(screen.getByTestId('wk-number').props.value).toBe('2');
    await fireEvent.changeText(screen.getByTestId('wk-number'), '40');
    await fireEvent(screen.getByTestId('wk-number'), 'submitEditing');
    expect(planner.weekRow('2030-02-04')).toMatchObject({ week_number: 40, number_edited: 1 });
  });

  test('lists the tasks of the week, the ones left behind, and adds one on the day in focus', async () => {
    const { tasks } = setup();
    tasks.create({ title: 'In week', due_date: '2030-02-07' });
    tasks.create({ title: 'Old one', due_date: '2030-01-30' });
    tasks.create({ title: 'Later one', due_date: '2030-03-01' });
    tasks.create({ title: 'No date' });
    tasks.create({ title: 'Milk' }, { listType: 'buy' });
    await renderIt();
    expect(screen.getByText('In week')).toBeTruthy();
    expect(screen.getByText('Old one')).toBeTruthy();
    expect(screen.queryByText('Later one')).toBeNull();
    await fireEvent.press(screen.getByTestId('wk-others'));
    expect(screen.getByText('Later one')).toBeTruthy();
    expect(screen.getByText('No date')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('wk-add-input'), 'Call mum');
    await fireEvent.press(screen.getByTestId('wk-add'));
    expect(tasks.list('todo').find((x) => x.title === 'Call mum')?.due_date).toBe('2030-02-06');
    expect(mockChanged).toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('wk-tab-buy'));
    expect(screen.queryByText('In week')).toBeNull();
  });

  test('ticks a task', async () => {
    const { tasks } = setup();
    const id = tasks.create({ title: 'In week', due_date: '2030-02-07' });
    await renderIt();
    await fireEvent.press(screen.getByTestId(`wk-task-check-${id}`));
    expect(tasks.get(id)?.is_done).toBe(1);
  });

  test('shows the pills of the day and ticks one', async () => {
    const { pills } = setup();
    mockDate = localToday();
    pills.createPlan({
      name: 'Vitamin D',
      dose: '1 pill',
      notes: '',
      color: '#3B82F6',
      freq_type: 'daily',
      weekdays: '1111111',
      month_days: '',
      interval_days: 1,
      times: '08:00',
      start_date: localToday(),
      end_date: null,
      is_active: true,
    });
    await renderIt();
    await fireEvent.press(screen.getByTestId('wk-tab-pills'));
    const dose = pills.day(localToday()).doses[0]!;
    expect(screen.getByText('Vitamin D  ·  1 pill')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`wk-dose-check-${dose.uuid}`));
    expect(pills.dose(dose.uuid)?.status).toBe('taken');
  });

  test('keeps the diary covered until you press show, and the cover is not the real text', async () => {
    const { diary } = setup();
    diary.setNote('2030-02-06', 'Secret thoughts');
    await renderIt();
    expect(screen.queryByText('Secret thoughts')).toBeNull();
    expect(screen.getByTestId('wk-diary-fake')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wk-diary-show'));
    expect(screen.getByText('Secret thoughts')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wk-diary-open'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/diary', params: { data: '2030-02-06' } });
    await fireEvent.press(screen.getByTestId('wk-diary-hide'));
    expect(screen.queryByText('Secret thoughts')).toBeNull();
  });
});
