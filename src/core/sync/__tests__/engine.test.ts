import { memoryDb } from '@/core/db/__tests__/testDb';
import { TasksRepo } from '@/features/tasks/repo';

import { SyncEngine, getState } from '../engine';
import { pendingCount } from '../outbox';
import { FakeServer } from './fakeServer';

function phone(server: FakeServer) {
  const db = memoryDb();
  let t = 0;
  const clock = () => `2026-11-01T10:00:${String(t++).padStart(2, '0')}Z`;
  const engine = new SyncEngine(db, server, clock);
  const repo = new TasksRepo(db, clock);
  return { db, engine, repo };
}
const titles = (repo: TasksRepo) => repo.list().map((t) => t.title);

describe('motore di sincronizzazione', () => {
  it('crea sul telefono, invia, e un secondo telefono lo riceve', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const b = phone(server);
    a.repo.create({ title: 'Comprare il pane' });
    expect(titles(a.repo)).toEqual(['Comprare il pane']); // subito, senza rete
    expect(pendingCount(a.db)).toBe(1);
    const rep = await a.engine.syncOnce();
    expect(rep.applied).toBe(1);
    expect(pendingCount(a.db)).toBe(0);
    await b.engine.syncOnce();
    expect(titles(b.repo)).toEqual(['Comprare il pane']);
  });

  it('senza rete tutto funziona; quando torna la rete parte in ordine', async () => {
    const server = new FakeServer();
    const a = phone(server);
    server.down = true;
    const x = a.repo.create({ title: 'uno' });
    a.repo.create({ title: 'due' });
    a.repo.update(x, { is_done: true });
    await expect(a.engine.syncOnce()).rejects.toThrow('rete assente');
    expect(titles(a.repo)).toEqual(['due', 'uno']); // le spuntate vanno in fondo
    expect(pendingCount(a.db)).toBe(2); // «uno» creata e spuntata = una sola modifica accorpata
    server.down = false;
    await a.engine.syncOnce();
    expect(pendingCount(a.db)).toBe(0);
    expect(server.rows.size).toBe(2);
  });

  it('accorpa le modifiche alla stessa riga e fa sparire creata+cancellata', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const u = a.repo.create({ title: 'bozza' });
    a.repo.update(u, { title: 'bozza 2' });
    a.repo.update(u, { due_date: '2099-01-01' });
    expect(pendingCount(a.db)).toBe(1);
    a.repo.remove(u);
    expect(pendingCount(a.db)).toBe(0); // il server non ne ha mai saputo niente
    await a.engine.syncOnce();
    expect(server.pushCalls).toBe(0);
  });

  it('modifica poi cancella una riga già sul server: parte solo la cancellazione', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const u = a.repo.create({ title: 'x' });
    await a.engine.syncOnce();
    a.repo.update(u, { title: 'y' });
    a.repo.remove(u);
    expect(a.db.all<{ op: string }>('SELECT op FROM outbox').map((r) => r.op)).toEqual(['delete']);
    await a.engine.syncOnce();
    expect(server.rows.size).toBe(0);
  });

  it('la stessa modifica rimandata non si applica due volte (mutation_id)', async () => {
    const server = new FakeServer();
    const a = phone(server);
    a.repo.create({ title: 'una sola volta' });
    // simula «la risposta si è persa»: la modifica resta «in volo» e il telefono la rimanda
    const orig = server.push.bind(server);
    let first = true;
    server.push = async (m) => {
      const r = await orig(m);
      if (first) {
        first = false;
        throw new Error('risposta persa');
      }
      return r;
    };
    await expect(a.engine.syncOnce()).rejects.toThrow('risposta persa');
    await a.engine.syncOnce();
    expect([...server.rows.values()].filter((r) => r.title === 'una sola volta')).toHaveLength(1);
    expect(pendingCount(a.db)).toBe(0);
  });

  it('un errore del server non perde la modifica: si riprova', async () => {
    const server = new FakeServer();
    const a = phone(server);
    a.repo.create({ title: 'a' });
    const id = a.db.all<{ mutation_id: string }>('SELECT mutation_id FROM outbox')[0].mutation_id;
    server.errorOnce.add(id);
    const r1 = await a.engine.syncOnce();
    expect(r1.retry).toBe(1);
    expect(pendingCount(a.db)).toBe(1);
    await a.engine.syncOnce();
    expect(pendingCount(a.db)).toBe(0);
  });

  it("una modifica rifiutata: la riga torna com'è sul server e resta nei problemi", async () => {
    const server = new FakeServer();
    const a = phone(server);
    const u = a.repo.create({ title: 'ok' });
    await a.engine.syncOnce();
    // un campo che il server non accetta (come se l'app fosse più nuova del server)
    a.db.run(
      `INSERT INTO outbox (mutation_id, tbl, uuid, op, patch, created_at) VALUES ('m-bad','todos',?, 'upsert', ?, 'x')`,
      [u, JSON.stringify({ colore_strano: 1, title: 'rotta' })],
    );
    a.db.run(`UPDATE todos SET title = 'rotta' WHERE uuid = ?`, [u]);
    const rep = await a.engine.syncOnce();
    expect(rep.rejected).toBe(1);
    expect(a.repo.get(u)?.title).toBe('ok');
    const pr = a.db.all<{ code: string; field: string }>('SELECT code, field FROM sync_problems');
    expect(pr).toEqual([{ code: 'validation', field: 'colore_strano' }]);
  });

  it('una creazione rifiutata toglie la riga dal telefono', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const u = a.repo.create({ title: 'x' });
    a.db.run(`UPDATE outbox SET patch = '{}'`); // il server vuole il titolo
    await a.engine.syncOnce();
    expect(a.repo.get(u)).toBeNull();
    expect(a.db.all('SELECT * FROM sync_problems')).toHaveLength(1);
  });

  it('una modifica del sito arriva; la mia modifica non ancora inviata resta sopra', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const u = a.repo.create({ title: 'originale' });
    await a.engine.syncOnce();
    server.external('todos', u, { title: 'dal sito', due_date: '2099-05-05' });
    a.repo.update(u, { title: 'dal telefono' }); // non ancora inviata
    server.down = true;
    await expect(a.engine.syncOnce()).rejects.toThrow();
    server.down = false;
    // il pull porta anche la data del sito; il titolo del telefono (in coda) resta
    const real = server.push.bind(server);
    server.push = async () => ({ results: [], head: 0 }); // niente invio: si guarda solo il ricevere
    await a.engine.syncOnce().catch(() => undefined);
    server.push = real;
    expect(a.repo.get(u)?.title).toBe('dal telefono');
    expect(a.repo.get(u)?.due_date).toBe('2099-05-05');
  });

  it('cancellata altrove mentre la modifico: vince la cancellazione, la modifica va nei problemi', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const u = a.repo.create({ title: 'x' });
    await a.engine.syncOnce();
    server.external('todos', u, null);
    a.repo.update(u, { title: 'mia modifica' });
    const real = server.push.bind(server);
    server.push = async () => ({ results: [], head: 0 });
    await a.engine.syncOnce().catch(() => undefined);
    server.push = real;
    expect(a.repo.get(u)).toBeNull();
    const pr = a.db.all<{ code: string; patch: string }>('SELECT code, patch FROM sync_problems');
    expect(pr[0].code).toBe('deleted_remotely');
    expect(JSON.parse(pr[0].patch).title).toBe('mia modifica');
  });

  it('copia completa a pagine; toglie le righe che il server non ha più, ma non quelle nuove non inviate', async () => {
    const server = new FakeServer();
    for (let i = 0; i < 1203; i++)
      server.external('todos', `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, {
        title: `t${i}`,
        list_type: 'todo',
        sort_key: 'a0',
        is_done: false,
      });
    const a = phone(server);
    const mia = a.repo.create({ title: 'solo mia' }); // non inviata
    server.down = false;
    // una riga che il server non ha più
    a.db.run(
      `INSERT INTO todos (uuid, title, sort_key) VALUES ('11111111-1111-4111-8111-111111111111','fantasma','a0')`,
    );
    // il push non ha novità da dire: si guarda la copia
    await a.engine.syncOnce();
    const n = a.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM todos')[0].n;
    expect(n).toBe(1203 + 1); // 1203 del server + «solo mia» (ora inviata)
    expect(a.repo.get('11111111-1111-4111-8111-111111111111')).toBeNull();
    expect(a.repo.get(mia)).not.toBeNull();
    expect(getState(a.db, 'cursor')).toBe(String(server.seq));
  });

  it('resync_required: si riparte dalla copia completa senza perdere le modifiche in coda', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const u = a.repo.create({ title: 'prima' });
    await a.engine.syncOnce();
    server.floor = 999; // il server ha potato oltre il cursore del telefono
    const v = a.repo.create({ title: 'dopo, ancora in coda' });
    server.down = false;
    const real = server.push.bind(server);
    server.push = async () => ({ results: [], head: 0 }); // la modifica resta in coda
    await a.engine.syncOnce().catch(() => undefined);
    server.push = real;
    expect(a.repo.get(u)).not.toBeNull();
    expect(a.repo.get(v)).not.toBeNull();
    await a.engine.syncOnce();
    expect(pendingCount(a.db)).toBe(0);
  });

  it('sposta una riga cambiando una sola riga', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const x = a.repo.create({ title: 'x' });
    const y = a.repo.create({ title: 'y' });
    const z = a.repo.create({ title: 'z' });
    await a.engine.syncOnce();
    a.repo.move(z, null, x); // z in cima
    expect(titles(a.repo)).toEqual(['z', 'x', 'y']);
    expect(pendingCount(a.db)).toBe(1);
    void y;
  });

  it('spuntare la madre spunta le sotto-attività; cancellarla le toglie', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const m = a.repo.create({ title: 'madre' });
    const s = a.repo.create({ title: 'figlia' }, { parentUuid: m });
    a.repo.update(m, { is_done: true });
    expect(a.repo.get(s)?.is_done).toBe(1);
    a.repo.remove(m);
    expect(a.repo.get(s)).toBeNull();
  });
});
