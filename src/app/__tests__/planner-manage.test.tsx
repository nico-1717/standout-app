import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { upsertRow } from '@/core/sync/rows';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PlannerRepo } from '@/features/planner/repo';

import PlannerManage from '../planner-manage';

let mockServices: unknown;
let mockVersion = 0;
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    uiStyle: 'standard',
    plannerSettings: jest.requireActual('@/features/planner/settings').DEFAULT_PLANNER_SETTINGS,
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
      <PlannerManage />
    </ThemeProvider>,
  );

describe('Planner calendars and categories', () => {
  beforeEach(() => {
    mockVersion = 0;
    mockChanged.mockClear();
    jest.restoreAllMocks();
  });

  test('adds a calendar and a category, hides a calendar, recolours a category', async () => {
    const repo = setup();
    await renderIt();
    await fireEvent.changeText(screen.getByTestId('cal-new'), 'Work');
    await fireEvent.press(screen.getByTestId('cal-add'));
    const work = repo.calendars().find((c) => c.name === 'Work')!;
    expect(work).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cal-vis-cal-main'));
    expect(repo.calendars().find((c) => c.uuid === 'cal-main')!.is_visible).toBeFalsy();

    await fireEvent.changeText(screen.getByTestId('cat-new'), 'Sport');
    await fireEvent.press(screen.getByTestId('cat-add'));
    const sport = repo.categories().find((c) => c.name === 'Sport')!;
    await fireEvent.press(screen.getByTestId(`cat-color-${sport.uuid}-#9DB4D0`));
    expect(repo.categories().find((c) => c.uuid === sport.uuid)!.color).toBe('#9DB4D0');
  });

  test('keywords: add, refuse a word that belongs to another category, remove', async () => {
    const repo = setup();
    const a = repo.addCategory('Sport', '#A9C3AE');
    const b = repo.addCategory('Study', '#9DB4D0');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderIt();
    await fireEvent.changeText(screen.getByTestId(`kw-new-${a}`), 'Gym');
    await fireEvent.press(screen.getByTestId(`kw-add-${a}`));
    expect(repo.keywords().map((k) => k.keyword)).toEqual(['gym']);
    await fireEvent.changeText(screen.getByTestId(`kw-new-${b}`), 'gym');
    await fireEvent.press(screen.getByTestId(`kw-add-${b}`));
    expect(alert).toHaveBeenCalled();
    expect(repo.keywords()).toHaveLength(1);
    await fireEvent.press(screen.getByTestId(`kw-${repo.keywords()[0]!.uuid}`));
    expect(repo.keywords()).toHaveLength(0);
  });

  test('the main calendar cannot be deleted; another one can, after confirming', async () => {
    const repo = setup();
    const other = repo.addCalendar('Work', '#E8B86B');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderIt();
    expect(screen.queryByTestId('cal-del-cal-main')).toBeNull();
    await fireEvent.press(screen.getByTestId(`cal-del-${other}`));
    expect(alert).toHaveBeenCalled();
    expect(repo.calendars().map((c) => c.uuid)).toEqual(['cal-main']);
    await act(async () => {});
  });
});
