import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import type { LocalPrefs } from '@/core/settings/localPrefs';
import { MediaQueue } from '@/core/media/mediaQueue';
import { pickImage } from '@/core/media/pickImage';
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

jest.mock('@/core/media/phoneFiles', () => ({
  keepFile: jest.fn((uri: string) => `file:///docs/media_queue/${uri.split('/').pop()}`),
  phoneFiles: { delete: jest.fn() },
}));
jest.mock('@/core/media/pickImage', () => ({ pickImage: jest.fn() }));
const mockTrigger = jest.fn();

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
let mockPrefs: Partial<LocalPrefs> = {};
const mockAiExample = jest.fn();
let mockAccount: { fcAiExample: jest.Mock } | null = null;
const mockUpdatePrefs = jest.fn((patch: Partial<LocalPrefs>) => {
  mockPrefs = { ...mockPrefs, ...patch };
  mockVersion += 1;
});
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    account: mockAccount,
    version: mockVersion,
    changed: mockChanged,
    localPrefs: {
      ...jest.requireActual('@/core/settings/localPrefs').DEFAULT_LOCAL_PREFS,
      ...mockPrefs,
    },
    updateLocalPrefs: mockUpdatePrefs,
  }),
}));

function setup() {
  mockVersion = 0;
  mockPrefs = {};
  mockAccount = { fcAiExample: mockAiExample };
  mockAiExample.mockReset();
  mockParams = {};
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  const db = memoryDb();
  migrate(db);
  const flashcards = new FlashcardsRepo(db);
  const study = new StudyRepo(db, 7);
  const projects = new ProjectsRepo(db);
  mockServices = {
    db,
    flashcards,
    study,
    projects,
    languages: new LanguagesRepo(db, 7, projects),
    games: new GameRepo(db, study),
    fcStats: new StatsRepo(db),
    media: new MediaQueue(
      db,
      { put: async () => ({ name: 'x.jpg' }), remove: async () => undefined },
      { delete: () => undefined },
    ),
    scheduler: { trigger: mockTrigger },
  };
  return {
    db,
    flashcards,
    study,
    projects,
    languages: (mockServices as { languages: LanguagesRepo }).languages,
  };
}
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('categories list', () => {
  test('a deck row shows «never played» until a game exists; Play opens the setup', async () => {
    const { flashcards } = setup();
    const d = flashcards.createDeck({ name: 'Physics' })!;
    flashcards.addCard(d, 'Q', 'A');
    await render(wrap(<FlashcardsScreen />));
    expect(screen.getByTestId(`fc-stats-${d}`)).toBeTruthy();
    expect(screen.getByText('Never played')).toBeTruthy();
    // come sul sito, il tasto in alto a destra porta allo storico (da lì si gioca)
    await fireEvent.press(screen.getByTestId('fc-play'));
    expect(mockPush).toHaveBeenCalledWith('/fc-history');
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
    // come sul sito: i rami partono chiusi
    expect(screen.queryByText('Algebra')).toBeNull();
    expect(screen.queryByText('Old')).toBeNull();
    await fireEvent.press(screen.getByTestId(`fc-toggle-${a}`));
    expect(screen.getByText('Algebra')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fc-collapse'));
    expect(screen.queryByText('Algebra')).toBeNull();
    await fireEvent.press(screen.getByTestId('fc-collapse'));
    expect(screen.getByText('Algebra')).toBeTruthy();
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

describe('grid view', () => {
  test('the toggle shows folder squares; a square with kids goes down, the arrow opens it', async () => {
    const { flashcards } = setup();
    const maths = flashcards.createDeck({ name: 'Maths' })!;
    const algebra = flashcards.createDeck({ name: 'Algebra', parent: maths })!;
    const view = await render(wrap(<FlashcardsScreen />));
    await fireEvent.press(screen.getByTestId('fc-view'));
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ fcTreeView: 'grid' });
    await view.rerender(wrap(<FlashcardsScreen />));
    expect(screen.getByTestId(`fc-gcard-${maths}`)).toBeTruthy();
    expect(screen.queryByTestId(`fc-gcard-${algebra}`)).toBeNull();
    // the arrow opens the category itself
    await fireEvent.press(screen.getByTestId(`fc-gopen-${maths}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-deck', params: { id: maths } });
    // the square goes one level down; the crumb brings us back
    await fireEvent.press(screen.getByTestId(`fc-gcard-${maths}`));
    expect(screen.getByTestId(`fc-gcard-${algebra}`)).toBeTruthy();
    expect(screen.queryByTestId(`fc-gcard-${maths}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('fc-crumb--1'));
    expect(screen.getByTestId(`fc-gcard-${maths}`)).toBeTruthy();
    // a folder with nothing inside opens straight away
    await fireEvent.press(screen.getByTestId(`fc-gcard-${maths}`));
    await fireEvent.press(screen.getByTestId(`fc-gcard-${algebra}`));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/fc-deck', params: { id: algebra } });
  });

  test('a new category made inside a folder goes under that folder', async () => {
    const { flashcards } = setup();
    mockPrefs = { fcTreeView: 'grid' };
    const maths = flashcards.createDeck({ name: 'Maths' })!;
    flashcards.createDeck({ name: 'Algebra', parent: maths });
    await render(wrap(<FlashcardsScreen />));
    await fireEvent.press(screen.getByTestId(`fc-gcard-${maths}`));
    await fireEvent.changeText(screen.getByTestId('fc-new'), 'Geometry');
    await fireEvent.press(screen.getByTestId('fc-new-add'));
    expect(flashcards.decks().find((d) => d.name === 'Geometry')!.parent_uuid).toBe(maths);
  });
});

describe('selecting several decks', () => {
  const pick = async (...ids: string[]) => {
    await fireEvent.press(screen.getByTestId('fc-select'));
    for (const id of ids) await fireEvent.press(screen.getByTestId(`fc-row-${id}`));
  };

  test('moves the picked decks under another one, and not into themselves', async () => {
    const { flashcards } = setup();
    const a = flashcards.createDeck({ name: 'A' })!;
    const b = flashcards.createDeck({ name: 'B' })!;
    const c = flashcards.createDeck({ name: 'C' })!;
    await render(wrap(<FlashcardsScreen />));
    await pick(a, b);
    expect(screen.getByTestId('fc-sel-count')).toHaveTextContent('2 selected');
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('fc-sel-move'));
    await fireEvent.press(screen.getByTestId(`deck-pick-${c}`));
    expect(flashcards.deck(a)!.parent_uuid).toBe(c);
    expect(flashcards.deck(b)!.parent_uuid).toBe(c);
    expect(screen.queryByTestId('fc-sel-count')).toBeNull();
  });

  test('colours the picked decks, or puts them back to automatic', async () => {
    const { flashcards } = setup();
    const a = flashcards.createDeck({ name: 'A' })!;
    const b = flashcards.createDeck({ name: 'B' })!;
    await render(wrap(<FlashcardsScreen />));
    await pick(a, b);
    await fireEvent.press(screen.getByTestId('fc-sel-color'));
    await fireEvent.press(screen.getByTestId('fc-sel-color-FF3B30'));
    expect(flashcards.deck(a)).toMatchObject({ color: '#FF3B30', color_edited: 1 });
    expect(flashcards.deck(b)).toMatchObject({ color: '#FF3B30', color_edited: 1 });
    await pick(a);
    await fireEvent.press(screen.getByTestId('fc-sel-color'));
    await fireEvent.press(screen.getByTestId('fc-sel-color-auto'));
    expect(flashcards.deck(a)!.color_edited).toBeFalsy();
    expect(flashcards.deck(b)!.color_edited).toBeTruthy();
  });

  test('archives the picked decks', async () => {
    const { flashcards } = setup();
    const a = flashcards.createDeck({ name: 'A' })!;
    const b = flashcards.createDeck({ name: 'B' })!;
    await render(wrap(<FlashcardsScreen />));
    await pick(a);
    await fireEvent.press(screen.getByTestId('fc-sel-archive'));
    expect(flashcards.deck(a)!.archived).toBeTruthy();
    expect(flashcards.deck(b)!.archived).toBeFalsy();
  });

  test('deletes only the empty ones, and a father goes with its empty children', async () => {
    const { flashcards } = setup();
    const father = flashcards.createDeck({ name: 'Father' })!;
    const kid = flashcards.createDeck({ name: 'Kid', parent: father })!;
    const full = flashcards.createDeck({ name: 'Full' })!;
    flashcards.addCard(full, 'q', 'a');
    await render(wrap(<FlashcardsScreen />));
    await fireEvent.press(screen.getByTestId(`fc-toggle-${father}`));
    await pick(father, kid, full);
    await fireEvent.press(screen.getByTestId('fc-sel-delete'));
    await fireEvent.press(screen.getByTestId('fc-sel-delete-confirm'));
    expect(flashcards.deck(father)).toBeNull();
    expect(flashcards.deck(kid)).toBeNull();
    expect(flashcards.deck(full)).not.toBeNull();
    expect(screen.getByTestId('fc-sel-note')).toHaveTextContent(/Only the empty ones/);
  });
});

describe('card text search', () => {
  test('the Card text chip searches inside the cards and opens one', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const a = flashcards.addCard(deck, 'Oxygen symbol', 'O')!;
    flashcards.addCard(deck, 'Helium symbol', 'He');
    const s = flashcards.addSubcard(a, 'Oxygen number', '8')!;
    await render(wrap(<FlashcardsScreen />));
    await fireEvent.changeText(screen.getByTestId('fc-search'), 'oxyg');
    expect(screen.queryByTestId(`fc-hit-${a}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('fc-search-cards'));
    expect(screen.getByTestId('fc-hits-count')).toHaveTextContent('2 cards found');
    await fireEvent.press(screen.getByTestId(`fc-hit-${s}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-card', params: { sub: s } });
    await fireEvent.press(screen.getByTestId(`fc-hit-${a}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-card', params: { id: a } });
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
    const view = await render(wrap(<DeckScreen />));
    expect(screen.getByTestId(`fcd-level-${a}`)).toBeTruthy();
    expect(screen.getByTestId(`fcd-learnt-${a}`)).toBeTruthy();
    expect(screen.queryByTestId(`fcd-learnt-${b}`)).toBeNull();
    // il filtro sta nelle impostazioni della vista, come sul sito
    expect(screen.queryByTestId('fcd-filter-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcd-settings'));
    await fireEvent.press(screen.getByTestId('fcd-status'));
    await fireEvent.press(screen.getByTestId('fcd-status-1'));
    await view.rerender(wrap(<DeckScreen />));
    expect(screen.getByTestId(`fcd-card-${a}`)).toBeTruthy();
    expect(screen.queryByTestId(`fcd-card-${b}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('fcd-status'));
    await fireEvent.press(screen.getByTestId('fcd-status-0'));
    await view.rerender(wrap(<DeckScreen />));
    expect(screen.queryByTestId(`fcd-card-${a}`)).toBeNull();
    expect(screen.getByTestId(`fcd-card-${b}`)).toBeTruthy();
  });

  test('the cards are drawn formatted (bold, lists), with their image, and «full cards» removes the height cap', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const q = stringifyDoc({
      v: 2,
      blocks: [
        { t: 'p', runs: [{ s: 'Water ', m: { b: true } }, { s: 'is wet' }] },
        { t: 'li', lvl: 1, runs: [{ s: 'H2O' }] },
      ],
    });
    const a = flashcards.addCard(id, q, 'plain answer')!;
    mockParams = { id };
    const view = await render(wrap(<DeckScreen />));
    // niente testo JSON grezzo: il grassetto è un pezzo di testo in grassetto, l'elenco ha il suo pallino
    expect(screen.queryByText(/"blocks"/)).toBeNull();
    const bold = screen.getByText('Water ');
    expect(bold).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('•')).toBeTruthy();
    expect(screen.getByText('plain answer')).toBeTruthy();
    expect(screen.getByTestId(`fcd-q-${a}-scroll`)).toBeTruthy();
    mockPrefs = { fcFullCards: true };
    mockVersion += 1;
    await view.rerender(wrap(<DeckScreen />));
    expect(screen.queryByTestId(`fcd-q-${a}-scroll`)).toBeNull();
    expect(screen.getByText('Water ')).toBeTruthy();
  });

  test('the view settings sheet: filter incl. duplicates, full cards, full examples, Big Edit', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const other = flashcards.createDeck({ name: 'Bio' })!;
    const a = flashcards.addCard(id, 'Same question', 'A1')!;
    const b = flashcards.addCard(id, 'Unique', 'A2')!;
    flashcards.addCard(other, ' same QUESTION ', 'A3');
    mockParams = { id };
    const view = await render(wrap(<DeckScreen />));
    expect(screen.queryByTestId('fcd-settings-dot')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcd-settings'));
    expect(screen.getByText('View settings')).toBeTruthy();
    expect(screen.getByText('Which cards')).toBeTruthy();
    expect(screen.getByText('How to show them')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcd-status'));
    await fireEvent.press(screen.getByTestId('fcd-status-dup'));
    await view.rerender(wrap(<DeckScreen />));
    expect(screen.getByTestId(`fcd-card-${a}`)).toBeTruthy();
    expect(screen.queryByTestId(`fcd-card-${b}`)).toBeNull();
    expect(screen.getByTestId('fcd-settings-dot')).toBeTruthy();
    await fireEvent(screen.getByTestId('fcd-full-cards'), 'valueChange', true);
    await fireEvent(screen.getByTestId('fcd-full-examples'), 'valueChange', true);
    expect(mockPrefs).toMatchObject({
      fcViewStatus: 'dup',
      fcFullCards: true,
      fcFullExamples: true,
    });
    await fireEvent.press(screen.getByTestId('fcd-bigedit'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-insert', params: { deck: id } });
  });

  test('child cards sit under their father, marked as sub-cards, with their own star and learnt tick', async () => {
    const { flashcards, study } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const father = flashcards.addCard(id, 'Father q', 'Father a')!;
    const kid = flashcards.addSubcard(father, 'Kid q', 'Kid a')!;
    flashcards.addCard(id, 'Other q', 'Other a');
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    const group = screen.getByTestId(`fcd-children-${father}`);
    expect(group).toBeTruthy();
    expect(screen.getByTestId(`fcd-child-tag-${kid}`)).toHaveTextContent(/Sub-card/);
    expect(screen.getByTestId(`fcd-card-${kid}`)).toBeTruthy();
    expect(screen.queryByTestId(`fcd-children-${kid}`)).toBeNull();
    // il figlio ha la sua stella e la sua casella: toccarle non tocca il padre
    await fireEvent.press(screen.getByTestId(`fcd-fav-${kid}`));
    expect(study.isFavorite(kid)).toBe(true);
    expect(study.isFavorite(father)).toBe(false);
    await fireEvent.press(screen.getByTestId(`fcd-learn-toggle-${kid}`));
    expect(study.isLearnt(kid)).toBe(true);
    expect(study.isLearnt(father)).toBe(false);
    // un tocco sul figlio apre la sua pagina (sub), non quella del padre
    await fireEvent.press(screen.getByTestId(`fcd-card-${kid}`));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/fc-card', params: { sub: kid } });
  });

  test('examples show under the answer as a carousel with dots, for cards and for child cards', async () => {
    const { flashcards, study } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(id, 'Q', 'A')!;
    const kid = flashcards.addSubcard(c, 'Kid q', 'Kid a')!;
    flashcards.addCard(id, 'No examples', 'x');
    study.addExample(c, false, 'First example');
    study.addExample(c, false, 'Second example');
    study.addExample(kid, true, 'Kid example');
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    expect(screen.getByTestId(`fcd-ex-${c}`)).toHaveTextContent(/Examples \(2\)/);
    expect(screen.getByTestId(`fcd-ex-${c}`)).toHaveTextContent(/First example/);
    expect(screen.getByTestId(`fcd-ex-${c}-dot-1`)).toBeTruthy();
    // un solo esempio: niente pallini
    expect(screen.getByTestId(`fcd-ex-${kid}`)).toHaveTextContent(/Examples \(1\)/);
    expect(screen.queryByTestId(`fcd-ex-${kid}-dots`)).toBeNull();
    expect(screen.getAllByText(/Examples \(/)).toHaveLength(2);
  });

  test('a father card with an empty answer shows as a group title', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const t = flashcards.addCard(id, 'Chapter one', '')!;
    flashcards.addSubcard(t, 'child q', 'child a');
    const n = flashcards.addCard(id, 'Normal q', 'normal a')!;
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    expect(screen.getByTestId(`fcd-title-${t}`)).toHaveTextContent(/1 sub-cards/);
    expect(screen.queryByTestId(`fcd-level-${t}`)).toBeNull();
    expect(screen.queryByTestId(`fcd-title-${n}`)).toBeNull();
    expect(screen.getByTestId(`fcd-level-${n}`)).toBeTruthy();
    // il visore non mostra i titoli, ma sì le loro sotto-carte (come il sito)
    await fireEvent.press(screen.getByTestId('fcd-view'));
    expect(screen.getByTestId('fcd-viewer-count')).toHaveTextContent('1 / 2');
    expect(screen.getByTestId('fcd-viewer-question')).toHaveTextContent('child q');
    await fireEvent.press(screen.getByTestId('fcd-viewer-next'));
    expect(screen.getByTestId('fcd-viewer-question')).toHaveTextContent('Normal q');
  });

  test('the viewer: sub-cards follow their parent, long text scrolls, the pencil edits, play opens the game', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const long = Array.from({ length: 80 }, (_, i) => `line ${i}`).join('\n');
    const a = flashcards.addCard(id, long, 'short answer')!;
    const s = flashcards.addSubcard(a, 'sub q', 'sub a')!;
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-view'));
    expect(screen.getByTestId('fcd-viewer-count')).toHaveTextContent('1 / 2');
    // il testo lungo sta in una zona che scorre, non in una che si taglia
    const scroll = screen.getByTestId('fcd-viewer-question-scroll');
    expect(scroll.props.showsVerticalScrollIndicator).toBe(true);
    expect(StyleSheet.flatten(scroll.props.style).flex).toBe(1);
    // la barra di avanzamento segue la posizione
    expect(StyleSheet.flatten(screen.getByTestId('fcd-viewer-bar-fill').props.style).width).toBe(
      '50%',
    );
    await fireEvent.press(screen.getByTestId('fcd-viewer-prev')); // già alla prima: non fa nulla
    expect(screen.getByTestId('fcd-viewer-count')).toHaveTextContent('1 / 2');
    // toccando il testo la carta si gira (il tocco sta DENTRO la zona che scorre, così lo scorrimento non viene rubato)
    await fireEvent.press(screen.getByTestId('fcd-viewer-card'));
    expect(screen.getByTestId('fcd-viewer-answer')).toHaveTextContent('short answer');
    const back = screen.getByTestId('fcd-viewer-answer-scroll');
    expect(back.props.showsVerticalScrollIndicator).toBe(true);
    expect(screen.getByTestId('fcd-viewer-answer-tap')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcd-viewer-next'));
    expect(screen.getByTestId('fcd-viewer-count')).toHaveTextContent('2 / 2');
    expect(screen.getByTestId('fcd-viewer-question')).toHaveTextContent('sub q');
    expect(StyleSheet.flatten(screen.getByTestId('fcd-viewer-bar-fill').props.style).width).toBe(
      '100%',
    );
    await fireEvent.press(screen.getByTestId('fcd-viewer-edit'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-card', params: { sub: s } });
    expect(screen.queryByTestId('fcd-viewer')).toBeNull();

    await fireEvent.press(screen.getByTestId('fcd-view'));
    await fireEvent.press(screen.getByTestId('fcd-viewer-edit'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-card', params: { id: a } });
    await fireEvent.press(screen.getByTestId('fcd-view'));
    await fireEvent.press(screen.getByTestId('fcd-viewer-play'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/fc-setup', params: { preselect: id } });
    expect(screen.queryByTestId('fcd-viewer')).toBeNull();
  });

  test('text search narrows the list and the counter follows', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const a = flashcards.addCard(id, 'Oxygen symbol', 'O')!;
    const b = flashcards.addCard(id, 'Helium symbol', 'He')!;
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    expect(screen.getByTestId('fcd-shown')).toHaveTextContent(/2 cards shown/);
    await fireEvent.changeText(screen.getByTestId('fcd-search'), 'heli');
    expect(screen.queryByTestId(`fcd-card-${a}`)).toBeNull();
    expect(screen.getByTestId(`fcd-card-${b}`)).toBeTruthy();
    expect(screen.getByTestId('fcd-shown')).toHaveTextContent(/1 card shown/);
  });

  test('the viewer button flips through the shown cards only', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    flashcards.addCard(id, 'Oxygen symbol', 'O');
    flashcards.addCard(id, 'Helium symbol', 'He');
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    await fireEvent.changeText(screen.getByTestId('fcd-search'), 'heli');
    await fireEvent.press(screen.getByTestId('fcd-view'));
    expect(screen.getByTestId('fcd-viewer-count')).toHaveTextContent('1 / 1');
    expect(screen.getByTestId('fcd-viewer-question')).toHaveTextContent('Helium symbol');
    await fireEvent.press(screen.getByTestId('fcd-viewer-card'));
    expect(screen.getByTestId('fcd-viewer-answer')).toHaveTextContent('He');
    await fireEvent.press(screen.getByTestId('fcd-viewer-close'));
    expect(screen.queryByTestId('fcd-viewer')).toBeNull();
  });

  test('the sort menu lists the orders and the level menu filters; a card star is a favourite', async () => {
    const { flashcards, study } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const first = flashcards.addCard(id, 'B card', 'x')!;
    flashcards.addCard(id, 'A card', 'y');
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    expect(screen.getByTestId('fcd-sort')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/Position/),
    );
    await fireEvent.press(screen.getByTestId('fcd-sort'));
    await fireEvent.press(screen.getByTestId('fcd-sort-newest'));
    expect(screen.getByTestId('fcd-sort')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/Newest first/),
    );
    // il livello è un menu a tendina, come sul sito
    await fireEvent.press(screen.getByTestId('fcd-level'));
    expect(screen.getByTestId('fcd-level-filter-all')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcd-level-filter-all'));
    // la stellina è sempre visibile e mette la carta fra le preferite
    expect(study.isFavorite(first)).toBe(false);
    await fireEvent.press(screen.getByTestId(`fcd-fav-${first}`));
    expect(study.isFavorite(first)).toBe(true);
  });

  test('select mode: pick cards, move them to another category, then delete one', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const other = flashcards.createDeck({ name: 'Physics' })!;
    const a = flashcards.addCard(id, 'QA', 'AA')!;
    const b = flashcards.addCard(id, 'QB', 'AB')!;
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-select'));
    await fireEvent.press(screen.getByTestId(`fcd-card-${a}`));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId('fcd-picked')).toHaveTextContent('1');
    await fireEvent.press(screen.getByTestId('fcd-select-all'));
    expect(screen.getByTestId('fcd-picked')).toHaveTextContent('2');
    await fireEvent.press(screen.getByTestId('fcd-select-all'));
    expect(screen.getByTestId('fcd-picked')).toHaveTextContent('0');
    await fireEvent.press(screen.getByTestId(`fcd-card-${a}`));
    await fireEvent.press(screen.getByTestId('fcd-bulk-move'));
    await fireEvent.press(screen.getByTestId(`deck-pick-${other}`));
    expect(flashcards.card(a)?.category_uuid).toBe(other);
    expect(flashcards.card(b)?.category_uuid).toBe(id);
    // select mode is closed after the move
    expect(screen.queryByTestId('fcd-picked')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcd-select'));
    await fireEvent.press(screen.getByTestId(`fcd-card-${b}`));
    await fireEvent.press(screen.getByTestId('fcd-bulk-delete'));
    await fireEvent.press(screen.getByTestId('fcd-bulk-delete-confirm'));
    expect(flashcards.card(b)).toBeFalsy();
  });

  test('selected cards are merged into a chosen parent card as sub-cards', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const father = flashcards.addCard(id, 'Parent', 'PA')!;
    const a = flashcards.addCard(id, 'Child A', 'AA')!;
    const b = flashcards.addCard(id, 'Child B', 'AB')!;
    mockParams = { id };
    await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-select'));
    await fireEvent.press(screen.getByTestId(`fcd-card-${a}`));
    await fireEvent.press(screen.getByTestId(`fcd-card-${b}`));
    await fireEvent.press(screen.getByTestId('fcd-bulk-join'));
    // le carte scelte non si offrono come padre
    expect(screen.queryByTestId(`fcd-join-${a}`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`fcd-join-${father}`));
    expect(flashcards.subcards(father).map((x) => x.question_desc)).toEqual(['Child A', 'Child B']);
    expect(flashcards.card(a)).toBeNull();
    expect(screen.getByTestId('fcd-join-note')).toHaveTextContent(/Cards merged: 2/);
  });

  test('the header counts the cards of the whole branch; the clock opens the history; the pencil moves it', async () => {
    const { flashcards } = setup();
    const father = flashcards.createDeck({ name: 'Maths' })!;
    const kid = flashcards.createDeck({ name: 'Algebra', parent: father })!;
    flashcards.addCard(father, 'q1', 'a1');
    flashcards.addCard(kid, 'q2', 'a2');
    flashcards.addCard(kid, 'q3', 'a3');
    mockParams = { id: father };
    await render(wrap(<DeckScreen />));
    expect(screen.getByTestId('fcd-count')).toHaveTextContent(/^3 cards$/);
    await fireEvent.press(screen.getByTestId('fcd-history'));
    expect(mockPush).toHaveBeenCalledWith('/fc-history');
    await fireEvent.press(screen.getByTestId('fcd-crumb-edit'));
    expect(screen.getByTestId('fcd-parent')).toBeTruthy();
  });

  test('the hero shows the linked project (also from a parent) and opens it; without one it offers to link', async () => {
    const { flashcards, projects } = setup();
    const father = flashcards.createDeck({ name: 'Maths' })!;
    const kid = flashcards.createDeck({ name: 'Algebra', parent: father })!;
    const course = projects.create({ name: 'PeS' })!;
    mockParams = { id: kid };
    const view = await render(wrap(<DeckScreen />));
    // senza progetto: il chip tratteggiato apre la scelta, che collega il mazzo
    expect(screen.queryByTestId('fcd-project')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcd-project-link'));
    expect(screen.getByTestId('fcd-link-sheet')).toBeTruthy();
    flashcards.linkDeck(course, father);
    await view.unmount();
    await render(wrap(<DeckScreen />));
    // il figlio eredita il progetto del padre
    await fireEvent.press(screen.getByTestId('fcd-project'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/projects', params: { id: course } });
    expect(screen.getByTestId('fcd-project')).toHaveTextContent('PeS');
    expect(screen.queryByTestId('fcd-close')).toBeNull();
  });

  test('rename, colour, pin, archive and exam date are saved', async () => {
    const { flashcards } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    mockParams = { id };
    const view = await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-settings'));
    await fireEvent.press(screen.getByTestId('fcd-edit-deck'));
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
    await fireEvent.press(screen.getByTestId('fcd-settings'));
    await fireEvent.press(screen.getByTestId('fcd-edit-deck'));
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
    await fireEvent.press(screen.getByTestId('fcd-settings'));
    await fireEvent.press(screen.getByTestId('fcd-edit-deck'));
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

  test('note, sub-category and learnt tick work from the page', async () => {
    const { flashcards, study } = setup();
    const id = flashcards.createDeck({ name: 'Chem' })!;
    const card = flashcards.addCard(id, 'q', 'a')!;
    mockParams = { id };
    const view = await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-note-add'));
    await fireEvent.changeText(screen.getByTestId('fcd-note'), 'Exam on Monday');
    await fireEvent(screen.getByTestId('fcd-note'), 'blur');
    expect(flashcards.deck(id)!.notes).toBe('Exam on Monday');
    await fireEvent.press(screen.getByTestId('fcd-sub-new'));
    await fireEvent.changeText(screen.getByTestId('fcd-sub-input'), 'Organic');
    await fireEvent.press(screen.getByTestId('fcd-sub-add'));
    expect(flashcards.decks().some((d) => d.name === 'Organic' && d.parent_uuid === id)).toBe(true);
    await fireEvent.press(screen.getByTestId(`fcd-learn-toggle-${card}`));
    expect(study.isLearnt(card)).toBe(true);
    await view.rerender(wrap(<DeckScreen />));
    expect(screen.getByTestId(`fcd-learnt-${card}`)).toBeTruthy();
  });

  test('move to another parent skips its own branch', async () => {
    const { flashcards } = setup();
    const a = flashcards.createDeck({ name: 'A' })!;
    const b = flashcards.createDeck({ name: 'B', parent: a })!;
    const c = flashcards.createDeck({ name: 'C' })!;
    mockParams = { id: a };
    await render(wrap(<DeckScreen />));
    await fireEvent.press(screen.getByTestId('fcd-settings'));
    await fireEvent.press(screen.getByTestId('fcd-edit-deck'));
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
  test('edit a card: choose a photo for the question, see it at once, then remove it', async () => {
    const { flashcards, db } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    (pickImage as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///docs/photo.jpg',
      mime: 'image/jpeg',
    });
    const view = await render(wrap(<CardScreen />));
    expect(screen.queryByTestId('fcc-q-imgfield-remove')).toBeNull();
    // una sola icona foto: il tocco mostra «libreria» e «scatta»
    expect(screen.queryByTestId('fcc-q-imgfield-library')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcc-q-imgfield'));
    expect(screen.getByTestId('fcc-q-imgfield-camera')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcc-q-imgfield-library'));
    expect(pickImage).toHaveBeenCalledWith('library');
    expect(db.all('SELECT tbl, row_uuid, slot, op, file FROM media_queue')).toEqual([
      {
        tbl: 'fc_study_cards',
        row_uuid: c,
        slot: 'question_image',
        op: 'put',
        file: 'file:///docs/photo.jpg',
      },
    ]);
    expect(mockTrigger).toHaveBeenCalled();
    await view.rerender(wrap(<CardScreen />));
    expect(screen.getByTestId('fcc-q-imgfield-local')).toBeTruthy();
    expect(screen.getByTestId('fcc-q-imgfield-waiting')).toBeTruthy();
    expect(screen.queryByTestId('fcc-a-imgfield-local')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcc-q-imgfield-remove'));
    await view.rerender(wrap(<CardScreen />));
    expect(screen.queryByTestId('fcc-q-imgfield-local')).toBeNull();
    expect(db.all<{ op: string }>('SELECT op FROM media_queue')).toEqual([{ op: 'delete' }]);
  });

  test('edit a card: record the answer audio, stop, and it waits in the upload queue', async () => {
    const { flashcards, db } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    const view = await render(wrap(<CardScreen />));
    expect(screen.queryByTestId('fcc-a-audfield-remove')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcc-a-audfield-record'));
    await screen.findByTestId('audio-stop');
    await fireEvent.press(screen.getByTestId('audio-stop'));
    await waitFor(() => expect(db.all('SELECT * FROM media_queue')).toHaveLength(1));
    expect(db.all('SELECT tbl, row_uuid, slot, op, file, mime FROM media_queue')).toEqual([
      {
        tbl: 'fc_study_cards',
        row_uuid: c,
        slot: 'answer_audio',
        op: 'put',
        file: 'file:///docs/media_queue/rec.m4a',
        mime: 'audio/mp4',
      },
    ]);
    await view.rerender(wrap(<CardScreen />));
    expect(screen.getByTestId('fcc-a-audfield-waiting')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcc-a-audfield-remove'));
    expect(db.all<{ op: string }>('SELECT op FROM media_queue')).toEqual([{ op: 'delete' }]);
  });

  test('edit a card: no microphone permission shows a message and keeps nothing', async () => {
    const { flashcards, db } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    const audio = jest.requireMock('expo-audio');
    audio.requestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-q-audfield-record'));
    await screen.findByTestId('fcc-q-audfield-error');
    expect(db.all('SELECT * FROM media_queue')).toEqual([]);
  });

  test('edit a card: a cancelled photo choice changes nothing', async () => {
    const { flashcards, db } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    (pickImage as jest.Mock).mockResolvedValueOnce(null);
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-a-imgfield'));
    await fireEvent.press(screen.getByTestId('fcc-a-imgfield-camera'));
    expect(pickImage).toHaveBeenCalledWith('camera');
    expect(db.all('SELECT * FROM media_queue')).toEqual([]);
  });

  test('a tap on a card opens the editor at once; the format bar sticks to the bottom while typing', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    // niente pagina di sola lettura: i campi sono già scrivibili e non c'è il tasto «modifica»
    expect(screen.queryByTestId('fcc-edit')).toBeNull();
    expect(screen.queryByTestId('bar-dock')).toBeNull();
    await fireEvent(screen.getByTestId('fcc-q-block-0'), 'focus');
    expect(screen.getByTestId('bar-dock')).toBeTruthy();
    expect(screen.getByTestId('fcc-q-bar')).toBeTruthy();
    expect(screen.queryByTestId('fcc-cancel')).toBeNull(); // niente barra Annulla/Salva in basso
    await fireEvent.press(screen.getByTestId('fcc-close'));
    expect(mockBack).toHaveBeenCalled();
  });

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
    // si resta sulla pagina: la barra dice quando è stato salvato
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByTestId('fcc-last-saved').props.children).toBeTruthy();
    expect(screen.queryByTestId('fcc-dirty')).toBeNull();
  });

  test('autosave: a pause in typing saves the card by itself; the switch turns it off', async () => {
    jest.useFakeTimers();
    try {
      const { flashcards } = setup();
      const deck = flashcards.createDeck({ name: 'Chem' })!;
      const c = flashcards.addCard(deck, 'old q', 'old a')!;
      mockParams = { id: c };
      await render(wrap(<CardScreen />));
      await fireEvent.changeText(screen.getByTestId('fcc-q-block-0'), 'typed q');
      expect(screen.getByTestId('fcc-dirty')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(1200);
      });
      expect(JSON.parse(flashcards.card(c)!.question_desc!).blocks[0].runs[0].s).toBe('typed q');
      expect(screen.queryByTestId('fcc-dirty')).toBeNull();
      // spento: nessun salvataggio da solo
      await fireEvent.press(screen.getByTestId('fcc-autosave'));
      await fireEvent.changeText(screen.getByTestId('fcc-q-block-0'), 'not saved');
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(JSON.parse(flashcards.card(c)!.question_desc!).blocks[0].runs[0].s).toBe('typed q');
      await fireEvent.press(screen.getByTestId('fcc-save'));
      expect(JSON.parse(flashcards.card(c)!.question_desc!).blocks[0].runs[0].s).toBe('not saved');
    } finally {
      jest.useRealTimers();
    }
  });

  test('add example: photo and audio are staged, then attached to the new example', async () => {
    const { flashcards, study, db } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    (pickImage as jest.Mock).mockResolvedValueOnce({ uri: 'file:///x/p.jpg', mime: 'image/jpeg' });
    await render(wrap(<CardScreen />));
    expect(screen.getByTestId('fcc-ex-photo')).toBeTruthy();
    expect(screen.getByTestId('fcc-ex-mic-record')).toBeTruthy();
    expect(screen.getByTestId('fcc-ex-ai')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcc-ex-photo'));
    await fireEvent.press(screen.getByTestId('fcc-ex-photo-library'));
    await screen.findByTestId('fcc-ex-image');
    await fireEvent.changeText(screen.getByTestId('fcc-ex-new'), 'An example');
    await fireEvent.press(screen.getByTestId('fcc-ex-add'));
    const examples = study.examples(c);
    expect(examples).toHaveLength(1);
    expect(db.all<{ slot: string }>('SELECT slot FROM media_queue').map((r) => r.slot)).toContain(
      'example_image',
    );
    expect(mockTrigger).toHaveBeenCalled();
    expect(screen.queryByTestId('fcc-ex-image')).toBeNull(); // il modulo si svuota
    expect((screen.getByTestId('fcc-ex-new').props as { value: string }).value).toBe('');
  });

  test('add example: the AI button fills the box from the card; a refusal shows its message', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'Capital of Italy?', 'Rome')!;
    mockParams = { id: c };
    const doc = stringifyDoc({
      v: 2,
      blocks: [{ t: 'p', runs: [{ s: 'Rome is on the Tiber.' }] }],
    });
    mockAiExample.mockResolvedValueOnce({ success: true, example: doc });
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-ex-ai'));
    await waitFor(() =>
      expect((screen.getByTestId('fcc-ex-new').props as { value: string }).value).toBe(
        'Rome is on the Tiber.',
      ),
    );
    expect(mockAiExample).toHaveBeenCalledWith({ q: 'Capital of Italy?', a: 'Rome' });
    mockAiExample.mockResolvedValueOnce({ success: false, message: 'No credits left' });
    await fireEvent.press(screen.getByTestId('fcc-ex-ai'));
    expect((await screen.findByTestId('fcc-ex-ai-error')).props.children).toBe('No credits left');
  });

  test('delete sits in the save bar and asks once before removing the card', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-delete'));
    await fireEvent.press(screen.getByTestId('fcc-delete-cancel'));
    expect(flashcards.card(c)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcc-delete'));
    await fireEvent.press(screen.getByTestId('fcc-delete-confirm'));
    expect(flashcards.card(c)).toBeFalsy();
  });

  test('edit a card: the untouched formatted side stays as it is; editing it keeps the formatting', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const rich = stringifyDoc({ v: 2, blocks: [{ t: 'p', runs: [{ s: 'Bold', m: { b: 1 } }] }] });
    const c = flashcards.addCard(deck, 'plain question', rich)!;
    mockParams = { id: c };
    const view = await render(wrap(<CardScreen />));
    await fireEvent.changeText(screen.getByTestId('fcc-q-block-0'), 'new question');
    await fireEvent.press(screen.getByTestId('fcc-save'));
    await view.rerender(wrap(<CardScreen />));
    expect(JSON.parse(flashcards.card(c)!.question_desc!).blocks[0].runs[0].s).toBe('new question');
    expect(flashcards.card(c)!.answer_desc).toBe(rich); // intatta
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
    expect(screen.getByTestId('fcc-q-imgfield-remote')).toBeTruthy();
    expect(screen.getByTestId('fcc-a-imgfield-remote')).toBeTruthy();
  });

  test('recorded audio shows a play button on each side that has a file', async () => {
    const { flashcards, db } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    db.run('UPDATE fc_study_cards SET question_audio = ? WHERE uuid = ?', ['q1.m4a', c]);
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    expect(screen.getByTestId('fcc-q-audfield-play')).toBeTruthy();
    expect(screen.queryByTestId('fcc-a-audfield-play')).toBeNull();
  });

  test('clearing a side saves it as empty', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
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

  test('a sub-card can be split back into a card of the deck', async () => {
    const { flashcards } = setup();
    const deck = flashcards.createDeck({ name: 'Chem' })!;
    const c = flashcards.addCard(deck, 'q', 'a')!;
    const s = flashcards.addSubcard(c, 'child q', 'child a')!;
    mockParams = { sub: s };
    await render(wrap(<CardScreen />));
    await fireEvent.press(screen.getByTestId('fcc-split'));
    expect(flashcards.subcard(s)).toBeNull();
    expect(flashcards.cards(deck).map((x) => x.question_desc)).toContain('child q');
    expect(flashcards.card(c)!.is_father).toBeFalsy();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/fc-card',
      params: { id: expect.any(String) },
    });
  });

  test('move a card to another deck and delete it', async () => {
    const { flashcards } = setup();
    const d1 = flashcards.createDeck({ name: 'D1' })!;
    const d2 = flashcards.createDeck({ name: 'D2' })!;
    const c = flashcards.addCard(d1, 'q', 'a')!;
    mockParams = { id: c };
    await render(wrap(<CardScreen />));
    expect(screen.queryByTestId('fcc-move-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('fcc-move'));
    expect(screen.getByTestId('fcc-move-sheet')).toBeTruthy(); // il selettore si apre come un foglio
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
