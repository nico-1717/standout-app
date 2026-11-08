import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { pickDocument } from '@/core/media/pickFile';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PomodoroRepo } from '@/features/pomodoro/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import PomodoroImportScreen from '../pomodoro-import';

jest.mock('@/core/media/pickFile', () => ({ pickDocument: jest.fn() }));
let mockServices: unknown;
const mockChanged = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: 0, changed: mockChanged }),
}));

const csv = (text: string) => ({ name: 'Sessions.csv', bytes: new TextEncoder().encode(text) });
const FILE =
  'StartTime,Type,Title,Duration,List\n' +
  '2026-11-01 10:00,Pomodoro,Algebra,25,Maths\n' +
  '2026-11-01 11:00,Stopwatch,Algebra,50,Maths\n';

function setup() {
  const db = memoryDb();
  migrate(db);
  const projects = new ProjectsRepo(db);
  mockServices = { db, projects, pomodoro: new PomodoroRepo(db, 'u1') };
  mockChanged.mockClear();
  return { db, projects };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('pomodoro import screen', () => {
  test('pick a file, see the preview, import it; a project with the same name is linked', async () => {
    const { db, projects } = setup();
    const maths = projects.create({ name: 'Maths' })!;
    (pickDocument as jest.Mock).mockResolvedValueOnce(csv(FILE));
    await render(wrap(<PomodoroImportScreen />));
    await fireEvent.press(screen.getByTestId('pi-pick'));
    await waitFor(() => expect(screen.getByTestId('pi-save')).toBeTruthy());
    expect(screen.getByText('2 sessions found in the file')).toBeTruthy();
    expect(screen.getByText('Projects: 1 new of 2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pi-save'));
    expect(screen.getByTestId('pi-done')).toBeTruthy();
    expect(mockChanged).toHaveBeenCalled();
    const sub = projects.all().find((p) => p.name === 'Algebra')!;
    expect(sub.parent_uuid).toBe(maths);
    expect(
      db.all<{ n: number }>('SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE project_uuid = ?', [
        sub.uuid,
      ])[0]!.n,
    ).toBe(2);
  });

  test('the link can be changed to a new project before saving', async () => {
    const { projects } = setup();
    projects.create({ name: 'Maths' });
    (pickDocument as jest.Mock).mockResolvedValueOnce(csv(FILE));
    await render(wrap(<PomodoroImportScreen />));
    await fireEvent.press(screen.getByTestId('pi-pick'));
    await waitFor(() => expect(screen.getByTestId('pi-link-lists-L0')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('pi-link-lists-L0'));
    await fireEvent.press(screen.getByTestId('pi-new-lists-L0'));
    await fireEvent.press(screen.getByTestId('pi-save'));
    expect(projects.all().filter((p) => p.name === 'Maths')).toHaveLength(2);
  });

  test('a file without sessions gives a clear message; cancelling changes nothing', async () => {
    setup();
    (pickDocument as jest.Mock).mockResolvedValueOnce(csv('StartTime,Duration\nhello,5\n'));
    await render(wrap(<PomodoroImportScreen />));
    await fireEvent.press(screen.getByTestId('pi-pick'));
    await waitFor(() => expect(screen.getByTestId('pi-error')).toBeTruthy());
    expect(screen.getByTestId('pi-error').props.children).toMatch(/No valid sessions/);
    (pickDocument as jest.Mock).mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByTestId('pi-pick'));
    expect(screen.queryByTestId('pi-save')).toBeNull();
  });
});
