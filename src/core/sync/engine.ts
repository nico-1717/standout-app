import type { SqlDb } from '../db/sqldb';
import { MANIFEST, TABLES, isSyncTable, type SyncTable } from './manifest';
import { nextBatch, pendingFor, resetSending } from './outbox';
import { deleteRow, patchRow, rowExists, upsertRow } from './rows';
import type { PullChange, PushResult, SyncApi, WireRow } from './types';

export const PUSH_MAX = 200;
export const PULL_PAGE = 500;
const CURSOR_KEY = 'cursor';
const START = 'snapshot';

export interface SyncReport {
  applied: number;
  rejected: number;
  retry: number;
  pulled: number;
  snapshotDone: boolean;
}

export function getState(db: SqlDb, key: string): string | null {
  return db.all<{ v: string }>('SELECT v FROM sync_state WHERE k = ?', [key])[0]?.v ?? null;
}
export function setState(db: SqlDb, key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO sync_state (k, v) VALUES (?, ?)', [key, value]);
}

/**
 * Il motore: prima INVIA le modifiche fatte sul telefono (in ordine, a blocchi), poi RICEVE quelle del
 * server (a pagine, dal cursore). Parla con il database solo tramite SqlDb e con il server solo tramite
 * SyncApi: per questo si prova in Node senza telefono.
 * Le chiamate non si sovrappongono: se ne parte una mentre un'altra gira, aspetta e ne fa una sola.
 */
export class SyncEngine {
  private running: Promise<SyncReport> | null = null;
  /** Le tabelle che il server conosce (null = non lo so: le provo tutte). */
  private supported: Set<string> | null = null;

