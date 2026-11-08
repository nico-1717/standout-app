import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';

import { BookRepo, cleanEmail, GUESTS_MAX } from '../book';
import { PlannerRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const book = new BookRepo(db, () => '2026-11-03T10:00:00Z', newId);
  const planner = new PlannerRepo(db, () => '2026-11-03T10:00:00Z', newId);
  const queue = () => nextBatch(db, 100).map((m) => `${m.table}:${m.op}`);
  return { db, book, planner, queue };
}

describe('contacts', () => {
  test('an address is cleaned, the name defaults to the part before @', () => {
    const { book, queue } = setup();
    const id = book.addContact('  Anna.Rossi@Example.COM ')!;
    expect(book.contacts()).toEqual([
      { uuid: id, name: 'anna.rossi', email: 'anna.rossi@example.com' },
    ]);
    expect(queue()).toEqual(['contacts:upsert']);
  });

  test('a bad or repeated address is refused', () => {
    const { book } = setup();
    expect(book.addContact('nope')).toBeNull();
    expect(cleanEmail('a@b')).toBeNull();
    expect(book.addContact('a@b.it', 'A')).not.toBeNull();
    expect(book.addContact('A@B.it')).toBeNull();
    expect(book.contacts()).toHaveLength(1);
  });

  test('a long name is cut to 80', () => {
    const { book } = setup();
    book.addContact('a@b.it', 'x'.repeat(120));
    expect(book.contacts()[0]!.name).toHaveLength(80);
  });

  test('rename, change address, and refuse an address of another contact', () => {
    const { book, db } = setup();
    const a = book.addContact('a@b.it', 'Anna')!;
    const b = book.addContact('b@b.it', 'Bob')!;
    db.run('DELETE FROM outbox');
    expect(book.updateContact(a, { name: 'Anna R' })).toBe(true);
    expect(book.updateContact(a, { email: 'B@b.it' })).toBe(false);
    expect(book.updateContact(a, { email: 'x' })).toBe(false);
    expect(book.updateContact(b, { email: 'new@b.it' })).toBe(true);
    expect(book.contacts().map((c) => c.email)).toEqual(['a@b.it', 'new@b.it']);
    expect(book.updateContact('missing', { name: 'x' })).toBe(false);
  });

  test('removing a contact keeps its guests, written by hand', () => {
    const { book, planner, db } = setup();
    const c = book.addContact('a@b.it', 'Anna')!;
    const ev = planner.create({ title: 'Lunch', date: '2026-11-10' });
    book.setGuests(ev, [{ email: 'a@b.it', contactUuid: c }]);
    expect(book.guests(ev)[0]!.contact_uuid).toBe(c);
    db.run('DELETE FROM outbox');
    book.removeContact(c);
    expect(book.contacts()).toEqual([]);
    expect(book.guests(ev).map((g) => [g.email, g.contact_uuid, g.name])).toEqual([
      ['a@b.it', null, 'Anna'],
    ]);
  });
});

