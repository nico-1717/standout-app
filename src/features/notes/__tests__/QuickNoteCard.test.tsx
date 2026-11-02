import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { CategoriesRepo } from '@/features/buy/categoriesRepo';
import { TasksRepo } from '@/features/tasks/repo';
import i18n from '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import { todoTheme } from '@/features/tasks/todoTheme';

import { noteLines, QuickNoteCard } from '../QuickNoteCard';
import { QuickNoteStore } from '../quickNote';

let mockNotes: QuickNoteStore;
let mockServices: Record<string, unknown>;
let mockVersion = 0;
const mockChanged = jest.fn();
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: mockVersion, changed: mockChanged }),
}));

function Card() {
  const th = useTheme();
  return <QuickNoteCard td={todoTheme('standard', th)} paper={false} />;
}
const ui = () =>
  render(
    <ThemeProvider accent="blue">
      <Card />
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockVersion = 0;
  const db = memoryDb();
  mockNotes = new QuickNoteStore(db);
  mockServices = {
    db,
    notes: mockNotes,
    tasks: new TasksRepo(db),
    categories: new CategoriesRepo(db),
  };
});
afterEach(() => jest.useRealTimers());

describe('noteLines', () => {
  test('drops empty lines, bullets and numbers, and remembers where each line was', () => {
    expect(noteLines('- latte\n\n  * pane\n2) chiamare Anna\n3. pulire')).toEqual([
      { orig: 0, text: 'latte' },
      { orig: 2, text: 'pane' },
      { orig: 3, text: 'chiamare Anna' },
      { orig: 4, text: 'pulire' },
    ]);
  });
  test('a line that is only a bullet is empty', () => {
    expect(noteLines('-\n•  \n')).toEqual([]);
  });
});

