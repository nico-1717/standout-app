import type { SqlDb } from '../db/sqldb';

/** Una modifica che il server non ha accettato (tabella `sync_problems`). */
export interface SyncProblem {
  id: number;
  tbl: string;
  uuid: string;
  code: string;
  field: string | null;
  message: string | null;
  op: 'upsert' | 'delete';
  created_at: string;
}

export type ProblemGroup =
  | 'todo'
  | 'habits'
  | 'pills'
  | 'diary'
  | 'planner'
  | 'projects'
  | 'pomodoro'
  | 'grades'
  | 'flashcards'
  | 'altro';

/** A quale parte dell'app appartiene una tabella: l'utente non conosce i nomi delle tabelle. */
export function groupOf(tbl: string): ProblemGroup {
  if (tbl === 'todos' || tbl.startsWith('todo_')) return 'todo';
  if (tbl.startsWith('habit_') || tbl === 'habits') return 'habits';
  if (tbl.startsWith('pill_')) return 'pills';
  if (tbl.startsWith('diary_')) return 'diary';
  if (tbl.startsWith('planner_')) return 'planner';
  if (tbl === 'projects') return 'projects';
  if (tbl.startsWith('pomodoro_')) return 'pomodoro';
  if (tbl.startsWith('university_')) return 'grades';
  if (tbl.startsWith('fc_')) return 'flashcards';
  return 'altro';
}

const KNOWN_REASONS = new Set(['validation', 'forbidden', 'not_found', 'conflict', 'server_error']);

/** La chiave del testo che spiega il codice di rifiuto del server. */
export function reasonKey(code: string): string {
  return `app.sync_motivo_${KNOWN_REASONS.has(code) ? code : 'altro'}`;
}

/** I problemi non ancora «capiti», i più recenti per primi. */
export function listProblems(db: SqlDb): SyncProblem[] {
  return db.all<SyncProblem>(
    `SELECT id, tbl, uuid, code, field, message, op, created_at FROM sync_problems
     WHERE dismissed = 0 ORDER BY id DESC`,
  );
}

export function dismissProblem(db: SqlDb, id: number): void {
  db.run('UPDATE sync_problems SET dismissed = 1 WHERE id = ?', [id]);
}

export function dismissAllProblems(db: SqlDb): void {
  db.run('UPDATE sync_problems SET dismissed = 1 WHERE dismissed = 0');
}
