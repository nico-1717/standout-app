import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { learntUuid } from '@/core/sync/uuid5';
import { ProjectsRepo } from '@/features/projects/repo';

import { isKnownLang, isLearnLang, langFlag, langName, learnChoices } from '../langs';
import { LanguagesRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const clock = () => '2026-11-03T10:00:00Z';
  const projects = new ProjectsRepo(db, clock, id);
  const repo = new LanguagesRepo(db, 7, projects, clock, id, () => '2026-11-03');
  return { db, repo, projects };
}
const sent = (db: ReturnType<typeof memoryDb>) => nextBatch(db, 200);

describe('the language list', () => {
  test('names, flags and choices follow the website', () => {
    expect(isLearnLang('en-GB')).toBe(true);
    expect(isLearnLang('en')).toBe(false); // da imparare serve il codice esatto
    expect(isKnownLang('en')).toBe(true); // quella che si conosce è senza variante
    expect(isKnownLang('en-GB')).toBe(false);
    expect(langName('en-GB', 'it')).toBe('Inglese (Regno Unito)');
    expect(langName('en-GB', 'en', false)).toBe('English');
    expect(langName('de', 'en')).toBe('German');
    expect(langName('zz', 'it')).toBe('zz');
    expect(langFlag('de')).toBe('🇩🇪');
    expect(langFlag('ca')).toBe('🌐'); // la bandiera della Catalogna non ha un emoji a due lettere
    const c = learnChoices('it', 'en').map((l) => l.code);
    expect(c).not.toContain('it');
    expect(c).toContain('en-GB');
  });
});

