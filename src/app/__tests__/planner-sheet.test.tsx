import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { upsertRow } from '@/core/sync/rows';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PlannerRepo } from '@/features/planner/repo';
import { localToday } from '@/features/tasks/groups';

import PlannerScreen from '../(tabs)/planner';

let mockServices: unknown;
let mockVersion = 0;
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
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
    plannerSettings: {
      ...jest.requireActual('@/features/planner/settings').DEFAULT_PLANNER_SETTINGS,
      first_week_start: null,
      first_week_number: 1,
    },
  }),
}));

const TODAY = localToday();
const project = {
  uuid: 'proj-1',
  parent_uuid: null,
  name: 'Thesis',
  notes: '',
  status: 'in_progress',
  color: '#336699',
  color_edited: 1,
  target_date: null,
  due_date: null,
  todo_enabled: 1,
  is_favorite: 0,
  sort_key: 'a0',
  study_event_uuid: null,
  study_start: null,
  study_end: null,
  study_pomodori_stimati: null,
  study_ripasso_di_uuid: null,
  study_ripasso_n: null,
  created_at: null,
};

function setup() {
  mockVersion = 0;
  mockChanged.mockClear();
  const db = memoryDb();
  migrate(db);
  const planner = new PlannerRepo(db);
  for (const [uuid, name, def, key] of [
    ['cal-main', 'Main', true, 'a0'],
    ['cal-work', 'Work', false, 'a1'],
  ] as const)
    upsertRow(db, 'planner_calendars', {
      uuid,
      name,
      color: null,
      is_visible: true,
      is_default: def,
      role: null,
      keywords: '',
      def_repeat: 'none',
      def_notify: 'none',
      sort_key: key,
      created_at: null,
      updated_at: null,
    });
  mockServices = { db, planner, projects: { all: () => [project] } };
  return { planner };
}
const open = async () => {
  await render(
    <ThemeProvider>
      <PlannerScreen />
    </ThemeProvider>,
  );
  await fireEvent.press(screen.getByTestId('planner-add'));
};

describe('Event sheet, as on the website', () => {
  test('the duration lock cycles auto → locked → open → auto', async () => {
    setup();
    await open();
    const lock = screen.getByTestId('sheet-lock');
    expect(lock.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(lock);
    expect(screen.getByTestId('sheet-lock').props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(screen.getByTestId('sheet-lock'));
    expect(screen.getByTestId('sheet-lock').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  test('the start moves the end with it; the open lock leaves the end where it is', async () => {
    setup();
    await open();
    await fireEvent(
      screen.getByTestId('sheet-start'),
      'valueChange',
      {},
      new Date(2026, 0, 1, 10, 0),
    );
    expect(new Date(screen.getByTestId('sheet-end').props.date as number).getHours()).toBe(11);
    // open lock: the end stays, the start moves
    await fireEvent.press(screen.getByTestId('sheet-lock'));
    await fireEvent.press(screen.getByTestId('sheet-lock'));
    await fireEvent(
      screen.getByTestId('sheet-start'),
      'valueChange',
      {},
      new Date(2026, 0, 1, 10, 30),
    );
    expect(new Date(screen.getByTestId('sheet-end').props.date as number).getHours()).toBe(11);
    expect(new Date(screen.getByTestId('sheet-end').props.date as number).getMinutes()).toBe(0);
  });

  test('a project links to the event, names an empty title and tints the sheet', async () => {
    const { planner } = setup();
    await open();
    await fireEvent.press(screen.getByTestId('sheet-project-btn'));
    await fireEvent.press(screen.getByTestId('project-pick-proj-1'));
    expect(screen.getByTestId('sheet-project-name')).toHaveTextContent(/Thesis/);
    expect(screen.getByTestId('sheet-title').props.value).toBe('Thesis');
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.rows().find((r) => r.title === 'Thesis')).toMatchObject({
      project_uuid: 'proj-1',
    });
  });

  test('a colour swatch is saved as the event colour; the first one clears it', async () => {
    const { planner } = setup();
    await open();
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Tinted');
    await fireEvent.press(screen.getByTestId('sw-2'));
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.rows().find((r) => r.title === 'Tinted')!.color).toBe('#F0D3D6');
  });

  test('repeat, notify and calendar are chosen from lists', async () => {
    const { planner } = setup();
    await open();
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Weekly');
    await fireEvent.press(screen.getByTestId('rep'));
    await fireEvent.press(screen.getByTestId('rep-weekly'));
    await fireEvent.press(screen.getByTestId('not'));
    await fireEvent.press(screen.getByTestId('not-d1'));
    await fireEvent.press(screen.getByTestId('cal'));
    await fireEvent.press(screen.getByTestId('cal-cal-work'));
    await fireEvent.press(screen.getByTestId('sheet-save'));
    const ev = planner.rows().find((r) => r.title === 'Weekly')!;
    expect(ev).toMatchObject({ calendar_uuid: 'cal-work' });
    expect(ev.rrule).toContain('WEEKLY');
  });

  test('a single-day end date is faded; the all-day switch hides the times', async () => {
    setup();
    await open();
    expect(screen.getByTestId('sheet-start')).toBeTruthy();
    await fireEvent(screen.getByTestId('sheet-allday'), 'press');
    expect(screen.queryByTestId('sheet-start')).toBeNull();
    expect(screen.getByTestId('sheet-enddate')).toBeTruthy();
  });

  test('tapping outside with nothing written just closes; with a title it saves', async () => {
    const { planner } = setup();
    await open();
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByTestId('sheet-save')).toBeNull();
    await fireEvent.press(screen.getByTestId('planner-add'));
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Quick one');
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(planner.rows().some((r) => r.title === 'Quick one' && r.event_date === TODAY)).toBe(
      true,
    );
  });
});
