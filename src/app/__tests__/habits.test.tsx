import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { HabitsRepo } from '@/features/habits/repo';
import { localToday } from '@/features/tasks/groups';

import HabitsScreen from '../(tabs)/habits';

let mockServices: unknown;
const mockChanged = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: 0,
    changed: mockChanged,
    uiStyle: 'standard',
    syncInfo: { status: 'idle', lastSyncAt: null, pending: 0 },
  }),
}));

function setup() {
  const db = memoryDb();
  migrate(db);
  const habits = new HabitsRepo(db, undefined, undefined, localToday);
  const water = habits.create({
    name: 'Drink water',
    icon: '💧',
    goal_type: 'quantity',
    target_amount: 2,
    step_amount: 1,
    unit: 'glasses',
    day_part: 'morning',
  });
  const read = habits.create({ name: 'Read', day_part: 'evening' });
  const run = habits.create({ name: 'Long run', frequency_type: 'weekly', times_per_week: 2 });
  mockServices = { db, habits };
  return { habits, water, read, run };
}

const renderIt = () =>
  render(
    <ThemeProvider>
      <HabitsScreen />
    </ThemeProvider>,
  );

describe('Habits screen', () => {
  beforeEach(() => mockChanged.mockClear());

  test('shows daily habits grouped by time of day, and weekly ones in their own section', async () => {
    setup();
    await renderIt();
    expect(screen.getByText('Drink water')).toBeTruthy();
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('Long run')).toBeTruthy();
    expect(screen.getByText('MORNING')).toBeTruthy();
    expect(screen.getByText('EVENING')).toBeTruthy();
    expect(screen.getAllByText('0/2')).toHaveLength(2); // acqua (0 di 2 bicchieri) + anello settimanale
    expect(screen.getByText('0%')).toBeTruthy();
  });

  test('a tap checks in; the Today card follows', async () => {
    const { habits, read, water } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId(`habit-check-${read}`));
    expect(habits.log(read, localToday())).toMatchObject({ status: 'done', amount: 1 });
    expect(mockChanged).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(`habit-check-${water}`));
    expect(habits.log(water, localToday())).toMatchObject({ status: 'partial', amount: 1 });
    await fireEvent.press(screen.getByTestId(`habit-check-${water}`));
    expect(habits.log(water, localToday())).toMatchObject({ status: 'done', amount: 2 });
  });

  test('long press opens the sheet: skip, then un-skip', async () => {
    const { habits, read } = setup();
    await renderIt();
    await fireEvent(screen.getByTestId(`habit-row-${read}`), 'longPress');
    await fireEvent.press(screen.getByTestId('sheet-skip'));
    expect(habits.log(read, localToday())).toMatchObject({ status: 'skipped' });
  });

  test('filter chips hide the other kinds', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('filter-weekly'));
    expect(screen.queryByText('Read')).toBeNull();
    expect(screen.getByText('Long run')).toBeTruthy();
  });

  test('empty state when there are no habits', async () => {
    const db = memoryDb();
    migrate(db);
    mockServices = { db, habits: new HabitsRepo(db, undefined, undefined, localToday) };
    await renderIt();
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });
});
