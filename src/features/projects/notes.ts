/**
 * Le note dei progetti. Sul sito sono un documento dell'editor ({"v":2,"blocks":[…]}) o, nelle più vecchie, testo semplice.
 * Sul telefono si leggono sempre come testo; si scrivono solo se sono testo semplice: una nota con formato non si
 * riscrive da qui (si perderebbero grassetti, elenchi, formule).
 */

interface Block {
  t?: string;
  tex?: string;
  runs?: { s?: unknown; x?: unknown }[];
}

function parse(note: string): { blocks: Block[] } | null {
  if (!note || note[0] !== '{') return null;
  try {
    const j = JSON.parse(note) as { blocks?: unknown };
    return Array.isArray(j.blocks) ? { blocks: j.blocks as Block[] } : null;
  } catch {
    return null;
  }
}

/** È una nota con formato (documento dell'editor)? */
export function isRichNote(note: string): boolean {
  return parse(note) !== null;
}

/** Il testo della nota, un blocco per riga. Le formule si leggono come il loro testo. */
export function noteText(note: string): string {
  const d = parse(note);
  if (!d) return note;
  return d.blocks
    .map((b) => {
      if (!b || typeof b !== 'object') return '';
      if (b.t === 'fx') return String(b.tex ?? '');
      return (b.runs ?? [])
        .map((r) => (typeof r?.s === 'string' ? r.s : typeof r?.x === 'string' ? r.x : ''))
        .join('');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
