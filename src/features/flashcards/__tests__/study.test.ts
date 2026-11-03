import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { learntUuid, perUserUuid, studyRecordUuid } from '@/core/sync/uuid5';

import { FlashcardsRepo } from '../repo';
import { StudyRepo } from '../study';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const clock = () => '2026-11-03T10:00:00Z';
  const flashcards = new FlashcardsRepo(db, clock, id);
  const study = new StudyRepo(
    db,
    7,
    clock,
    id,
    () => '2026-11-03',
    () => '2026-11-03 10:00:00',
  );
  const deck = flashcards.createDeck({ name: 'Maths' })!;
  const card = flashcards.addCard(deck, 'Q', 'A')!;
  const kid = flashcards.addSubcard(card, 'q', 'a')!;
  // le modifiche "già inviate": i test guardano solo quello che viene dopo
  db.run('DELETE FROM outbox');
  return { db, flashcards, study, deck, card, kid };
}
const out = (db: ReturnType<typeof memoryDb>) => nextBatch(db, 100);

describe('favourites', () => {
  test('toggle on and off, for a card and for a child card; sent as create then delete', () => {
    const { db, study, card, kid } = setup();
    expect(study.setFavorite(card, false, true)).toBe(true);
    expect(study.setFavorite(kid, true, true)).toBe(true);
    expect(study.isFavorite(card)).toBe(true);
    expect([...study.favorites()].sort()).toEqual([card, kid].sort());
    const sent = out(db);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      table: 'fc_study_favorites',
      patch: { card_uuid: card, child_uuid: null, favorited_date: '2026-11-03' },
    });
    expect(sent[1]!.patch).toMatchObject({ card_uuid: null, child_uuid: kid });
    expect(study.setFavorite(card, false, true)).toBe(true); // già preferita: niente di nuovo
    expect(out(db)).toHaveLength(0);
    study.setFavorite(card, false, false);
    expect(study.isFavorite(card)).toBe(false);
    expect(study.setFavorite('nope', false, true)).toBe(false);
  });
});

describe('learnt', () => {
  test('the uuid is the one the server computes, and a second "learnt" keeps the first date', () => {
    const { db, study, card, kid } = setup();
    study.setLearnt(card, false, true);
    study.setLearnt(kid, true, true);
    expect(study.isLearnt(card)).toBe(true);
    expect(study.learnt().has(kid)).toBe(true);
    const sent = out(db);
    expect(sent.map((s) => s.uuid).sort()).toEqual(
      [learntUuid(7, card, false), learntUuid(7, kid, true)].sort(),
    );
    expect(sent.find((s) => s.uuid === learntUuid(7, kid, true))!.patch).toEqual({
      target_uuid: kid,
      is_child: true,
      learnt_date: '2026-11-03',
    });
    study.setLearnt(card, false, true);
    expect(out(db)).toHaveLength(0);
    study.setLearnt(card, false, false);
    expect(study.isLearnt(card)).toBe(false);
    expect(out(db)).toHaveLength(1);
  });
});

describe('examples', () => {
  test('add, edit, remove; empty text is refused', () => {
    const { db, study, card } = setup();
    expect(study.addExample(card, false, '   ')).toBeNull();
    const ex = study.addExample(card, false, ' First ')!;
    expect(study.examples(card)).toMatchObject([
      { uuid: ex, example_text: 'First', card_uuid: card },
    ]);
    expect(study.updateExample(ex, '')).toBe(false);
    expect(study.updateExample(ex, 'Second')).toBe(true);
    expect(study.examples(card)[0]!.example_text).toBe('Second');
    // creata e poi cambiata prima dell'invio: una sola modifica
    expect(out(db)).toHaveLength(1);
    study.removeExample(ex);
    expect(study.examples(card)).toHaveLength(0);
  });
});

