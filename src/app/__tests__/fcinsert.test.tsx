import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { MediaQueue } from '@/core/media/mediaQueue';
import { pickImage } from '@/core/media/pickImage';
import { FlashcardsRepo } from '@/features/flashcards/repo';

import InsertScreen from '../fc-insert';

jest.mock('@/core/media/pickImage', () => ({ pickImage: jest.fn() }));
const mockTrigger = jest.fn();
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
  mockServices = {
    db,
    flashcards,
    media: new MediaQueue(
      db,
      { put: async () => ({ name: 'x.jpg' }), remove: async () => undefined },
      { delete: () => undefined },
    ),
    scheduler: { trigger: mockTrigger },
  };
  mockTrigger.mockClear();
  const deck = flashcards.createDeck({ name: 'Maths' })!;
  mockParams = { deck };
  mockChanged.mockClear();
  return { flashcards, deck, db };
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

  test('rows mode: a child row becomes a sub-card of the row above, and goes with it when removed', async () => {
    const { flashcards, deck } = setup();
    await render(wrap(<InsertScreen />));
    await fireEvent.press(screen.getByTestId('fci-mode-rows'));
    await fireEvent.changeText(screen.getByTestId('fci-q-0'), 'Father');
    await fireEvent.press(screen.getByTestId('fci-kid-0'));
    await fireEvent.press(screen.getByTestId('fci-kid-0'));
    await fireEvent.changeText(screen.getByTestId('fci-q-1'), 'Kid 1');
    await fireEvent.changeText(screen.getByTestId('fci-q-2'), 'Kid 2');
    // un figlio non ha il tasto «figlio»
    expect(screen.queryByTestId('fci-kid-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('fci-add-row'));
    await fireEvent.changeText(screen.getByTestId('fci-q-3'), 'Other');
    await fireEvent.press(screen.getByTestId('fci-save'));
    const cards = flashcards.cards(deck);
    expect(cards.map((c) => c.question_desc)).toEqual(['Father', 'Other']);
    const father = cards.find((c) => c.question_desc === 'Father')!;
    expect(flashcards.subcards(father.uuid).map((k) => k.question_desc)).toEqual([
      'Kid 1',
      'Kid 2',
    ]);
  });

  test('rows mode: a photo for the question or answer goes to the queue once the card exists', async () => {
    const { flashcards, deck, db } = setup();
    (pickImage as jest.Mock)
      .mockResolvedValueOnce({ uri: 'file:///docs/q.jpg', mime: 'image/jpeg' })
      .mockResolvedValueOnce({ uri: 'file:///docs/kid.jpg', mime: 'image/jpeg' });
    await render(wrap(<InsertScreen />));
    await fireEvent.press(screen.getByTestId('fci-mode-rows'));
    // una riga con una sola foto (niente testo) si può salvare
    await fireEvent.press(screen.getByTestId('fci-qimg-0-library'));
    expect(pickImage).toHaveBeenCalledWith('library');
    expect(screen.getByTestId('fci-qimg-0')).toBeTruthy();
    expect(screen.queryByTestId('fci-qimg-0-library')).toBeNull();
    // una figlia con la foto della risposta
    await fireEvent.press(screen.getByTestId('fci-kid-0'));
    await fireEvent.press(screen.getByTestId('fci-aimg-1-library'));
    // togliere e rimettere non lascia nulla in giro
    await fireEvent.press(screen.getByTestId('fci-save'));
    const [card] = flashcards.cards(deck);
    expect(card).toBeTruthy();
    const kid = flashcards.subcards(card!.uuid)[0]!;
    expect(
      db.all('SELECT tbl, row_uuid, slot, op, file FROM media_queue ORDER BY tbl DESC'),
    ).toEqual([
      {
        tbl: 'fc_study_subcards',
        row_uuid: kid.uuid,
        slot: 'answer_image',
        op: 'put',
        file: 'file:///docs/kid.jpg',
      },
      {
        tbl: 'fc_study_cards',
        row_uuid: card!.uuid,
        slot: 'question_image',
        op: 'put',
        file: 'file:///docs/q.jpg',
      },
    ]);
    expect(mockTrigger).toHaveBeenCalled();
  });

  test('rows mode: a chosen photo can be removed again', async () => {
    const { flashcards, deck } = setup();
    (pickImage as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///docs/z.jpg',
      mime: 'image/jpeg',
    });
    await render(wrap(<InsertScreen />));
    await fireEvent.press(screen.getByTestId('fci-mode-rows'));
    await fireEvent.press(screen.getByTestId('fci-qimg-0-library'));
    await fireEvent.press(screen.getByTestId('fci-qimg-del-0'));
    expect(screen.getByTestId('fci-qimg-0-library')).toBeTruthy();
    expect(screen.getByTestId('fci-save').props.accessibilityState?.disabled).toBe(true);
    expect(flashcards.cards(deck)).toHaveLength(0);
  });

  test('rows mode: removing a father removes its children; a child of an empty father is not saved', async () => {
    const { flashcards, deck } = setup();
    await render(wrap(<InsertScreen />));
    await fireEvent.press(screen.getByTestId('fci-mode-rows'));
    await fireEvent.press(screen.getByTestId('fci-kid-0'));
    await fireEvent.changeText(screen.getByTestId('fci-q-1'), 'Lonely kid');
    await fireEvent.press(screen.getByTestId('fci-add-row'));
    await fireEvent.changeText(screen.getByTestId('fci-q-2'), 'Real card');
    await fireEvent.press(screen.getByTestId('fci-save'));
    expect(flashcards.cards(deck).map((c) => c.question_desc)).toEqual(['Real card']);

    await fireEvent.press(screen.getByTestId('fci-kid-0'));
    expect(screen.getByTestId('fci-q-1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fci-add-row'));
    await fireEvent.press(screen.getByTestId('fci-del-0'));
    expect(screen.getByTestId('fci-q-0')).toBeTruthy();
    expect(screen.queryByTestId('fci-q-1')).toBeNull();
  });

  test('rows you wrote and did not create are kept for next time, and go away once created', async () => {
    const { flashcards, deck } = setup();
    const first = await render(wrap(<InsertScreen />));
    await fireEvent.press(screen.getByTestId('fci-mode-rows'));
    await fireEvent.changeText(screen.getByTestId('fci-q-0'), 'Unsaved question');
    await fireEvent.press(screen.getByTestId('fci-kid-0'));
    await fireEvent.changeText(screen.getByTestId('fci-q-1'), 'Unsaved kid');
    // si esce subito, prima che passi il timer: le righe si salvano comunque
    await first.unmount();
    const second = await render(wrap(<InsertScreen />));
    expect(screen.getByTestId('fci-q-0').props.value).toBe('Unsaved question');
    expect(screen.getByTestId('fci-q-1').props.value).toBe('Unsaved kid');
    await fireEvent.press(screen.getByTestId('fci-save'));
    expect(flashcards.cards(deck)).toHaveLength(1);
    await second.unmount();
    await render(wrap(<InsertScreen />));
    expect(screen.getByTestId('fci-mode-paste')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fci-mode-rows'));
    expect(screen.getByTestId('fci-q-0').props.value).toBe('');
  });
});
