import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { pickDocument } from '@/core/media/pickFile';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { HabitsRepo } from '@/features/habits/repo';

import HabitImportScreen from '../habit-import';

jest.mock('@/core/media/pickFile', () => ({ pickDocument: jest.fn() }));
let mockServices: unknown;
const mockChanged = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: 0, changed: mockChanged }),
}));

const csv = (text: string) => ({ name: 'Habits.csv', bytes: new TextEncoder().encode(text) });
function setup() {
  const db = memoryDb();
  migrate(db);
  const habits = new HabitsRepo(db, undefined, undefined, () => '2026-11-08');
  mockServices = { db, habits };
  mockChanged.mockClear();
  mockBack.mockClear();
  return { habits };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('habit import screen', () => {
  test('pick a file, see the preview, import it', async () => {
    const { habits } = setup();
    habits.create({ name: 'Run' });
    (pickDocument as jest.Mock).mockResolvedValueOnce(
      csv('Habit,Date\nRun,2026-11-01\nRun,2026-11-02\nRead,2026-11-03\n'),
    );
    await render(wrap(<HabitImportScreen />));
    await fireEvent.press(screen.getByTestId('hi-pick'));
    await waitFor(() => expect(screen.getByTestId('hi-save')).toBeTruthy());
    expect(screen.getByText('2 habits, 3 check-ins found')).toBeTruthy();
    expect(screen.getByText('1 new of 2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('hi-save'));
    expect(screen.getByTestId('hi-done')).toBeTruthy();
    expect(mockChanged).toHaveBeenCalled();
    const all = habits.list();
    expect(all.map((h) => h.name).sort()).toEqual(['Read', 'Run']);
    const run = all.find((h) => h.name === 'Run')!;
    expect(habits.logsOf(run.uuid).map((l) => l.log_date)).toEqual(['2026-11-01', '2026-11-02']);
  });

  test('a matching habit can be turned into a new one before saving', async () => {
    const { habits } = setup();
    habits.create({ name: 'Run' });
    (pickDocument as jest.Mock).mockResolvedValueOnce(csv('Habit,Date\nRun,2026-11-01\n'));
    await render(wrap(<HabitImportScreen />));
    await fireEvent.press(screen.getByTestId('hi-pick'));
    await waitFor(() => expect(screen.getByTestId('hi-link-H0')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('hi-link-H0'));
    await fireEvent.press(screen.getByTestId('hi-new-H0'));
    await fireEvent.press(screen.getByTestId('hi-save'));
    expect(habits.list().filter((h) => h.name === 'Run')).toHaveLength(2);
  });

  test('warnings are shown; an old .xls and a file with no habit give a clear message', async () => {
    setup();
    (pickDocument as jest.Mock).mockResolvedValueOnce({
      name: 'old.xls',
      bytes: new Uint8Array([1, 2, 3]),
    });
    await render(wrap(<HabitImportScreen />));
    await fireEvent.press(screen.getByTestId('hi-pick'));
    await waitFor(() => expect(screen.getByTestId('hi-error')).toBeTruthy());
    expect(screen.getByTestId('hi-error').props.children).toMatch(/Old \.xls/);

    (pickDocument as jest.Mock).mockResolvedValueOnce(csv('Date\nnot a date\n'));
    await fireEvent.press(screen.getByTestId('hi-pick'));
    await waitFor(() =>
      expect(screen.getByTestId('hi-error').props.children).toMatch(/No valid habit/),
    );
  });

  test('cancelling the picker changes nothing', async () => {
    setup();
    (pickDocument as jest.Mock).mockResolvedValueOnce(null);
    await render(wrap(<HabitImportScreen />));
    await fireEvent.press(screen.getByTestId('hi-pick'));
    expect(screen.queryByTestId('hi-save')).toBeNull();
    expect(screen.queryByTestId('hi-error')).toBeNull();
  });
});
