import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PomodoroRepo } from '@/features/pomodoro/repo';
import { ProjectsRepo } from '@/features/projects/repo';
import { localToday } from '@/features/tasks/groups';

import PomodoroHistory from '../pomodoro-history';

let mockServices: unknown;
let mockVersion = 0;
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

const mockWritten: { name: string; data: unknown }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri: string;
    name: string;
    constructor(_dir: unknown, name: string) {
      this.name = name;
      this.uri = `file:///cache/${name}`;
    }
    exists = true;
    create() {}
    write(data: unknown) {
      mockWritten.push({ name: this.name, data });
    }
    delete() {}
  },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => undefined) }));

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: mockVersion, changed: mockChanged }),
}));

function setup() {
  mockVersion = 0;
  mockParams = {};
  const db = memoryDb();
  migrate(db);
  const pomodoro = new PomodoroRepo(db, 7);
  const projects = new ProjectsRepo(db);
  mockServices = { db, pomodoro, projects };
  return { pomodoro, projects };
}
const renderIt = () =>
  render(
    <ThemeProvider>
      <PomodoroHistory />
    </ThemeProvider>,
  );

type Handlers = Record<string, (e: never) => unknown>;
let clock = 1;
let lastX = 100;
const touchX = (x: number, active = true) => {
  clock += 1;
  const before = lastX;
  lastX = x;
  const t = { pageX: x, pageY: 30, identifier: 0, timestamp: clock, locationX: 0, locationY: 0 };
  return {
    nativeEvent: { touches: active ? [t] : [], changedTouches: [t], pageX: x, pageY: 30 },
    touchHistory: {
      touchBank: [
        {
          touchActive: active,
          startPageX: 100,
          startPageY: 30,
          startTimeStamp: 1,
          currentPageX: x,
          currentPageY: 30,
          currentTimeStamp: clock,
          previousPageX: before,
          previousPageY: 30,
          previousTimeStamp: clock - 1,
        },
      ],
      numberActiveTouches: active ? 1 : 0,
      indexOfSingleActiveTouch: active ? 0 : -1,
      mostRecentTimeStamp: clock,
    },
  } as never;
};
/** Trascina la riga verso destra come un dito (il gesto è lo stesso di projects.test), poi tocca il tasto scoperto. */
const pressSwipe = async (key: string, id: string) => {
  const h = screen.getByTestId(`swipe-pan-${id}`).props as Handlers;
  lastX = 100;
  await act(async () => {
    h.onMoveShouldSetResponderCapture!(touchX(100));
    const end = touchX(300);
    h.onMoveShouldSetResponderCapture!(end);
    h.onMoveShouldSetResponder!(end);
    h.onResponderGrant!(touchX(100));
    h.onResponderMove!(touchX(300));
    h.onResponderRelease!(touchX(300, false));
  });
  await fireEvent.press(screen.getByTestId(`swipe-${key}-${id}`));
};