describe('courses', () => {
  test('a course makes its own project, and sends it before the course', () => {
    const { db, repo, projects } = setup();
    const c = repo.addCourse('it', 'de', 'it');
    expect(typeof c).toBe('string');
    const course = repo.course(c as string)!;
    expect(course).toMatchObject({ known_lang: 'it', learn_lang: 'de' });
    const p = projects.get(course.project_uuid!)!;
    expect(p).toMatchObject({ name: 'Tedesco', color: '#5856D6', parent_uuid: null });
    const out = sent(db);
    expect(out.map((o) => o.table)).toEqual(['projects', 'fc_vocab_courses']);
    expect(out[1]!.patch).toMatchObject({
      known_lang: 'it',
      learn_lang: 'de',
      project_uuid: p.uuid,
    });
  });

  test('a project already called like the language is reused, unless another course has it', () => {
    const { repo, projects } = setup();
    const mine = projects.create({ name: 'tedesco' })!;
    const first = repo.addCourse('it', 'de') as string;
    expect(repo.course(first)!.project_uuid).toBe(mine);
    // lo stesso nome per un altro corso (conosco l'inglese, imparo il tedesco): il progetto è già preso
    const second = repo.addCourse('en', 'de', 'it') as string;
    expect(repo.course(second)!.project_uuid).not.toBe(mine);
  });

  test('refuses the same language, unknown ones and duplicates', () => {
    const { repo } = setup();
    expect(repo.addCourse('it', 'it')).toBe('same');
    expect(repo.addCourse('en', 'en-US')).toBe('same');
    expect(repo.addCourse('it', 'xx')).toBe('languages');
    expect(repo.addCourse('it-IT', 'de')).toBe('languages');
    expect(typeof repo.addCourse('it', 'en-GB')).toBe('string');
    expect(repo.addCourse('it', 'en-GB')).toBe('exists');
    expect(typeof repo.addCourse('it', 'en-US')).toBe('string'); // un'altra variante è un altro corso
  });

  test('only the variant can change, and not onto one you already have', () => {
    const { db, repo } = setup();
    const gb = repo.addCourse('it', 'en-GB') as string;
    const us = repo.addCourse('it', 'en-US') as string;
    db.run('DELETE FROM outbox');
    expect(repo.changeVariant(gb, 'en-US')).toBe('exists');
    expect(repo.changeVariant(gb, 'de')).toBe('variant');
    expect(repo.changeVariant(gb, 'en-AU')).toBe(true);
    expect(repo.course(gb)!.learn_lang).toBe('en-AU');
    expect(sent(db).map((o) => o.patch)).toEqual([{ learn_lang: 'en-AU' }]);
    void us;
  });

  test('reorder puts a course between two others', () => {
    const { repo } = setup();
    const a = repo.addCourse('it', 'de') as string;
    const b = repo.addCourse('it', 'fr-FR') as string;
    const c = repo.addCourse('it', 'es-ES') as string;
    expect(repo.courses().map((x) => x.uuid)).toEqual([a, b, c]);
    repo.reorderCourse(c, null, a);
    expect(repo.courses().map((x) => x.uuid)).toEqual([c, a, b]);
  });

  test('removing a course removes everything of it; the project stays; sent as one delete', () => {
    const { db, repo, projects } = setup();
    const c = repo.addCourse('it', 'de') as string;
    const other = repo.addCourse('it', 'fr-FR') as string;
    const d = repo.createDeck(c, { name: 'Food' })!;
    const sub = repo.createDeck(c, { name: 'Fruit', parent: d })!;
    const w = repo.addWord(sub, { word: 'Apfel', translation: 'mela' })!;
    const kid = repo.addChild(w, { word: 'Äpfel', translation: 'mele' })!;
    repo.addExample(w, false, 'Ich esse einen Apfel.');
    repo.setFavorite(w, false, true);
    repo.setLearnt(kid, true, true);
    const od = repo.createDeck(other, { name: 'Keep' })!;
    repo.addWord(od, { word: 'pomme' });
    const proj = repo.course(c)!.project_uuid!;
    db.run('DELETE FROM outbox');
    expect(repo.removeCourse(c)).toBe(true);
    for (const t of [
      'fc_vocab_decks',
      'fc_vocab_cards',
      'fc_vocab_subcards',
      'fc_vocab_examples',
      'fc_vocab_favorites',
      'fc_vocab_learnt',
    ])
      expect(db.all(`SELECT 1 FROM ${t} WHERE uuid IS NOT NULL`).length).toBe(
        t === 'fc_vocab_decks' || t === 'fc_vocab_cards' ? 1 : 0,
      );
    expect(repo.course(c)).toBeNull();
    expect(projects.get(proj)).not.toBeNull();
    expect(sent(db).map((o) => [o.table, o.op])).toEqual([['fc_vocab_courses', 'delete']]);
  });
});

describe('decks', () => {
  test('colour is inherited, a deck stays in its course, no cycles, empty-only delete', () => {
    const { db, repo } = setup();
    const c1 = repo.addCourse('it', 'de') as string;
    const c2 = repo.addCourse('it', 'fr-FR') as string;
    const root = repo.createDeck(c1, { name: ' Food ', color: '#ff0000' })!;
    const kid = repo.createDeck(c1, { name: 'Fruit', parent: root })!;
    expect(repo.deck(root)).toMatchObject({ name: 'Food', color: '#FF0000', color_edited: 1 });
    expect(repo.deck(kid)).toMatchObject({ color: '#FF0000', color_edited: 0, course_uuid: c1 });
    expect(repo.createDeck(c1, { name: '' })).toBeNull();
    expect(repo.createDeck(c1, { name: 'x', parent: 'nope' })).toBeNull();
    const foreign = repo.createDeck(c2, { name: 'Elsewhere' })!;
    expect(repo.createDeck(c1, { name: 'x', parent: foreign })).toBeNull(); // il padre è di un altro corso
    expect(repo.moveDeck(root, kid)).toBe(false); // dentro un suo figlio
    expect(repo.moveDeck(kid, foreign)).toBe(false);
    repo.updateDeck(root, { color: '#00FF00' });
    expect(repo.deck(kid)!.color).toBe('#00FF00');
    repo.updateDeck(root, { color: null });
    expect(repo.deck(root)).toMatchObject({ color_edited: 0, color: '#A0A0A0' });
    expect(repo.updateDeck(root, { name: '  ' })).toBe(false);
    expect(repo.updateDeck(root, { color: 'red' })).toBe(false);
    repo.setPinned(root, true);
    repo.setArchived(kid, true);
    expect(repo.deck(root)!.pinned).toBe(1);
    expect(repo.deck(kid)!.archived).toBe(1);
    expect(repo.canDeleteDeck(root)).toBe(false);
    expect(repo.removeDeck(root)).toBe(false);
    expect(repo.canDeleteDeck(kid)).toBe(true);
    db.run('DELETE FROM outbox');
    expect(repo.removeDeck(root, true)).toBe(true);
    expect(repo.deck(kid)).toBeNull();
    expect(sent(db).map((o) => [o.table, o.op])).toEqual([['fc_vocab_decks', 'delete']]);
  });
});

