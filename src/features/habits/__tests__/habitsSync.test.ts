import { memoryDb } from '@/core/db/__tests__/testDb';
import { SyncEngine } from '@/core/sync/engine';
import { FakeServer } from '@/core/sync/__tests__/fakeServer';
import { pendingCount } from '@/core/sync/outbox';
import { checkInUuid } from '@/core/sync/uuid5';

import { HabitCategoriesRepo, HabitsRepo } from '../repo';

function phone(server: FakeServer, today = '2026-11-05') {
  const db = memoryDb();
  let t = 0;
  const clock = () => `2026-11-05T10:00:${String(t++).padStart(2, '0')}Z`;
  return {
    db,
    engine: new SyncEngine(db, server, clock),
    habits: new HabitsRepo(db, clock, undefined, () => today),
    cats: new HabitCategoriesRepo(db, clock),
  };
}

describe('abitudini: telefono ↔ server', () => {
  it("crea, spunta offline, invia: il server riceve lo stato del giorno con l'uuid atteso", async () => {
    const server = new FakeServer();
    const a = phone(server);
    const h = a.habits.create({
      name: 'Acqua',
      goal_type: 'quantity',
      target_amount: 8,
      unit: 'bicchieri',
      start_date: '2026-11-01',
    });
    a.habits.checkIn(h, '2026-11-05', 'increment');
    a.habits.checkIn(h, '2026-11-05', 'increment');
    a.habits.checkIn(h, '2026-11-04', 'set', 8);
    expect(pendingCount(a.db)).toBe(3); // 1 abitudine + 2 giorni (le due spunte di oggi sono una sola modifica)
    expect(a.habits.log(h, '2026-11-05')).toMatchObject({
      amount: 2,
      status: 'partial',
      completions: 2,
    });
    await a.engine.syncOnce();
    expect(pendingCount(a.db)).toBe(0);
    const log = server.rows.get(`habit_logs|${checkInUuid(h, '2026-11-05')}`)!;
    expect(log).toMatchObject({
      habit_uuid: h,
      log_date: '2026-11-05',
      amount: 2,
      status: 'partial',
    });
    expect(server.rows.get(`habit_logs|${checkInUuid(h, '2026-11-04')}`)).toMatchObject({
      status: 'done',
    });
  });

  it('un secondo telefono riceve abitudine e check-in', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const b = phone(server);
    const h = a.habits.create({ name: 'Corsa', icon: '🏃', start_date: '2026-11-01' });
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.habits.list().map((x) => x.name)).toEqual(['Corsa']);
    expect(b.habits.log(h, '2026-11-05')?.status).toBe('done');
  });

  it('spunta e annulla prima di inviare: il server non sa niente', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const h = a.habits.create({ name: 'x', start_date: '2026-11-01' });
    await a.engine.syncOnce();
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    expect(pendingCount(a.db)).toBe(0);
    expect(a.habits.log(h, '2026-11-05')).toBeNull();
  });

  it('annullare un check-in già inviato = cancellazione', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const h = a.habits.create({ name: 'x', start_date: '2026-11-01' });
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    await a.engine.syncOnce();
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    await a.engine.syncOnce();
    expect(server.rows.has(`habit_logs|${checkInUuid(h, '2026-11-05')}`)).toBe(false);
  });

  it("il sito fa un check-in sullo stesso giorno: stessa riga (uuid UUIDv5), vince l'ultimo che scrive", async () => {
    const server = new FakeServer();
    const a = phone(server);
    const h = a.habits.create({
      name: 'x',
      goal_type: 'quantity',
      target_amount: 4,
      start_date: '2026-11-01',
    });
    await a.engine.syncOnce();
    const u = checkInUuid(h, '2026-11-05');
    server.external('habit_logs', u, {
      habit_uuid: h,
      log_date: '2026-11-05',
      status: 'partial',
      amount: 1,
      completions: 1,
      target_amount: 4,
      note: null,
      mood: null,
    });
    await a.engine.syncOnce();
    expect(a.habits.log(h, '2026-11-05')?.amount).toBe(1);
    a.habits.checkIn(h, '2026-11-05', 'set', 3);
    await a.engine.syncOnce();
    expect(server.rows.get(`habit_logs|${u}`)).toMatchObject({ amount: 3 });
    expect(a.db.all('SELECT 1 FROM habit_logs')).toHaveLength(1);
  });

  it("il sito cancella l'abitudine: sparisce anche dal telefono con i suoi check-in", async () => {
    const server = new FakeServer();
    const a = phone(server);
    const h = a.habits.create({ name: 'x', start_date: '2026-11-01' });
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    await a.engine.syncOnce();
    server.external('habits', h, null);
    await a.engine.syncOnce();
    expect(a.habits.list()).toHaveLength(0);
    expect(a.db.all('SELECT 1 FROM habit_logs')).toHaveLength(0);
  });

  it("cancellare l'abitudine sul telefono toglie anche i check-in", async () => {
    const server = new FakeServer();
    const a = phone(server);
    const h = a.habits.create({ name: 'x', start_date: '2026-11-01' });
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    await a.engine.syncOnce();
    a.habits.remove(h);
    expect(a.db.all('SELECT 1 FROM habit_logs')).toHaveLength(0);
    await a.engine.syncOnce();
    expect(server.rows.has(`habits|${h}`)).toBe(false);
  });

  it('giorno futuro: il telefono rifiuta subito', () => {
    const a = phone(new FakeServer());
    const h = a.habits.create({ name: 'x', start_date: '2026-11-01' });
    expect(() => a.habits.checkIn(h, '2026-11-06', 'toggle')).toThrow('future_day');
  });

  it('nota e umore: creano la riga del giorno; senza niente la tolgono', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const h = a.habits.create({ name: 'x', start_date: '2026-11-01' });
    a.habits.setNote(h, '2026-11-05', { note: 'bene', mood: 4 });
    expect(a.habits.log(h, '2026-11-05')).toMatchObject({ note: 'bene', mood: 4, amount: 0 });
    await a.engine.syncOnce();
    a.habits.setNote(h, '2026-11-05', { note: null, mood: null });
    expect(a.habits.log(h, '2026-11-05')).toBeNull();
  });

  it('una nota tiene in vita la riga anche se si annulla la spunta', () => {
    const a = phone(new FakeServer());
    const h = a.habits.create({ name: 'x', start_date: '2026-11-01' });
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    a.habits.setNote(h, '2026-11-05', { note: 'ok' });
    a.habits.checkIn(h, '2026-11-05', 'toggle');
    expect(a.habits.log(h, '2026-11-05')).toMatchObject({
      amount: 0,
      status: 'partial',
      note: 'ok',
    });
  });

  it('durata a giorni: la fine si ricava; archivia e riordina', () => {
    const a = phone(new FakeServer());
    const h1 = a.habits.create({
      name: '1',
      start_date: '2026-11-01',
      duration_type: 'days',
      duration_days: 10,
    });
    const h2 = a.habits.create({ name: '2', start_date: '2026-11-01' });
    expect(a.habits.get(h1)?.end_date).toBe('2026-11-10');
    a.habits.move(h2, null, h1);
    expect(a.habits.list().map((x) => x.name)).toEqual(['2', '1']);
    a.habits.archive(h1);
    expect(a.habits.list().map((x) => x.name)).toEqual(['2']);
    expect(a.habits.list({ archived: true }).map((x) => x.name)).toEqual(['1']);
    expect(
      a.db.all<{ archived_at: string | null }>('SELECT archived_at FROM habits WHERE uuid = ?', [
        h1,
      ])[0].archived_at,
    ).toBeTruthy();
  });

  it('categorie: le proprie si cambiano, quelle di sistema no; cancellare lascia le abitudini senza categoria', async () => {
    const server = new FakeServer();
    const a = phone(server);
    server.external('habit_categories', 'sys', {
      slug: 'salute',
      name: 'Salute',
      icon: '',
      color: '#0A84FF',
      sort_order: 5,
      is_system: true,
    });
    await a.engine.syncOnce();
    const c = a.cats.create('Mie');
    a.cats.update('sys', { name: 'hack' });
    expect(a.cats.list().map((x) => x.name)).toEqual(['Salute', 'Mie']);
    expect(a.cats.list()[0].is_system).toBe(1);
    const h = a.habits.create({ name: 'x', category_uuid: c, start_date: '2026-11-01' });
    await a.engine.syncOnce();
    a.cats.remove('sys');
    expect(a.cats.list()).toHaveLength(2);
    a.cats.remove(c);
    expect(a.habits.get(h)?.category_uuid).toBeNull();
  });
});