describe('Pomodoro history', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists sessions by day with the day total, and the overview counts today', async () => {
    const { pomodoro } = setup();
    const today = localToday();
    pomodoro.addManual({ day: today, from: '09:00', to: '09:30' });
    await renderIt();
    // il totale del giorno, la riga e il centro della torta dicono la stessa durata
    expect(screen.getAllByText('30 min')).toHaveLength(3);
    expect(screen.getByTestId('ins-today').props.children.join('')).toContain('1 · 30 min');
    expect(screen.getByTestId('ins-streak')).toBeTruthy();
  });

  test('the day pie splits today by project and the bars are stacked by project', async () => {
    const { pomodoro, projects } = setup();
    const a = projects.create({ name: 'Physics' })!;
    const today = localToday();
    pomodoro.addManual({ day: today, from: '09:00', to: '09:30', projectUuid: a });
    pomodoro.addManual({ day: today, from: '10:00', to: '10:20' });
    const ins = pomodoro.insights(today);
    expect(ins.todayProjects).toEqual([
      { uuid: a, secs: 1800 },
      { uuid: null, secs: 1200 },
    ]);
    expect(ins.weekProjects[today]).toHaveLength(2);
    await renderIt();
    expect(screen.getByTestId('ins-pie')).toBeTruthy();
    expect(screen.getByTestId('ins-pie-caption')).toHaveTextContent('Physics and 1 more');
  });

  test('the import button opens the import page', async () => {
    setup();
    mockPush.mockClear();
    await renderIt();
    await fireEvent.press(screen.getByTestId('hist-import'));
    expect(mockPush).toHaveBeenCalledWith('/pomodoro-import');
  });

  test('with nothing today there is no pie', async () => {
    setup();
    await renderIt();
    expect(screen.queryByTestId('ins-pie')).toBeNull();
  });

  test('adds a session by hand and edits it', async () => {
    const { pomodoro, projects } = setup();
    const proj = projects.create({ name: 'Physics' })!;
    await renderIt();
    await fireEvent.press(screen.getByTestId('hist-add'));
    await fireEvent(
      screen.getByTestId('draft-from'),
      'valueChange',
      {},
      new Date(2030, 0, 1, 14, 0),
    );
    await fireEvent(
      screen.getByTestId('draft-to'),
      'valueChange',
      {},
      new Date(2030, 0, 1, 15, 15),
    );
    await fireEvent.press(screen.getByTestId('draft-project'));
    await fireEvent.press(screen.getByTestId(`project-pick-${proj}`));
    await fireEvent.press(screen.getByTestId('draft-save'));
    const [s] = pomodoro.history({});
    expect(s).toMatchObject({ duration_seconds: 4500, project_uuid: proj, is_manual: 1 });
    expect(screen.getAllByText('1 h 15 min').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId(`hist-row-${s!.uuid}`));
    await fireEvent(
      screen.getByTestId('draft-to'),
      'valueChange',
      {},
      new Date(2030, 0, 1, 14, 30),
    );
    await fireEvent.press(screen.getByTestId('draft-save'));
    expect(pomodoro.get(s!.uuid)!.duration_seconds).toBe(1800);
  });

  test('deleting one needs a second tap', async () => {
    const { pomodoro } = setup();
    const id = pomodoro.addManual({ day: localToday(), from: '09:00', to: '09:30' })!;
    await renderIt();
    await fireEvent.press(screen.getByTestId(`hist-row-${id}`));
    await fireEvent.press(screen.getByTestId('draft-delete'));
    expect(pomodoro.get(id)).not.toBeNull();
    await fireEvent.press(screen.getByTestId('draft-delete-yes'));
    expect(pomodoro.get(id)).toBeNull();
  });

  test('filters by project and "none"; select all then assign a project, unlink, delete', async () => {
    const { pomodoro, projects } = setup();
    const proj = projects.create({ name: 'Chem' })!;
    const day = localToday();
    const a = pomodoro.addManual({ day, from: '08:00', to: '08:30', projectUuid: proj })!;
    const b = pomodoro.addManual({ day, from: '10:00', to: '10:30' })!;
    const c = pomodoro.addManual({ day, from: '12:00', to: '12:30' })!;
    await renderIt();
    await fireEvent.press(screen.getByTestId('hist-filter-project'));
    await fireEvent.press(screen.getByTestId('project-pick-none'));
    expect(screen.queryByTestId(`hist-row-${a}`)).toBeNull();
    expect(screen.getByTestId(`hist-row-${b}`)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('hist-select'));
    await fireEvent.press(screen.getByTestId('bulk-all'));
    await fireEvent.press(screen.getByTestId('bulk-set'));
    await fireEvent.press(screen.getByTestId(`project-pick-${proj}`));
    expect(pomodoro.get(b)!.project_uuid).toBe(proj);
    expect(pomodoro.get(c)!.project_uuid).toBe(proj);
    expect(pomodoro.get(a)!.project_uuid).toBe(proj);

    await fireEvent.press(screen.getByTestId('hist-reset'));
    await fireEvent.press(screen.getByTestId('hist-select'));
    await fireEvent.press(screen.getByTestId(`hist-row-${a}`));
    await fireEvent.press(screen.getByTestId('bulk-unlink'));
    expect(pomodoro.get(a)!.project_uuid).toBeNull();

    await fireEvent.press(screen.getByTestId('hist-select'));
    await fireEvent.press(screen.getByTestId(`hist-row-${b}`));
    await fireEvent.press(screen.getByTestId('bulk-delete'));
    expect(pomodoro.get(b)).not.toBeNull();
    await fireEvent.press(screen.getByTestId('bulk-delete-yes'));
    expect(pomodoro.get(b)).toBeNull();
  });

  test('opened from a project, it shows that project and its sub-projects until reset', async () => {
    const { pomodoro, projects } = setup();
    const a = projects.create({ name: 'A' })!;
    const k = projects.create({ name: 'K', parent: a })!;
    const x = projects.create({ name: 'X' })!;
    const day = localToday();
    const sa = pomodoro.addManual({ day, from: '08:00', to: '08:30', projectUuid: a })!;
    const sk = pomodoro.addManual({ day, from: '09:00', to: '09:30', projectUuid: k })!;
    const sx = pomodoro.addManual({ day, from: '10:00', to: '10:30', projectUuid: x })!;
    mockParams = { project: a };
    await renderIt();
    expect(screen.getByTestId(`hist-row-${sa}`)).toBeTruthy();
    expect(screen.getByTestId(`hist-row-${sk}`)).toBeTruthy();
    expect(screen.queryByTestId(`hist-row-${sx}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('hist-scope-clear'));
    expect(screen.getByTestId(`hist-row-${sx}`)).toBeTruthy();
  });

  test('loads more past twenty', async () => {
    const { pomodoro } = setup();
    for (let i = 0; i < 22; i += 1) {
      const m = String(i).padStart(2, '0');
      pomodoro.addManual({
        day: '2030-01-05',
        from: `10:${m}`,
        to: `10:${m === '59' ? '59' : String(i + 1).padStart(2, '0')}`,
      });
    }
    await renderIt();
    expect(screen.getByTestId('hist-more')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('hist-more'));
    expect(screen.queryByTestId('hist-more')).toBeNull();
  });

  test('swiping a row shows Edit and Delete; Delete asks once and then removes the session', async () => {
    const { pomodoro } = setup();
    const today = localToday();
    const id = pomodoro.addManual({ day: today, from: '09:00', to: '09:30' })!;
    await renderIt();
    expect(screen.getByTestId(`swipe-edit-${id}`)).toBeTruthy();
    await pressSwipe('delete', id);
    expect(screen.getByTestId('row-delete-choice')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('row-delete-choice-cancel'));
    expect(pomodoro.get(id)).not.toBeNull();
    await pressSwipe('delete', id);
    await fireEvent.press(screen.getByTestId('row-delete-choice-yes'));
    expect(pomodoro.get(id)).toBeNull();
  });

  test('the Edit swipe button opens the correction panel on that row', async () => {
    const { pomodoro } = setup();
    const id = pomodoro.addManual({ day: localToday(), from: '09:00', to: '09:30' })!;
    await renderIt();
    await pressSwipe('edit', id);
    expect(screen.getByTestId('draft-save')).toBeTruthy();
  });

  test('opened from a project, a button starts a pomodoro on it', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Physics' })!;
    mockParams = { project: a };
    await renderIt();
    await fireEvent.press(screen.getByTestId('hist-go'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pomodoro', params: { project: a } });
  });

  test('without a project there is no start button', async () => {
    setup();
    await renderIt();
    expect(screen.queryByTestId('hist-go')).toBeNull();
  });

  test('Export asks for the format and shares an .xlsx or .csv of the whole history', async () => {
    const { pomodoro } = setup();
    pomodoro.addManual({ day: localToday(), from: '09:00', to: '09:30' });
    mockWritten.length = 0;
    await renderIt();
    await fireEvent.press(screen.getByTestId('hist-export'));
    await fireEvent.press(screen.getByTestId('export-choice-xlsx'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
    expect(mockWritten[0]!.name).toMatch(/^Pomodoro_record_\d{8}\.xlsx$/);
    await fireEvent.press(screen.getByTestId('hist-export'));
    await fireEvent.press(screen.getByTestId('export-choice-csv'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(2));
    expect(mockWritten[1]!.name).toMatch(/\.csv$/);
    expect(String(mockWritten[1]!.data)).toContain('Date,StartTime,EndTime,Type,Title');
  });
});
