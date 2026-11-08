import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';

import {
  DECK_ICON_KEYS,
  daysToExam,
  deckBranch,
  deckIcon,
  deckIconSvg,
  deckMap,
  deckPath,
  examUrgency,
  flattenDecks,
  iconFromName,
  inArchivedBranch,
  inheritedDeckColor,
  scopeCounts,
  searchDecks,
} from '../logic';
import { FlashcardsRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const repo = new FlashcardsRepo(
    db,
    () => '2026-11-03T10:00:00Z',
    () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  );
  return { db, repo };
}

const outbox = (db: ReturnType<typeof memoryDb>) => nextBatch(db, 100);

describe('deck rules', () => {
  test('a new deck takes the colour of the nearest ancestor with a chosen one, else grey', () => {
    const { repo } = setup();
    const a = repo.createDeck({ name: 'Maths', color: '#336699' })!;
    const b = repo.createDeck({ name: 'Other' })!;
    const kid = repo.createDeck({ name: 'Algebra', parent: a })!;
    const grand = repo.createDeck({ name: 'Groups', parent: kid })!;
    expect(repo.deck(b)).toMatchObject({ color: '#A0A0A0', color_edited: 0 });
    expect(repo.deck(kid)).toMatchObject({ color: '#336699', color_edited: 0 });
    expect(repo.deck(grand)!.color).toBe('#336699');
    expect(repo.deck(a)).toMatchObject({ color_edited: 1 });
    expect(repo.createDeck({ name: '   ' })).toBeNull();
    expect(repo.createDeck({ name: 'x', parent: 'nope' })).toBeNull();
    expect(repo.createDeck({ name: 'x', color: 'red' })).toBeNull();
    expect(repo.createDeck({ name: 'x', exam_date: '3/11/2026' })).toBeNull();
  });

  test('changing a colour passes it down to automatic children only; back to automatic follows the parent', () => {
    const { repo } = setup();
    const root = repo.createDeck({ name: 'Root', color: '#111111' })!;
    const auto = repo.createDeck({ name: 'Auto', parent: root })!;
    const own = repo.createDeck({ name: 'Own', parent: root, color: '#222222' })!;
    const deep = repo.createDeck({ name: 'Deep', parent: auto })!;
    const deepOwn = repo.createDeck({ name: 'DeepOwn', parent: own })!;
    repo.updateDeck(root, { color: '#aa0000' });
    expect(repo.deck(root)!.color).toBe('#AA0000');
    expect(repo.deck(auto)!.color).toBe('#AA0000');
    expect(repo.deck(deep)!.color).toBe('#AA0000');
    expect(repo.deck(own)!.color).toBe('#222222');
    expect(repo.deck(deepOwn)!.color).toBe('#222222');
    repo.updateDeck(own, { color: null });
    expect(repo.deck(own)).toMatchObject({ color: '#AA0000', color_edited: 0 });
    expect(repo.deck(deepOwn)!.color).toBe('#AA0000');
  });

  test('moving: no cycles, automatic colour follows the new parent', () => {
    const { repo } = setup();
    const a = repo.createDeck({ name: 'A', color: '#111111' })!;
    const b = repo.createDeck({ name: 'B', color: '#222222' })!;
    const a1 = repo.createDeck({ name: 'A1', parent: a })!;
    const a2 = repo.createDeck({ name: 'A2', parent: a1 })!;
    expect(repo.moveDeck(a, a2)).toBe(false);
    expect(repo.moveDeck(a, a)).toBe(false);
    expect(repo.moveDeck(a1, 'nope')).toBe(false);
    expect(repo.moveDeck(a1, b)).toBe(true);
    expect(repo.deck(a1)).toMatchObject({ parent_uuid: b, color: '#222222' });
    expect(repo.deck(a2)!.color).toBe('#222222');
    expect(repo.moveDeck(a1, null)).toBe(true);
    expect(repo.deck(a1)).toMatchObject({ parent_uuid: null, color: '#A0A0A0' });
  });

  test('name is never empty; icon must be a known one; pin and archive toggle', () => {
    const { repo, db } = setup();
    const a = repo.createDeck({ name: 'Physics' })!;
    expect(repo.updateDeck(a, { name: '  ' })).toBe(false);
    expect(repo.updateDeck(a, { icon: 'not-an-icon' })).toBe(false);
    expect(
      repo.updateDeck(a, { icon: 'atomo', notes: ' study this ', exam_date: '2026-12-01' }),
    ).toBe(true);
    expect(repo.deck(a)).toMatchObject({
      icon: 'atomo',
      notes: ' study this ',
      exam_date: '2026-12-01',
    });
    expect(repo.updateDeck(a, { exam_date: 'tomorrow' })).toBe(false);
    repo.setPinned(a, true);
    repo.setArchived(a, true);
    expect(repo.deck(a)).toMatchObject({ pinned: 1, archived: 1 });
    // le modifiche in attesa dello stesso mazzo diventano una sola
    const mine = outbox(db).filter((m) => m.uuid === a);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.patch).toMatchObject({
      pinned: true,
      archived: true,
    });
  });

  test('a new deck is created with booleans as real booleans on the wire', () => {
    const { repo, db } = setup();
    repo.createDeck({ name: 'Chem', color: '#00FF00', icon: 'provetta' });
    const m = outbox(db)[0]!;
    expect(m).toMatchObject({ table: 'fc_study_decks', op: 'upsert' });
    expect(m.patch).toEqual({
      name: 'Chem',
      parent_uuid: null,
      color: '#00FF00',
      color_edited: true,
      icon: 'provetta',
    });
  });

  test('deleting a deck removes the whole branch locally and sends one delete', () => {
    const { repo, db } = setup();
    const a = repo.createDeck({ name: 'A' })!;
    const a1 = repo.createDeck({ name: 'A1', parent: a })!;
    const keep = repo.createDeck({ name: 'Keep' })!;
    const c1 = repo.addCard(a, 'q1', 'a1')!;
    const c2 = repo.addCard(a1, 'q2', 'a2')!;
    repo.addSubcard(c2, 'sq', 'sa');
    const k = repo.addCard(keep, 'kq', 'ka')!;
    outbox(db); // tutto «inviato»
    db.run(`DELETE FROM outbox`);
    repo.updateDeck(a1, { name: 'A1 renamed' }); // una modifica in attesa nel ramo
    repo.updateDeck(keep, { name: 'Keep it' });
    expect(repo.canDeleteDeck(a)).toBe(false);
    expect(repo.removeDeck(a)).toBe(false); // come il sito: non vuoto, non si toglie
    expect(repo.removeDeck(a, true)).toBe(true);
    expect(repo.decks().map((d) => d.uuid)).toEqual([keep]);
    expect(repo.card(c1)).toBeNull();
    expect(repo.card(c2)).toBeNull();
    expect(repo.card(k)).not.toBeNull();
    expect(db.all('SELECT * FROM fc_study_subcards')).toHaveLength(0);
    const ops = outbox(db).map((m) => `${m.table}:${m.op}:${m.uuid}`);
    // le modifiche in attesa del ramo sono sparite: resta la cancellazione, più quello che non si tocca
    expect(ops).toContain(`fc_study_decks:delete:${a}`);
    expect(ops.filter((o) => o.includes(a1) || o.includes(c1) || o.includes(c2))).toHaveLength(0);
    expect(ops.some((o) => o.includes(keep))).toBe(true);
  });

  test('a deck never sent leaves no trace when deleted', () => {
    const { repo, db } = setup();
    const a = repo.createDeck({ name: 'A' })!;
    const c = repo.addCard(a, 'q', 'a')!;
    expect(repo.removeDeck(a)).toBe(false);
    repo.removeCard(c);
    expect(repo.canDeleteDeck(a)).toBe(true);
    expect(repo.removeDeck(a)).toBe(true);
    expect(outbox(db)).toHaveLength(0);
    expect(repo.decks()).toHaveLength(0);
  });
});

