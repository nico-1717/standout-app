import { QuickNoteStore } from '@/features/notes/quickNote';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { addDaysIso, localToday } from '@/features/tasks/groups';
import { TasksRepo } from '@/features/tasks/repo';

import TodoScreen from '../(tabs)/index';

let mockStyle: 'standard' | 'paper' = 'standard';
let mockServices: unknown;
let mockVersion = 0;
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    uiStyle: mockStyle,
    syncInfo: { status: 'idle', lastSyncAt: null, pending: 0 },
  }),
}));

const TODAY = localToday();
const YESTERDAY = addDaysIso(TODAY, -1);
const TOMORROW = addDaysIso(TODAY, 1);

function setup() {
  const db = memoryDb();
  migrate(db);
  const tasks = new TasksRepo(db);
  const late = tasks.create({ title: 'Pay the bill', due_date: YESTERDAY });
  const today = tasks.create({ title: 'Call Anna', due_date: TODAY });
  const later = tasks.create({ title: 'Book the train', due_date: TOMORROW, due_time: '15:00' });
  const idea = tasks.create({ title: 'Read a book' });
  mockServices = { db, tasks, notes: new QuickNoteStore(db), scheduler: { trigger: jest.fn() } };
  return { tasks, late, today, later, idea };
}

const renderIt = () =>
  render(
    <ThemeProvider>
      <TodoScreen />
    </ThemeProvider>,
  );

const rerender = async () => {
  // il motore vero fa ridisegnare la schermata dopo ogni modifica: qui basta un nuovo disegno
  await act(async () => {});
};

