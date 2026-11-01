import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '../db/sqldb';
import type { SyncTable } from './manifest';
import type { Mutation, WireValue } from './types';

interface OutboxRow {
  seq: number;
  mutation_id: string;
  tbl: SyncTable;
  uuid: string;
  op: 'upsert' | 'delete';
  is_create: number;
  patch: string;
  state: 'pending' | 'sending';
  attempts: number;
}

/**
 * Mette in coda una modifica. Si chiama DENTRO la stessa transazione che scrive la riga:
 * o succedono tutte e due le cose o nessuna.
 *
 * Accorpamento (le modifiche non ancora inviate sulla stessa riga diventano una):
 *  - più modifiche ai campi della stessa riga → una sola, con i valori più recenti;
 *  - riga creata e cancellata prima di essere inviata → sparisce tutto, il server non ne sa niente;
 *  - modifica poi cancellazione → resta solo la cancellazione.
 * Una modifica già «in volo» (state=sending) non si tocca: la risposta potrebbe arrivare da un momento all'altro.
 */
export function enqueue(
  db: SqlDb,
  m: {
    table: SyncTable;
    uuid: string;
    op: 'upsert' | 'delete';
    patch?: Record<string, WireValue>;
    isCreate?: boolean;
  },
  now: string,
): void {
  const pending = db.all<OutboxRow>(
    `SELECT * FROM outbox WHERE tbl = ? AND uuid = ? ORDER BY seq`,
    [m.table, m.uuid],
  );
  const inFlight = pending.some((p) => p.state === 'sending');
  const queued = pending.filter((p) => p.state === 'pending');

  if (m.op === 'delete') {
    const neverSent = queued.some((p) => p.is_create === 1) && !inFlight;
    for (const p of queued) db.run('DELETE FROM outbox WHERE seq = ?', [p.seq]);
    if (neverSent) return;
    insert(db, m.table, m.uuid, 'delete', {}, false, now);
    return;
  }

  const last = pending[pending.length - 1];
  if (last && last.state === 'pending' && last.op === 'upsert') {
    const merged = { ...(JSON.parse(last.patch) as Record<string, WireValue>), ...(m.patch ?? {}) };
    db.run('UPDATE outbox SET patch = ? WHERE seq = ?', [JSON.stringify(merged), last.seq]);
    return;
  }
  insert(db, m.table, m.uuid, 'upsert', m.patch ?? {}, !!m.isCreate, now);
}

function insert(
  db: SqlDb,
  table: SyncTable,
  uuid: string,
  op: 'upsert' | 'delete',
  patch: Record<string, WireValue>,
  isCreate: boolean,
  now: string,
): void {
  db.run(
    `INSERT INTO outbox (mutation_id, tbl, uuid, op, is_create, patch, state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [uuidv7(), table, uuid, op, isCreate ? 1 : 0, JSON.stringify(patch), now],
  );
}

/** Un'app chiusa nel mezzo di un invio: quello che era «in volo» torna da inviare (il server riconosce il mutation_id). */
export function resetSending(db: SqlDb): void {
  db.run(`UPDATE outbox SET state = 'pending' WHERE state = 'sending'`);
}

/** Le prossime modifiche da inviare, segnate come «in volo». */
export function nextBatch(db: SqlDb, limit: number): Mutation[] {
  return db.transaction(() => {
    const rows = db.all<OutboxRow>(
      `SELECT * FROM outbox WHERE state = 'pending' ORDER BY seq LIMIT ?`,
      [limit],
    );
    for (const r of rows) db.run(`UPDATE outbox SET state = 'sending' WHERE seq = ?`, [r.seq]);
    return rows.map((r) => ({
      mutation_id: r.mutation_id,
      table: r.tbl,
      op: r.op,
      uuid: r.uuid,
      patch: JSON.parse(r.patch) as Record<string, WireValue>,
    }));
  });
}

export function pendingCount(db: SqlDb): number {
  return Number(db.all<{ n: number }>('SELECT COUNT(*) AS n FROM outbox')[0]?.n ?? 0);
}

/** Le modifiche non ancora confermate di una riga, in ordine: servono a rimetterle sopra una riga appena arrivata dal server. */
export function pendingFor(
  db: SqlDb,
  table: SyncTable,
  uuid: string,
): { op: 'upsert' | 'delete'; patch: Record<string, WireValue> }[] {
  return db
    .all<OutboxRow>('SELECT * FROM outbox WHERE tbl = ? AND uuid = ? ORDER BY seq', [table, uuid])
    .map((r) => ({ op: r.op, patch: JSON.parse(r.patch) as Record<string, WireValue> }));
}