describe('cards', () => {
  test('cards go to the end of the deck; moving puts them last in the other deck', () => {
    const { repo } = setup();
    const d1 = repo.createDeck({ name: 'D1' })!;
    const d2 = repo.createDeck({ name: 'D2' })!;
    const a = repo.addCard(d1, 'a', '1')!;
    const b = repo.addCard(d1, 'b', '2')!;
    const c = repo.addCard(d2, 'c', '3')!;
    expect(repo.cards(d1).map((x) => x.uuid)).toEqual([a, b]);
    expect(repo.moveCard(a, d2)).toBe(true);
    expect(repo.cards(d2).map((x) => x.uuid)).toEqual([c, a]);
    expect(repo.moveCard(a, 'nope')).toBe(false);
    expect(repo.addCard('nope', 'x', 'y')).toBeNull();
    expect(repo.addCard(d1, 'x'.repeat(60_001), 'y')).toBeNull();
  });

  test('editing a card sends only what changed; empty text becomes null', () => {
    const { repo, db } = setup();
    const d = repo.createDeck({ name: 'D' })!;
    const c = repo.addCard(d, 'q', 'a')!;
    expect(repo.updateCard(c, { question: 'q' })).toBe(true); // nothing changed
    expect(repo.updateCard(c, { question: 'new q', answer: '' })).toBe(true);
    expect(repo.card(c)).toMatchObject({ question_desc: 'new q', answer_desc: null });
    // ancora non inviata: la modifica si fonde con la creazione
    const m = outbox(db).filter((x) => x.uuid === c);
    expect(m).toHaveLength(1);
    expect(m[0]!.patch).toEqual({ category_uuid: d, question_desc: 'new q', answer_desc: null });
    expect(repo.updateCard('nope', { question: 'x' })).toBe(false);
  });

  test('sub-cards make the parent a father, and the flag goes back when the last one goes', () => {
    const { repo, db } = setup();
    const d = repo.createDeck({ name: 'D' })!;
    const c = repo.addCard(d, 'q', 'a')!;
    const s1 = repo.addSubcard(c, 'sq1', 'sa1')!;
    const s2 = repo.addSubcard(c, 'sq2', 'sa2')!;
    expect(repo.card(c)!.is_father).toBe(1);
    expect(repo.subcards(c).map((x) => x.uuid)).toEqual([s1, s2]);
    repo.updateSubcard(s2, { answer: 'changed' });
    expect(repo.subcard(s2)!.answer_desc).toBe('changed');
    repo.removeSubcard(s1);
    expect(repo.card(c)!.is_father).toBe(1);
    repo.removeSubcard(s2);
    expect(repo.card(c)!.is_father).toBe(0);
    expect(repo.addSubcard('nope', 'x', 'y')).toBeNull();
    // il padre non viene mai inviato con is_father: lo decide il server
    for (const m of outbox(db)) expect(m.patch).not.toHaveProperty('is_father');
  });

  test('removing a card removes its sub-cards and its waiting changes', () => {
    const { repo, db } = setup();
    const d = repo.createDeck({ name: 'D' })!;
    const c = repo.addCard(d, 'q', 'a')!;
    const s = repo.addSubcard(c, 'sq', 'sa')!;
    db.run(`DELETE FROM outbox`); // già inviate
    repo.updateSubcard(s, { answer: 'x' });
    repo.removeCard(c);
    expect(repo.card(c)).toBeNull();
    expect(repo.subcard(s)).toBeNull();
    const ops = outbox(db).filter((m) => m.uuid === c || m.uuid === s);
    expect(ops.map((m) => m.op)).toEqual(['delete']);
  });

  test('counts include sub-cards and the whole branch', () => {
    const { repo } = setup();
    const a = repo.createDeck({ name: 'A' })!;
    const a1 = repo.createDeck({ name: 'A1', parent: a })!;
    const c1 = repo.addCard(a, 'q', 'a')!;
    repo.addCard(a1, 'q', 'a');
    repo.addSubcard(c1, 'sq', 'sa');
    expect(repo.cardCounts().get(a)).toBe(2); // la carta + la sua carta figlia
    expect(repo.branchCardCount(a)).toBe(3);
    expect(repo.branchCardCount(a1)).toBe(1);
  });
});

