import { memoryDb } from '@/core/db/__tests__/testDb';
import { SyncEngine } from '@/core/sync/engine';
import { FakeServer } from '@/core/sync/__tests__/fakeServer';
import { pendingCount } from '@/core/sync/outbox';
import { doseUuid } from '@/core/sync/uuid5';

import { PillsRepo } from '../repo';
import type { PlanInput } from '../logic';

const TODAY = '2026-11-05';
const NOW = `${TODAY} 10:30:00`;

function phone(server: FakeServer, today = TODAY, now = NOW) {
  const db = memoryDb();
  let t = 0;
  const clock = () => `2026-11-05T10:00:${String(t++).padStart(2, '0')}Z`;
  return {
    db,
    engine: new SyncEngine(db, server, clock),
    pills: new PillsRepo(
      db,
      () => today,
      () => now,
      clock,
    ),
  };
}

const plan = (o: Partial<PlanInput> = {}): PlanInput => ({
  name: 'Vitamina D',
  dose: '1 compressa',
  notes: '',
  color: '#3B82F6',
  freq_type: 'daily',
  weekdays: '1111111',
  month_days: '',
  interval_days: 1,
  times: '08:00,20:00',
  start_date: '2026-11-01',
  end_date: null,
  is_active: true,
  ...o,
});

