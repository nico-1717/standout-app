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
import ProjectsScreen from '../(tabs)/projects';

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
    // il timer apre prima l'elenco dei Pomodoro del progetto, che ha il tasto «Avvia su questo»
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/pomodoro-history',
      params: { project: a },
    });
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
    projects.create({ name: 'Kid 4', parent: a });
    mockParams = { id: a };
    const view = await renderPage();

    await fireEvent.press(screen.getByTestId('sub-select-toggle'));
    await fireEvent.press(screen.getByTestId('sub-bulk-color'));
    expect(screen.getByTestId('sub-count')).toHaveTextContent(/at least one/i); // niente scelti: un avviso
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

  test('fold-all only hides rows: the parent stays, a second press brings everything back', async () => {
    const { projects } = setup();
    const top = projects.create({ name: 'Interview' })!;
    const neet = projects.create({ name: 'NeetCode', parent: top })!;
    const a = projects.create({ name: 'Claude manual', parent: neet })!;
    const leet = projects.create({ name: 'LeetCode', parent: neet })!;
    const x = projects.create({ name: 'Two Sum', parent: leet })!;
    mockParams = { id: top };
    await renderPage();
    const press = async () => fireEvent.press(screen.getByTestId('sub-fold-all'));
    // apri tutto
    if (!screen.queryByTestId(`kid-${x}`)) await press();
    expect(screen.getByTestId(`kid-${neet}`)).toBeTruthy();
    expect(screen.getByTestId(`kid-${a}`)).toBeTruthy();
    expect(screen.getByTestId(`kid-${leet}`)).toBeTruthy();
    expect(screen.getByTestId(`kid-${x}`)).toBeTruthy();
    // chiudi tutto: il padre resta, i figli no
    await press();
    expect(screen.getByTestId(`kid-${neet}`)).toBeTruthy();
    expect(screen.queryByTestId(`kid-${a}`)).toBeNull();
    // riapri: tutto torna
    await press();
    expect(screen.getByTestId(`kid-${leet}`)).toBeTruthy();
    expect(screen.getByTestId(`kid-${x}`)).toBeTruthy();
    expect(projects.all().length).toBe(5);
  });

  test('opening one branch keeps its parent row and does not change any status', async () => {
    const { projects } = setup();
    const top = projects.create({ name: 'Interview' })!;
    const neet = projects.create({ name: 'NeetCode', parent: top })!;
    const a = projects.create({ name: 'Claude manual', parent: neet })!;
    projects.create({ name: 'LeetCode', parent: neet });
    mockParams = { id: top };
    await renderPage();
    expect(screen.getByTestId(`kid-${neet}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`proj-toggle-${neet}`));
    expect(screen.getByTestId(`kid-${neet}`)).toBeTruthy();
    expect(screen.getByTestId(`kid-${a}`)).toBeTruthy();
    expect(projects.all().find((x) => x.uuid === neet)?.status).not.toBe('completed');
  });

  test('like the website: time under the timer, "Add to" at the end of an open branch, "Add a note"', async () => {
    const { projects, pomodoro } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const k1 = projects.create({ name: 'Kid 1', parent: a })!;
    projects.create({ name: 'Kid 2', parent: a });
    const g1 = projects.create({ name: 'Grandkid', parent: k1 })!;
    pomodoro.addManual({ day: '2030-01-01', from: '09:00', to: '10:30', projectUuid: g1 });
    mockParams = { id: a };
    await renderPage();
    if (!screen.queryByTestId(`kid-${g1}`))
      await fireEvent.press(screen.getByTestId(`proj-toggle-${k1}`));
    // il tempo sta sotto il timer, anche dei rami (come prog_fmt_duration del sito)
    expect(screen.getByTestId(`proj-time-${k1}`)).toHaveTextContent('1h 30m');
    expect(screen.getByTestId(`proj-time-${g1}`)).toHaveTextContent('1h 30m');
    // «Aggiungi a Kid 1» chiude il ramo aperto
    expect(screen.getByTestId(`proj-add-in-${k1}`)).toHaveTextContent('Add to Kid 1');
    // la scheda non ha una nota: la riga per scriverla c'è
    expect(screen.getByTestId('proj-note-add')).toHaveTextContent('Add a note');
  });

  test('selecting works at every level: a chosen parent locks its children', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const k1 = projects.create({ name: 'Kid 1', parent: a })!;
    projects.create({ name: 'Kid 2', parent: a });
    const g1 = projects.create({ name: 'Grandkid', parent: k1 })!;
    mockParams = { id: a };
    await renderPage();
    if (!screen.queryByTestId(`kid-${g1}`))
      await fireEvent.press(screen.getByTestId(`proj-toggle-${k1}`));
    await fireEvent.press(screen.getByTestId('sub-select-toggle'));
    await fireEvent.press(screen.getByTestId(`kid-${g1}`)); // un figlio di un figlio si sceglie da solo
    expect(screen.getByTestId('sub-count')).toHaveTextContent(/1 selected/);
    await fireEvent.press(screen.getByTestId(`kid-${k1}`)); // scegliendo il padre, il figlio non conta due volte
    expect(screen.getByTestId('sub-count')).toHaveTextContent(/1 selected/);
    await fireEvent.press(screen.getByTestId(`kid-${g1}`)); // ora è bloccato: il tocco non fa niente
    expect(screen.getByTestId('sub-count')).toHaveTextContent(/1 selected/);
    expect(screen.getByTestId(`kid-${g1}`).props.accessibilityState).toMatchObject({
      checked: true,
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('sub-select-close'));
    expect(screen.queryByTestId('sub-count')).toBeNull(); // la barra se ne va
  });
});

/* ---- tenere premuta una riga e trascinarla (come sul sito) ---- */
let clock = 1;
const touch = (y: number, active = true) => {
  clock += 1;
  const t = { pageX: 100, pageY: y, identifier: 0, timestamp: clock, locationX: 0, locationY: 0 };
  return {
    nativeEvent: { touches: active ? [t] : [], changedTouches: [t], pageX: 100, pageY: y },
    touchHistory: {
      touchBank: [
        {
          touchActive: active,
          startPageX: 100,
          startPageY: 30,
          startTimeStamp: 1,
          currentPageX: 100,
          currentPageY: y,
          currentTimeStamp: clock,
          previousPageX: 100,
          previousPageY: y,
          previousTimeStamp: clock - 1,
        },
      ],
      numberActiveTouches: active ? 1 : 0,
      indexOfSingleActiveTouch: active ? 0 : -1,
      mostRecentTimeStamp: clock,
    },
  } as never;
};
type Handlers = Record<string, (e: never) => unknown>;
const rows = () => screen.getByTestId('sub-rows').props as Handlers;
/** Ogni riga alta 60, una sotto l'altra, come le misurerebbe il telefono. */
const layOut = async (ids: string[]) => {
  for (const [i, id] of ids.entries())
    await fireEvent(screen.getByTestId(`drag-item-${id}`), 'layout', {
      nativeEvent: { layout: { x: 0, y: i * 60, width: 300, height: 60 } },
    });
};
/** Premere a lungo la riga `id` e portare il dito fino a `y`, poi lasciare. */
const dragTo = async (id: string, from: number, to: number, hold = 0) => {
  await fireEvent(screen.getByTestId(`kid-${id}`), 'longPress');
  await act(async () => {
    expect(rows().onMoveShouldSetResponderCapture!(touch(from + 5))).toBe(true);
    rows().onResponderGrant!(touch(from));
    rows().onResponderMove!(touch(to));
  });
  if (hold) await act(async () => void jest.advanceTimersByTime(hold));
  await act(async () => {
    rows().onResponderRelease!(touch(to, false));
  });
};

describe('Projects › dragging a row', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const kids = () => {
    const s = setup();
    const a = s.projects.create({ name: 'Alpha' })!;
    const k1 = s.projects.create({ name: 'Kid 1', parent: a, position: 'last' })!;
    const k2 = s.projects.create({ name: 'Kid 2', parent: a, position: 'last' })!;
    const k3 = s.projects.create({ name: 'Kid 3', parent: a, position: 'last' })!;
    mockParams = { id: a };
    return { ...s, a, k1, k2, k3 };
  };
  const order = (projects: ProjectsRepo, parent: string) =>
    projects
      .all()
      .filter((p) => p.parent_uuid === parent)
      .sort((x, y) => (x.sort_key < y.sort_key ? -1 : 1))
      .map((p) => p.name);

  test('holding a row, it lifts; moving it past the others puts it in the new place', async () => {
    const { projects, a, k1, k2, k3 } = kids();
    await renderPage();
    await layOut([k1, k2, k3]);
    await fireEvent(screen.getByTestId(`kid-${k1}`), 'longPress');
    expect(screen.getByTestId(`drag-item-${k1}`).props.style).toBeTruthy();
    await act(async () => {
      rows().onResponderGrant!(touch(30));
      rows().onResponderMove!(touch(175));
    });
    await act(async () => {
      rows().onResponderRelease!(touch(175, false));
    });
    expect(order(projects, a)).toEqual(['Kid 2', 'Kid 3', 'Kid 1']);
    expect(mockChanged).toHaveBeenCalled();
  });

  test('a long press that does not move changes nothing', async () => {
    const { projects, a, k1, k2, k3 } = kids();
    await renderPage();
    await layOut([k1, k2, k3]);
    await fireEvent(screen.getByTestId(`kid-${k1}`), 'longPress');
    await fireEvent(screen.getByTestId(`kid-${k1}`), 'pressOut');
    await act(async () => void jest.advanceTimersByTime(5));
    expect(order(projects, a)).toEqual(['Kid 1', 'Kid 2', 'Kid 3']);
  });

  test('dropped on the middle of a sibling (held a moment) it goes inside, with an Undo', async () => {
    const { projects, a, k1, k2, k3 } = kids();
    const view = await renderPage();
    await layOut([k1, k2, k3]);
    await dragTo(k1, 30, 90, 300);
    expect(projects.get(k1)?.parent_uuid).toBe(k2);
    await redraw(view);
    expect(screen.getByTestId('sub-notice')).toHaveTextContent(/“Kid 1” moved into “Kid 2”/);
    await fireEvent.press(screen.getByTestId('sub-notice-undo'));
    expect(projects.get(k1)?.parent_uuid).toBe(a);
  });

  test('without the hold, the middle of a sibling does not nest', async () => {
    const { projects, a, k1, k2, k3 } = kids();
    await renderPage();
    await layOut([k1, k2, k3]);
    await dragTo(k1, 30, 90, 50);
    expect(projects.get(k1)?.parent_uuid).toBe(a);
  });

  test('over a project of another branch it goes inside at once', async () => {
    const { projects, k1, k2, k3 } = kids();
    const g1 = projects.create({ name: 'Grand 1', parent: k1, position: 'last' })!;
    const view = await renderPage();
    await fireEvent.press(screen.getByTestId(`proj-toggle-${k1}`));
    await redraw(view);
    await layOut([k1, g1, k2, k3]);
    await dragTo(k3, 150, 90);
    expect(projects.get(k3)?.parent_uuid).toBe(g1);
  });

  test('a project cannot go inside itself', async () => {
    const { projects, a, k1, k2, k3 } = kids();
    const g1 = projects.create({ name: 'Grand 1', parent: k1, position: 'last' })!;
    const view = await renderPage();
    await fireEvent.press(screen.getByTestId(`proj-toggle-${k1}`));
    await redraw(view);
    await layOut([k1, g1, k2, k3]);
    await dragTo(k1, 30, 90);
    expect(projects.get(k1)?.parent_uuid).toBe(a);
    expect(projects.get(g1)?.parent_uuid).toBe(k1);
  });

  test('with a sorted order a row is not reordered by hand', async () => {
    const { db, projects, a, k1, k2, k3 } = kids();
    new ProjectOptionsStore(db).write({ ordine: 'alfabetico' });
    await renderPage();
    await layOut([k1, k2, k3]);
    await dragTo(k1, 30, 175);
    expect(order(projects, a)).toEqual(['Kid 1', 'Kid 2', 'Kid 3']);
  });
});

/* ---- scorrere una riga: i tasti nascosti (Aggiungi dentro, Sposta, Elimina) ---- */
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
/** Trascinare la riga `id` di `dx` punti verso destra e lasciarla. */
const swipe = async (id: string, dx: number) => {
  const h = screen.getByTestId(`swipe-pan-${id}`).props as Handlers;
  lastX = 100;
  await act(async () => {
    // il capture aggiorna il gesto (come fa il telefono prima di chiedere «lo prendo io?»)
    h.onMoveShouldSetResponderCapture!(touchX(100));
    const end = touchX(100 + dx);
    h.onMoveShouldSetResponderCapture!(end);
    expect(h.onMoveShouldSetResponder!(end)).toBe(true);
    h.onResponderGrant!(touchX(100));
    h.onResponderMove!(touchX(100 + dx));
    h.onResponderRelease!(touchX(100 + dx, false));
  });
};

describe('Projects › swiping a row', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const kids = () => {
    const s = setup();
    const a = s.projects.create({ name: 'Alpha' })!;
    const k1 = s.projects.create({ name: 'Kid 1', parent: a, position: 'last' })!;
    const k2 = s.projects.create({ name: 'Kid 2', parent: a, position: 'last' })!;
    mockParams = { id: a };
    return { ...s, a, k1, k2 };
  };

  test('a short swipe springs back, a long one stays open; a tap on the open row only closes it', async () => {
    const { k1 } = kids();
    await renderPage();
    await swipe(k1, 40);
    expect(screen.queryByTestId(`swipe-close-${k1}`)).toBeNull();
    await swipe(k1, 150);
    expect(screen.getByTestId(`swipe-close-${k1}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`swipe-close-${k1}`));
    expect(screen.queryByTestId(`swipe-close-${k1}`)).toBeNull();
    expect(mockParams.id).toBeTruthy();
  });

  test('only one row is open at a time', async () => {
    const { k1, k2 } = kids();
    await renderPage();
    await swipe(k1, 150);
    await swipe(k2, 150);
    expect(screen.queryByTestId(`swipe-close-${k1}`)).toBeNull();
    expect(screen.getByTestId(`swipe-close-${k2}`)).toBeTruthy();
  });

  test('«Add inside» opens the field under that row and creates a child of it', async () => {
    const { projects, k1 } = kids();
    await renderPage();
    await swipe(k1, 150);
    await fireEvent.press(screen.getByTestId(`swipe-add-${k1}`));
    await fireEvent.changeText(screen.getByTestId('proj-sub-input'), 'Deep one');
    await fireEvent.press(screen.getByTestId('proj-sub-add'));
    const made = projects.all().find((x) => x.name === 'Deep one');
    expect(made?.parent_uuid).toBe(k1);
  });

  test('«Move» sends it to the top level', async () => {
    const { projects, k1 } = kids();
    await renderPage();
    await swipe(k1, 150);
    await fireEvent.press(screen.getByTestId(`swipe-move-${k1}`));
    await fireEvent.press(screen.getByTestId('project-pick-root'));
    expect(projects.get(k1)?.parent_uuid).toBeNull();
  });

  test('«Delete» asks first; Cancel keeps the project, Delete removes it', async () => {
    const { projects, k1 } = kids();
    await renderPage();
    await swipe(k1, 150);
    await fireEvent.press(screen.getByTestId(`swipe-delete-${k1}`));
    await fireEvent.press(screen.getByTestId('row-delete-cancel'));
    expect(projects.get(k1)).not.toBeNull();
    await swipe(k1, 150);
    await fireEvent.press(screen.getByTestId(`swipe-delete-${k1}`));
    await fireEvent.press(screen.getByTestId('row-delete-yes'));
    expect(projects.get(k1)).toBeNull();
  });

  test('with pomodoros linked it asks what to do with them', async () => {
    const { projects, pomodoro, k1 } = kids();
    pomodoro.addManual({ day: '2030-01-01', from: '09:00', to: '09:30', projectUuid: k1 });
    await renderPage();
    await swipe(k1, 150);
    await fireEvent.press(screen.getByTestId(`swipe-delete-${k1}`));
    await fireEvent.press(screen.getByTestId('row-delete-keep'));
    await fireEvent.press(screen.getByTestId('row-delete-yes'));
    expect(projects.get(k1)).toBeNull();
    expect(projects.sessionCount([k1])).toBe(0);
  });

  test('on the main list too: «Add inside» a top-level project', async () => {
    const s = setup();
    const a = s.projects.create({ name: 'Alpha' })!;
    await renderPage();
    await swipe(a, 150);
    await fireEvent.press(screen.getByTestId(`swipe-add-${a}`));
    await fireEvent.changeText(screen.getByTestId('proj-sub-input'), 'First kid');
    await fireEvent.press(screen.getByTestId('proj-sub-add'));
    expect(s.projects.all().find((x) => x.name === 'First kid')?.parent_uuid).toBe(a);
  });
});

describe('Projects › breadcrumbs', () => {
  test('each project that contains this one is its own tap target', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Alpha' })!;
    const b = projects.create({ name: 'Beta', parent: a, position: 'last' })!;
    const c = projects.create({ name: 'Gamma', parent: b, position: 'last' })!;
    mockParams = { id: c };
    const view = await renderPage();
    expect(screen.getByTestId(`proj-crumb-${a}`)).toBeTruthy();
    expect(screen.getByTestId('proj-crumb')).toHaveTextContent('Beta');
    await fireEvent.press(screen.getByTestId(`proj-crumb-${a}`));
    await redraw(view);
    expect(nameShown()).toBe('Alpha');
  });
});