describe('tree and search', () => {
  function tree() {
    const { repo } = setup();
    const m = repo.createDeck({ name: 'Maths' })!;
    const z = repo.createDeck({ name: 'Zoology' })!;
    const alg = repo.createDeck({ name: 'Algebra', parent: m })!;
    const geo = repo.createDeck({ name: 'Geometry', parent: m })!;
    const old = repo.createDeck({ name: 'Old', parent: alg })!;
    return { repo, m, z, alg, geo, old };
  }

  test('active tree: pinned first, then by name; collapsed branches hide children', () => {
    const { repo, m, z, alg } = tree();
    repo.setPinned(z, true);
    const rows = flattenDecks(repo.decks(), 'active');
    expect(rows.map((r) => `${r.depth}:${r.deck.name}`)).toEqual([
      '0:Zoology',
      '0:Maths',
      '1:Algebra',
      '2:Old',
      '1:Geometry',
    ]);
    const closed = flattenDecks(repo.decks(), 'active', new Set([m]));
    expect(closed.map((r) => r.deck.name)).toEqual(['Zoology', 'Maths']);
    expect(closed[1]!.hasChildren).toBe(true);
    expect(
      flattenDecks(repo.decks(), 'active', new Set([alg])).map((r) => r.deck.name),
    ).not.toContain('Old');
  });

  test('archiving a branch moves it (with its children) to the archive, shown as a first-level entry', () => {
    const { repo, alg, old } = tree();
    repo.setArchived(alg, true);
    const all = repo.decks();
    expect(inArchivedBranch(deckMap(all), old)).toBe(true);
    expect(flattenDecks(all, 'active').map((r) => r.deck.name)).toEqual([
      'Maths',
      'Geometry',
      'Zoology',
    ]);
    expect(flattenDecks(all, 'archived').map((r) => `${r.depth}:${r.deck.name}`)).toEqual([
      '0:Algebra',
      '1:Old',
    ]);
    expect(scopeCounts(all)).toEqual({ active: 2, archived: 1 });
  });

  test('branch, path, colour inheritance and search with accents', () => {
    const { repo, m, alg, old } = tree();
    const all = repo.decks();
    expect(deckBranch(all, m).sort()).toHaveLength(4);
    expect(deckPath(deckMap(all), old).map((d) => d.name)).toEqual(['Maths', 'Algebra']);
    expect(inheritedDeckColor(deckMap(all), alg)).toBe('#A0A0A0');
    const r = repo.createDeck({ name: 'Cálculo' })!;
    expect(searchDecks(repo.decks(), 'calculo').map((x) => x.deck.uuid)).toEqual([r]);
    expect(searchDecks(repo.decks(), 'old')[0]!.path).toBe('Maths › Algebra');
    expect(searchDecks(repo.decks(), '  ')).toEqual([]);
  });
});

