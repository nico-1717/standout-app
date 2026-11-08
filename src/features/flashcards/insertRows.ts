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
