import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PomodoroRepo } from '@/features/pomodoro/repo';
import { ProjectOptionsStore } from '@/features/projects/options';
import { ProjectsRepo } from '@/features/projects/repo';
import { nextBatch } from '@/core/sync/outbox';
import { localToday } from '@/features/tasks/groups';

import ProjectsScreen from '../projects';
import ProjectScreen from '../project';

let mockServices: unknown;
let mockVersion = 0;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
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
  mockPush.mockClear();
  mockBack.mockClear();
  const db = memoryDb();
  migrate(db);
  const projects = new ProjectsRepo(db);
  const pomodoro = new PomodoroRepo(db, 7);
  mockServices = { db, projects, pomodoro, projectOptions: new ProjectOptionsStore(db) };
  return { db, projects, pomodoro };
}
const renderList = () =>
  render(
    <ThemeProvider>
      <ProjectsScreen />
    </ThemeProvider>,
  );
const renderOne = () =>
  render(
    <ThemeProvider>
      <ProjectScreen />
    </ThemeProvider>,
  );

describe('projects list', () => {
  test('shows the empty message, then adds a project first', async () => {
    const { projects } = setup();
    const view = await renderList();
    expect(screen.getByText('No projects yet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('proj-new'), 'Thesis');
    await fireEvent.press(screen.getByTestId('proj-new-add'));
    expect(projects.all().map((p) => p.name)).toEqual(['Thesis']);
    await view.rerender(
      <ThemeProvider>
        <ProjectsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByText('Thesis')).toBeTruthy();
  });

  test('branches start closed; opening one shows the sub-projects; adding one opens its branch', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    projects.create({ name: 'Kid', parent: a });
    const view = await renderList();
    expect(screen.queryByText('Kid')).toBeNull();
    await fireEvent.press(screen.getByTestId(`proj-toggle-${a}`));
    expect(screen.getByText('Kid')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`proj-toggle-${a}`));
    expect(screen.queryByText('Kid')).toBeNull();
    await fireEvent.press(screen.getByTestId(`proj-add-${a}`));
    await fireEvent.changeText(screen.getByTestId('proj-sub-input'), 'Second');
    await fireEvent(screen.getByTestId('proj-sub-input'), 'submitEditing');
    await view.rerender(
      <ThemeProvider>
        <ProjectsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByText('Second')).toBeTruthy();
  });

  test('tapping the circle completes a project and its sub-projects; tapping through brings them back', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const k = projects.create({ name: 'Kid', parent: a })!;
    await renderList();
    await fireEvent.press(screen.getByTestId(`proj-status-${a}`));
    expect(projects.get(a)!.status).toBe('completed');
    expect(projects.get(k)!.status).toBe('completed');
    await fireEvent.press(screen.getByTestId(`proj-status-${a}`));
    expect(projects.get(a)!.status).toBe('planned');
    expect(projects.get(k)!.status).toBe('in_progress');
  });

  test('"show completed" off hides them, order by name, and opening a row goes to its page', async () => {
    const { projects } = setup();
    const b = projects.create({ name: 'Beta' })!;
    const a = projects.create({ name: 'Alpha' })!;
    projects.cycleStatus(b);
    const view = await renderList();
    await fireEvent.press(screen.getByTestId('proj-options'));
    await fireEvent(screen.getByTestId('opt-completati'), 'valueChange', false);
    await view.rerender(
      <ThemeProvider>
        <ProjectsScreen />
      </ThemeProvider>,
    );
    expect(screen.queryByText('Beta')).toBeNull();
    await fireEvent.press(screen.getByTestId('opt-order-alfabetico'));
    await fireEvent.press(screen.getByTestId(`proj-row-${a}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/project', params: { id: a } });
  });
});

describe('project page', () => {
  test('renames (not to empty), keeps a plain note, changes dates and colour', async () => {
    const { projects, db } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    mockParams = { id: a };
    const view = await renderOne();
    await fireEvent.changeText(screen.getByTestId('proj-name'), 'Alpha 2');
    await fireEvent(screen.getByTestId('proj-name'), 'submitEditing');
    expect(projects.get(a)!.name).toBe('Alpha 2');
    await fireEvent.changeText(screen.getByTestId('proj-name'), '  ');
    await fireEvent(screen.getByTestId('proj-name'), 'blur');
    expect(projects.get(a)!.name).toBe('Alpha 2');

    await fireEvent.changeText(screen.getByTestId('proj-note'), 'remember the sources');
    await fireEvent(screen.getByTestId('proj-note'), 'blur');
    expect(projects.get(a)!.notes).toBe('remember the sources');

    // la nota si salva anche senza toccare fuori: mezzo secondo dopo l'ultimo tasto
    jest.useFakeTimers();
    await fireEvent.changeText(screen.getByTestId('proj-note'), 'remember the sources, again');
    expect(projects.get(a)!.notes).toBe('remember the sources');
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    expect(projects.get(a)!.notes).toBe('remember the sources, again');
    jest.useRealTimers();

    // sin qui nessuna data: toccare il campo mette quella di oggi, poi il selettore la cambia
    await fireEvent.press(screen.getByTestId('proj-due'));
    expect(projects.get(a)!.due_date).toBe(localToday());
    await view.rerender(
      <ThemeProvider>
        <ProjectScreen />
      </ThemeProvider>,
    );
    await fireEvent(screen.getByTestId('proj-due'), 'valueChange', {}, new Date(2031, 4, 20));
    expect(projects.get(a)!.due_date).toBe('2031-05-20');
    await fireEvent.press(screen.getByTestId('swatch-FF2D55'));
    expect(projects.get(a)).toMatchObject({ color: '#FF2D55', color_edited: 1 });
    await fireEvent(screen.getByTestId('proj-color-auto'), 'valueChange', true);
    expect(projects.get(a)).toMatchObject({ color: '#8E8E93', color_edited: 0 });
    expect(nextBatch(db, 50).length).toBeGreaterThan(0);
  });

  test('a note with formatting is shown as text and cannot be overwritten from the phone', async () => {
    const { projects } = setup();
    const rich = JSON.stringify({ v: 2, blocks: [{ t: 'p', runs: [{ s: 'Bold idea' }] }] });
    const a = projects.create({ name: 'Alpha', notes: rich })!;
    mockParams = { id: a };
    await renderOne();
    expect(screen.getByTestId('proj-note-rich').props.children).toBe('Bold idea');
    expect(screen.queryByTestId('proj-note')).toBeNull();
  });

  test('moves under another project (never inside itself) and back to the top', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const b = projects.create({ name: 'Beta' })!;
    const k = projects.create({ name: 'Kid', parent: a })!;
    mockParams = { id: a };
    await renderOne();
    await fireEvent.press(screen.getByTestId('proj-move'));
    expect(screen.queryByTestId(`project-pick-${k}`)).toBeNull(); // il suo ramo non si offre
    await fireEvent.press(screen.getByTestId(`project-pick-${b}`));
    expect(projects.get(a)!.parent_uuid).toBe(b);
    await fireEvent.press(screen.getByTestId('proj-move'));
    await fireEvent.press(screen.getByTestId('project-pick-root'));
    expect(projects.get(a)!.parent_uuid).toBeNull();
  });

  test('starting a pomodoro and opening the history carry the project along', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    mockParams = { id: a };
    await renderOne();
    await fireEvent.press(screen.getByTestId('proj-start'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pomodoro', params: { project: a } });
    await fireEvent.press(screen.getByTestId('proj-sessions'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/pomodoro-history',
      params: { project: a },
    });
  });

  test('deleting asks about the pomodoros when there are some', async () => {
    const { projects, pomodoro } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const s = pomodoro.addManual({
      day: '2030-01-01',
      from: '09:00',
      to: '09:30',
      projectUuid: a,
    })!;
    mockParams = { id: a };
    await renderOne();
    await fireEvent.press(screen.getByTestId('proj-delete'));
    await fireEvent.press(screen.getByTestId('proj-del-keep'));
    expect(projects.get(a)).toBeNull();
    expect(pomodoro.get(s)).toMatchObject({ project_uuid: null });
    expect(mockBack).toHaveBeenCalled();
  });

  test('deleting with its pomodoros removes them too; with none it is one tap', async () => {
    const { projects, pomodoro } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const s = pomodoro.addManual({
      day: '2030-01-01',
      from: '09:00',
      to: '09:30',
      projectUuid: a,
    })!;
    mockParams = { id: a };
    await renderOne();
    await fireEvent.press(screen.getByTestId('proj-delete'));
    await fireEvent.press(screen.getByTestId('proj-del-all'));
    expect(pomodoro.get(s)).toBeNull();

    const b = projects.create({ name: 'Beta' })!;
    mockParams = { id: b };
    await renderOne();
    await fireEvent.press(screen.getAllByTestId('proj-delete').pop()!);
    await fireEvent.press(screen.getByTestId('proj-del-yes'));
    expect(projects.get(b)).toBeNull();
  });
});
