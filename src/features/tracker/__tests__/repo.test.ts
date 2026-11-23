import { memoryDb } from '@/core/db/__tests__/testDb';

import { MAX_BLOCKS } from '../blocks';
import { TrackerRepo } from '../repo';

const setup = () => {
  const db = memoryDb();
  let n = 0;
  const repo = new TrackerRepo(
    db,
    () => '2026-11-23T10:00:00.000Z',
    () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}`,
  );
  return { db, repo };
};
const P = '11111111-1111-7111-8111-111111111111';
const outbox = (db: ReturnType<typeof memoryDb>) =>
  db.all<{ tbl: string; op: string }>('SELECT tbl, op FROM outbox ORDER BY seq');

describe('TrackerRepo', () => {
  it('un tracker nuovo è vuoto', () => {
    expect(setup().repo.blocks(P)).toEqual([]);
  });

  it('aggiunge in fondo, con i valori di partenza, e mette la modifica in coda', () => {
    const { db, repo } = setup();
    const a = repo.add(P, 'counter', 'Giorni')!;
    const b = repo.add(P, 'note', 'Appunti')!;
    expect(repo.blocks(P).map((x) => x.uuid)).toEqual([a, b]);
    expect(repo.blocks(P)[0]).toMatchObject({
      kind: 'counter',
      title: 'Giorni',
      data: { value: 0 },
    });
    expect(outbox(db)).toEqual([
      { tbl: 'tracker_blocks', op: 'upsert' },
      { tbl: 'tracker_blocks', op: 'upsert' },
    ]);
  });

  it('cambia solo quello che si manda e rifiuta un blocco troppo grande', () => {
    const { repo } = setup();
    const a = repo.add(P, 'counter', 'x')!;
    expect(repo.update(a, { data: { value: 7 } })).toBe(true);
    expect(repo.blocks(P)[0]).toMatchObject({ title: 'x', data: { value: 7 } });
    expect(repo.update(a, { data: { text: 'a'.repeat(1_000_000) } })).toBe(false);
    expect(repo.update('non-esiste', { title: 'y' })).toBe(false);
  });

  it('al massimo 20 blocchi, e un solo collegamento', () => {
    const { repo } = setup();
    for (let i = 0; i < MAX_BLOCKS; i++) expect(repo.add(P, 'note', `n${i}`)).not.toBeNull();
    expect(repo.add(P, 'note', 'uno di troppo')).toBeNull();
    const Q = '22222222-2222-7222-8222-222222222222';
    expect(repo.add(Q, 'connection', 'sito')).not.toBeNull();
    expect(repo.add(Q, 'connection', 'altro')).toBeNull();
  });

  it('sposta su e giù', () => {
    const { repo } = setup();
    const a = repo.add(P, 'note', 'a')!;
    const b = repo.add(P, 'note', 'b')!;
    const c = repo.add(P, 'note', 'c')!;
    repo.move(c, -1);
    expect(repo.blocks(P).map((x) => x.uuid)).toEqual([a, c, b]);
    repo.move(a, -1);
    expect(repo.blocks(P).map((x) => x.uuid)).toEqual([a, c, b]);
    repo.move(a, 1);
    expect(repo.blocks(P).map((x) => x.uuid)).toEqual([c, a, b]);
  });

  it('toglie un blocco e lo comunica; uno mai inviato sparisce dalla coda', () => {
    const { db, repo } = setup();
    const a = repo.add(P, 'note', 'a')!;
    repo.remove(a);
    expect(repo.blocks(P)).toEqual([]);
    expect(outbox(db)).toEqual([]);
  });
});