describe('pastiglie: dati sul telefono', () => {
  it('crea una terapia e le prese di oggi, senza metterle in coda', () => {
    const { pills, db } = phone(new FakeServer());
    const id = pills.createPlan(plan());
    const day = pills.day(TODAY);
    expect(day.doses.map((d) => d.due_time)).toEqual(['08:00', '20:00']);
    expect(day.doses[0]).toMatchObject({ name: 'Vitamina D', plan_uuid: id, status: 'pending' });
    // in coda c'è solo la terapia: le prese nascono da una regola, non si inviano
    expect(pendingCount(db)).toBe(1);
  });

  it('rifiuta una terapia con un campo sbagliato, dicendo quale', () => {
    const { pills } = phone(new FakeServer());
    expect(() => pills.createPlan(plan({ name: '  ' }))).toThrow('invalid:name');
    expect(() => pills.createPlan(plan({ color: 'rosso' }))).toThrow('invalid:color');
  });

  it("segna una presa con l'ora vera, mai nel futuro", () => {
    const { pills } = phone(new FakeServer());
    pills.createPlan(plan());
    const [morning, evening] = pills.day(TODAY).doses;
    pills.setStatus(morning!.uuid, 'taken', `${TODAY} 08:15:00`);
    pills.setStatus(evening!.uuid, 'taken', `${TODAY} 23:00:00`);
    expect(pills.dose(morning!.uuid)).toMatchObject({
      status: 'taken',
      taken_at: `${TODAY} 08:15:00`,
    });
    // le 23:00 sono nel futuro (adesso sono le 10:30): si scrive adesso
    expect(pills.dose(evening!.uuid)!.taken_at).toBe(NOW);
    pills.setStatus(morning!.uuid, 'pending');
    expect(pills.dose(morning!.uuid)).toMatchObject({ status: 'pending', taken_at: null });
  });

  it('«prese tutte» tocca solo quelle non ancora segnate', () => {
    const { pills } = phone(new FakeServer());
    pills.createPlan(plan());
    const [a, b] = pills.day(TODAY).doses;
    pills.setStatus(a!.uuid, 'taken', `${TODAY} 08:20:00`);
    expect(pills.markAll([a!.uuid, b!.uuid], 'on_time')).toBe(1);
    expect(pills.dose(a!.uuid)!.taken_at).toBe(`${TODAY} 08:20:00`);
    // l'orario previsto delle 20:00 è nel futuro: si ferma ad adesso
    expect(pills.dose(b!.uuid)!.taken_at).toBe(NOW);
  });

  it('le prese rimaste in sospeso nei giorni scorsi tornano fra le arretrate (14 giorni)', () => {
    const { pills } = phone(new FakeServer());
    pills.createPlan(plan({ start_date: '2026-10-01' }));
    const late = pills.day(TODAY).late;
    // schedule_from = inizio, ma le prese si generano solo per gli ultimi 7 giorni: 7 giorni × 2
    expect(late).toHaveLength(14);
    expect(late[0]!.due_date).toBe('2026-11-04');
    expect(late[late.length - 1]!.due_date).toBe('2026-10-29');
  });

  it('il calendario: «ne ho prese 1» su un giorno passato salta le altre', () => {
    const { pills } = phone(new FakeServer());
    const id = pills.createPlan(plan());
    pills.day('2026-11-03');
    expect(pills.setDayCount(id, '2026-11-03', 1)).toEqual({ taken: 1, tot: 2 });
    const d = pills.day('2026-11-03').doses;
    expect(d.map((x) => x.status)).toEqual(['taken', 'skipped']);
    expect(() => pills.setDayCount(id, '2026-11-09', 1)).toThrow('future_day');
  });

  it('il calendario crea le prese di un giorno senza prese', () => {
    const { pills } = phone(new FakeServer());
    const id = pills.createPlan(plan({ start_date: '2026-11-04' }));
    // 2 novembre è prima dell'inizio: nessuna presa; ma «ne ho prese 2» è un fatto
    expect(pills.setDayCount(id, '2026-11-02', 2)).toEqual({ taken: 2, tot: 2 });
  });

  it('cambiare gli orari rifà le prese in sospeso da oggi e non tocca quelle segnate', () => {
    const { pills } = phone(new FakeServer());
    const id = pills.createPlan(plan());
    const [a] = pills.day(TODAY).doses;
    pills.updatePlan(id, plan({ times: '09:00' }));
    const times = pills.day(TODAY).doses.map((d) => `${d.due_time}`);
    expect(times).toEqual(['09:00']);
    expect(pills.plan(id)!.schedule_from).toBe(TODAY);
    expect(pills.dose(a!.uuid)).toBeNull();
  });

  it('se oggi una presa è già segnata, il ritmo nuovo parte da domani', () => {
    const { pills } = phone(new FakeServer());
    const id = pills.createPlan(plan());
    const [a] = pills.day(TODAY).doses;
    pills.setStatus(a!.uuid, 'taken');
    pills.updatePlan(id, plan({ times: '09:00' }));
    expect(pills.plan(id)!.schedule_from).toBe('2026-11-06');
    // la presa segnata resta, quella in sospeso delle 20:00 (del ritmo vecchio) resta anche lei: parte da domani
    expect(pills.dose(a!.uuid)!.status).toBe('taken');
    expect(pills.day(TODAY).doses.map((d) => d.due_time)).toEqual(['08:00', '20:00']);
  });

  it('correggere il nome non cambia le prese', () => {
    const { pills } = phone(new FakeServer());
    const id = pills.createPlan(plan());
    const before = pills.day(TODAY).doses.map((d) => d.uuid);
    pills.updatePlan(id, plan({ name: 'Vitamina D3' }));
    expect(pills.day(TODAY).doses.map((d) => d.uuid)).toEqual(before);
    expect(pills.plan(id)!.name).toBe('Vitamina D3');
  });

  it('elimina la terapia, le sue prese e le modifiche in coda', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const id = a.pills.createPlan(plan());
    await a.engine.syncOnce();
    const [d] = a.pills.day(TODAY).doses;
    a.pills.setStatus(d!.uuid, 'taken');
    expect(pendingCount(a.db)).toBe(1);
    a.pills.removePlan(id);
    expect(a.pills.dose(d!.uuid)).toBeNull();
    // resta solo la cancellazione della terapia
    expect(pendingCount(a.db)).toBe(1);
    await a.engine.syncOnce();
    expect(server.rows.has(`pill_plans|${id}`)).toBe(false);
    expect(a.db.all('SELECT 1 FROM pill_doses')).toHaveLength(0);
  });

  it('la storia di una terapia, giorno per giorno', () => {
    const { pills } = phone(new FakeServer());
    const id = pills.createPlan(plan());
    pills.day('2026-11-03');
    pills.setDayCount(id, '2026-11-03', 1);
    expect(pills.history(id, '2026-11-01', TODAY)).toEqual([
      // i giorni scorsi si sono generati da soli (le arretrate), 3 novembre l'ho sistemato io
      { date: '2026-11-01', taken: 0, skipped: 0, pending: 2 },
      { date: '2026-11-02', taken: 0, skipped: 0, pending: 2 },
      { date: '2026-11-03', taken: 1, skipped: 1, pending: 0 },
      { date: '2026-11-04', taken: 0, skipped: 0, pending: 2 },
      { date: TODAY, taken: 0, skipped: 0, pending: 2 },
    ]);
  });
});