describe('words', () => {
  test('add, edit, children, move, remove — with the same limits as the server', () => {
    const { db, repo } = setup();
    const c = repo.addCourse('it', 'de') as string;
    const a = repo.createDeck(c, { name: 'A' })!;
    const b = repo.createDeck(c, { name: 'B' })!;
    const other = repo.addCourse('it', 'fr-FR') as string;
    const foreign = repo.createDeck(other, { name: 'F' })!;
    expect(repo.addWord(a, { word: '   ' })).toBeNull();
    expect(repo.addWord('nope', { word: 'x' })).toBeNull();
    const w1 = repo.addWord(a, { word: ' Haus ', translation: 'casa', meaning: '', notes: ' n ' })!;
    const w2 = repo.addWord(a, { word: 'Baum' })!;
    expect(repo.words(a).map((x) => x.word)).toEqual(['Haus', 'Baum']);
    expect(repo.word(w1)).toMatchObject({
      translation: 'casa',
      meaning: null,
      notes: 'n',
      is_father: 0,
    });
    const long = repo.addWord(a, { word: 'w'.repeat(300), translation: 't'.repeat(600) })!;
    expect(repo.word(long)!.word).toHaveLength(255);
    expect(repo.word(long)!.translation).toHaveLength(500);
    db.run('DELETE FROM outbox');

    expect(repo.updateWord(w1, { word: '' })).toBe(false);
    expect(repo.updateWord(w1, { translation: 'casa' })).toBe(true); // niente di nuovo: niente da inviare
    expect(sent(db)).toHaveLength(0);
    expect(repo.updateWord(w1, { translation: null, meaning: 'building' })).toBe(true);
    expect(repo.word(w1)).toMatchObject({ translation: null, meaning: 'building' });
    expect(sent(db)[0]!.patch).toEqual({ translation: null, meaning: 'building' });

    const k = repo.addChild(w1, { word: 'Häuser' })!;
    expect(repo.word(w1)!.is_father).toBe(1);
    expect(repo.child(k)).toMatchObject({ word: 'Häuser', translation: '' }); // la figlia tiene il testo vuoto
    expect(repo.addChild(w1, { word: '' })).toBeNull();
    expect(repo.updateChild(k, { translation: 'case' })).toBe(true);
    expect(repo.children(w1).map((x) => x.translation)).toEqual(['case']);
    repo.updateChild(k, { translation: null });
    expect(repo.child(k)!.translation).toBe('');

    expect(repo.moveWord(w2, b)).toBe(true);
    expect(repo.words(b).map((x) => x.uuid)).toEqual([w2]);
    expect(repo.moveWord(w2, foreign)).toBe(false); // un'altra lingua: no
    expect(repo.wordCounts(c).get(a)).toBe(3); // Haus + Häuser + la lunga
    expect(repo.courseWords(c).map((x) => x.word)).toContain('Baum');

    repo.setLearnt(k, true, true);
    repo.removeChild(k);
    expect(repo.word(w1)!.is_father).toBe(0);
    expect(repo.learnt().size).toBe(0);
    repo.removeWord(w1);
    expect(repo.word(w1)).toBeNull();
  });

  test('deleting a word that was never sent leaves nothing in the outbox', () => {
    const { db, repo } = setup();
    const c = repo.addCourse('it', 'de') as string;
    const d = repo.createDeck(c, { name: 'A' })!;
    db.run('DELETE FROM outbox');
    const w = repo.addWord(d, { word: 'Haus' })!;
    repo.addExample(w, false, 'Das Haus.');
    repo.removeWord(w);
    expect(sent(db).filter((o) => o.table.startsWith('fc_vocab_c') && o.uuid === w)).toEqual([]);
    expect(db.all('SELECT 1 FROM fc_vocab_examples')).toHaveLength(0);
  });
});

