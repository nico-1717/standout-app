import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import i18n from '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import { todoTheme } from '@/features/tasks/todoTheme';

import { noteLines, QuickNoteCard } from '../QuickNoteCard';
import { QuickNoteStore } from '../quickNote';

let mockNotes: QuickNoteStore;
let mockVersion = 0;
const mockChanged = jest.fn();
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: { notes: mockNotes }, version: mockVersion, changed: mockChanged }),
}));

function Card({ onSort }: { onSort?: (l: { orig: number; text: string }[]) => void }) {
  const th = useTheme();
  return <QuickNoteCard td={todoTheme('standard', th)} paper={false} onSort={onSort} />;
}
const ui = (onSort?: (l: { orig: number; text: string }[]) => void) =>
  render(
    <ThemeProvider accent="blue">
      <Card onSort={onSort} />
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockVersion = 0;
  mockNotes = new QuickNoteStore(memoryDb());
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

  test('sort by hand is off for an empty note and passes the lines otherwise', async () => {
    const onSort = jest.fn();
    await ui(onSort);
    await fireEvent.press(screen.getByTestId('note-sort'));
    expect(onSort).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('note-input'), 'compra latte\ndentista domani');
    await fireEvent.press(screen.getByTestId('note-sort'));
    expect(onSort).toHaveBeenCalledWith([
      { orig: 0, text: 'compra latte' },
      { orig: 1, text: 'dentista domani' },
    ]);
  });
});
