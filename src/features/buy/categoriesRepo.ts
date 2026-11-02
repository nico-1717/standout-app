import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireRow, WireValue } from '@/core/sync/types';

import { DEFAULT_CATEGORY_COLOR, type BuyCategory } from './logic';

/**
 * Le categorie del «to buy». Come TasksRepo: la riga sul telefono e la modifica in coda
 * si scrivono insieme, nella stessa transazione. Cancellare una categoria lascia le sue voci
 * «senza categoria» (lo fa il server, e ce lo dice nel prossimo scarico).
 */
export class CategoriesRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  list(): BuyCategory[] {
    return this.db.all<BuyCategory>(
      'SELECT uuid, name, color, sort_key FROM todo_buy_categories ORDER BY sort_key',
    );
  }

  create(name: string, color: string = DEFAULT_CATEGORY_COLOR): string {
    const uuid = this.newId();
    this.db.transaction(() => {
      const last = this.db.all<{ sort_key: string }>(
        'SELECT sort_key FROM todo_buy_categories ORDER BY sort_key DESC LIMIT 1',
      )[0]?.sort_key;
      const sortKey = generateKeyBetween(last ?? null, null);
      const now = this.clock();
      const row: WireRow = {
        uuid,
        name,
        color,
        sort_key: sortKey,
        created_at: now,
        updated_at: now,
      };
      upsertRow(this.db, 'todo_buy_categories', row);
      enqueue(
        this.db,
        {
          table: 'todo_buy_categories',
          uuid,
          op: 'upsert',
          patch: { name, color, sort_key: sortKey },
          isCreate: true,
        },
        now,
      );
    });
    return uuid;
  }

  update(uuid: string, patch: { name?: string; color?: string }): void {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Record<string, WireValue>;
    if (!Object.keys(clean).length) return;
    this.db.transaction(() => {
      const now = this.clock();
      if (!patchRow(this.db, 'todo_buy_categories', uuid, clean)) return;
      enqueue(this.db, { table: 'todo_buy_categories', uuid, op: 'upsert', patch: clean }, now);
    });
  }

  remove(uuid: string): void {
    this.db.transaction(() => {
      const now = this.clock();
      // Le voci perdono la categoria anche qui, subito: il server farà lo stesso e ce lo confermerà.
      this.db.run('UPDATE todos SET buy_category_uuid = NULL WHERE buy_category_uuid = ?', [uuid]);
      deleteRow(this.db, 'todo_buy_categories', uuid);
      enqueue(this.db, { table: 'todo_buy_categories', uuid, op: 'delete' }, now);
    });
  }
}
