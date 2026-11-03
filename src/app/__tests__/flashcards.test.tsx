import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { stringifyDoc } from '@/features/flashcards/doc';
import { FlashcardsRepo } from '@/features/flashcards/repo';

import CardScreen from '../fc-card';
import DeckScreen from '../fc-deck';
import FlashcardsScreen from '../flashcards';

let mockServices: unknown;
let mockVersion = 0;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
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
  mockReplace.mockClear();
  const db = memoryDb();
  migrate(db);
  const flashcards = new FlashcardsRepo(db);
  mockServices = { db, flashcards };
  return { db, flashcards };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('categories list', () => {
  test('empty message, then adds a subject; a sub-category opens its branch', async () => {
    const { flashcards } = setup();
    const view = await render(wrap(<FlashcardsScreen />));
    expect(screen.getByText(/Create your first subject/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('fc-new'), 'Physics');
    await fireEvent.press(screen.getByTestId('fc-new-add'));
    expect(flashcards.decks().map((d) => d.name)).toEqual(['Physics']);
    await view.rerender(wrap(<FlashcardsScreen />));
    expect(screen.getByText('Physics')).toBeTruthy();
    const id = flashcards.decks()[0]!.uuid;
    await fireEvent.press(screen.getByTestId(`fc-add-${id}`));
    await fireEvent.changeText(screen.getByTestId('fc-sub-input'), 'Optics');
    await fireEvent(screen.getByTestId('fc-sub-input'), 'submitEditing');
    await view.rerender(wrap(<FlashcardsScreen />));
    expect(screen.getByText('Optics')).toBeTruthy();
  });

  test('toggle hides children; archive tab shows archived branch; search finds with path', async () => {
    const { flashcards } = setup();
    const a = flashcards.createDeck({ name: 'Maths' })!;
    flashcards.createDeck({ name: 'Algebra', parent: a });
    const old = flashcards.createDeck({ name: 'Old' })!;
    flashcards.setArchived(old, true);
    const view = await render(wrap(<FlashcardsScreen />));
    expect(screen.getByText('Algebra')).toBeTruthy();
    expect(screen.queryByText('Old')).toBeNull();
    await fireEvent.press(screen.getByTestId(`fc-toggle-${a}`));
    expect(screen.queryByText('Algebra')).toBeNull();
    await fireEvent.press(screen.getByTestId('fc-scope-archived'));
    expect(screen.getByText('Old')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fc-scope-active'));
    await fireEvent.changeText(screen.getByTestId('fc-search'), 'algebr');
    await view.rerender(wrap(<FlashcardsScreen />));
    expect(screen.getByText('Maths')).toBeTruthy(); // il percorso
    await fireEvent.press(
      screen.getByTestId(`fc-row-${flashcards.decks().find((d) => d.name === 'Algebra')!.uuid}`),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/fc-deck',
      params: { id: flashcards.decks().find((d) => d.name === 'Algebra')!.uuid },
    });
  });
});

describe('category page', () => {
  test('rename, colour, pin, archive and exam date are saved', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    mockParams = { id };
    const view = await render(wrap(<DeckScreen />));
    await fireEvent.changeText(screen.getByTestId('fcd-name'), 'Chemistry');
    await fireEvent(screen.getByTestId('fcd-name'), 'blur');
    await fireEvent.press(screen.getByTestId('fcd-color-FF3B30'));
    await view.rerender(wrap(<DeckScreen />));
    expect(flashcards.deck(id)).toMatchObject({
      name: 'Chemistry',
      color: '#FF3B30',
      color_edited: 1,
    });
    await fireEvent(screen.getByTestId('fcd-pin-switch'), 'valueChange', true);
    await fireEvent(screen.getByTestId('fcd-archive-switch'), 'valueChange', true);
    expect(flashcards.deck(id)).toMatchObject({ pinned: 1, archived: 1 });
    await fireEvent.press(screen.getByTestId('fcd-color-auto'));
    expect(flashcards.deck(id)).toMatchObject({ color: '#A0A0A0', color_edited: 0 });
  });

  test('icon picker sets and clears the icon', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-icon-toggle'));
    await fireEvent.press(screen.getByTestId('fcd-icon-atomo'));
    expect(flashcards.deck(id)!.icon).toBe('atomo');
    await fireEvent.press(screen.getByTestId('fcd-icon-_auto'));
    expect(flashcards.deck(id)!.icon).toBeNull();
  });

  test('delete only when empty; a deck with a card shows the hint', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const card = flashcards.addCard(id, 'q', 'a')!;
    mockParams = { id };
    const view = await render(wrap(<DeckScreen />));
    expect(screen.getByTestId('fcd-delete-hint')).toBeTruthy();
    expect(screen.queryByTestId('fcd-delete')).toBeNull();
    flashcards.removeCard(card);
    mockVersion += 1;
    await view.rerender(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-delete'));
    await fireEvent.press(screen.getByTestId('fcd-delete-confirm'));
    expect(flashcards.decks()).toHaveLength(0);
    expect(mockBack).toHaveBeenCalled();
  });

  test('move to another parent skips its own branch', async () => {
    const { flashcards } = setup();
    const a = flashcards.createDeck({ name: 'A' })!;
    const b = flashcards.createDeck({ name: 'B', parent: a })!;
    const c = flashcards.createDeck({ name: 'C' })!;
    mockParams = { id: a };
    await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-parent'));
    await fireEvent.press(screen.getByTestId(`deck-pick-${b}`)); // disabled: own child
    expect(flashcards.deck(a)!.parent_uuid).toBeNull();
    await fireEvent.press(screen.getByTestId(`deck-pick-${c}`));
    expect(flashcards.deck(a)!.parent_uuid).toBe(c);
  });

  test('cards are listed and the add button opens a new card', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(
      id,
      stringifyDoc({ v: 2, blocks: [{ t: 'p', runs: [{ s: 'What is H2O?' }] }] }),
      'Water',
    )!;
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    expect(screen.getByText('What is H2O?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`fcd-card-${c}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-card', params: { id: c } });
    await fireEvent.press(screen.getByTestId('fcd-add-card'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-card', params: { deck: id } });
  });
});

