import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import i18n from '@/core/i18n';
import { upsertRow } from '@/core/sync/rows';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { addDaysIso, addMonths, mondayOf } from '@/features/planner/dates';
import { weekPhraseId } from '@/features/planner/phrases';
import { PlannerRepo } from '@/features/planner/repo';
import { localToday } from '@/features/tasks/groups';

import PlannerScreen from '../(tabs)/planner';

let mockStyle: 'standard' | 'paper' = 'standard';
let mockServices: unknown;
let mockVersion = 0;
let mockZoom = 'm30';
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

const mockPush = jest.fn();
const mockUpdateSettings = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    updatePlannerSettings: mockUpdateSettings,
    uiStyle: mockStyle,
    authState: { status: 'signedIn', user: { id: 7 } },
    plannerSettings: {
      ...jest.requireActual('@/features/planner/settings').DEFAULT_PLANNER_SETTINGS,
      first_week_start: null,
      first_week_number: 1,
      zoom: mockZoom,
    },
  }),
}));

const TODAY = localToday();

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
const pickView = async (v: 'day' | 'week' | 'month') => {
  await fireEvent.press(screen.getByTestId('planner-view'));
  await fireEvent.press(screen.getByTestId(`mode-${v}`));
};
/** Apre il calendarietto e va a un giorno (`planner-mini` → `mini-<data>`). */
const goTo = async (iso: string) => {
  await fireEvent.press(screen.getByTestId('planner-mini'));
  await fireEvent.press(screen.getByTestId(`mini-${iso}`));
};
const renderIt = () =>
  render(
    <ThemeProvider>
      <PlannerScreen />
    </ThemeProvider>,
  );

