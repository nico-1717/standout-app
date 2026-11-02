import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { HabitCategoriesRepo, HabitsRepo } from '@/features/habits/repo';
import { localToday } from '@/features/tasks/groups';

import HabitsScreen from '../(tabs)/habits';

let mockServices: unknown;
let mockVersion = 0;
let mockHabitSettings = {
  ...jest.requireActual('@/features/habits/habitSettings').DEFAULT_HABIT_SETTINGS,
};
const mockChanged = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: () => {
      mockVersion++;
      mockChanged();
    },
    habitSettings: mockHabitSettings,
    updateHabitSettings: (patch: object) => {
      mockHabitSettings = { ...mockHabitSettings, ...patch };
      mockVersion++;
    },
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
  mockServices = { db, habits, habitCategories: new HabitCategoriesRepo(db) };
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
    // l'ordine dei gruppi è quello del sito: mattina, sera, poi «tutto il giorno»; gli altri tipi dopo
    expect(screen.getByText('🌅 MORNING')).toBeTruthy();
    expect(screen.getByText('🌆 EVENING')).toBeTruthy();
    expect(screen.getByText('WEEKLY')).toBeTruthy();
    expect(screen.getByText('0 of 2 completed')).toBeTruthy();
    expect(screen.getByTestId('hb-stats')).toBeTruthy();
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

  test('filters: a day part only shows when used; «To do» hides what is done', async () => {
    const { read } = setup();
    await renderIt();
    expect(screen.queryByTestId('filter-part:night')).toBeNull(); // nessuna abitudine di notte
    await fireEvent.press(screen.getByTestId('filter-part:morning'));
    expect(screen.queryByText('Read')).toBeNull();
    expect(screen.getByText('Drink water')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filter-all'));
    await fireEvent.press(screen.getByTestId(`habit-check-${read}`));
    await fireEvent.press(screen.getByTestId('filter-todo'));
    expect(screen.queryByText('Read')).toBeNull();
    expect(screen.getByText('Drink water')).toBeTruthy();
  });

  test('the header opens the Statistics and Table sheets', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('hb-stats'));
    expect(screen.getByTestId('stats-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancel'));
  });

  test('Settings: grouping can be turned off; archived habits can be restored', async () => {
    const { habits, read } = setup();
    habits.archive(read, true);
    await renderIt();
    expect(screen.queryByText('Read')).toBeNull();
    expect(screen.getByText('🌅 MORNING')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('hb-settings'));
    expect(screen.getByTestId('settings-sheet')).toBeTruthy();
    await fireEvent(screen.getByTestId('set-group_by_day_part'), 'valueChange', false);
    expect(mockHabitSettings.group_by_day_part).toBe(false);
    await fireEvent.press(screen.getByTestId('set-days-plus'));
    expect(mockHabitSettings.visible_days).toBe(12);
    await fireEvent.press(screen.getByTestId(`restore-${read}`));
    expect(habits.get(read)?.is_archived).toBe(0);
    mockHabitSettings = { ...mockHabitSettings, group_by_day_part: true, visible_days: 11 };
  });

  test('the Table sheet toggles a day and shows the 7/14/30 switch', async () => {
    const { habits, read } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('hb-table'));
    expect(screen.getByTestId('table-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`cell-${read}-${localToday()}`));
    expect(habits.log(read, localToday())).toMatchObject({ status: 'done' });
    await fireEvent.press(screen.getByTestId('table-span-7'));
    expect(screen.getByTestId(`cell-${read}-${localToday()}`)).toBeTruthy();
  });

  test('empty state when there are no habits', async () => {
    const db = memoryDb();
    migrate(db);
    mockServices = {
      db,
      habits: new HabitsRepo(db, undefined, undefined, localToday),
      habitCategories: new HabitCategoriesRepo(db),
    };
    await renderIt();
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });
});

