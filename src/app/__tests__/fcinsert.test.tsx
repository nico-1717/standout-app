import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { FlashcardsRepo } from '@/features/flashcards/repo';

import InsertScreen from '../fc-insert';

let mockServices: unknown;
let mockParams: Record<string, string> = {};
const mockChanged = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ services: mockServices, version: 0, changed: mockChanged }),
}));

function setup() {
  const db = memoryDb();
  migrate(db);
  const flashcards = new FlashcardsRepo(db);
  mockServices = { db, flashcards };
  const deck = flashcards.createDeck({ name: 'Maths' })!;
  mockParams = { deck };
  mockChanged.mockClear();
  return { flashcards, deck };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('insert many cards', () => {
  test('paste a table: it understands the format, a column can be changed, then it creates the cards', async () => {
    const { flashcards, deck } = setup();
    await render(wrap(<InsertScreen />));
    await fireEvent.changeText(
      screen.getByTestId('fci-text'),
      'Domanda\tRisposta\nCos’è un limite?\tIl valore a cui tende\nDerivata\tTasso di variazione',
    );
    expect(screen.getByTestId('fci-format')).toBeTruthy();
    expect(screen.getByText('2 cards')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fci-create'));
    const cards = flashcards.cards(deck);
    expect(cards.map((c) => c.question_desc)).toEqual(['Cos’è un limite?', 'Derivata']);
    expect(cards.map((c) => c.answer_desc)).toEqual([
      'Il valore a cui tende',
      'Tasso di variazione',
    ]);
    expect(screen.getByTestId('fci-done')).toBeTruthy();
    expect(mockChanged).toHaveBeenCalled();
  });

  test('swapping the columns swaps question and answer', async () => {
    const { flashcards, deck } = setup();
    await render(wrap(<InsertScreen />));
    await fireEvent.changeText(screen.getByTestId('fci-text'), 'cold - freddo\nhot - caldo');
    // la colonna 2 diventa «domanda»: la 1 cede il campo
    await fireEvent.press(screen.getByTestId('fci-col-0')); // q -> a (la colonna 2 perde «risposta»)
    await fireEvent.press(screen.getByTestId('fci-col-1')); // ignora -> q
    await fireEvent.press(screen.getByTestId('fci-create'));
    expect(flashcards.cards(deck).map((c) => c.question_desc)).toEqual(['freddo', 'caldo']);
  });

  test('a broken JSON shows an error and creates nothing', async () => {
    setup();
    await render(wrap(<InsertScreen />));
    await fireEvent.changeText(screen.getByTestId('fci-text'), '[{"q": "rotto"');
    expect(screen.getByTestId('fci-error')).toBeTruthy();
    expect(screen.getByTestId('fci-create').props.accessibilityState?.disabled).toBe(true);
  });

  test('rows mode: write rows, add and remove, save only the filled ones', async () => {
    const { flashcards, deck } = setup();
    await render(wrap(<InsertScreen />));
    await fireEvent.press(screen.getByTestId('fci-mode-rows'));
    await fireEvent.changeText(screen.getByTestId('fci-q-0'), 'Q1');
    await fireEvent.changeText(screen.getByTestId('fci-a-0'), 'A1');
    await fireEvent.press(screen.getByTestId('fci-add-row'));
    await fireEvent.press(screen.getByTestId('fci-add-row'));
    await fireEvent.changeText(screen.getByTestId('fci-q-2'), 'Q3');
    await fireEvent.press(screen.getByTestId('fci-del-1'));
    await fireEvent.press(screen.getByTestId('fci-save'));
    expect(flashcards.cards(deck).map((c) => c.question_desc)).toEqual(['Q1', 'Q3']);
  });
});
