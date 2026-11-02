import type { SyncTable } from './manifest';

export type WireValue = string | number | boolean | null;
export type WireRow = Record<string, WireValue> & { uuid: string };

export interface Mutation {
  mutation_id: string;
  table: SyncTable;
  op: 'upsert' | 'delete';
  uuid: string;
  patch: Record<string, WireValue>;
}

export interface PushResult {
  mutation_id: string;
  status: 'applied' | 'rejected' | 'error';
  code?: string;
  field?: string;
  message?: string;
  replayed?: boolean;
  /** la riga com'è sul server (solo con status rejected): serve a rimettere a posto il telefono */
  current?: WireRow | null;
}

export type PullChange =
  | { table: SyncTable; op: 'upsert'; uuid: string; row: WireRow }
  | { table: SyncTable; op: 'delete'; uuid: string };

export interface PullResponse {
  changes: PullChange[];
  cursor: string | number;
  more: boolean;
  snapshot?: boolean;
  resync_required?: boolean;
}

/** Il server visto dal motore. L'implementazione vera usa fetch (httpApi.ts); nei test ce n'è una finta. */
export interface SyncApi {
  push(mutations: Mutation[]): Promise<{ results: PushResult[]; head: number }>;
  pull(cursor: string, limit: number): Promise<PullResponse>;
  /** Le tabelle che il server sa sincronizzare (un server più vecchio dell'app non le ha tutte). Facoltativa. */
  tables?(): Promise<string[]>;
}