describe('card page', () => {
  test('new card: save needs some text, then the card goes in the deck', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    mockParams = { deck };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-save')); // spento: non fa niente
    expect(flashcards.cards(deck)).toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId('fcc-q-input'), 'Capital of Italy?');
    await fireEvent.changeText(screen.getByTestId('fcc-a-input'), 'Rome');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    const cards = flashcards.cards(deck);
    expect(cards).toHaveLength(1);
    expect(JSON.parse(cards[0]!.question_desc!).blocks[0].runs[0].s).toBe('Capital of Italy?');
    expect(mockBack).toHaveBeenCalled();
  });

  test('edit a plain card; a formatted side is kept unless replaced', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const rich = stringifyDoc({ v: 2, blocks: [{ t: 'p', runs: [{ s: 'Bold', m: { b: 1 } }] }] });
    const c = flashcards.addCard(deck, 'plain question', rich)!;
    mockParams = { id: c };
    const view = await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-edit'));
    expect(screen.getByTestId('fcc-q-input')).toBeTruthy();
    expect(screen.queryByTestId('fcc-a-input')).toBeNull(); // formattato: non si riscrive
    expect(screen.getByText('This text has formatting (bold, lists, formulas…).')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('fcc-q-input'), 'new question');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    await view.rerender(wrap(<CardScreen />));
    expect(JSON.parse(flashcards.card(c)!.question_desc!).blocks[0].runs[0].s).toBe('new question');
    expect(flashcards.card(c)!.answer_desc).toBe(rich); // intatta
    await fireEvent.press(screen.getByTestId('fcc-edit'));
    await fireEvent.press(screen.getByTestId('fcc-a-replace'));
    await fireEvent.changeText(screen.getByTestId('fcc-a-input'), 'plain now');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    expect(JSON.parse(flashcards.card(c)!.answer_desc!).blocks[0].runs[0]).toEqual({
      s: 'plain now',
    });
  });

  test('child cards: add, open, delete; the parent becomes a father', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { parent: c };
    const first = await render(wrap(<CardScreen />));
    await fireEvent.changeText(screen.getByTestId('fcc-q-input'), 'child q');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    await first.unmount();
    expect(flashcards.subcards(c)).toHaveLength(1);
    expect(flashcards.card(c)!.is_father).toBe(1);

    const s = flashcards.subcards(c)[0]!.uuid;
    mockParams = { id: c };
    mockVersion += 1;
    const view = await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId(`fcc-sub-${s}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-card', params: { sub: s } });
    await view.unmount();

    mockParams = { sub: s };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-delete'));
    await fireEvent.press(screen.getByTestId('fcc-delete-confirm'));
    expect(flashcards.subcards(c)).toHaveLength(0);
    expect(flashcards.card(c)!.is_father).toBe(0);
  });

  test('move a card to another deck and delete it', async () => {
    const { flashcards } = setup();
    const d1 = flashcards.createDeck({ name: 'D1' })!;
    const d2 = flashcards.createDeck({ name: 'D2' })!;
    const c = flashcards.addCard(d1, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-move'));
    await fireEvent.press(screen.getByTestId(`deck-pick-${d2}`));
    expect(flashcards.card(c)!.category_uuid).toBe(d2);
    await fireEvent.press(screen.getByTestId('fcc-delete'));
    await fireEvent.press(screen.getByTestId('fcc-delete-confirm'));
    expect(flashcards.card(c)).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });
});
