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
let mockDefaultNotify = 'h1';
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
      default_notify: mockDefaultNotify,
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
  // la scheda parte da «adesso»: si ferma l'orologio alle 9 così il risultato non dipende dall'ora in cui girano i test
  beforeEach(() =>
    jest.useFakeTimers({
      now: (() => {
        const d = new Date();
        d.setHours(9, 0, 0, 0);
        return d;
      })(),
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'hrtime',
      ],
    }),
  );
  afterEach(() => {
    jest.useRealTimers();
    mockDefaultNotify = 'h1';
  });

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

  test('the colour circle opens a list of named colours; the choice is saved as the event colour', async () => {
    const { planner } = setup();
    await open();
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Tinted');
    await fireEvent.press(screen.getByTestId('color-btn'));
    expect(screen.getByText('Coral')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('color-#F58C84'));
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.rows().find((r) => r.title === 'Tinted')!.color).toBe('#F58C84');
  });

  test('the first item of the colour list goes back to the category colour', async () => {
    const { planner } = setup();
    await open();
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Plain');
    await fireEvent.press(screen.getByTestId('color-btn'));
    await fireEvent.press(screen.getByTestId('color-#6DB6F2'));
    await fireEvent.press(screen.getByTestId('color-btn'));
    await fireEvent.press(screen.getByTestId('color-__base'));
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.rows().find((r) => r.title === 'Plain')!.color).toBeNull();
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

  test('the duration is a time field: picking 01:30 moves the end, no panel opens', async () => {
    setup();
    await open();
    expect(screen.queryByTestId('sheet-quick')).toBeNull();
    await fireEvent(
      screen.getByTestId('sheet-duration'),
      'valueChange',
      {},
      new Date(2026, 0, 1, 1, 30),
    );
    const at = (id: string) => new Date(screen.getByTestId(id).props.date as number).getTime();
    expect((at('sheet-end') - at('sheet-start')) / 60000).toBe(90);
  });

  test('a duration of 00:00 leaves the end where it was', async () => {
    setup();
    await open();
    const at = (id: string) => new Date(screen.getByTestId(id).props.date as number).getTime();
    const before = at('sheet-end');
    await fireEvent(
      screen.getByTestId('sheet-duration'),
      'valueChange',
      {},
      new Date(2026, 0, 1, 0, 0),
    );
    expect(at('sheet-end')).toBe(before);
  });

  test('dates read with a two-digit year and the sheet has no Type, Repeat or Notification titles', async () => {
    setup();
    await open();
    expect(screen.getAllByText(/^\p{L}{3}, \d{1,2} \p{L}{3} \d{2}$/u).length).toBe(2);
    expect(screen.queryByText(/^Type$/i)).toBeNull();
    expect(screen.queryByText(/^Repeat$/i)).toBeNull();
    expect(screen.queryByText(/^Notification$/i)).toBeNull();
  });

  test('the category menu has a "none" entry and the picks next to it follow the title', async () => {
    const { planner } = setup();
    const health = planner.addCategory('Health', '#C77D7D');
    const sport = planner.addCategory('Sport', '#A9C3AE');
    for (const t of ['Dentist visit', 'Dentist check', 'Dentist cleaning'])
      planner.create({ title: t, date: TODAY, categoryUuid: health });
    planner.create({ title: 'Gym chest', date: TODAY, categoryUuid: sport });
    await open();
    // the last saved category is always offered; the title adds its own suggestions
    expect(screen.getByTestId(`cat-${sport}`)).toBeTruthy();
    expect(screen.queryByTestId(`cat-${health}`)).toBeNull();
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Dentist again');
    expect(screen.getByTestId(`cat-${health}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`cat-${health}`));
    expect(screen.getByTestId(`cat-${health}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await fireEvent.press(screen.getByTestId('cat'));
    await fireEvent.press(screen.getByTestId('cat-__none'));
    expect(screen.getByTestId(`cat-${health}`).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  test('a new event starts with the default notification chosen in the settings', async () => {
    const { planner } = setup();
    mockDefaultNotify = 'at_time';
    await open();
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Soon');
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.rows().find((r) => r.title === 'Soon')).toMatchObject({
      notify_type: 'at_time',
    });
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
