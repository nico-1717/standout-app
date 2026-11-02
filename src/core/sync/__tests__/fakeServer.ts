import type {
  Mutation,
  PullChange,
  PullResponse,
  PushResult,
  SyncApi,
  WireRow,
  WireValue,
} from '../types';

/**
 * Un server finto in memoria con le STESSE regole che contano per il motore:
 * registro con seq, idempotenza per mutation_id, rifiuto dei campi sbagliati, copia completa e pagine.
 * Le prove contro il server vero stanno in engine.integration.test.ts.
 */
export class FakeServer implements SyncApi {
  rows = new Map<string, WireRow & { _t: string }>();
  log: { seq: number; table: string; uuid: string; op: 'upsert' | 'delete' }[] = [];
  seen = new Map<string, PushResult>();
  seq = 0;
  down = false;
  errorOnce = new Set<string>();
  pushCalls = 0;
  floor = 0;

  private key = (t: string, u: string) => `${t}|${u}`;

  /** Una scrittura «dal sito» o da un altro telefono. */
  external(table: string, uuid: string, patch: Record<string, WireValue> | null): void {
    const k = this.key(table, uuid);
    if (patch === null) {
      this.rows.delete(k);
      this.log.push({ seq: ++this.seq, table, uuid, op: 'delete' });
    } else {
      const old = this.rows.get(k) ?? ({ uuid, _t: table } as WireRow & { _t: string });
      this.rows.set(k, { ...old, ...patch, uuid, _t: table });
      this.log.push({ seq: ++this.seq, table, uuid, op: 'upsert' });
    }
  }

  async push(mutations: Mutation[]) {
    this.pushCalls++;
    if (this.down) throw new Error('rete assente');
    const results: PushResult[] = [];
    for (const m of mutations) {
      const old = this.seen.get(m.mutation_id);
      if (old) {
        results.push({ ...old, replayed: true });
        continue;
      }
      if (this.errorOnce.delete(m.mutation_id)) {
        results.push({ mutation_id: m.mutation_id, status: 'error', code: 'server_error' });
        continue;
      }
      const k = this.key(m.table, m.uuid);
      let r: PushResult;
      if (m.op === 'delete') {
        if (this.rows.has(k)) this.external(m.table, m.uuid, null);
        r = { mutation_id: m.mutation_id, status: 'applied' };
      } else if ('colore_strano' in m.patch) {
        const cur = this.rows.get(k);
        r = {
          mutation_id: m.mutation_id,
          status: 'rejected',
          code: 'validation',
          field: 'colore_strano',
          current: cur ? this.strip(cur) : null,
        };
      } else if (m.table === 'todos' && !this.rows.has(k) && !m.patch.title) {
        r = {
          mutation_id: m.mutation_id,
          status: 'rejected',
          code: 'validation',
          field: 'title',
          current: null,
        };
      } else {
        this.external(
          m.table,
          m.uuid,
          m.table === 'todos' ? { is_done: false, ...m.patch } : m.patch,
        );
        r = { mutation_id: m.mutation_id, status: 'applied' };
      }
      this.seen.set(m.mutation_id, r);
      results.push(r);
    }
    return { results, head: this.seq };
  }

  private strip(r: WireRow & { _t: string }): WireRow {
    const { _t, ...rest } = r;
    void _t;
    return rest as WireRow;
  }

  async pull(cursor: string, limit: number): Promise<PullResponse> {
    if (this.down) throw new Error('rete assente');
    if (cursor === 'snapshot' || cursor.startsWith('s:')) {
      const head = cursor === 'snapshot' ? this.seq : Number(cursor.split(':')[1]);
      const after = cursor === 'snapshot' ? 0 : Number(cursor.split(':')[2]);
      const all = [...this.rows.values()]
        .sort((a, b) => a.uuid.localeCompare(b.uuid))
        .filter((r, i) => i >= after);
      const page = all.slice(0, limit);
      const changes: PullChange[] = page.map((r) => ({
        table: r._t as never,
        op: 'upsert',
        uuid: r.uuid,
        row: this.strip(r),
      }));
      const more = all.length > limit;
      return {
        changes,
        cursor: more ? `s:${head}:${after + page.length}` : head,
        more,
        snapshot: true,
      };
    }
    const n = Number(cursor);
    if (n < this.floor)
      return { changes: [], cursor: 'snapshot', more: false, resync_required: true };
    const voci = this.log.filter((v) => v.seq > n);
    const page = voci.slice(0, limit);
    const last = new Map<string, (typeof page)[number]>();
    for (const v of page) last.set(this.key(v.table, v.uuid), v);
    const changes: PullChange[] = [];
    for (const v of last.values()) {
      const row = this.rows.get(this.key(v.table, v.uuid));
      if (v.op === 'delete') changes.push({ table: v.table as never, op: 'delete', uuid: v.uuid });
      else if (row)
        changes.push({ table: v.table as never, op: 'upsert', uuid: v.uuid, row: this.strip(row) });
    }
    return {
      changes,
      cursor: page.length ? page[page.length - 1].seq : n,
      more: voci.length > limit,
    };
  }
}
