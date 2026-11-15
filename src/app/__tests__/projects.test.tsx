import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { nextBatch } from '@/core/sync/outbox';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PomodoroRepo } from '@/features/pomodoro/repo';
import { ProjectOptionsStore } from '@/features/projects/options';
import { ProjectsRepo } from '@/features/projects/repo';
import { localToday } from '@/features/tasks/groups';
import { TasksRepo } from '@/features/tasks/repo';

import ProjectScreen from '../project';
import ProjectsScreen from '../projects';

let mockServices: unknown;
let mockVersion = 0;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRedirect = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: unknown }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    pomodoroSettings: { last_pomodoro_duration_min: 25 },
    authState: { status: 'signedIn', user: { username: 'nico' } },
  }),
}));

function setup() {
  mockVersion = 0;
  mockParams = {};
  mockPush.mockClear();
  mockBack.mockClear();
  mockRedirect.mockClear();
  const db = memoryDb();
  migrate(db);
  const projects = new ProjectsRepo(db);
  const pomodoro = new PomodoroRepo(db, 7);
  const tasks = new TasksRepo(db);
  mockServices = { db, projects, pomodoro, tasks, projectOptions: new ProjectOptionsStore(db) };
  return { db, projects, pomodoro, tasks };
}
const tree = () => (
  <ThemeProvider>
    <ProjectsScreen />
  </ThemeProvider>
);
const renderPage = () => render(tree());
/** I dati si rileggono a ogni disegno: dopo una modifica si ridisegna, come fa l'app con `version`. */
const redraw = (view: Awaited<ReturnType<typeof render>>) => view.rerender(tree());
const nameShown = () => screen.getByTestId('proj-name').props.value as string;