describe('exam countdown', () => {
  test('counts calendar days, null when missing or past', () => {
    expect(daysToExam('2026-11-03', '2026-11-03')).toBe(0);
    expect(daysToExam('2026-11-04', '2026-11-03')).toBe(1);
    expect(daysToExam('2026-12-01', '2026-11-03')).toBe(28);
    expect(daysToExam('2026-11-02', '2026-11-03')).toBeNull();
    expect(daysToExam(null, '2026-11-03')).toBeNull();
    expect(daysToExam('garbage', '2026-11-03')).toBeNull();
    // il cambio dell'ora legale non sposta i giorni
    expect(daysToExam('2027-03-29', '2027-03-27')).toBe(2);
  });
  test('urgency steps', () => {
    expect(examUrgency(0)).toBe('urgent');
    expect(examUrgency(3)).toBe('urgent');
    expect(examUrgency(4)).toBe('near');
    expect(examUrgency(14)).toBe('near');
    expect(examUrgency(15)).toBe('far');
  });
});

describe('icons', () => {
  test('57 icons, name rules pick like the website, unknown names get the folder', () => {
    expect(DECK_ICON_KEYS).toHaveLength(57);
    expect(iconFromName('Phrasal verbs')).toBe('puzzle');
    expect(iconFromName('Fruit and vegetables')).toBe('mela');
    expect(iconFromName('Filosofia')).toBe('lampadina');
    expect(iconFromName('Inglese')).toBe('fumetto');
    expect(iconFromName('qwerty')).toBe('cartella');
    expect(deckIcon({ icon: 'atomo', name: 'Inglese' })).toBe('atomo');
    expect(deckIcon({ icon: 'bogus', name: 'Inglese' })).toBe('fumetto');
    expect(deckIcon({ icon: null, name: 'zzz' })).toBe('cartella');
    expect(deckIconSvg('atomo')).toContain('<circle');
    expect(deckIconSvg('bogus')).toBe(deckIconSvg('cartella'));
  });
});