describe.each(['standard', 'paper'] as const)('To do screen (%s)', (style) => {
  beforeEach(() => {
    mockStyle = style;
    mockVersion = 0;
    mockChanged.mockClear();
    jest.restoreAllMocks();
  });

  test('shows the website groups with counts, in the website order', async () => {
    setup();
    await renderIt();
    expect(screen.getByText('Overdue')).toBeTruthy();
    expect(screen.getByTestId('todo-group-oggi')).toBeTruthy();
    expect(screen.getByTestId('todo-group-domani')).toBeTruthy();
    expect(screen.getByText('No date')).toBeTruthy();
    expect(screen.getByDisplayValue('Pay the bill')).toBeTruthy();
    // la riga a riposo dice giorno e ora in una frase sola
    expect(screen.getByText('Tomorrow · 15:00')).toBeTruthy();
  });

  test('empty list shows the website sentence', async () => {
    const db = memoryDb();
    migrate(db);
    mockServices = {
      db,
      tasks: new TasksRepo(db),
      notes: new QuickNoteStore(db),
      scheduler: { trigger: jest.fn() },
    };
    await renderIt();
    expect(screen.getByTestId('todo-empty')).toBeTruthy();
  });

  test('the smart bar understands day and time and shows what it understood', async () => {
    const { tasks } = setup();
    await renderIt();
    const input = screen.getByTestId('todo-input');
    await fireEvent.changeText(input, 'dentist tomorrow at 3pm');
    const chips = within(screen.getByTestId('todo-understood'));
    expect(chips.getByText('Tomorrow')).toBeTruthy();
    expect(chips.getByText('15:00')).toBeTruthy();
    await fireEvent(input, 'submitEditing');
    const added = tasks.list('todo').find((x) => x.title.toLowerCase().includes('dentist'))!;
    expect(added).toMatchObject({ due_date: TOMORROW, due_time: '15:00' });
    expect(mockChanged).toHaveBeenCalled();
    expect((screen.getByTestId('todo-input').props as { value: string }).value).toBe('');
  });

  test('a plain title is added without date', async () => {
    const { tasks } = setup();
    await renderIt();
    const input = screen.getByTestId('todo-input');
    await fireEvent.changeText(input, 'buy stamps');
    await fireEvent.press(screen.getByTestId('todo-add'));
    expect(tasks.list('todo').find((x) => x.title === 'Buy stamps')).toMatchObject({
      due_date: null,
      due_time: null,
    });
  });

  test('ticking the circle marks the task done', async () => {
    const { tasks, idea } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId(`box-${idea}`));
    expect(tasks.get(idea)!.is_done).toBe(1);
  });

  test('opening a row shows the quick days; they set and clear the date', async () => {
    const { tasks, today } = setup();
    await renderIt();
    expect(screen.queryByTestId(`quick-domani-${today}`)).toBeNull();
    await fireEvent(screen.getByTestId(`title-${today}`), 'focus');
    await fireEvent.press(screen.getByTestId(`quick-domani-${today}`));
    expect(tasks.get(today)!.due_date).toBe(TOMORROW);
    await fireEvent.press(screen.getByTestId(`quick-senza-${today}`));
    expect(tasks.get(today)).toMatchObject({ due_date: null, due_time: null });
  });

  test('a touched row stays where it is until you tap elsewhere', async () => {
    const { tasks, late } = setup();
    await renderIt();
    await fireEvent(screen.getByTestId(`title-${late}`), 'focus');
    await fireEvent.press(screen.getByTestId(`quick-oggi-${late}`));
    expect(tasks.get(late)!.due_date).toBe(TODAY);
    // ancora sotto «In ritardo»: il sito non riordina da sotto il dito
    expect(screen.getByTestId('todo-group-ritardo')).toBeTruthy();
    await fireEvent(screen.getByTestId('todo-input'), 'focus');
    await rerender();
    expect(screen.queryByTestId('todo-group-ritardo')).toBeNull();
  });

  test('editing the title saves it; an empty title is ignored', async () => {
    const { tasks, idea } = setup();
    await renderIt();
    const title = screen.getByTestId(`title-${idea}`);
    await fireEvent(title, 'endEditing', { nativeEvent: { text: 'Read two books' } });
    expect(tasks.get(idea)!.title).toBe('Read two books');
    await rerender();
    await fireEvent(screen.getByTestId(`title-${idea}`), 'endEditing', {
      nativeEvent: { text: '  ' },
    });
    expect(tasks.get(idea)!.title).toBe('Read two books');
  });

  test('the duration is a number in minutes, 30 when it makes no sense', async () => {
    const { tasks, later } = setup();
    await renderIt();
    await fireEvent(screen.getByTestId(`title-${later}`), 'focus');
    const dur = screen.getByTestId(`chip-min-${later}`);
    await fireEvent(dur, 'endEditing', { nativeEvent: { text: '45' } });
    expect(tasks.get(later)!.duration_minutes).toBe(45);
    // si chiude la riga: la frase a riposo mostra anche la durata, perché non è quella di sempre
    await fireEvent(screen.getByTestId('todo-input'), 'focus');
    await rerender();
    expect(screen.getByText('Tomorrow · 15:00 · 45 min')).toBeTruthy();
  });

  test('deleting asks first, then removes', async () => {
    const { tasks, idea } = setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderIt();
    await fireEvent(screen.getByTestId(`title-${idea}`), 'focus');
    await fireEvent.press(screen.getByTestId(`chip-trash-${idea}`));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(tasks.get(idea)).not.toBeNull();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((b) => b.style === 'destructive')!.onPress!());
    expect(tasks.get(idea)).toBeNull();
  });

  test('select mode: pick two, schedule them together, then delete', async () => {
    const { tasks, idea, today } = setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderIt();
    await fireEvent.press(screen.getByTestId('todo-select'));
    expect(screen.getByTestId('bulk-count').props.children).toBe('none selected');
    await fireEvent.press(screen.getByTestId(`pick-${idea}`));
    await fireEvent.press(screen.getByTestId(`pick-${today}`));
    expect(screen.getByTestId('bulk-count').props.children).toBe('2 selected');

    await fireEvent.press(screen.getByTestId('bulk-schedule'));
    expect(screen.getByTestId('when-modal')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('when-minutes'), '50');
    await fireEvent.press(screen.getByTestId('when-apply'));
    expect(tasks.get(idea)).toMatchObject({ due_date: TODAY, duration_minutes: 50 });
    expect(tasks.get(today)).toMatchObject({ due_date: TODAY, duration_minutes: 50 });

    await rerender();
    await fireEvent.press(screen.getByTestId(`pick-${idea}`));
    await fireEvent.press(screen.getByTestId('bulk-delete'));
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((b) => b.style === 'destructive')!.onPress!());
    expect(tasks.get(idea)).toBeNull();
    expect(tasks.get(today)).not.toBeNull();
  });
});