describe('favourites, learnt and examples', () => {
  test('learnt uses the uuid the server computes and keeps the first date', () => {
    const { db, repo } = setup();
    const c = repo.addCourse('it', 'de') as string;
    const d = repo.createDeck(c, { name: 'A' })!;
    const w = repo.addWord(d, { word: 'Haus' })!;
    const k = repo.addChild(w, { word: 'Häuser' })!;
    db.run('DELETE FROM outbox');
    expect(repo.setLearnt(w, false, true)).toBe(true);
    expect(repo.setLearnt(k, true, true)).toBe(true);
    expect(repo.setLearnt('nope', false, true)).toBe(false);
    const out = sent(db);
    expect(out.map((o) => o.uuid).sort()).toEqual(
      [learntUuid(7, w, false), learntUuid(7, k, true)].sort(),
    );
    expect(repo.setLearnt(w, false, true)).toBe(true);
    expect(sent(db)).toHaveLength(0);
    repo.setLearnt(w, false, false);
    expect(repo.learnt().has(w)).toBe(false);
  });

  test('favourites toggle for a word and a child', () => {
    const { db, repo } = setup();
    const c = repo.addCourse('it', 'de') as string;
    const d = repo.createDeck(c, { name: 'A' })!;
    const w = repo.addWord(d, { word: 'Haus' })!;
    const k = repo.addChild(w, { word: 'Häuser' })!;
    db.run('DELETE FROM outbox');
    repo.setFavorite(w, false, true);
    repo.setFavorite(k, true, true);
    expect([...repo.favorites()].sort()).toEqual([w, k].sort());
    const out = sent(db);
    expect(out[0]!.patch).toEqual({ card_uuid: w, child_uuid: null, favorited_date: '2026-11-03' });
    repo.setFavorite(w, false, false);
    expect(repo.favorites().has(w)).toBe(false);
  });

  test('examples: add, edit, remove; empty text is refused; long text is cut', () => {
    const { repo } = setup();
    const c = repo.addCourse('it', 'de') as string;
    const d = repo.createDeck(c, { name: 'A' })!;
    const w = repo.addWord(d, { word: 'Haus' })!;
    const k = repo.addChild(w, { word: 'Häuser' })!;
    expect(repo.addExample(w, false, '  ')).toBeNull();
    const e1 = repo.addExample(w, false, 'Das Haus ist groß.')!;
    const e2 = repo.addExample(k, true, 'x'.repeat(1200))!;
    expect(repo.examples(w).map((e) => e.uuid)).toEqual([e1]);
    expect(repo.examples(k)[0]!.example_text).toHaveLength(1000);
    expect(repo.updateExample(e1, 'Neu')).toBe(true);
    expect(repo.updateExample(e1, '')).toBe(false);
    expect(repo.examples(w)[0]!.example_text).toBe('Neu');
    repo.removeExample(e2);
    expect(repo.examples(k)).toHaveLength(0);
  });

  test('course stats count words and learnt words, children included', () => {
    const { repo } = setup();
    const c = repo.addCourse('it', 'de') as string;
    const d = repo.createDeck(c, { name: 'A' })!;
    const w = repo.addWord(d, { word: 'Haus' })!;
    const k = repo.addChild(w, { word: 'Häuser' })!;
    repo.setLearnt(k, true, true);
    expect(repo.courseStats().get(c)).toEqual({ words: 2, learnt: 1 });
  });
});