describe('Projects › All', () => {
  test('shows the empty message, then adds a project first', async () => {
    const { projects } = setup();
    const view = await renderPage();
    expect(screen.getByText('No projects yet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('proj-new-line'));
    await fireEvent.changeText(screen.getByTestId('proj-new'), 'Thesis');
    await fireEvent.press(screen.getByTestId('proj-new-add'));
    expect(projects.all().map((p) => p.name)).toEqual(['Thesis']);
    await redraw(view);
    expect(screen.getAllByText('Thesis').length).toBeGreaterThan(0);
  });

  test('lists favourites apart, and a row opens the project page', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    projects.create({ name: 'Beta' });
    projects.update(a, { is_favorite: true });
    await renderPage();
    expect(screen.getByTestId(`proj-fav-${a}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`proj-row-${a}`));
    expect(nameShown()).toBe('Alpha');
    // «Tutti» riporta all'elenco
    await fireEvent.press(screen.getByTestId('proj-chip-all'));
    expect(screen.queryByTestId('proj-name')).toBeNull();
  });

  test('the chips at the top open a main project', async () => {
    const { projects } = setup();
    projects.create({ name: 'Alpha' });
    const b = projects.create({ name: 'Beta' })!;
    await renderPage();
    await fireEvent.press(screen.getByTestId(`proj-chip-${b}`));
    expect(nameShown()).toBe('Beta');
  });

  test('"show completed" off hides them; order by name; the page opens from a row', async () => {
    const { projects } = setup();
    const b = projects.create({ name: 'Beta' })!;
    const a = projects.create({ name: 'Alpha' })!;
    projects.cycleStatus(b);
    const view = await renderPage();
    await fireEvent.press(screen.getByTestId('proj-options'));
    await fireEvent.press(screen.getByTestId('opt-completati'));
    await redraw(view);
    expect(screen.queryByTestId(`proj-row-${b}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('opt-order-alfabetico'));
    await fireEvent.press(screen.getByTestId('proj-options-close'));
    await fireEvent.press(screen.getByTestId(`proj-row-${a}`));
    expect(nameShown()).toBe('Alpha');
  });

  test('the dates sheet lists deadlines and opens the project', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    projects.update(a, { due_date: '2031-05-20' });
    await renderPage();
    await fireEvent.press(screen.getByTestId('proj-dates'));
    expect(screen.getByTestId('proj-dates-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`dates-row-${a}`));
    expect(nameShown()).toBe('Alpha');
  });

  test('the avatar opens the account', async () => {
    setup();
    await renderPage();
    await fireEvent.press(screen.getByTestId('proj-avatar'));
    expect(mockPush).toHaveBeenCalledWith('/account');
  });

  test('the old /project address lands on the Projects page with the same id', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    mockParams = { id: a };
    await render(
      <ThemeProvider>
        <ProjectScreen />
      </ThemeProvider>,
    );
    expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/projects', params: { id: a } });
  });

  test('a link with an id opens that project straight away', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    mockParams = { id: a };
    await renderPage();
    expect(nameShown()).toBe('Alpha');
  });
});

describe('Projects › page', () => {
  test('branches start closed; adding a sub-project opens it and lists it', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const k = projects.create({ name: 'Kid', parent: a })!;
    projects.create({ name: 'Grand', parent: k });
    mockParams = { id: a };
    const view = await renderPage();
    expect(screen.getByText('Kid')).toBeTruthy();
    expect(screen.queryByText('Grand')).toBeNull();
    await fireEvent.press(screen.getByTestId(`proj-toggle-${k}`));
    expect(screen.getByText('Grand')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`proj-toggle-${k}`));
    expect(screen.queryByText('Grand')).toBeNull();

    await fireEvent.press(screen.getByTestId('proj-sub-add-line'));
    await fireEvent.changeText(screen.getByTestId('proj-sub-input'), 'Second');
    await fireEvent(screen.getByTestId('proj-sub-input'), 'submitEditing');
    await redraw(view);
    expect(screen.getByText('Second')).toBeTruthy();
  });

  test('the circle completes a project with its sub-projects; again brings them back', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const k = projects.create({ name: 'Kid', parent: a })!;
    mockParams = { id: a };
    const view = await renderPage();
    await fireEvent.press(screen.getByTestId('proj-status'));
    expect(projects.get(a)!.status).toBe('completed');
    expect(projects.get(k)!.status).toBe('completed');
    await redraw(view);
    await fireEvent.press(screen.getByTestId('proj-status'));
    expect(projects.get(a)!.status).toBe('planned');
    expect(projects.get(k)!.status).toBe('in_progress');
  });

  test('a sub-project row has its own circle, and opens on tap', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const k = projects.create({ name: 'Kid', parent: a })!;
    mockParams = { id: a };
    await renderPage();
    await fireEvent.press(screen.getByTestId(`proj-status-${k}`));
    expect(projects.get(k)!.status).toBe('completed');
    await fireEvent.press(screen.getByTestId(`kid-${k}`));
    expect(nameShown()).toBe('Kid');
    // il filo d'Arianna riporta al padre
    await fireEvent.press(screen.getByTestId('proj-crumb'));
    expect(nameShown()).toBe('Alpha');
  });

  test('renames by typing on the name, never to empty', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    mockParams = { id: a };
    await renderPage();
    await fireEvent.changeText(screen.getByTestId('proj-name'), 'Alpha 2');
    await fireEvent(screen.getByTestId('proj-name'), 'submitEditing');
    expect(projects.get(a)!.name).toBe('Alpha 2');
    await fireEvent.changeText(screen.getByTestId('proj-name'), '  ');
    await fireEvent(screen.getByTestId('proj-name'), 'blur');
    expect(projects.get(a)!.name).toBe('Alpha 2');
  });

  test('starting a pomodoro and opening the history carry the project along', async () => {
    const { projects, pomodoro } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    pomodoro.addManual({ day: '2030-01-01', from: '09:00', to: '09:30', projectUuid: a });
    mockParams = { id: a };
    await renderPage();
    await fireEvent.press(screen.getByTestId('proj-start'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pomodoro', params: { project: a } });
    await fireEvent.press(screen.getByTestId('proj-time'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/pomodoro-history',
      params: { project: a },
    });
  });

  test('the date in the grey line opens the menu on the deadline', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    projects.update(a, { due_date: '2031-05-20' });
    mockParams = { id: a };
    await renderPage();
    await fireEvent.press(screen.getByTestId('proj-date-meta'));
    expect(screen.getByTestId('proj-due')).toBeTruthy();
  });
});

