import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { stringifyDoc } from '@/features/flashcards/doc';
import { GameRepo } from '@/features/flashcards/game';
import { FlashcardsRepo } from '@/features/flashcards/repo';
import { StatsRepo } from '@/features/flashcards/stats';
import { StudyRepo } from '@/features/flashcards/study';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

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
  const study = new StudyRepo(db, 7);
  mockServices = {
    db,
    flashcards,
    study,
    languages: new LanguagesRepo(db, 7, new ProjectsRepo(db)),
    games: new GameRepo(db, study),
    fcStats: new StatsRepo(db),
  };
  return {
    db,
    flashcards,
    study,
    languages: (mockServices as { languages: LanguagesRepo }).languages,
  };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('categories list', () => {
  test('the Languages card shows the count and opens the Languages page', async () => {
    const { languages } = setup();
    const view = await render(wrap(<FlashcardsScreen />));
    expect(screen.getByTestId('fc-languages-sub').props.children).toMatch(/Words, translations/);
    const course = languages.addCourse('en', 'de') as string;
    const deck = languages.createDeck(course, { name: 'Food' })!;
    languages.addWord(deck, { word: 'Brot' });
    await view.rerender(wrap(<FlashcardsScreen />));
    expect(screen.getByTestId('fc-languages-sub').props.children).toBe('1 language · 1 words');
    await fireEvent.press(screen.getByTestId('fc-languages'));
    expect(mockPush).toHaveBeenCalledWith('/languages');
  });

  test('a deck row shows «never played» until a game exists; Play opens the setup', async () => {
    const { flashcards } = setup();
    const d = flashcards.createDeck({ name: 'Physics' })!;
    flashcards.addCard(d, 'Q', 'A');
    await render(wrap(<FlashcardsScreen />));
    expect(screen.getByTestId(`fc-stats-${d}`)).toBeTruthy();
    expect(screen.getByText('Never played')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fc-play'));
    expect(mockPush).toHaveBeenCalledWith('/fc-setup');
    expect(screen.getByTestId('fc-goal').props.children.join('')).toBe('0 / 20');
    expect(screen.getByTestId('fc-known').props.children).toBe(0);
    await fireEvent.press(screen.getByTestId('fc-summary'));
    expect(mockPush).toHaveBeenCalledWith('/fc-stats');
  });

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
  test('cards show their level and the learnt filter hides the others', async () => {
    const { flashcards, study } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const a = flashcards.addCard(id, 'QA', 'AA')!;
    const b = flashcards.addCard(id, 'QB', 'AB')!;
    study.setLearnt(a, false, true);
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    expect(screen.getByTestId(`fcd-level-${a}`)).toBeTruthy();
    expect(screen.getByTestId(`fcd-learnt-${a}`)).toBeTruthy();
    expect(screen.queryByTestId(`fcd-learnt-${b}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('fcd-filter-1'));
    expect(screen.getByTestId(`fcd-card-${a}`)).toBeTruthy();
    expect(screen.queryByTestId(`fcd-card-${b}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('fcd-filter-0'));
    expect(screen.queryByTestId(`fcd-card-${a}`)).toBeNull();
    expect(screen.getByTestId(`fcd-card-${b}`)).toBeTruthy();
  });

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
    await fireEvent.changeText(screen.getByTestId('fcc-q-block-0'), 'Capital of Italy?');
    await fireEvent.changeText(screen.getByTestId('fcc-a-block-0'), 'Rome');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    const cards = flashcards.cards(deck);
    expect(cards).toHaveLength(1);
    expect(JSON.parse(cards[0]!.question_desc!).blocks[0].runs[0].s).toBe('Capital of Italy?');
    expect(mockBack).toHaveBeenCalled();
  });

  test('edit a card: the untouched formatted side stays as it is; editing it keeps the formatting', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const rich = stringifyDoc({ v: 2, blocks: [{ t: 'p', runs: [{ s: 'Bold', m: { b: 1 } }] }] });
    const c = flashcards.addCard(deck, 'plain question', rich)!;
    mockParams = { id: c };
    const view = await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-edit'));
    await fireEvent.changeText(screen.getByTestId('fcc-q-block-0'), 'new question');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    await view.rerender(wrap(<CardScreen />));
    expect(JSON.parse(flashcards.card(c)!.question_desc!).blocks[0].runs[0].s).toBe('new question');
    expect(flashcards.card(c)!.answer_desc).toBe(rich); // intatta
    await fireEvent.press(screen.getByTestId('fcc-edit'));
    await fireEvent.changeText(screen.getByTestId('fcc-a-block-0'), 'Bolder');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    expect(JSON.parse(flashcards.card(c)!.answer_desc!).blocks[0].runs[0]).toEqual({
      s: 'Bolder',
      m: { b: 1 },
    });
  });

  test('card images from the website show on the card page', async () => {
    const { flashcards, db } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    db.run('UPDATE fc_study_cards SET question_image = ?, answer_image = ? WHERE uuid = ?', [
      'q1.png',
      'a1.png',
      c,
    ]);
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    expect(screen.getByTestId('fcc-q-image')).toBeTruthy();
    expect(screen.getByTestId('fcc-a-image')).toBeTruthy();
  });

  test('clearing a side saves it as empty', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-edit'));
    await fireEvent.changeText(screen.getByTestId('fcc-a-block-0'), '');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    expect(flashcards.card(c)!.answer_desc).toBeNull();
  });

  test('child cards: add, open, delete; the parent becomes a father', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { parent: c };
    const first = await render(wrap(<CardScreen />));
    await fireEvent.changeText(screen.getByTestId('fcc-q-block-0'), 'child q');
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
  test('move a card to a deck made on the spot (top level or under the current one)', async () => {
    const { flashcards } = setup();
    const d1 = flashcards.createDeck({ name: 'D1' })!;
    const c = flashcards.addCard(d1, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-move'));
    await fireEvent.press(screen.getByTestId('deck-pick-new'));
    await fireEvent.press(screen.getByTestId('deck-pick-new-save')); // senza nome
    expect(screen.getByTestId('deck-pick-new-error')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('deck-pick-new-name'), 'Fresh');
    await fireEvent.press(screen.getByTestId('deck-pick-new-parent-under'));
    await fireEvent.press(screen.getByTestId('deck-pick-new-save'));
    const moved = flashcards.card(c)!;
    const fresh = flashcards.decks().find((d) => d.name === 'Fresh')!;
    expect(moved.category_uuid).toBe(fresh.uuid);
    expect(fresh.parent_uuid).toBe(d1);
  });

  test('the deck picker search narrows a long list', async () => {
    const { flashcards } = setup();
    const ids = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'].map((n) =>
      flashcards.createDeck({ name: n })!,
    );
    const c = flashcards.addCard(ids[0]!, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-move'));
    await fireEvent.changeText(screen.getByTestId('deck-pick-search'), 'eps');
    expect(screen.getByTestId(`deck-pick-${ids[4]}`)).toBeTruthy();
    expect(screen.queryByTestId(`deck-pick-${ids[1]}`)).toBeNull();
    await fireEvent.changeText(screen.getByTestId('deck-pick-search'), 'zzz');
    expect(screen.getByTestId('deck-pick-none')).toBeTruthy();
  });

  test('learnt and favourite switches; examples are added, edited and removed', async () => {
    const { flashcards, study } = setup();
    const d = flashcards.createDeck({ name: 'D' })!;
    const c = flashcards.addCard(d, 'q', 'a')!;
    mockParams = { id: c };
    const view = await render(wrap(<CardScreen />));
    await fireEvent(screen.getByTestId('fcc-learnt'), 'valueChange', true);
    await fireEvent(screen.getByTestId('fcc-favorite'), 'valueChange', true);
    expect(study.isLearnt(c)).toBe(true);
    expect(study.isFavorite(c)).toBe(true);

    await fireEvent.changeText(screen.getByTestId('fcc-ex-new'), 'A real example');
    await fireEvent.press(screen.getByTestId('fcc-ex-add'));
    const ex = study.examples(c)[0]!;
    expect(ex.example_text).toBe('A real example');
    await view.rerender(wrap(<CardScreen />));
    expect(screen.getByText('A real example')).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`fcc-ex-edit-${ex.uuid}`));
    await fireEvent.changeText(screen.getByTestId(`fcc-ex-input-${ex.uuid}`), 'Better');
    await fireEvent.press(screen.getByTestId(`fcc-ex-save-${ex.uuid}`));
    expect(study.examples(c)[0]!.example_text).toBe('Better');

    await view.rerender(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId(`fcc-ex-delete-${ex.uuid}`));
    expect(study.examples(c)).toHaveLength(0);
    await fireEvent(screen.getByTestId('fcc-learnt'), 'valueChange', false);
    expect(study.isLearnt(c)).toBe(false);
  });
});