describe('join and split cards', () => {
  test('join turns plain cards into sub-cards; the parent, parents and cards with files stay', () => {
    const { db, repo } = setup();
    const deck = repo.createDeck({ name: 'Deck' })!;
    const parent = repo.addCard(deck, 'Parent Q', 'Parent A')!;
    const plain1 = repo.addCard(deck, 'One Q', 'One A')!;
    const plain2 = repo.addCard(deck, 'Two Q', 'Two A')!;
    const withKids = repo.addCard(deck, 'Has kids', 'x')!;
    repo.addSubcard(withKids, 'kid', 'kid');
    const withImage = repo.addCard(deck, 'Pic Q', 'Pic A')!;
    db.run('UPDATE fc_study_cards SET question_image = ? WHERE uuid = ?', ['pic.jpg', withImage]);

    const r = repo.joinCards(parent, [parent, plain1, plain2, withKids, withImage]);
    expect(r).toEqual({ joined: 2, skipped: 2 });
    expect(repo.card(plain1)).toBeNull();
    expect(repo.card(plain2)).toBeNull();
    expect(repo.card(withKids)).not.toBeNull();
    expect(repo.card(withImage)).not.toBeNull();
    expect(repo.subcards(parent).map((x) => x.question_desc)).toEqual(['One Q', 'Two Q']);
    expect(repo.card(parent)!.is_father).toBeTruthy();
  });

  test('split gives the sub-card back as a card of the same deck and clears the parent flag', () => {
    const { db, repo } = setup();
    const deck = repo.createDeck({ name: 'Deck' })!;
    const parent = repo.addCard(deck, 'Parent Q', 'Parent A')!;
    const kid = repo.addSubcard(parent, 'Kid Q', 'Kid A')!;
    const made = repo.unjoinSubcard(kid)!;
    expect(repo.subcard(kid)).toBeNull();
    expect(repo.card(made)).toMatchObject({
      category_uuid: deck,
      question_desc: 'Kid Q',
      answer_desc: 'Kid A',
    });
    expect(repo.card(parent)!.is_father).toBeFalsy();

    const pic = repo.addSubcard(parent, 'Pic', 'x')!;
    db.run('UPDATE fc_study_subcards SET answer_audio = ? WHERE uuid = ?', ['a.mp3', pic]);
    expect(repo.unjoinSubcard(pic)).toBeNull();
    expect(repo.subcard(pic)).not.toBeNull();
  });
});
