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
import { TasksRepo } from '@/features/tasks/repo';

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
  const tasks = new TasksRepo(db);
  mockServices = { db, projects, pomodoro, tasks, projectOptions: new ProjectOptionsStore(db) };
  return { db, projects, pomodoro, tasks };
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

  test('a note with formatting opens in the rich editor and keeps its format when edited', async () => {
    const { projects } = setup();
    const rich = JSON.stringify({
      v: 2,
      blocks: [{ t: 'p', runs: [{ s: 'Bold', m: { b: 1 } }, { s: ' idea' }] }],
    });
    const a = projects.create({ name: 'Alpha', notes: rich })!;
    mockParams = { id: a };
    await renderOne();
    expect(screen.queryByTestId('proj-note')).toBeNull();
    jest.useFakeTimers();
    await fireEvent.changeText(screen.getByTestId('proj-note-rich-block-0'), 'Bold ideas');
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    jest.useRealTimers();
    const saved = JSON.parse(projects.get(a)!.notes) as {
      blocks: { runs: { s: string; m?: object }[] }[];
    };
    expect(saved.blocks[0]!.runs).toEqual([{ s: 'Bold', m: { b: 1 } }, { s: ' ideas' }]);
  });

  test('a formatted note over the limit is not saved (it would be cut in the middle)', async () => {
    const { projects } = setup();
    const rich = JSON.stringify({ v: 2, blocks: [{ t: 'p', runs: [{ s: 'short' }] }] });
    const a = projects.create({ name: 'Alpha', notes: rich })!;
    mockParams = { id: a };
    await renderOne();
    jest.useFakeTimers();
    await fireEvent.changeText(screen.getByTestId('proj-note-rich-block-0'), 'x'.repeat(8100));
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    jest.useRealTimers();
    expect(screen.getByTestId('proj-note-long')).toBeTruthy();
    expect(projects.get(a)!.notes).toBe(rich);
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

  test('the Activities switch shows the linked tasks: tick one, add one', async () => {
    const { projects, tasks } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const mine = tasks.create({ title: 'Read chapter 1', project_uuid: a });
    tasks.create({ title: 'Other project task' });
    mockParams = { id: a };
    const view = await renderOne();
    // spento: nessuna lista
    expect(screen.queryByTestId('proj-task-new')).toBeNull();
    await fireEvent(screen.getByTestId('proj-todo-switch'), 'valueChange', true);
    expect(projects.get(a)!.todo_enabled).toBe(1);
    await view.rerender(
      <ThemeProvider>
        <ProjectScreen />
      </ThemeProvider>,
    );
    expect(screen.getByText('Read chapter 1')).toBeTruthy();
    expect(screen.queryByText('Other project task')).toBeNull();

    await fireEvent.press(screen.getByTestId(`proj-task-${mine}`));
    expect(tasks.get(mine)!.is_done).toBe(1);

    await fireEvent.changeText(screen.getByTestId('proj-task-new'), '  Write summary ');
    await fireEvent.press(screen.getByTestId('proj-task-add'));
    const linked = tasks.ofProject(a).map((x) => x.title);
    expect(linked).toContain('Write summary');
    // titolo vuoto: non crea niente
    await fireEvent.press(screen.getByTestId('proj-task-add'));
    expect(tasks.ofProject(a)).toHaveLength(2);

    await fireEvent(screen.getByTestId('proj-todo-switch'), 'valueChange', false);
    expect(projects.get(a)!.todo_enabled).toBe(0);
  });

  test('sub-projects can be shown as a grid of cards, and the choice stays', async () => {
    const { db, projects, pomodoro } = setup();
    const store = new ProjectOptionsStore(db);
    const a = projects.create({ name: 'Alpha' })!;
    const k1 = projects.create({ name: 'Kid 1', parent: a })!;
    const k2 = projects.create({ name: 'Kid 2', parent: a })!;
    projects.create({ name: 'Grand 1', parent: k1 });
    const g2 = projects.create({ name: 'Grand 2', parent: k1 })!;
    projects.setStatus(g2, 'completed');
    pomodoro.addManual({ day: '2030-01-01', from: '09:00', to: '09:30', projectUuid: k1 });
    mockParams = { id: a };
    const view = await renderOne();
    expect(screen.queryByTestId('sub-grid')).toBeNull();
    await fireEvent.press(screen.getByTestId('sub-view-toggle'));
    await view.rerender(
      <ThemeProvider>
        <ProjectScreen />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('sub-grid')).toBeTruthy();
    // la scheda mostra il tempo e quanti sotto-progetti sono fatti; l'altra ha un trattino
    expect(screen.getByTestId(`kid-bar-${k1}`)).toBeTruthy();
    expect(screen.queryByTestId(`kid-bar-${k2}`)).toBeNull();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
    // toccare una scheda apre il sotto-progetto
    await fireEvent.press(screen.getByTestId(`kid-${k2}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/project', params: { id: k2 } });
    // la scelta resta sul telefono
    expect(store.subView()).toBe('grid');
    // dalla griglia si torna all'elenco
    await fireEvent.press(screen.getByTestId('sub-view-toggle'));
    expect(store.subView()).toBe('list');
  });

  test('selecting sub-projects: colour, move and delete them together', async () => {
    const { projects, pomodoro } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const b = projects.create({ name: 'Beta' })!;
    const k1 = projects.create({ name: 'Kid 1', parent: a })!;
    const k2 = projects.create({ name: 'Kid 2', parent: a })!;
    const k3 = projects.create({ name: 'Kid 3', parent: a })!;
    mockParams = { id: a };
    const view = await renderOne();
    const again = async () =>
      view.rerender(
        <ThemeProvider>
          <ProjectScreen />
        </ThemeProvider>,
      );

    // fuori dalla selezione, toccare apre il sotto-progetto
    await fireEvent.press(screen.getByTestId(`kid-${k1}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/project', params: { id: k1 } });

    await fireEvent.press(screen.getByTestId('sub-select-toggle'));
    await fireEvent.press(screen.getByTestId('sub-bulk-color'));
    expect(screen.queryByTestId('sub-color-FF3B30')).toBeNull(); // niente scelti: niente pannello
    await fireEvent.press(screen.getByTestId(`kid-${k1}`));
    await fireEvent.press(screen.getByTestId(`kid-${k2}`));
    expect(screen.getByTestId('sub-count')).toHaveTextContent(/2 selected/);
    await fireEvent.press(screen.getByTestId('sub-bulk-color'));
    await fireEvent.press(screen.getByTestId('sub-color-FF3B30'));
    expect(projects.get(k1)!.color.toUpperCase()).toBe('#FF3B30');
    expect(projects.get(k2)!.color_edited).toBeTruthy();
    expect(projects.get(k3)!.color_edited).toBeFalsy();
    await again();

    // spostare k1 e k2 sotto Beta
    await fireEvent.press(screen.getByTestId('sub-select-toggle'));
    await fireEvent.press(screen.getByTestId('sub-all'));
    await fireEvent.press(screen.getByTestId('sub-all')); // di nuovo: deseleziona
    expect(screen.getByTestId('sub-count')).toHaveTextContent(/0 selected/);
    await fireEvent.press(screen.getByTestId(`kid-${k1}`));
    await fireEvent.press(screen.getByTestId(`kid-${k2}`));
    await fireEvent.press(screen.getByTestId('sub-bulk-parent'));
    // un progetto scelto non si offre come destinazione
    expect(screen.queryByTestId(`project-pick-${k1}`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`project-pick-${b}`));
    expect(projects.get(k1)!.parent_uuid).toBe(b);
    expect(projects.get(k2)!.parent_uuid).toBe(b);
    expect(projects.get(k3)!.parent_uuid).toBe(a);
    await again();

    // eliminare k3 con i suoi pomodori
    pomodoro.addManual({ day: '2030-01-01', from: '09:00', to: '09:30', projectUuid: k3 });
    await fireEvent.press(screen.getByTestId('sub-select-toggle'));
    await fireEvent.press(screen.getByTestId(`kid-${k3}`));
    await fireEvent.press(screen.getByTestId('sub-bulk-delete'));
    await fireEvent.press(screen.getByTestId('sub-del-all'));
    expect(projects.get(k3)).toBeNull();
    expect(projects.sessionCount([k3])).toBe(0);
  });
});
