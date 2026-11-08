import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/core/i18n';
import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import SyncScreen from '../sync';

const mockBack = jest.fn();
const mockTrigger = jest.fn();
const mockChanged = jest.fn();
let mockDb = memoryDb();
let mockInfo = { status: 'idle', lastSyncAt: null as number | null, pending: 0 };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: { db: mockDb, scheduler: { trigger: mockTrigger } },
    syncInfo: mockInfo,
    version: 0,
    changed: mockChanged,
  }),
}));

const T = (k: string) => i18n.t(k) as string;
const add = (tbl: string, code: string, message: string | null = null) =>
  mockDb.run(
    `INSERT INTO sync_problems (tbl, uuid, code, field, message, patch, op, created_at)
     VALUES (?, 'u', ?, 'title', ?, '{}', 'upsert', '2026-11-05T10:00:00Z')`,
    [tbl, code, message],
  );
const ui = () =>
  render(
    <ThemeProvider accent="indigo">
      <SyncScreen />
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = memoryDb();
  migrate(mockDb);
  mockInfo = { status: 'idle', lastSyncAt: null, pending: 0 };
});

describe('Synchronization screen', () => {
  test('says everything is fine when nothing was refused', async () => {
    await ui();
    expect(screen.getByTestId('sync-clean')).toBeOnTheScreen();
  });

  test('"Sync now" asks the scheduler to run at once', async () => {
    await ui();
    await fireEvent.press(screen.getByTestId('sync-now'));
    expect(mockTrigger).toHaveBeenCalledWith(0);
  });

  test('lists refused changes with a plain area name and reason, and "Got it" hides one', async () => {
    add('planner_events', 'validation', 'Title too long');
    add('habit_logs', 'not_found');
    await ui();
    expect(screen.getByText(T('app.sync_g_planner'))).toBeOnTheScreen();
    expect(screen.getByText(T('app.sync_g_habits'))).toBeOnTheScreen();
    expect(screen.getByText(T('app.sync_motivo_validation'))).toBeOnTheScreen();
    expect(screen.getByText('Title too long')).toBeOnTheScreen();
    const id = mockDb.all<{ id: number }>("SELECT id FROM sync_problems WHERE tbl='habit_logs'")[0]!
      .id;
    await fireEvent.press(screen.getByTestId(`problem-ok-${id}`));
    expect(
      mockDb.all<{ dismissed: number }>('SELECT dismissed FROM sync_problems WHERE id = ?', [
        id,
      ])[0]!.dismissed,
    ).toBe(1);
    expect(mockChanged).toHaveBeenCalled();
  });

  test('"Got it, all of them" hides everything', async () => {
    add('todos', 'forbidden');
    add('fc_study_cards', 'conflict');
    await ui();
    await fireEvent.press(screen.getByTestId('problems-ok-all'));
    expect(
      mockDb.all<{ n: number }>('SELECT COUNT(*) AS n FROM sync_problems WHERE dismissed = 0')[0]!
        .n,
    ).toBe(0);
  });

  test('an unknown code gets the general reason', async () => {
    add('projects', 'something_new');
    await ui();
    expect(screen.getByText(T('app.sync_motivo_altro'))).toBeOnTheScreen();
  });
});
