import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { upsertRow } from '@/core/sync/rows';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PlannerRepo } from '@/features/planner/repo';
import { localToday } from '@/features/tasks/groups';

import PlannerScreen from '../(tabs)/planner';

let mockStyle: 'standard' | 'paper' = 'standard';
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
    uiStyle: mockStyle,
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
    mockChanged.mockClear();
    jest.restoreAllMocks();
  });

  test('an empty day says so, and shows today in the title', async () => {
    setup();
    await renderIt();
    expect(screen.getByTestId('day-empty')).toBeTruthy();
    expect(screen.getByTestId(`strip-${TODAY}`)).toBeTruthy();
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

  test('the arrows and the week strip move between days', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('day-next'));
    expect(screen.getByTestId('day-today')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('day-today'));
    expect(screen.queryByTestId('day-today')).toBeNull();
  });
  test('week and month views list the events and open the day on tap', async () => {
    const repo = setup();
    repo.create({ title: 'Dentist', date: TODAY, start: '15:00', end: '16:00' });
    await renderIt();
    await fireEvent.press(screen.getByTestId('mode-week'));
    expect(screen.getByTestId('week-view')).toBeTruthy();
    expect(screen.getByText('Dentist')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('mode-month'));
    expect(screen.getByTestId('month-view')).toBeTruthy();
    expect(screen.getByText('Dentist')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`month-day-${TODAY}`));
    expect(screen.getByTestId('day-scroll')).toBeTruthy();
  });

  test('the arrows move by a week in week view', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('mode-week'));
    await fireEvent.press(screen.getByTestId('day-next'));
    expect(screen.getByTestId('week-view')).toBeTruthy();
    expect(screen.queryByTestId(`week-day-${TODAY}`)).toBeNull();
  });
  test('priorities: add one, tick it, and it stays after a refresh', async () => {
    const repo = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('priority-empty'));
    await fireEvent.changeText(screen.getByTestId('priority-new'), 'Study maths');
    await fireEvent(screen.getByTestId('priority-new'), 'submitEditing');
    expect(repo.priorities(TODAY).map((p) => p.content)).toEqual(['Study maths']);
    await screen.rerender(
      <ThemeProvider>
        <PlannerScreen />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('priority-box-1'));
    expect(repo.priorities(TODAY)[0]!.is_done).toBe(1);
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
});