describe('Projects › the … menu', () => {
  const openMenu = async (row?: string) => {
    await fireEvent.press(screen.getByTestId('proj-menu'));
    if (row) await fireEvent.press(screen.getByTestId(`proj-menu-${row}`));
  };

  test('favourite and the dates, colour auto/custom', async () => {
    const { projects, db } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    mockParams = { id: a };
    const view = await renderPage();
    await openMenu();
    await fireEvent.press(screen.getByTestId('proj-menu-fav'));
    expect(projects.get(a)!.is_favorite).toBeTruthy();
    await redraw(view);

    // senza data, toccare il campo mette quella di oggi; poi il selettore la cambia
    await fireEvent.press(screen.getByTestId('proj-menu-due'));
    await fireEvent.press(screen.getByTestId('proj-due'));
    expect(projects.get(a)!.due_date).toBe(localToday());
    await redraw(view);
    await fireEvent(screen.getByTestId('proj-due'), 'valueChange', {}, new Date(2031, 4, 20));
    expect(projects.get(a)!.due_date).toBe('2031-05-20');
    await fireEvent.press(screen.getByTestId('proj-menu-back'));

    await fireEvent.press(screen.getByTestId('proj-menu-target'));
    await fireEvent.press(screen.getByTestId('proj-target'));
    await redraw(view);
    await fireEvent(screen.getByTestId('proj-target'), 'valueChange', {}, new Date(2031, 6, 1));
    expect(projects.get(a)!.target_date).toBe('2031-07-01');
    await fireEvent.press(screen.getByTestId('proj-menu-back'));

    await fireEvent.press(screen.getByTestId('proj-menu-color'));
    await fireEvent.press(screen.getByTestId('swatch-FF2D55'));
    expect(projects.get(a)).toMatchObject({ color: '#FF2D55', color_edited: 1 });
    await fireEvent(screen.getByTestId('proj-color-auto'), 'valueChange', true);
    expect(projects.get(a)).toMatchObject({ color: '#8E8E93', color_edited: 0 });
    expect(nextBatch(db, 50).length).toBeGreaterThan(0);
  });

  test('a plain note is kept, also without tapping away', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    mockParams = { id: a };
    await renderPage();
    await openMenu('note');
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
  });

  test('a note with formatting opens in the rich editor and keeps its format when edited', async () => {
    const { projects } = setup();
    const rich = JSON.stringify({
      v: 2,
      blocks: [{ t: 'p', runs: [{ s: 'Bold', m: { b: 1 } }, { s: ' idea' }] }],
    });
    const a = projects.create({ name: 'Alpha', notes: rich })!;
    mockParams = { id: a };
    await renderPage();
    // la scheda ne mostra l'inizio, in testo semplice
    expect(screen.getByTestId('proj-note-preview')).toBeTruthy();
    await openMenu('note');
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
    await renderPage();
    await openMenu('note');
    jest.useFakeTimers();
    await fireEvent.changeText(screen.getByTestId('proj-note-rich-block-0'), 'x'.repeat(8100));
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    jest.useRealTimers();
    expect(screen.getByTestId('proj-note-long')).toBeTruthy();
    expect(projects.get(a)!.notes).toBe(rich);
  });

  test('moves under another project (never inside itself)', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const b = projects.create({ name: 'Beta' })!;
    const k = projects.create({ name: 'Kid', parent: a })!;
    mockParams = { id: a };
    await renderPage();
    await openMenu('parent');
    await fireEvent.press(screen.getByTestId('proj-move'));
    expect(screen.queryByTestId(`project-pick-${k}`)).toBeNull(); // il suo ramo non si offre
    await fireEvent.press(screen.getByTestId(`project-pick-${b}`));
    expect(projects.get(a)!.parent_uuid).toBe(b);
  });

  test('moves back to the top level', async () => {
    const { projects } = setup();
    const b = projects.create({ name: 'Beta' })!;
    const a = projects.create({ name: 'Alpha', parent: b })!;
    mockParams = { id: a };
    await renderPage();
    await openMenu('parent');
    await fireEvent.press(screen.getByTestId('proj-move'));
    await fireEvent.press(screen.getByTestId('project-pick-root'));
    expect(projects.get(a)!.parent_uuid).toBeNull();
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
    await renderPage();
    await openMenu();
    await fireEvent.press(screen.getByTestId('proj-menu-delete'));
    await fireEvent.press(screen.getByTestId('proj-del-keep'));
    expect(projects.get(a)).toBeNull();
    expect(pomodoro.get(s)).toMatchObject({ project_uuid: null });
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
    const view = await renderPage();
    await openMenu();
    await fireEvent.press(screen.getByTestId('proj-menu-delete'));
    await fireEvent.press(screen.getByTestId('proj-del-all'));
    expect(pomodoro.get(s)).toBeNull();
    await redraw(view);
    // il progetto non c'è più: si torna all'elenco
    expect(screen.queryByTestId('proj-name')).toBeNull();

    const b = projects.create({ name: 'Beta' })!;
    mockVersion += 1;
    await redraw(view);
    await fireEvent.press(screen.getByTestId(`proj-row-${b}`));
    await openMenu();
    await fireEvent.press(screen.getByTestId('proj-menu-delete'));
    await fireEvent.press(screen.getByTestId('proj-del-yes'));
    expect(projects.get(b)).toBeNull();
  });

  test('deleting a sub-project returns to its parent', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const k = projects.create({ name: 'Kid', parent: a })!;
    mockParams = { id: k };
    await renderPage();
    await openMenu();
    await fireEvent.press(screen.getByTestId('proj-menu-delete'));
    await fireEvent.press(screen.getByTestId('proj-del-yes'));
    expect(projects.get(k)).toBeNull();
    expect(nameShown()).toBe('Alpha');
  });

  test('the Activities switch shows the linked tasks: tick one, add one', async () => {
    const { projects, tasks } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const mine = tasks.create({ title: 'Read chapter 1', project_uuid: a });
    tasks.create({ title: 'Other project task' });
    mockParams = { id: a };
    const view = await renderPage();
    // spento: nessuna lista
    expect(screen.queryByTestId('proj-task-new')).toBeNull();
    await openMenu('todo');
    expect(projects.get(a)!.todo_enabled).toBe(1);
    await fireEvent.press(screen.getAllByLabelText('Close')[0]!);
    await redraw(view);
    expect(screen.getByText('Read chapter 1')).toBeTruthy();
    expect(screen.queryByText('Other project task')).toBeNull();

    await fireEvent.press(screen.getByTestId(`proj-task-${mine}`));
    expect(tasks.get(mine)!.is_done).toBe(1);

    await fireEvent.changeText(screen.getByTestId('proj-task-new'), '  Write summary ');
    await fireEvent.press(screen.getByTestId('proj-task-add'));
    expect(tasks.ofProject(a).map((x) => x.title)).toContain('Write summary');
    // titolo vuoto: non crea niente
    await fireEvent.press(screen.getByTestId('proj-task-add'));
    expect(tasks.ofProject(a)).toHaveLength(2);

    await openMenu('todo');
    expect(projects.get(a)!.todo_enabled).toBe(0);
  });
});