describe('QuickNoteCard', () => {
  test('shows the saved note', async () => {
    mockNotes.write('uova');
    await ui();
    expect(screen.getByTestId('note-input').props.value).toBe('uova');
    expect(screen.getByTestId('note-count').props.children).toBe(i18n.t('todo.nota_riga_1'));
  });

  test('typing saves on the phone at once and asks for the sync after a short pause', async () => {
    await ui();
    await fireEvent.changeText(screen.getByTestId('note-input'), 'latte\npane');
    expect(mockNotes.read()).toBe('latte\npane');
    expect(mockNotes.hasPending()).toBe(true);
    expect(mockChanged).not.toHaveBeenCalled();
    expect(screen.getByTestId('note-status').props.children).toBe(i18n.t('todo.nota_salvo'));
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    expect(mockChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('note-status').props.children).toBe(i18n.t('todo.nota_salvata'));
    expect(screen.getByTestId('note-count').props.children).toBe(
      i18n.t('todo.nota_righe_n', { n: 2 }),
    );
  });

  test('typing fast makes one sync, not one per key', async () => {
    await ui();
    const input = screen.getByTestId('note-input');
    for (const v of ['a', 'ab', 'abc']) {
      await fireEvent.changeText(input, v);
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
    }
    expect(mockChanged).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(mockChanged).toHaveBeenCalledTimes(1);
  });

  test('leaving the box saves without waiting', async () => {
    await ui();
    await fireEvent(screen.getByTestId('note-input'), 'focus');
    await fireEvent.changeText(screen.getByTestId('note-input'), 'subito');
    await fireEvent(screen.getByTestId('note-input'), 'blur');
    expect(mockChanged).toHaveBeenCalledTimes(1);
  });

  test('a note that arrives from the server shows up, but not while typing', async () => {
    const view = await ui();
    mockNotes.write('dal sito');
    mockVersion = 1;
    await act(async () =>
      view.rerender(
        <ThemeProvider accent="blue">
          <Card />
        </ThemeProvider>,
      ),
    );
    expect(screen.getByTestId('note-input').props.value).toBe('dal sito');

    await fireEvent(screen.getByTestId('note-input'), 'focus');
    mockNotes.write('cambiata altrove');
    mockVersion = 2;
    await act(async () =>
      view.rerender(
        <ThemeProvider accent="blue">
          <Card />
        </ThemeProvider>,
      ),
    );
    expect(screen.getByTestId('note-input').props.value).toBe('dal sito');
  });

  test('sort by hand is off for an empty note', async () => {
    await ui();
    await fireEvent.press(screen.getByTestId('note-sort'));
    expect(screen.queryByTestId('sort-modal')).toBeNull();
  });

  test('sort by hand: check the items, change one, save; saved lines leave the note', async () => {
    const tasks = mockServices.tasks as TasksRepo;
    mockNotes.write('compra latte 1,20\ndentista domani alle 9\nnon so cosa fare');
    await ui();
    await fireEvent.press(screen.getByTestId('note-sort'));
    expect(screen.getByTestId('sort-modal')).toBeTruthy();
    expect(screen.getByTestId('sort-title-0').props.value).toBe('Latte');
    expect(screen.getByTestId('sort-price-0').props.value).toBe('1,20');
    expect(screen.getByTestId('sort-title-1').props.value).toBe('Dentista');

    await fireEvent.changeText(screen.getByTestId('sort-title-1'), 'Dentista Rossi');
    await fireEvent.press(screen.getByTestId('sort-remove-2')); // questa riga resta nella nota
    await fireEvent.press(screen.getByTestId('sort-save'));

    expect(screen.queryByTestId('sort-modal')).toBeNull();
    const buy = tasks.list('buy');
    expect(buy.map((x) => [x.title, x.buy_price_cents])).toEqual([['Latte', 120]]);
    const todos = tasks.list('todo');
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ title: 'Dentista Rossi', due_time: '09:00' });
    expect(mockNotes.read()).toBe('non so cosa fare');
    expect(screen.getByTestId('note-input').props.value).toBe('non so cosa fare');
    expect(screen.getByTestId('note-notice').props.children).toBe(
      i18n.t('todo.nota_fatto_n', { n: 2 }),
    );
    expect(mockChanged).toHaveBeenCalled();
  });

  test('cancelling the sort changes nothing', async () => {
    mockNotes.write('uova');
    await ui();
    await fireEvent.press(screen.getByTestId('note-sort'));
    await fireEvent.press(screen.getByTestId('sort-cancel'));
    expect(screen.queryByTestId('sort-modal')).toBeNull();
    expect(mockNotes.read()).toBe('uova');
    expect((mockServices.tasks as TasksRepo).list('buy')).toEqual([]);
  });

  test('moving a line to to buy and picking a category', async () => {
    const cats = mockServices.categories as CategoriesRepo;
    const cat = cats.create('Casa', '#123456');
    mockNotes.write('lampadina');
    await ui();
    await fireEvent.press(screen.getByTestId('note-sort'));
    await fireEvent.press(screen.getByTestId('sort-dest-0-buy'));
    await fireEvent.press(screen.getByTestId(`sort-cat-0-${cat}`));
    await fireEvent.press(screen.getByTestId('sort-save'));
    const [item] = (mockServices.tasks as TasksRepo).list('buy');
    expect(item).toMatchObject({ title: 'Lampadina', buy_category_uuid: cat });
    expect(mockNotes.read()).toBe('');
  });

  test('a new #category in the line is created once', async () => {
    mockNotes.write('compra viti #ferramenta\ncompra chiodi #ferramenta');
    await ui();
    await fireEvent.press(screen.getByTestId('note-sort'));
    await fireEvent.press(screen.getByTestId('sort-save'));
    const cats = (mockServices.categories as CategoriesRepo).list();
    expect(cats.map((c) => c.name)).toEqual(['ferramenta']);
    const buy = (mockServices.tasks as TasksRepo).list('buy');
    expect(buy).toHaveLength(2);
    expect(new Set(buy.map((b) => b.buy_category_uuid)).size).toBe(1);
  });
});
