import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/** Una riga scritta a mano: `kid` = è una carta figlia della riga sopra (o delle sue sorelle) che non è figlia. */
export type Row = { q: string; a: string; kid?: boolean };

/** Le righe da salvare: quelle con del testo; una figlia solo se il suo padre ha del testo. */
export function rowsToCreate(rows: readonly Row[]): { q: string; a: string; kid: boolean }[] {
  const out: { q: string; a: string; kid: boolean }[] = [];
  let parentOk = false;
  for (const r of rows) {
    const has = !!(r.q.trim() || r.a.trim());
    if (!r.kid) parentOk = has;
    if (has && (!r.kid || parentOk)) out.push({ q: r.q, a: r.a, kid: !!r.kid });
  }
  return out;
}

/**
 * La bozza di «Inserisci» (fc_autosave_bar del sito): le righe scritte e non ancora create restano sul telefono, una per
 * mazzo, così uscire dalla pagina o chiudere l'app non le butta via. Si toglie quando le carte sono create.
 */
const draftKey = (deck: string): string => `insert_draft:${deck}`;

export function loadInsertDraft(db: SqlDb, deck: string): Row[] | null {
  const raw = getState(db, draftKey(deck));
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return null;
    const rows = j
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        q: typeof r.q === 'string' ? r.q : '',
        a: typeof r.a === 'string' ? r.a : '',
        ...(r.kid === true ? { kid: true } : {}),
      }));
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/** Salva le righe; se non c'è niente di scritto la bozza si toglie. */
export function saveInsertDraft(db: SqlDb, deck: string, rows: readonly Row[]): void {
  if (!rows.some((r) => r.q.trim() || r.a.trim())) {
    db.run('DELETE FROM sync_state WHERE k = ?', [draftKey(deck)]);
    return;
  }
  setState(db, draftKey(deck), JSON.stringify(rows));
}