describe.each(['standard', 'paper'] as const)('Planner day screen (%s)', (style) => {
  beforeEach(() => {
    mockStyle = style;
    mockVersion = 0;
    mockZoom = 'm30';
    mockUpdateSettings.mockClear();
    mockChanged.mockClear();
    jest.restoreAllMocks();
  });

  test('the month picture is drawn behind the header in the paper style only', async () => {
    setup();
    await renderIt();
    const scene = screen.queryByTestId('month-scene', { includeHiddenElements: true });
    if (style === 'paper') expect(scene).toBeTruthy();
    else expect(scene).toBeNull();
  });

  test('an empty day says so, and shows today in the title', async () => {
    setup();
    await renderIt();
    expect(screen.getByTestId('day-empty')).toBeTruthy();
    expect(screen.getByTestId('day-title')).toHaveTextContent(String(Number(TODAY.slice(8))));
  });

  test("shows the week's affirmation on top and the motivational quote at the bottom", async () => {
    setup();
    await renderIt();
    const monday = mondayOf(TODAY);
    const aff = i18n.t(`planner.fr_${weekPhraseId('affirmations', monday, 7)}`);
    const quote = i18n.t(`planner.fr_${weekPhraseId('quotes', monday, 7)}`);
    expect(aff).not.toMatch(/^<</);
    expect(screen.getByTestId('week-affirmation')).toHaveTextContent(aff);
    expect(screen.getByTestId('week-quote')).toHaveTextContent(quote);
  });

  test('shows the events of the day, with the all-day ones in the band', async () => {
    const repo = setup();
    repo.create({ title: 'Dentist', date: TODAY, start: '15:00', end: '16:00' });
    repo.create({ title: 'Holiday', date: TODAY, allDay: true });
    const id = repo.rows().find((r) => r.title === 'Dentist')!.uuid;
    await renderIt();
    expect(screen.getByTestId(`ev-${id}@${TODAY}`)).toBeTruthy();
    expect(screen.getByText('Holiday')).toBeTruthy();
    expect(screen.queryByTestId('day-empty')).toBeNull();
  });

  test('search: finds an event on another day, tapping it jumps there', async () => {
    const repo = setup();
    const far = new Date(Date.now() + 9 * 86_400_000);
    const farIso = `${far.getFullYear()}-${String(far.getMonth() + 1).padStart(2, '0')}-${String(far.getDate()).padStart(2, '0')}`;
    const id = repo.create({ title: 'Dentist', date: farIso, start: '15:00', end: '16:00' });
    await renderIt();
    expect(screen.queryByTestId(`ev-${id}@${farIso}`)).toBeNull(); // oggi non c'è nulla
    await fireEvent.press(screen.getByTestId('planner-search'));
    await fireEvent.changeText(screen.getByTestId('search-input'), 'x');
    expect(screen.queryByTestId('search-empty')).toBeNull(); // meno di 2 lettere: ancora niente
    await fireEvent.changeText(screen.getByTestId('search-input'), 'zzz');
    expect(screen.getByTestId('search-empty')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'dent');
    await fireEvent.press(screen.getByTestId(`search-hit-${id}`));
    expect(screen.getByTestId(`ev-${id}@${farIso}`)).toBeTruthy();
  });

  test('+ opens the sheet, saving creates the event', async () => {
    const repo = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('planner-add'));
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Coffee with Anna');
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(repo.rows().map((r) => r.title)).toEqual(['Coffee with Anna']);
    expect(mockChanged).toHaveBeenCalled();
  });

  test('tapping an event opens it, a change is saved', async () => {
    const repo = setup();
    const id = repo.create({ title: 'Dentist', date: TODAY, start: '15:00', end: '16:00' });
    await renderIt();
    await fireEvent.press(screen.getByTestId(`ev-${id}@${TODAY}`));
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Dentist (new time)');
    await fireEvent.press(screen.getByTestId('imp-high'));
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(repo.row(id)).toMatchObject({ title: 'Dentist (new time)', importance: 'high' });
  });

  test('a long press holds an event (the page stops scrolling); letting go without moving changes nothing', async () => {
    const repo = setup();
    const id = repo.create({ title: 'Dentist', date: TODAY, start: '15:00', end: '16:00' });
    await renderIt();
    const block = screen.getByTestId(`ev-${id}@${TODAY}`);
    expect(screen.getByTestId('day-scroll').props.scrollEnabled).toBe(true);
    await fireEvent(block, 'longPress');
    expect(screen.getByTestId('day-scroll').props.scrollEnabled).toBe(false);
    await fireEvent(block, 'pressOut');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId('day-scroll').props.scrollEnabled).toBe(true);
    expect(repo.row(id)).toMatchObject({ start_time: '15:00', end_time: '16:00' });
  });

  test('a task has a box: ticking it marks it done', async () => {
    const repo = setup();
    const id = repo.create({
      title: 'Send form',
      date: TODAY,
      type: 'task',
      start: '11:00',
      end: '11:30',
    });
    await renderIt();
    await fireEvent.press(screen.getByTestId(`box-${id}@${TODAY}`));
    expect(repo.row(id)!.is_completed).toBe(1);
  });

  test('deleting asks first', async () => {
    const repo = setup();
    const id = repo.create({ title: 'Gone', date: TODAY });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderIt();
    await fireEvent.press(screen.getByTestId(`ev-${id}@${TODAY}`));
    await fireEvent.press(screen.getByTestId('sheet-delete'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(repo.row(id)).not.toBeNull();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((b) => b.style === 'destructive')!.onPress!());
    expect(repo.row(id)).toBeNull();
  });

  test('editing one time of a series asks which, and "just this one" makes an exception', async () => {
    const repo = setup();
    repo.create({ title: 'Gym', date: TODAY, repeat: 'weekly' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderIt();
    const master = repo.rows()[0]!.uuid;
    await fireEvent.press(screen.getByTestId(`ev-${master}@${TODAY}`));
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Gym (today)');
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((b) => b.text === 'Just this one')!.onPress!());
    expect(repo.rows()).toHaveLength(2);
    expect(repo.row(master)!.title).toBe('Gym');
  });

  test('the month calendar moves between days and the date tile comes back to today', async () => {
    setup();
    await renderIt();
    const other = addDaysIso(TODAY, 1);
    await goTo(other);
    expect(screen.queryByTestId('month-popup')).toBeNull();
    expect(screen.getByTestId('day-title')).toHaveTextContent(String(Number(other.slice(8))));
    await fireEvent.press(screen.getByTestId('planner-today'));
    expect(screen.getByTestId('day-title')).toHaveTextContent(String(Number(TODAY.slice(8))));
  });
  test('week and month views list the events and open the day on tap', async () => {
    const repo = setup();
    repo.create({ title: 'Dentist', date: TODAY, start: '15:00', end: '16:00' });
    await renderIt();
    await pickView('week');
    expect(screen.getByTestId('week-view')).toBeTruthy();
    expect(screen.getByText('Dentist')).toBeTruthy();
    await pickView('month');
    expect(screen.getByTestId('month-view')).toBeTruthy();
    expect(screen.getByText('Dentist')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`month-day-${TODAY}`));
    expect(screen.getByTestId('day-scroll')).toBeTruthy();
  });

  test('week grid: tapping a day header opens that day, tapping a column opens a new event at that hour', async () => {
    setup();
    await renderIt();
    await pickView('week');
    const tomorrow = addDaysIso(TODAY, 1);
    await fireEvent.press(screen.getByTestId(`week-head-${tomorrow}`));
    expect(screen.getByTestId('day-title')).toHaveTextContent(String(Number(tomorrow.slice(8))));
    expect(screen.getByTestId('day-scroll')).toBeTruthy();
    await pickView('week');
    await fireEvent.press(screen.getByTestId(`week-col-${TODAY}`));
    expect(screen.getByTestId('sheet-title')).toBeTruthy();
  });

  test('month: the pull handle lists the next events, a day name goes to that day, the chips jump to a month', async () => {
    const repo = setup();
    const later = addDaysIso(TODAY, 2);
    repo.create({ title: 'Dentist', date: later, start: '15:00', end: '16:00' });
    await renderIt();
    await pickView('month');
    await fireEvent.press(screen.getByTestId('month-pull'));
    expect(screen.getByTestId('month-agenda')).toBeTruthy();
    expect(screen.getByTestId(`agenda-go-${later}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('agenda-close'));
    expect(screen.queryByTestId('month-agenda')).toBeNull();
    await fireEvent.press(screen.getByTestId('month-pull'));
    await fireEvent.press(screen.getByTestId(`agenda-go-${later}`));
    expect(screen.getByTestId('day-title')).toHaveTextContent(String(Number(later.slice(8))));
    await pickView('month');
    await fireEvent.press(screen.getByTestId('planner-month-name'));
    const next = addMonths(TODAY, 1).slice(0, 7);
    await fireEvent.press(screen.getByTestId(`month-chip-${next}`));
    expect(screen.queryByTestId('months-bar')).toBeNull();
    expect(screen.getByTestId(`month-day-${next}-15`)).toBeTruthy();
  });

  test('picking a day of another week in week view shows that week', async () => {
    setup();
    await renderIt();
    await pickView('week');
    const week = Array.from({ length: 7 }, (_, i) => addDaysIso(mondayOf(TODAY), i));
    await fireEvent.press(screen.getByTestId('planner-mini'));
    const cell = screen
      .getAllByTestId(/^mini-\d{4}-/)
      .find((c) => !week.includes(String(c.props.testID).slice(5)))!;
    await fireEvent.press(cell);
    expect(screen.getByTestId('week-view')).toBeTruthy();
    expect(screen.queryByTestId(`week-day-${TODAY}`)).toBeNull();
  });

  test('priorities: add one, tick it, and it stays after a refresh', async () => {
    const repo = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('priority-add'));
    await fireEvent.press(screen.getByTestId('priority-empty'));
    await fireEvent.changeText(screen.getByTestId('priority-new'), 'Study maths');
    await fireEvent(screen.getByTestId('priority-new'), 'submitEditing');
    expect(repo.priorities(TODAY).map((p) => p.content)).toEqual(['Study maths']);
    await fireEvent.press(screen.getByTestId('priority-close'));
    await screen.rerender(
      <ThemeProvider>
        <PlannerScreen />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('priority-1')).toHaveTextContent('Study maths');
    await fireEvent.press(screen.getByTestId('priority-box-1'));
    expect(repo.priorities(TODAY)[0]!.is_done).toBe(1);
  });

  test('the side buttons open routines and categories, the arrow hides them, the avatar opens the account', async () => {
    setup();
    mockPush.mockClear();
    mockUpdateSettings.mockClear();
    await renderIt();
    await fireEvent.press(screen.getByTestId('fab-routine'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/planner-routines',
      params: { date: TODAY },
    });
    await fireEvent.press(screen.getByTestId('fab-category'));
    expect(mockPush).toHaveBeenLastCalledWith('/planner-manage');
    await fireEvent.press(screen.getByTestId('planner-avatar'));
    expect(mockPush).toHaveBeenLastCalledWith('/account');
    await fireEvent.press(screen.getByTestId('fab-toggle'));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ fabs_open: false });
  });

  test('earlier or later: moves the events of the day by the chosen minutes', async () => {
    const repo = setup();
    const tomorrow = addDaysIso(TODAY, 1);
    const id = repo.create({ title: 'Lab', date: tomorrow, start: '15:00', end: '16:00' });
    await renderIt();
    await goTo(tomorrow);
    await fireEvent.press(screen.getByTestId('fab-shift'));
    await fireEvent.press(screen.getByTestId('shift-early'));
    await fireEvent.press(screen.getByTestId('shift-min-15'));
    await fireEvent.press(screen.getByTestId('shift-save'));
    const ev = repo.eventsInRange(tomorrow, tomorrow).find((e) => e.uuid === id)!;
    expect([ev.start, ev.end]).toEqual(['14:45', '15:45']);
    expect(screen.queryByTestId('shift-sheet')).toBeNull();
  });

  test('a closed routine is one bar; opening it shows its steps; deleting asks first', async () => {
    const repo = setup();
    const id = repo.saveRoutine({
      name: 'Morning',
      color: '#C6B6A6',
      items: [
        { name: 'Shower', minutes: 10 },
        { name: 'Breakfast', minutes: 20 },
      ],
    })!;
    repo.insertRoutine(id, TODAY, '07:00');
    const group = repo.rows()[0]!.routine_group!;
    await renderIt();
    expect(screen.getByTestId(`routine-${group}`)).toBeTruthy();
    expect(screen.queryByText('Shower')).toBeNull();
    await fireEvent.press(screen.getByTestId(`routine-toggle-${group}`));
    await screen.rerender(
      <ThemeProvider>
        <PlannerScreen />
      </ThemeProvider>,
    );
    expect(screen.getByText('Shower')).toBeTruthy();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getByTestId(`routine-del-${group}`));
    expect(alert).toHaveBeenCalled();
    expect(repo.rows()).toHaveLength(0);
  });
  test('smart bar: a phrase becomes an event on the right day, and says what it understood', async () => {
    const repo = setup();
    await renderIt();
    await fireEvent.changeText(screen.getByTestId('smart-input'), 'dentista oggi 15');
    await fireEvent.press(screen.getByTestId('smart-go'));
    const rows = repo.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Dentista',
      event_date: TODAY,
      start_time: '15:00',
      end_time: '16:00',
    });
    expect(screen.getByTestId('smart-report')).toBeTruthy();
  });

  test('smart bar: a phrase with no title creates nothing and keeps the text', async () => {
    const repo = setup();
    await renderIt();
    await fireEvent.changeText(screen.getByTestId('smart-input'), 'domani alle 15');
    await fireEvent.press(screen.getByTestId('smart-go'));
    expect(repo.rows()).toHaveLength(0);
    expect(screen.getByTestId('smart-unclear')).toBeTruthy();
    expect(screen.getByTestId('smart-input').props.value).toBe('domani alle 15');
  });

  test('each snap writes its own times; the dial is hidden in the hour views', async () => {
    setup();
    mockZoom = 'h1';
    await renderIt();
    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.queryByText('05:30')).toBeNull();
    expect(screen.queryByTestId('zoom-dial')).toBeNull();
  });

  test('a finer snap adds the times in between', async () => {
    setup();
    mockZoom = 'm15';
    await renderIt();
    expect(screen.getByText('05:15')).toBeTruthy();
    expect(screen.getByText('05:45')).toBeTruthy();
  });

  test('list view: the day is a list (all-day included), the dial stays in view and picks a snap', async () => {
    const repo = setup();
    repo.create({ title: 'Dentist', date: TODAY, start: '15:00', end: '16:00' });
    repo.create({ title: 'Holiday', date: TODAY, allDay: true });
    mockZoom = 'agenda';
    await renderIt();
    expect(screen.getByTestId('agenda-list')).toBeTruthy();
    expect(screen.getByText('Dentist')).toBeTruthy();
    expect(screen.getByText('Holiday')).toBeTruthy();
    expect(screen.queryByTestId('grid-empty')).toBeNull();
    expect(screen.getByTestId('zoom-dial')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('zoom-m15'));
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({ zoom: 'm15' });
  });

  test('an empty day in list view says nothing is scheduled', async () => {
    setup();
    mockZoom = 'agenda';
    await renderIt();
    expect(screen.getByTestId('agenda-empty')).toBeTruthy();
  });
});