describe('Habit form', () => {
  beforeEach(() => mockChanged.mockClear());

  test('the + button opens the form; a name is required', async () => {
    const db = memoryDb();
    migrate(db);
    const habits = new HabitsRepo(db, undefined, undefined, localToday);
    mockServices = { db, habits, habitCategories: new HabitCategoriesRepo(db) };
    await renderIt();
    await fireEvent.press(screen.getByTestId('habit-add'));
    expect(screen.getByText('New habit')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('habit-save'));
    expect(screen.getByText(/name is missing/i)).toBeTruthy();
    expect(habits.list()).toHaveLength(0);
  });

  test('creates a quantity habit with its options', async () => {
    const db = memoryDb();
    migrate(db);
    const habits = new HabitsRepo(db, undefined, undefined, localToday);
    mockServices = { db, habits, habitCategories: new HabitCategoriesRepo(db) };
    await renderIt();
    await fireEvent.press(screen.getByTestId('habit-add'));
    await fireEvent.changeText(screen.getByTestId('habit-name'), 'Walk');
    await fireEvent.press(screen.getByTestId('goal-quantity'));
    await fireEvent.changeText(screen.getByTestId('habit-unit'), 'km');
    await fireEvent.press(screen.getByTestId('target-plus')); // 1 → 1.5
    await fireEvent.press(screen.getByTestId('freq-weekly'));
    await fireEvent.press(screen.getByTestId('per-week-plus')); // 4 → 5
    await fireEvent.press(screen.getByTestId('part-morning'));
    await fireEvent.press(screen.getByTestId('habit-save'));
    expect(habits.list()).toHaveLength(1);
    expect(habits.list()[0]).toMatchObject({
      name: 'Walk',
      goal_type: 'quantity',
      target_amount: 1.5,
      unit: 'km',
      frequency_type: 'weekly',
      times_per_week: 5,
      day_part: 'morning',
    });
    expect(mockChanged).toHaveBeenCalled();
  });

  test('a ready-made habit fills the form', async () => {
    const db = memoryDb();
    migrate(db);
    const habits = new HabitsRepo(db, undefined, undefined, localToday);
    mockServices = { db, habits, habitCategories: new HabitCategoriesRepo(db) };
    await renderIt();
    await fireEvent.press(screen.getByTestId('habit-add'));
    await fireEvent.press(screen.getByTestId('from-preset'));
    await fireEvent.press(screen.getByTestId('preset-drink_water'));
    expect(screen.getByDisplayValue('Drink water')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('habit-save'));
    expect(habits.list()[0]).toMatchObject({
      preset_key: 'drink_water',
      goal_type: 'quantity',
      target_amount: 8,
    });
  });

  test('the icon picker changes the icon', async () => {
    const db = memoryDb();
    migrate(db);
    const habits = new HabitsRepo(db, undefined, undefined, localToday);
    mockServices = { db, habits, habitCategories: new HabitCategoriesRepo(db) };
    await renderIt();
    await fireEvent.press(screen.getByTestId('habit-add'));
    await fireEvent.press(screen.getByTestId('pick-icon'));
    await fireEvent.press(screen.getByTestId('icon-💧'));
    await fireEvent.changeText(screen.getByTestId('habit-name'), 'Water');
    await fireEvent.press(screen.getByTestId('habit-save'));
    expect(habits.list()[0]).toMatchObject({ icon: '💧' });
  });

  test('long press → Edit changes only what changed; Archive and Delete work', async () => {
    const { habits, read } = setup();
    await renderIt();
    await fireEvent(screen.getByTestId(`habit-row-${read}`), 'longPress');
    await fireEvent.press(screen.getByTestId('sheet-edit'));
    expect(screen.getByText('Edit habit')).toBeTruthy();
    await fireEvent.changeText(screen.getByDisplayValue('Read'), 'Read more');
    await fireEvent.press(screen.getByTestId('habit-save'));
    expect(habits.get(read)).toMatchObject({ name: 'Read more', day_part: 'evening' });

    await fireEvent(screen.getByTestId(`habit-row-${read}`), 'longPress');
    await fireEvent.press(screen.getByTestId('sheet-archive'));
    expect(habits.get(read)?.is_archived).toBe(1);
  });

  test('a habit starting later is kept out of the list and shown under "future"', async () => {
    const db = memoryDb();
    migrate(db);
    const habits = new HabitsRepo(db, undefined, undefined, localToday);
    habits.create({ name: 'Later', start_date: '2999-01-01' });
    habits.create({ name: 'Now' });
    mockServices = { db, habits, habitCategories: new HabitCategoriesRepo(db) };
    await renderIt();
    expect(screen.queryByText('Later')).toBeNull();
    expect(screen.getByText('Now')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('future-toggle'));
    expect(screen.getByText('Later')).toBeTruthy();
  });
});

describe('Habit detail and notes', () => {
  beforeEach(() => mockChanged.mockClear());

  test('tapping a row opens the detail with the numbers', async () => {
    const { read, habits } = setup();
    habits.checkIn(read, localToday(), 'toggle');
    await renderIt();
    await fireEvent.press(screen.getByTestId(`habit-row-${read}`));
    expect(screen.getByTestId('habit-detail')).toBeTruthy();
    expect(screen.getAllByText('CURRENT STREAK').length).toBeGreaterThan(0);
    expect(screen.getByText('BEST')).toBeTruthy();
    expect(screen.getByText('TOTAL CHECK-INS')).toBeTruthy();
    expect(screen.getByText('Undo today')).toBeTruthy(); // oggi è già fatta
    expect(
      screen.getByText('No notes yet. Press and hold a day in the calendar to write one.'),
    ).toBeTruthy();
  });

  test('a day in the calendar toggles the check-in', async () => {
    const { read, habits } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId(`habit-row-${read}`));
    await fireEvent.press(screen.getByTestId(`cal-${localToday()}`));
    expect(habits.log(read, localToday())).toMatchObject({ status: 'done' });
    await fireEvent.press(screen.getByTestId('detail-toggle')); // «Annulla oggi»
    expect(habits.log(read, localToday())).toBeNull();
  });

  test('writing a note with a mood saves it and the detail lists it', async () => {
    const { read, habits } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId(`habit-row-${read}`));
    await fireEvent.press(screen.getByTestId('detail-note'));
    await fireEvent.press(screen.getByTestId('mood-4'));
    await fireEvent.changeText(screen.getByTestId('note-text'), 'felt good');
    expect(screen.getByText('9 characters')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('note-save'));
    expect(habits.log(read, localToday())).toMatchObject({ note: 'felt good', mood: 4 });
    expect(screen.getByText('felt good')).toBeTruthy();
  });

  test('clearing a note removes it', async () => {
    const { read, habits } = setup();
    habits.setNote(read, localToday(), { note: 'old', mood: 2 });
    await renderIt();
    await fireEvent.press(screen.getByTestId(`habit-row-${read}`));
    await fireEvent.press(screen.getByTestId('detail-note'));
    expect(screen.getByDisplayValue('old')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('note-clear'));
    await fireEvent.press(screen.getByTestId('note-save'));
    expect(habits.log(read, localToday())).toBeNull();
  });

  test('Edit from the detail opens the form', async () => {
    const { read } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId(`habit-row-${read}`));
    await fireEvent.press(screen.getByTestId('detail-edit'));
    expect(screen.getByText('Edit habit')).toBeTruthy();
  });
});