describe('guests', () => {
  test('the name is copied from the contact book', () => {
    const { book, planner } = setup();
    const c = book.addContact('a@b.it', 'Anna')!;
    const ev = planner.create({ title: 'Lunch', date: '2026-11-10' });
    book.setGuests(ev, [{ email: 'A@b.it' }, { email: 'z@z.it', name: 'Zed' }]);
    const g = book.guests(ev);
    expect(g.map((x) => [x.email, x.name, x.contact_uuid])).toEqual([
      ['a@b.it', 'Anna', null],
      ['z@z.it', 'Zed', null],
    ]);
    void c;
  });

  test('setGuests adds, renames and removes; the queue only holds what changed', () => {
    const { book, planner, db } = setup();
    const ev = planner.create({ title: 'Lunch', date: '2026-11-10' });
    book.setGuests(ev, [{ email: 'a@b.it' }, { email: 'b@b.it' }]);
    db.run('DELETE FROM outbox');
    book.setGuests(ev, [{ email: 'a@b.it', name: 'Anna' }, { email: 'c@b.it' }]);
    expect(book.guests(ev).map((g) => g.email)).toEqual(['a@b.it', 'c@b.it']);
    expect(book.guests(ev)[0]!.name).toBe('Anna');
    expect(
      nextBatch(db, 100)
        .map((m) => `${m.table}:${m.op}`)
        .sort(),
    ).toEqual(['event_guests:delete', 'event_guests:upsert', 'event_guests:upsert']);
    db.run('DELETE FROM outbox');
    book.setGuests(ev, [{ email: 'a@b.it', name: 'Anna' }, { email: 'c@b.it' }]);
    expect(nextBatch(db, 100)).toEqual([]);
  });

  test('one per address, bad addresses skipped, at most 30', () => {
    const { book, planner } = setup();
    const ev = planner.create({ title: 'Party', date: '2026-11-10' });
    const list = Array.from({ length: 40 }, (_, i) => ({ email: `g${i}@b.it` }));
    book.setGuests(ev, [{ email: 'bad' }, { email: 'g0@b.it' }, ...list]);
    expect(book.guests(ev)).toHaveLength(GUESTS_MAX);
  });

  test('deleting an event takes its guests away without telling the server about them', () => {
    const { book, planner, db } = setup();
    const ev = planner.create({ title: 'Lunch', date: '2026-11-10' });
    book.setGuests(ev, [{ email: 'a@b.it' }]);
    const view = planner.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    planner.remove(view, 'one');
    expect(db.all('SELECT * FROM event_guests')).toEqual([]);
    expect(nextBatch(db, 100)).toEqual([]);
  });

  test('deleting a whole series takes its guests away', () => {
    const { book, planner, db } = setup();
    const ev = planner.create({ title: 'Weekly', date: '2026-11-10', repeat: 'weekly' });
    book.setGuests(ev, [{ email: 'a@b.it' }]);
    const view = planner.eventsInRange('2026-11-10', '2026-11-10')[0]!;
    planner.remove(view, 'series');
    expect(db.all('SELECT * FROM event_guests')).toEqual([]);
  });
});

describe('places', () => {
  test('add keeps order, lowercases the words, and needs a name', () => {
    const { book, queue } = setup();
    expect(book.addPlace({ label: '  ' })).toBeNull();
    const a = book.addPlace({
      label: 'Home',
      keywords: 'Casa, HOME, casa',
      address: 'Via Roma 1',
    })!;
    const b = book.addPlace({ label: 'Gym', keywords: 'palestra', lat: 45.1, lon: 9.2 })!;
    const all = book.places();
    expect(all.map((p) => p.uuid)).toEqual([a, b]);
    expect(all[0]!.keywords).toBe('casa, home');
    expect(all[1]!.place_lat).toBe(45.1);
    expect(queue()).toEqual(['planner_places:upsert', 'planner_places:upsert']);
  });

  test('coordinates go in pairs and stay in range', () => {
    const { book } = setup();
    const a = book.addPlace({ label: 'A', lat: 45 })!;
    expect(book.places()[0]!.place_lat).toBeNull();
    book.updatePlace(a, { lat: 95, lon: 1 });
    expect(book.places()[0]!.place_lat).toBeNull();
    book.updatePlace(a, { lat: 10, lon: 20 });
    expect(book.places()[0]).toMatchObject({ place_lat: 10, place_lon: 20 });
    book.updatePlace(a, { lat: null, lon: null });
    expect(book.places()[0]).toMatchObject({ place_lat: null, place_lon: null });
  });

  test('update refuses an empty name; remove deletes', () => {
    const { book } = setup();
    const a = book.addPlace({ label: 'A' })!;
    expect(book.updatePlace(a, { label: ' ' })).toBe(false);
    expect(book.updatePlace(a, { label: 'B', address: 'Somewhere' })).toBe(true);
    expect(book.places()[0]).toMatchObject({ label: 'B', address: 'Somewhere' });
    book.removePlace(a);
    expect(book.places()).toEqual([]);
  });

  test('a title that names a keyword suggests the place', () => {
    const { book } = setup();
    book.addPlace({ label: 'Gym', keywords: 'palestra, allenamento' });
    book.addPlace({ label: 'Home', keywords: 'casa' });
    expect(book.suggestPlace('Allenamento gambe')!.label).toBe('Gym');
    expect(book.suggestPlace('Pizza a casa')!.label).toBe('Home');
    expect(book.suggestPlace('Dentist')).toBeNull();
    expect(book.suggestPlace('')).toBeNull();
  });
});