describe('goal and settings', () => {
  test('goal defaults to 20, accepts 1..1000 whole numbers, uses the per-user uuid', () => {
    const { db, study } = setup();
    expect(study.goal()).toBe(20);
    expect(study.setGoal(0)).toBe(false);
    expect(study.setGoal(1001)).toBe(false);
    expect(study.setGoal(2.5)).toBe(false);
    expect(study.setGoal(35)).toBe(true);
    expect(study.goal()).toBe(35);
    const sent = out(db);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ uuid: perUserUuid('fc_goals', 7), patch: { daily_goal: 35 } });
    expect(study.setGoal(35)).toBe(true);
    expect(out(db)).toHaveLength(0);
  });

  test('settings: defaults, validation, first save sends everything, later saves only the change', () => {
    const { db, study } = setup();
    expect(study.settings()).toEqual({
      vocab_meaning: 'aperto',
      vocab_examples: 'aperto',
      voice_read: null,
    });
    expect(study.saveSettings({ vocab_meaning: 'boh' as never })).toBe(false);
    expect(study.saveSettings({ voice_read: '9999' })).toBe(false);
    expect(study.saveSettings({ vocab_meaning: 'tocco' })).toBe(true);
    expect(out(db)[0]!.patch).toEqual({
      vocab_meaning: 'tocco',
      vocab_examples: 'aperto',
      voice_read: null,
    });
    expect(study.saveSettings({ voice_read: '1101' })).toBe(true);
    expect(study.settings()).toEqual({
      vocab_meaning: 'tocco',
      vocab_examples: 'aperto',
      voice_read: '1101',
    });
    expect(out(db)[0]!.patch).toEqual({ voice_read: '1101' });
  });
});

describe('records', () => {
  test('only a better value is written; lower wins when asked', () => {
    const { db, study } = setup();
    expect(study.bumpRecord('combo', 5, null)).toEqual({
      before: null,
      changed: false,
      first: true,
    });
    expect(study.bumpRecord('combo', 4, null)).toEqual({ before: 5, changed: false, first: false });
    expect(study.bumpRecord('combo', 9.456, 'g1')).toEqual({
      before: 5,
      changed: true,
      first: false,
    });
    expect(study.records()).toEqual({ combo: 9.46 });
    expect(study.bumpRecord('veloce', 12, null, true).first).toBe(true);
    expect(study.bumpRecord('veloce', 8, null, true).changed).toBe(true);
    expect(study.bumpRecord('veloce', 9, null, true).changed).toBe(false);
    const sent = out(db);
    const combo = sent.find((s) => s.uuid === studyRecordUuid(7, 'combo'))!;
    // creato e poi cambiato prima dell'invio: una riga sola, con il tipo e l'ultimo valore
    expect(combo.patch).toMatchObject({ kind: 'combo', value: 9.46, game_uuid: 'g1' });
  });
});

describe('deleting cards also drops what hangs on them', () => {
  test('removing a card removes its favourites, learnt, examples and the children ones', () => {
    const { db, flashcards, study, card, kid } = setup();
    study.setFavorite(card, false, true);
    study.setLearnt(kid, true, true);
    const ex = study.addExample(kid, true, 'x')!;
    expect(ex).toBeTruthy();
    flashcards.removeCard(card);
    expect(study.favorites().size).toBe(0);
    expect(study.learnt().size).toBe(0);
    expect(study.examples(kid)).toHaveLength(0);
    // le modifiche in attesa di righe che non esistono più sono state buttate: resta la sola cancellazione della carta
    const sent = out(db);
    expect(sent.map((s) => s.table)).toEqual(['fc_study_cards']);
  });

  test('removing a deck with force does the same, and the game keeps living without the deck', () => {
    const { db, flashcards, study, deck, card } = setup();
    study.setLearnt(card, false, true);
    db.run('INSERT INTO fc_games (uuid, type) VALUES (?, ?)', ['g1', 'fc']);
    db.run('INSERT INTO fc_study_game_decks (uuid, game_uuid, deck_uuid) VALUES (?, ?, ?)', [
      'gd1',
      'g1',
      deck,
    ]);
    expect(flashcards.removeDeck(deck, true)).toBe(true);
    expect(study.learnt().size).toBe(0);
    expect(db.all('SELECT 1 FROM fc_study_game_decks')).toHaveLength(0);
    expect(db.all('SELECT 1 FROM fc_games')).toHaveLength(1);
  });
});