describe('Projects › sub-projects', () => {
  test('can be shown as a grid of cards, and the choice stays', async () => {
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
    const view = await renderPage();
    expect(screen.queryByTestId('sub-grid')).toBeNull();
    await fireEvent.press(screen.getByTestId('sub-view-toggle'));
    await redraw(view);
    expect(screen.getByTestId('sub-grid')).toBeTruthy();
    // la scheda mostra il tempo e quanti sotto-progetti sono fatti; l'altra ha un trattino
    expect(screen.getByTestId(`kid-bar-${k1}`)).toBeTruthy();
    expect(screen.queryByTestId(`kid-bar-${k2}`)).toBeNull();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
    // la scelta resta sul telefono
    expect(store.subView()).toBe('grid');
    // toccare una scheda apre il sotto-progetto
    await fireEvent.press(screen.getByTestId(`kid-${k2}`));
    expect(nameShown()).toBe('Kid 2');
    await fireEvent.press(screen.getByTestId('proj-crumb'));
    // dalla griglia si torna all'elenco
    await fireEvent.press(screen.getByTestId('sub-view-toggle'));
    expect(store.subView()).toBe('list');
  });

  test('selecting: colour, move and delete them together', async () => {
    const { projects, pomodoro } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const b = projects.create({ name: 'Beta' })!;
    const k1 = projects.create({ name: 'Kid 1', parent: a })!;
    const k2 = projects.create({ name: 'Kid 2', parent: a })!;
    const k3 = projects.create({ name: 'Kid 3', parent: a })!;
    mockParams = { id: a };
    const view = await renderPage();

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
    await redraw(view);

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
    await redraw(view);

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
