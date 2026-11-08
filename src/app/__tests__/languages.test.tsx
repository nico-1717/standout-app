import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { MediaQueue } from '@/core/media/mediaQueue';
import { pickImage } from '@/core/media/pickImage';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

import LangCourseScreen from '../lang-course';
import LangDeckScreen from '../lang-deck';
import LangWordScreen from '../lang-word';
import LanguagesScreen from '../languages';

jest.mock('@/core/media/pickImage', () => ({ pickImage: jest.fn() }));

let mockServices: unknown;
let mockVersion = 0;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
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
  const db = memoryDb();
  migrate(db);
  const projects = new ProjectsRepo(db);
  const languages = new LanguagesRepo(db, 7, projects);
  const media = new MediaQueue(
    db,
    { put: async () => ({ name: 'x.jpg' }), remove: async () => undefined },
    { delete: () => undefined },
  );
  mockServices = { db, languages, projects, media, scheduler: { trigger: jest.fn() } };
  return { db, languages, projects };
}
/** Il telefono è cambiato fuori dallo schermo: lo schermo deve rileggere. */
const bump = () => {
  mockVersion += 1;
};
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('Languages hub', () => {
  test('empty: the picker is open; picking a language makes the course and opens it', async () => {
    const { languages, projects } = setup();
    await render(wrap(<LanguagesScreen />));
    expect(screen.getByText('Which language do you want to learn?')).toBeTruthy();
    // chi parla inglese non può imparare l'inglese
    expect(screen.queryByTestId('lang-pick-en-GB')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('lang-search'), 'germ');
    await fireEvent.press(screen.getByTestId('lang-pick-de'));
    const [course] = languages.courses();
    expect(course).toMatchObject({ known_lang: 'en', learn_lang: 'de' });
    expect(projects.get(course!.project_uuid!)!.name).toBe('German');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/lang-course',
      params: { id: course!.uuid },
    });
  });

  test('another known language changes the choices; a language you have is greyed out', async () => {
    const { languages } = setup();
    languages.addCourse('it', 'de', 'en');
    const view = await render(wrap(<LanguagesScreen />));
    await fireEvent.press(screen.getByTestId('lang-add'));
    await fireEvent.press(screen.getByTestId('lang-known'));
    await fireEvent.press(screen.getByTestId('lang-known-it'));
    expect(screen.queryByTestId('lang-pick-it')).toBeNull();
    expect(screen.getByTestId('lang-pick-de').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('lang-pick-de'));
    expect(languages.courses()).toHaveLength(1); // niente doppioni
    await view.rerender(wrap(<LanguagesScreen />));
    await fireEvent.press(screen.getByTestId('lang-pick-fr-FR'));
    expect(languages.courses().map((c) => c.learn_lang)).toEqual(['de', 'fr-FR']);
  });

  test('card shows the progress; accent, order and delete work', async () => {
    const { languages } = setup();
    const a = languages.addCourse('it', 'en-GB', 'en') as string;
    const b = languages.addCourse('it', 'de', 'en') as string;
    const deck = languages.createDeck(a, { name: 'Food' })!;
    const w = languages.addWord(deck, { word: 'bread' })!;
    languages.addWord(deck, { word: 'milk' });
    languages.setLearnt(w, false, true);
    const view = await render(wrap(<LanguagesScreen />));
    expect(screen.getByTestId(`lang-stats-${a}`).props.children).toBe('1 of 2 words learnt');
    expect(screen.getByTestId(`lang-stats-${b}`).props.children).toBe('No words yet');
    const again = () => view.rerender(wrap(<LanguagesScreen />));

    await fireEvent.press(screen.getByTestId(`lang-options-${a}`));
    await fireEvent.press(screen.getByTestId(`lang-variant-${a}`));
    await fireEvent.press(screen.getByTestId(`lang-variant-${a}-en-US`));
    expect(languages.course(a)!.learn_lang).toBe('en-US');
    await again();

    await fireEvent.press(screen.getByTestId(`lang-down-${a}`));
    expect(languages.courses().map((c) => c.uuid)).toEqual([b, a]);
    await again();

    await fireEvent.press(screen.getByTestId(`lang-delete-${a}`));
    expect(screen.getByText(/2 words will be deleted/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`lang-delete-confirm-${a}`));
    expect(languages.course(a)).toBeNull();
    expect(languages.word(w)).toBeNull();
  });

  test('a course opens its page', async () => {
    const { languages } = setup();
    const c = languages.addCourse('it', 'de', 'en') as string;
    await render(wrap(<LanguagesScreen />));
    await fireEvent.press(screen.getByTestId(`lang-course-${c}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/lang-course', params: { id: c } });
  });
});

describe('Course page', () => {
  test('adds decks and sub-decks, archives, searches words across decks', async () => {
    const { languages } = setup();
    const c = languages.addCourse('it', 'de', 'en') as string;
    mockParams = { id: c };
    const view = await render(wrap(<LangCourseScreen />));
    const again = () => view.rerender(wrap(<LangCourseScreen />));
    await fireEvent.changeText(screen.getByTestId('lcourse-new'), 'Food');
    await fireEvent.press(screen.getByTestId('lcourse-new-add'));
    const food = languages.decks(c)[0]!;
    expect(food.name).toBe('Food');
    await again();
    await fireEvent.press(screen.getByTestId(`lcourse-add-${food.uuid}`));
    await fireEvent.changeText(screen.getByTestId('lcourse-sub-input'), 'Fruit');
    await fireEvent(screen.getByTestId('lcourse-sub-input'), 'submitEditing');
    const fruit = languages.decks(c).find((d) => d.name === 'Fruit')!;
    expect(fruit.parent_uuid).toBe(food.uuid);
    languages.addWord(fruit.uuid, { word: 'Apfel', translation: 'mela' });
    bump();
    await again();
    expect(screen.getByText('Fruit')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`lcourse-toggle-${food.uuid}`));
    await again();
    expect(screen.queryByText('Fruit')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('lcourse-search'), 'mela');
    const w = languages.courseWords(c)[0]!;
    await fireEvent.press(screen.getByTestId(`lcourse-word-${w.uuid}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/lang-word', params: { id: w.uuid } });
    await fireEvent.changeText(screen.getByTestId('lcourse-search'), 'zzz');
    expect(screen.getByText('No results')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('lcourse-search'), '');
    languages.setArchived(food.uuid, true);
    bump();
    await again();
    await fireEvent.press(screen.getByTestId('lcourse-scope-archived'));
    expect(screen.getByTestId(`lcourse-deck-${food.uuid}`)).toBeTruthy();
  });

  test('a missing course shows a back button', async () => {
    setup();
    mockParams = { id: 'nope' };
    await render(wrap(<LangCourseScreen />));
    await fireEvent.press(screen.getByTestId('lcourse-gone-back'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('Deck page', () => {
  test('quick-add words, tick learnt, star, rename, colour, and delete only when empty', async () => {
    const { languages } = setup();
    const c = languages.addCourse('it', 'de', 'en') as string;
    const deck = languages.createDeck(c, { name: 'Food' })!;
    mockParams = { id: deck };
    const view = await render(wrap(<LangDeckScreen />));
    const again = () => view.rerender(wrap(<LangDeckScreen />));

    await fireEvent.changeText(screen.getByTestId('ld-word'), 'Brot');
    await fireEvent.changeText(screen.getByTestId('ld-translation'), 'pane');
    await fireEvent.press(screen.getByTestId('ld-word-add'));
    const w = languages.words(deck)[0]!;
    expect(w).toMatchObject({ word: 'Brot', translation: 'pane' });
    await again();
    expect(screen.getByTestId('ld-word').props.value).toBe('');

    await fireEvent.press(screen.getByTestId(`ld-learnt-${w.uuid}`));
    await fireEvent.press(screen.getByTestId(`ld-fav-${w.uuid}`));
    expect(languages.learnt().has(w.uuid)).toBe(true);
    expect(languages.favorites().has(w.uuid)).toBe(true);
    await fireEvent.press(screen.getByTestId(`ld-open-${w.uuid}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/lang-word', params: { id: w.uuid } });

    await fireEvent.changeText(screen.getByTestId('ld-name'), 'Eat');
    await fireEvent(screen.getByTestId('ld-name'), 'blur');
    expect(languages.deck(deck)!.name).toBe('Eat');
    await fireEvent.press(screen.getByTestId('ld-color-FF3B30'));
    expect(languages.deck(deck)).toMatchObject({ color: '#FF3B30', color_edited: 1 });
    await fireEvent.press(screen.getByTestId('ld-pin-switch'));
    await fireEvent(screen.getByTestId('ld-pin-switch'), 'valueChange', true);
    expect(languages.deck(deck)!.pinned).toBe(1);

    await again();
    // con una parola dentro non si cancella
    await fireEvent.press(screen.getByTestId('ld-delete'));
    expect(screen.getByTestId('ld-delete-hint')).toBeTruthy();
    expect(screen.queryByTestId('ld-delete-confirm')).toBeNull();
    languages.removeWord(w.uuid);
    bump();
    await again();
    await fireEvent.press(screen.getByTestId('ld-delete'));
    await fireEvent.press(screen.getByTestId('ld-delete-confirm'));
    expect(languages.deck(deck)).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });

  test('adds a sub-deck', async () => {
    const { languages } = setup();
    const c = languages.addCourse('it', 'de', 'en') as string;
    const deck = languages.createDeck(c, { name: 'Food' })!;
    mockParams = { id: deck };
    await render(wrap(<LangDeckScreen />));
    await fireEvent.changeText(screen.getByTestId('ld-sub-input'), 'Fruit');
    await fireEvent.press(screen.getByTestId('ld-sub-add'));
    expect(languages.decks(c).find((d) => d.name === 'Fruit')!.parent_uuid).toBe(deck);
  });
});

describe('Word page', () => {
  function word() {
    const s = setup();
    const c = s.languages.addCourse('it', 'de', 'en') as string;
    const deck = s.languages.createDeck(c, { name: 'Food' })!;
    const other = s.languages.createDeck(c, { name: 'Drinks' })!;
    const w = s.languages.addWord(deck, { word: 'Brot', translation: 'pane' })!;
    mockParams = { id: w };
    return { ...s, c, deck, other, w };
  }

  test('edits save when you leave the field; an empty word is refused and comes back', async () => {
    const { languages, w } = word();
    const view = await render(wrap(<LangWordScreen />));
    await fireEvent.changeText(screen.getByTestId('lw-translation'), 'bread');
    await fireEvent(screen.getByTestId('lw-translation'), 'blur');
    await fireEvent.changeText(screen.getByTestId('lw-meaning'), 'baked food');
    await fireEvent(screen.getByTestId('lw-meaning'), 'blur');
    await fireEvent.changeText(screen.getByTestId('lw-notes'), 'neuter? no: das Brot');
    await fireEvent(screen.getByTestId('lw-notes'), 'blur');
    expect(languages.word(w)).toMatchObject({
      translation: 'bread',
      meaning: 'baked food',
      notes: 'neuter? no: das Brot',
    });
    await fireEvent.changeText(screen.getByTestId('lw-word'), '  ');
    await fireEvent(screen.getByTestId('lw-word'), 'blur');
    expect(languages.word(w)!.word).toBe('Brot');
    expect(screen.getByTestId('lw-error')).toBeTruthy();
    await view.rerender(wrap(<LangWordScreen />));
    expect(screen.getByTestId('lw-word').props.value).toBe('Brot');
  });

  test('a photo for the word goes to the upload queue with the vocab slot', async () => {
    const { db, w } = word();
    (pickImage as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///docs/bread.jpg',
      mime: 'image/jpeg',
    });
    await render(wrap(<LangWordScreen />));
    await fireEvent.press(screen.getByTestId('lw-imgfield-library'));
    expect(db.all('SELECT tbl, row_uuid, slot, op FROM media_queue')).toEqual([
      { tbl: 'fc_vocab_cards', row_uuid: w, slot: 'image', op: 'put' },
    ]);
  });

  test('learnt and favourite switches', async () => {
    const { languages, w } = word();
    await render(wrap(<LangWordScreen />));
    await fireEvent(screen.getByTestId('lw-learnt'), 'valueChange', true);
    await fireEvent(screen.getByTestId('lw-fav'), 'valueChange', true);
    expect(languages.learnt().has(w)).toBe(true);
    expect(languages.favorites().has(w)).toBe(true);
  });

  test('examples: add, edit, remove', async () => {
    const { languages, w } = word();
    const view = await render(wrap(<LangWordScreen />));
    const again = () => view.rerender(wrap(<LangWordScreen />));
    await fireEvent.changeText(screen.getByTestId('lw-ex-new'), 'Ich esse Brot.');
    await fireEvent.press(screen.getByTestId('lw-ex-add'));
    const [e] = languages.examples(w);
    expect(e!.example_text).toBe('Ich esse Brot.');
    await again();
    await fireEvent.changeText(screen.getByTestId(`lw-ex-${e!.uuid}`), 'Das Brot ist frisch.');
    await fireEvent(screen.getByTestId(`lw-ex-${e!.uuid}`), 'blur');
    expect(languages.examples(w)[0]!.example_text).toBe('Das Brot ist frisch.');
    await again();
    await fireEvent.press(screen.getByTestId(`lw-ex-del-${e!.uuid}`));
    expect(languages.examples(w)).toHaveLength(0);
  });

  test('child forms: add, edit, learnt, examples, delete', async () => {
    const { languages, w } = word();
    const view = await render(wrap(<LangWordScreen />));
    const again = () => view.rerender(wrap(<LangWordScreen />));
    await fireEvent.changeText(screen.getByTestId('lw-kid-word'), 'Brote');
    await fireEvent.changeText(screen.getByTestId('lw-kid-translation'), 'pani');
    await fireEvent.press(screen.getByTestId('lw-kid-add'));
    const [k] = languages.children(w);
    expect(k).toMatchObject({ word: 'Brote', translation: 'pani' });
    await again();
    await fireEvent.changeText(screen.getByTestId(`lw-kid-translation-${k!.uuid}`), 'pani!');
    await fireEvent(screen.getByTestId(`lw-kid-translation-${k!.uuid}`), 'blur');
    expect(languages.child(k!.uuid)!.translation).toBe('pani!');
    await fireEvent.press(screen.getByTestId(`lw-kid-learnt-${k!.uuid}`));
    expect(languages.learnt().has(k!.uuid)).toBe(true);
    await again();
    await fireEvent.press(screen.getByTestId(`lw-kid-more-${k!.uuid}`));
    await fireEvent.changeText(screen.getByTestId(`lw-kid-${k!.uuid}-ex-new`), 'Zwei Brote.');
    await fireEvent.press(screen.getByTestId(`lw-kid-${k!.uuid}-ex-add`));
    expect(languages.examples(k!.uuid)).toHaveLength(1);
    await again();
    await fireEvent.press(screen.getByTestId(`lw-kid-delete-${k!.uuid}`));
    expect(languages.child(k!.uuid)).toBeNull();
    expect(languages.word(w)!.is_father).toBe(0);
  });

  test('move to another deck, then delete', async () => {
    const { languages, w, other } = word();
    const view = await render(wrap(<LangWordScreen />));
    await fireEvent.press(screen.getByTestId('lw-move'));
    await fireEvent.press(screen.getByTestId(`deck-pick-${other}`));
    expect(languages.word(w)!.category_uuid).toBe(other);
    await view.rerender(wrap(<LangWordScreen />));
    expect(screen.getByTestId('lw-path').props.children).toBe('Drinks');
    await fireEvent.press(screen.getByTestId('lw-delete'));
    await fireEvent.press(screen.getByTestId('lw-delete-confirm'));
    expect(languages.word(w)).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });

  test('a missing word shows a back button', async () => {
    setup();
    mockParams = { id: 'nope' };
    await render(wrap(<LangWordScreen />));
    await fireEvent.press(screen.getByTestId('lw-gone-back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