describe('pastiglie: telefono ↔ server', () => {
  it("invia la presa con la chiave e l'uuid che il server si aspetta", async () => {
    const server = new FakeServer();
    const a = phone(server);
    const id = a.pills.createPlan(plan());
    const [d] = a.pills.day(TODAY).doses;
    expect(d!.uuid).toBe(doseUuid(id, TODAY, '08:00', 1));
    a.pills.setStatus(d!.uuid, 'taken', `${TODAY} 08:10:00`);
    await a.engine.syncOnce();
    expect(pendingCount(a.db)).toBe(0);
    expect(server.rows.get(`pill_doses|${d!.uuid}`)).toMatchObject({
      plan_uuid: id,
      due_date: TODAY,
      due_time: '08:00',
      seq: 1,
      status: 'taken',
      taken_at: `${TODAY} 08:10:00`,
    });
  });

  it('un secondo telefono riceve terapia e presa e crea le stesse prese senza duplicarle', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const b = phone(server);
    const id = a.pills.createPlan(plan());
    const [d] = a.pills.day(TODAY).doses;
    a.pills.setStatus(d!.uuid, 'taken', `${TODAY} 08:10:00`);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.pills.plan(id)).toMatchObject({ name: 'Vitamina D' });
    expect(b.pills.dose(d!.uuid)).toMatchObject({ status: 'taken', taken_at: `${TODAY} 08:10:00` });
    // b genera le prese di oggi: quella già arrivata non si duplica
    const day = b.pills.day(TODAY).doses;
    expect(day).toHaveLength(2);
    expect(day[0]!.status).toBe('taken');
  });

  it('due telefoni segnano la stessa presa offline: una riga sola', async () => {
    const server = new FakeServer();
    const a = phone(server);
    const b = phone(server);
    const id = a.pills.createPlan(plan());
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    const [da] = a.pills.day(TODAY).doses;
    const [db] = b.pills.day(TODAY).doses;
    expect(da!.uuid).toBe(db!.uuid);
    a.pills.setStatus(da!.uuid, 'taken', `${TODAY} 08:05:00`);
    b.pills.setStatus(db!.uuid, 'skipped');
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    const rows = [...server.rows.keys()].filter((k) => k.startsWith('pill_doses|'));
    expect(rows).toHaveLength(1);
    expect(id).toBeTruthy();
  });

  describe('le prese da chiedere nel planner (due)', () => {
    it('chiede solo le prese di oggi la cui ora è passata, e smette dopo la risposta', () => {
      const { pills } = phone(new FakeServer());
      pills.createPlan(plan({ start_date: TODAY }));
      const due = pills.due();
      expect(due.map((d) => `${d.due_date} ${d.due_time}`)).toEqual([`${TODAY} 08:00`]);
      pills.setStatus(due[0]!.uuid, 'skipped');
      expect(pills.due()).toEqual([]);
    });

    it('include i giorni scorsi, le più vecchie per prime', () => {
      const { pills } = phone(new FakeServer());
      pills.createPlan(plan({ start_date: '2026-11-03' }));
      expect(pills.due().map((d) => `${d.due_date} ${d.due_time}`)).toEqual([
        '2026-11-03 08:00',
        '2026-11-03 20:00',
        '2026-11-04 08:00',
        '2026-11-04 20:00',
        '2026-11-05 08:00',
      ]);
    });

    it('non ne chiede più di sei', () => {
      const { pills } = phone(new FakeServer());
      pills.createPlan(plan({ start_date: '2026-10-25', times: '06:00,08:00,09:00' }));
      expect(pills.due()).toHaveLength(6);
    });
  });
});
