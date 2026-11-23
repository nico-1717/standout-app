import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';

import { MAX_BLOCKS, emptyBlock, parseJson, type Block, type BlockKind } from './blocks';

interface Row {
  uuid: string;
  project_uuid: string;
  kind: string;
  title: string;
  config: string;
  data: string;
  sort_key: string | null;
}

/** Quanto può pesare il testo JSON di un blocco (il server rifiuta oltre 1 MB). */
const MAX_BYTES = 900_000;

/**
 * I blocchi del Tracker di un progetto, sul telefono. Una riga per blocco, che si sincronizza da sola;
 * vince l'ultima modifica di ogni blocco. Un tracker non ha una riga sua: è l'insieme dei blocchi del progetto.
 */
export class TrackerRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clockIso: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  blocks(project: string): Block[] {
    return this.db
      .all<Row>(
        'SELECT uuid, project_uuid, kind, title, config, data, sort_key FROM tracker_blocks WHERE project_uuid = ? ORDER BY sort_key, created_at, uuid',
        [project],
      )
      .map((r) => ({
        uuid: r.uuid,
        project: r.project_uuid,
        kind: r.kind as BlockKind,
        title: r.title,
        config: parseJson(r.config),
        data: parseJson(r.data),
        sortKey: r.sort_key,
      }));
  }

  count(project: string): number {
    return Number(
      this.db.all<{ n: number }>(
        'SELECT COUNT(*) AS n FROM tracker_blocks WHERE project_uuid = ?',
        [project],
      )[0]?.n ?? 0,
    );
  }

  /** Aggiunge un blocco in fondo. Ritorna il suo uuid, o null se il tracker è pieno (o ha già il collegamento). */
  add(
    project: string,
    kind: BlockKind,
    title: string,
    start?: { config?: object; data?: object },
  ): string | null {
    if (this.count(project) >= MAX_BLOCKS) return null;
    if (
      kind === 'connection' &&
      this.db.all("SELECT 1 FROM tracker_blocks WHERE project_uuid = ? AND kind = 'connection'", [
        project,
      ]).length
    )
      return null;
    const base = emptyBlock(kind);
    const config = JSON.stringify(start?.config ?? base.config);
    const data = JSON.stringify(start?.data ?? base.data);
    if (config.length > MAX_BYTES || data.length > MAX_BYTES) return null;
    const uuid = this.newId();
    const now = this.clockIso();
    const name = title.trim().slice(0, 120);
    this.db.transaction(() => {
      const last = this.db.all<{ sort_key: string | null }>(
        'SELECT sort_key FROM tracker_blocks WHERE project_uuid = ? AND sort_key IS NOT NULL ORDER BY sort_key DESC LIMIT 1',
        [project],
      )[0]?.sort_key;
      const sortKey = generateKeyBetween(last ?? null, null);
      upsertRow(this.db, 'tracker_blocks', {
        uuid,
        project_uuid: project,
        kind,
        title: name,
        config,
        data,
        sort_key: sortKey,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'tracker_blocks',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { project_uuid: project, kind, title: name, config, data, sort_key: sortKey },
        },
        now,
      );
    });
    return uuid;
  }

  /** Cambia titolo, config e/o data di un blocco (si manda solo quello che è cambiato). Ritorna se è stato salvato. */
  update(uuid: string, change: { title?: string; config?: object; data?: object }): boolean {
    const patch: Record<string, string> = {};
    if (change.title !== undefined) patch.title = change.title.trim().slice(0, 120);
    if (change.config !== undefined) patch.config = JSON.stringify(change.config);
    if (change.data !== undefined) patch.data = JSON.stringify(change.data);
    if ((patch.config?.length ?? 0) > MAX_BYTES || (patch.data?.length ?? 0) > MAX_BYTES)
      return false;
    if (!Object.keys(patch).length) return true;
    let ok = false;
    this.db.transaction(() => {
      ok = patchRow(this.db, 'tracker_blocks', uuid, patch);
      if (ok)
        enqueue(this.db, { table: 'tracker_blocks', uuid, op: 'upsert', patch }, this.clockIso());
    });
    return ok;
  }

  remove(uuid: string): void {
    this.db.transaction(() => {
      deleteRow(this.db, 'tracker_blocks', uuid);
      enqueue(this.db, { table: 'tracker_blocks', uuid, op: 'delete' }, this.clockIso());
    });
  }

  /** Sposta un blocco su o giù di un posto. */
  move(uuid: string, dir: -1 | 1): void {
    const row = this.db.all<{ project_uuid: string }>(
      'SELECT project_uuid FROM tracker_blocks WHERE uuid = ?',
      [uuid],
    )[0];
    if (!row) return;
    const list = this.blocks(row.project_uuid);
    const i = list.findIndex((b) => b.uuid === uuid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    // si rinumera tutto il tracker (massimo 20 blocchi) così nessuno ha mai un sort_key vuoto o uguale
    const order = list.map((b) => b.uuid);
    [order[i], order[j]] = [order[j] as string, order[i] as string];
    let prev: string | null = null;
    const now = this.clockIso();
    this.db.transaction(() => {
      for (const id of order) {
        const key = generateKeyBetween(prev, null);
        prev = key;
        const cur = list.find((b) => b.uuid === id);
        if (cur?.sortKey === key) continue;
        patchRow(this.db, 'tracker_blocks', id, { sort_key: key });
        enqueue(
          this.db,
          { table: 'tracker_blocks', uuid: id, op: 'upsert', patch: { sort_key: key } },
          now,
        );
      }
    });
  }
}
