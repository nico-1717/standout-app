import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb, SqlValue } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, toColumn, upsertRow } from '@/core/sync/rows';
import type { WireRow, WireValue } from '@/core/sync/types';

export interface Task {
  uuid: string;
  list_type: 'todo' | 'buy';
  parent_uuid: string | null;
  title: string;
  is_done: number;
  /** quando è stata spuntata (lo scrive il server, o l'app al tocco): serve a far sparire le fatte il giorno dopo */
  done_at: string | null;
  due_date: string | null;
  due_time: string | null;
  duration_minutes: number;
  sort_key: string;
  buy_category_uuid: string | null;
  /** il progetto a cui l'attività è collegata (solo i to do) */
  project_uuid: string | null;
  buy_priority: number;
  buy_price_cents: number | null;
  buy_url: string | null;
  /** il nome del file della foto (lo sceglie il server: sul telefono si cambia dalla coda dei file) */
  buy_image: string | null;
}

/** I campi che l'utente può scrivere da un'attività (gli altri li decide il server). */
export type TaskInput = Partial<
  Pick<
    Task,
    | 'title'
    | 'due_date'
    | 'due_time'
    | 'duration_minutes'
    | 'buy_category_uuid'
    | 'project_uuid'
    | 'buy_priority'
    | 'buy_price_cents'
    | 'buy_url'
  >
> & { is_done?: boolean };

/**
 * Le operazioni dell'utente sulle attività. Ognuna scrive la riga sul telefono E mette la modifica
 * in coda, nella stessa transazione: se l'app si chiude nel mezzo, o ci sono tutte e due o nessuna.
 * Le regole (titolo non vuoto, formati) le controlla il server con le funzioni di sempre: se rifiuta,
 * il motore rimette la riga com'era e lo segnala in «problemi di sincronizzazione».
 */
export class TasksRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  list(listType: 'todo' | 'buy' = 'todo'): Task[] {
    return this.db.all<Task>(
      `SELECT * FROM todos WHERE list_type = ? AND parent_uuid IS NULL ORDER BY is_done, sort_key`,
      [listType],
    );
  }

  /** Le attività (to do) collegate a un progetto, quelle da fare prima. */
  ofProject(projectUuid: string): Task[] {
    return this.db.all<Task>(
      `SELECT * FROM todos WHERE list_type = 'todo' AND parent_uuid IS NULL AND project_uuid = ? ORDER BY is_done, sort_key`,
      [projectUuid],
    );
  }

  subtasks(parentUuid: string): Task[] {
    return this.db.all<Task>(`SELECT * FROM todos WHERE parent_uuid = ? ORDER BY sort_key`, [
      parentUuid,
    ]);
  }

  get(uuid: string): Task | null {
    return this.db.all<Task>('SELECT * FROM todos WHERE uuid = ?', [uuid])[0] ?? null;
  }

  /** In coda alla sua lista. */
  create(
    input: TaskInput & { title: string },
    opts: { listType?: 'todo' | 'buy'; parentUuid?: string | null } = {},
  ): string {
    const uuid = this.newId();
    const listType = opts.listType ?? 'todo';
    return this.db.transaction(() => {
      const last = this.db.all<{ sort_key: string }>(
        `SELECT sort_key FROM todos WHERE list_type = ? ORDER BY sort_key DESC LIMIT 1`,
        [listType],
      )[0]?.sort_key;
      const sortKey = generateKeyBetween(last ?? null, null);
      const now = this.clock();
      const patch: Record<string, WireValue> = {
        list_type: listType,
        title: input.title,
        sort_key: sortKey,
        ...(opts.parentUuid ? { parent_uuid: opts.parentUuid } : {}),
        ...(Object.fromEntries(
          Object.entries(input).filter(([k, v]) => k !== 'title' && v !== undefined),
        ) as Record<string, WireValue>),
      };
      const row: WireRow = {
        uuid,
        list_type: listType,
        parent_uuid: opts.parentUuid ?? null,
        buy_category_uuid: null,
        project_uuid: null,
        buy_priority: 3,
        buy_price_cents: null,
        buy_url: null,
        buy_image: null,
        title: input.title,
        is_done: 0,
        done_at: null,
        due_date: null,
        due_time: null,
        duration_minutes: 30,
        sort_key: sortKey,
        created_at: now,
        updated_at: now,
        ...Object.fromEntries(Object.entries(input).filter(([k]) => k !== 'is_done')),
      } as WireRow;
      if (input.is_done !== undefined) row.is_done = input.is_done ? 1 : 0;
      upsertRow(this.db, 'todos', row);
      enqueue(this.db, { table: 'todos', uuid, op: 'upsert', patch, isCreate: true }, now);
      return uuid;
    });
  }

  update(uuid: string, patch: TaskInput & { sort_key?: string }): void {
    this.db.transaction(() => {
      const now = this.clock();
      const clean = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ) as Record<string, WireValue>;
      if (!Object.keys(clean).length) return;
      if (!patchRow(this.db, 'todos', uuid, clean)) return; // la riga non c'è (più): niente da fare
      if ('is_done' in clean) {
        const done = clean.is_done ? now : null;
        this.db.run('UPDATE todos SET done_at = ? WHERE uuid = ?', [done as SqlValue, uuid]);
        // come il sito: spuntare una attività spunta anche le sue sotto-attività
        for (const s of this.subtasks(uuid)) {
          patchRow(this.db, 'todos', s.uuid, { is_done: clean.is_done });
          this.db.run('UPDATE todos SET done_at = ? WHERE uuid = ?', [done as SqlValue, s.uuid]);
        }
      }
      enqueue(this.db, { table: 'todos', uuid, op: 'upsert', patch: clean }, now);
    });
  }

  /** Mette `uuid` fra `before` e `after` (uno dei due può mancare = in cima o in fondo). Cambia UNA riga. */
  move(uuid: string, before: string | null, after: string | null): void {
    const a = before ? (this.get(before)?.sort_key ?? null) : null;
    const b = after ? (this.get(after)?.sort_key ?? null) : null;
    this.update(uuid, { sort_key: generateKeyBetween(a, b) });
  }

  /** Toglie più voci in una volta sola (es. «Bought» svuota il carrello): tutto o niente. */
  removeMany(uuids: string[]): void {
    this.db.transaction(() => {
      for (const u of uuids) this.remove(u);
    });
  }

  remove(uuid: string): void {
    this.db.transaction(() => {
      const now = this.clock();
      // le sotto-attività le cancella il server insieme alla madre (e ci manderà le sue cancellazioni): qui basta toglierle dalla vista
      for (const s of this.subtasks(uuid)) deleteRow(this.db, 'todos', s.uuid);
      deleteRow(this.db, 'todos', uuid);
      enqueue(this.db, { table: 'todos', uuid, op: 'delete' }, now);
    });
  }
}

export { toColumn };