  constructor(
    private readonly db: SqlDb,
    private readonly api: SyncApi,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {
    resetSending(db);
  }

  syncOnce(): Promise<SyncReport> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<SyncReport> {
    const report: SyncReport = {
      applied: 0,
      rejected: 0,
      retry: 0,
      pulled: 0,
      snapshotDone: false,
    };
    this.supported = null;
    if (this.api.tables) {
      try {
        this.supported = new Set(await this.api.tables());
      } catch {
        // senza saperlo si prova con tutte: se la rete manca fallirà anche l'invio, e si riprova dopo
      }
    }
    await this.pushAll(report);
    await this.pullAll(report);
    setState(this.db, 'last_sync_at', this.clock());
    return report;
  }

  /* ---------------- INVIO ---------------- */

  private async pushAll(report: SyncReport): Promise<void> {
    for (;;) {
      const batch = nextBatch(this.db, PUSH_MAX, this.supported);
      if (!batch.length) return;
      let results: PushResult[];
      try {
        ({ results } = await this.api.push(batch));
      } catch (e) {
        // rete assente o errore del server: tutto torna «da inviare», l'ordine non cambia
        this.db.run(
          `UPDATE outbox SET state = 'pending', attempts = attempts + 1, last_error = ? WHERE state = 'sending'`,
          [String((e as Error)?.message ?? e).slice(0, 200)],
        );
        throw e;
      }
      const byId = new Map(results.map((r) => [r.mutation_id, r]));
      let stop = false;
      for (const m of batch) {
        const r = byId.get(m.mutation_id);
        if (!r || r.status === 'error') {
          this.db.run(
            `UPDATE outbox SET state = 'pending', attempts = attempts + 1, last_error = ? WHERE mutation_id = ?`,
            [r?.code ?? 'no_result', m.mutation_id],
          );
          report.retry++;
          stop = true;
          continue;
        }
        this.db.transaction(() => this.handleResult(m.table, m.op, m.uuid, m.patch, r, report));
      }
      // se una modifica non è passata per un errore del server, le successive tornano in coda in ordine: si riprova al prossimo giro
      if (stop) {
        this.db.run(`UPDATE outbox SET state = 'pending' WHERE state = 'sending'`);
        return;
      }
    }
  }

  private handleResult(
    table: SyncTable,
    op: 'upsert' | 'delete',
    uuid: string,
    patch: Record<string, unknown>,
    r: PushResult,
    report: SyncReport,
  ): void {
    this.db.run('DELETE FROM outbox WHERE mutation_id = ?', [r.mutation_id]);
    if (r.status === 'applied') {
      report.applied++;
      return;
    }
    // rifiutata: si ricorda per l'utente, e il telefono torna com'è sul server
    report.rejected++;
    this.db.run(
      `INSERT INTO sync_problems (tbl, uuid, code, field, message, patch, op, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [
        table,
        uuid,
        r.code ?? 'rejected',
        r.field ?? null,
        r.message ?? null,
        JSON.stringify(patch),
        op,
        this.clock(),
      ],
    );
    if (r.current === undefined) return; // il server non ha detto com'è la riga: la lasciamo
    if (r.current === null) {
      this.cascade(table, uuid);
      deleteRow(this.db, table, uuid);
    } else {
      upsertRow(this.db, table, r.current);
      this.overlayPending(table, uuid);
    }
  }

  /* ---------------- RICEZIONE ---------------- */

  private async pullAll(report: SyncReport): Promise<void> {
    for (;;) {
      const cursor = getState(this.db, CURSOR_KEY) ?? START;
      const res = await this.api.pull(cursor, PULL_PAGE);
      if (res.resync_required) {
        // il registro del server è andato oltre il punto del telefono: si riparte da una copia completa
        setState(this.db, CURSOR_KEY, START);
        continue;
      }
      this.db.transaction(() => {
        if (cursor === START) this.db.run('DELETE FROM snapshot_seen');
        for (const c of res.changes) this.applyChange(c, !!res.snapshot);
        setState(this.db, CURSOR_KEY, String(res.cursor));
        if (res.snapshot && !res.more) this.finishSnapshot();
      });
      report.pulled += res.changes.length;
      if (res.snapshot && !res.more) report.snapshotDone = true;
      if (!res.more) return;
    }
  }

  private applyChange(c: PullChange, snapshot: boolean): void {
    if (!isSyncTable(c.table)) return; // una tabella che questa versione dell'app non conosce: la ignora (si aggiornerà l'app)
    if (c.op === 'delete') {
      this.applyDelete(c.table, c.uuid);
      return;
    }
    const pend = pendingFor(this.db, c.table, c.uuid);
    // l'utente l'ha cancellata qui e il server non lo sa ancora: la cancellazione vince, la riga non torna
    if (pend.some((p) => p.op === 'delete')) return;
    upsertRow(this.db, c.table, c.row);
    this.overlayPending(c.table, c.uuid);
    if (snapshot)
      this.db.run('INSERT OR IGNORE INTO snapshot_seen (tbl, uuid) VALUES (?, ?)', [
        c.table,
        c.uuid,
      ]);
  }

  /** Le modifiche del telefono non ancora confermate si rimettono SOPRA la riga arrivata: l'utente non vede la riga «tornare indietro». */
  private overlayPending(table: SyncTable, uuid: string): void {
    for (const p of pendingFor(this.db, table, uuid)) {
      if (p.op === 'upsert') patchRow(this.db, table, uuid, p.patch);
    }
  }

  private applyDelete(table: SyncTable, uuid: string): void {
    const pend = pendingFor(this.db, table, uuid).filter((p) => p.op === 'upsert');
    if (pend.length) {
      // la riga è stata cancellata altrove mentre qui veniva modificata: vince la cancellazione, ma la modifica non si perde in silenzio
      const merged = Object.assign({}, ...pend.map((p) => p.patch));
      this.db.run(
        `INSERT INTO sync_problems (tbl, uuid, code, field, message, patch, op, created_at) VALUES (?,?,?,?,?,?,?,?)`,
        [
          table,
          uuid,
          'deleted_remotely',
          null,
          null,
          JSON.stringify(merged),
          'upsert',
          this.clock(),
        ],
      );
      this.db.run(
        `DELETE FROM outbox WHERE tbl = ? AND uuid = ? AND op = 'upsert' AND state = 'pending'`,
        [table, uuid],
      );
    }
    this.cascade(table, uuid);
    deleteRow(this.db, table, uuid);
  }

  /** Il server cancella le righe figlie insieme al padre (es. i check-in di un'abitudine): il telefono le toglie anche lui. */
  private cascade(table: SyncTable, uuid: string): void {
    for (const ch of MANIFEST[table].children ?? []) {
      if (ch.setNull) {
        this.db.run(`UPDATE ${ch.table} SET ${ch.column} = NULL WHERE ${ch.column} = ?`, [uuid]);
        continue;
      }
      // un albero (i progetti): prima i nipoti, poi i figli
      if (MANIFEST[ch.table].children?.length) {
        for (const k of this.db.all<{ uuid: string }>(
          `SELECT uuid FROM ${ch.table} WHERE ${ch.column} = ?`,
          [uuid],
        )) {
          this.cascade(ch.table, k.uuid);
        }
      }
      this.db.run(`DELETE FROM ${ch.table} WHERE ${ch.column} = ?`, [uuid]);
    }
  }

  /** Fine della copia completa: via le righe che il server non ha più (ma non quelle create qui e non ancora inviate). */
  private finishSnapshot(): void {
    for (const t of TABLES) {
      this.db.run(
        `DELETE FROM ${t} WHERE uuid NOT IN (SELECT uuid FROM snapshot_seen WHERE tbl = ?)
           AND uuid NOT IN (SELECT uuid FROM outbox WHERE tbl = ? AND is_create = 1)`,
        [t, t],
      );
    }
    this.db.run('DELETE FROM snapshot_seen');
  }
}

export { MANIFEST, rowExists };
export type { WireRow };