describe('cards you know chart', () => {
  test('shows the tapped cards on their day, with the +N chips and the type tiles', async () => {
    const { db, flashcards, study, languages } = setup();
    const deck = flashcards.createDeck({ name: 'D' })!;
    const card = flashcards.addCard(deck, 'Q', 'A')!;
    study.setLearnt(card, false, true);
    const course = languages.addCourse('fr', 'en-GB', 'en') as string;
    const ldeck = languages.createDeck(course, { name: 'Home' })!;
    const word = languages.addWord(ldeck, { word: 'house', translation: 'maison' })!;
    languages.setLearnt(word, false, true);
    // both learnt today (the repos stamp today), so today's bar and chips show 2
    await render(wrap(<FlashcardsScreen />));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+2/);
    expect(screen.getByTestId('fc-learned-bar-13')).toBeTruthy();
    // tile "study" keeps only the study cards, tapping again shows all
    await fireEvent.press(screen.getByTestId('fc-learned-tile-study'));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+1/);
    await fireEvent.press(screen.getByTestId('fc-learned-tile-vocab'));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+1/);
    await fireEvent.press(screen.getByTestId('fc-learned-tile-vocab'));
    expect(screen.getByTestId('fc-learned-chip-today')).toHaveTextContent(/^\+2/);
    // weeks and months: 8 and 6 bars
    await fireEvent.press(screen.getByTestId('fc-learned-step-week'));
    expect(screen.getByTestId('fc-learned-bar-7')).toBeTruthy();
    expect(screen.queryByTestId('fc-learned-bar-8')).toBeNull();
    await fireEvent.press(screen.getByTestId('fc-learned-step-month'));
    expect(screen.getByTestId('fc-learned-bar-5')).toBeTruthy();
    expect(screen.queryByTestId('fc-learned-bar-6')).toBeNull();
    void db;
  });

  test('without a language course there is no languages tile', async () => {
    setup();
    await render(wrap(<FlashcardsScreen />));
    expect(screen.queryByTestId('fc-learned-tile-vocab')).toBeNull();
    expect(screen.getByTestId('fc-learned-tile-study')).toBeTruthy();
  });
});
