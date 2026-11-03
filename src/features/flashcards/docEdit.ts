/**
 * Le modifiche al documento di una carta, come funzioni pure (il modello è quello di `doc.ts`): cambiare il testo di un
 * blocco senza perdere le etichette, applicare grassetto / corsivo / sottolineato / evidenziatore / colore a un pezzo,
 * spezzare e unire i blocchi, cambiarne il tipo (elenco, casella, citazione, codice), rientro. È il motore dell'editor ricco.
 */
import {
  normDoc,
  CODE_LANGS,
  type Block,
  type Doc,
  type Marks,
  type Run,
  type TextRun,
} from './doc';

export type MarkKey = 'b' | 'i' | 'u' | 'h';
export type BlockKind = 'p' | 'li' | 'ck' | 'q' | 'code' | 'fx';

const runText = (r: Run): string => ('x' in r && typeof r.x === 'string' ? r.x : (r as TextRun).s);
const runLen = (r: Run): number => runText(r).length;
const isMath = (r: Run): boolean => 'x' in r && typeof r.x === 'string';

/** Le righe di un blocco (le formule a blocco non ne hanno: il loro testo è il LaTeX). */
function runsOf(b: Block): Run[] {
  return b.t === 'fx' ? [{ s: b.tex }] : b.runs;
}

/** Il testo di un blocco, in un pezzo solo. */
export function textOf(b: Block | undefined): string {
  if (!b) return '';
  return b.t === 'fx' ? b.tex : b.runs.map(runText).join('');
}

/**
 * Divide le righe in due alla posizione `pos`. Un pezzo di testo a cavallo si spezza; una formula a cavallo va tutta nella
 * seconda parte (le due parti, rimesse insieme, sono sempre le righe di prima).
 */
export function splitRuns(runs: Run[], pos: number): [Run[], Run[]] {
  const before: Run[] = [];
  const after: Run[] = [];
  let o = 0;
  for (const r of runs) {
    const l = runLen(r);
    if (o + l <= pos) before.push(r);
    else if (o >= pos) after.push(r);
    else if (isMath(r)) after.push(r);
    else {
      const t = r as TextRun;
      const cut = pos - o;
      before.push(t.m ? { s: t.s.slice(0, cut), m: { ...t.m } } : { s: t.s.slice(0, cut) });
      after.push(t.m ? { s: t.s.slice(cut), m: { ...t.m } } : { s: t.s.slice(cut) });
    }
    o += l;
  }
  return [before, after];
}

/** Le formule in linea che toccano [start, end) diventano testo (così una modifica dentro una formula non la perde per intero). */
function flattenMath(runs: Run[], start: number, end: number): Run[] {
  let o = 0;
  return runs.map((r) => {
    const l = runLen(r);
    const touches = o < end && o + l > start;
    o += l;
    if (!touches || !isMath(r)) return r;
    return r.m ? { s: runText(r), m: { ...r.m } } : { s: runText(r) };
  });
}

/** Divide in tre: prima di `start`, tra `start` e `end`, dopo `end` (le posizioni sono nel testo del blocco). */
function splitThree(runs: Run[], start: number, end: number): [Run[], Run[], Run[]] {
  const [pre, rest] = splitRuns(runs, start);
  // se una formula a cavallo è finita in `rest`, questo comincia prima di `start`
  const preLen = pre.reduce((n, r) => n + runLen(r), 0);
  const [mid, post] = splitRuns(rest, Math.max(0, end - preLen));
  return [pre, mid, post];
}

const withRuns = (b: Block, runs: Run[]): Block => {
  if (b.t === 'fx') return { ...b, tex: runs.map(runText).join('') };
  return { ...b, runs };
};

const setBlock = (doc: Doc, i: number, b: Block): Doc => {
  const blocks = doc.blocks.slice();
  blocks[i] = b;
  return normDoc({ v: 2, blocks });
};

/** Le etichette che un testo nuovo eredita: quelle del carattere prima (o, all'inizio, dopo). */
function inheritedMarks(before: Run[], after: Run[]): Marks | undefined {
  for (let k = before.length - 1; k >= 0; k--) {
    const r = before[k]!;
    if (!isMath(r)) return r.m;
  }
  for (const r of after) if (!isMath(r)) return r.m;
  return undefined;
}

/**
 * Il testo di un blocco è diventato `text` (l'utente ha scritto): si cambia solo la parte che è cambiata, così il resto
 * mantiene le sue etichette. Una formula in linea toccata dalla modifica diventa testo.
 */
export function editBlockText(doc: Doc, i: number, text: string): Doc {
  const b = doc.blocks[i];
  if (!b) return doc;
  if (b.t === 'fx') return setBlock(doc, i, { ...b, tex: text });
  const old = textOf(b);
  if (old === text) return doc;
  let p = 0;
  const max = Math.min(old.length, text.length);
  while (p < max && old[p] === text[p]) p++;
  let s = 0;
  while (s < max - p && old[old.length - 1 - s] === text[text.length - 1 - s]) s++;
  const [pre, , post] = splitThree(flattenMath(b.runs, p, old.length - s), p, old.length - s);
  const inserted = text.slice(p, text.length - s);
  const marks = inheritedMarks(pre, post);
  const mid2: Run[] = inserted ? [marks ? { s: inserted, m: { ...marks } } : { s: inserted }] : [];
  return setBlock(doc, i, withRuns(b, [...pre, ...mid2, ...post]));
}

const MARK_VALUE = 1;

/** Dice se tutto il pezzo [start, end) ha l'etichetta (per l'aspetto dei tasti della barra). */
export function marksAt(
  doc: Doc,
  i: number,
  start: number,
  end: number,
): { b: boolean; i: boolean; u: boolean; h: boolean; c: string | null } {
  const b = doc.blocks[i];
  const none = { b: false, i: false, u: false, h: false, c: null };
  if (!b || b.t === 'fx') return none;
  let from = start;
  let to = end;
  if (from === to) {
    // il cursore: vale il carattere prima
    if (from === 0) return none;
    from = from - 1;
    to = from + 1;
  }
  const [, mid] = splitThree(b.runs, from, to);
  const runs = mid.filter((r) => runLen(r) > 0);
  if (!runs.length) return none;
  const all = (k: MarkKey): boolean => runs.every((r) => !!r.m?.[k]);
  const colors = new Set(runs.map((r) => (typeof r.m?.c === 'string' ? r.m.c : '')));
  const c = colors.size === 1 ? [...colors][0] || null : null;
  return { b: all('b'), i: all('i'), u: all('u'), h: all('h'), c };
}

function mapRange(doc: Doc, i: number, start: number, end: number, fn: (r: Run) => Run): Doc {
  const b = doc.blocks[i];
  if (!b || b.t === 'fx' || start >= end) return doc;
  const [pre, mid, post] = splitThree(b.runs, start, end);
  return setBlock(doc, i, withRuns(b, [...pre, ...mid.map(fn), ...post]));
}

const withMark = (r: Run, k: string, v: string | number | null): Run => {
  const m: Marks = { ...(r.m ?? {}) };
  if (v === null) delete m[k];
  else m[k] = v;
  return { ...r, m };
};

/** Grassetto, corsivo, sottolineato o evidenziatore sul pezzo [start, end): se c'è già su tutto si toglie, se no si mette. */
export function toggleMark(doc: Doc, i: number, start: number, end: number, key: MarkKey): Doc {
  const on = marksAt(doc, i, start, end)[key];
  return mapRange(doc, i, start, end, (r) => withMark(r, key, on ? null : MARK_VALUE));
}

/** Il colore del testo (`null` = nessuno) sul pezzo [start, end). */
export function setColor(
  doc: Doc,
  i: number,
  start: number,
  end: number,
  color: string | null,
): Doc {
  return mapRange(doc, i, start, end, (r) => withMark(r, 'c', color));
}

/** Tutto il blocco con le stesse etichette (per applicare una scelta all'intero blocco quando non c'è selezione). */
export function blockRange(doc: Doc, i: number): [number, number] {
  return [0, textOf(doc.blocks[i]).length];
}

/** Il blocco `i` è spezzato in `at`; il secondo pezzo è un blocco nuovo dello stesso tipo (una casella riparte vuota). */
export function splitBlock(doc: Doc, i: number, at: number): Doc {
  const b = doc.blocks[i];
  if (!b) return doc;
  const blocks = doc.blocks.slice();
  if (b.t === 'fx') {
    blocks.splice(i + 1, 0, { t: 'p', runs: [] });
    return normDoc({ v: 2, blocks });
  }
  const [a, z] = splitRuns(b.runs, at);
  const first = { ...b, runs: a } as Block;
  const second = { ...b, runs: z } as Block;
  if (second.t === 'li' && second.ck !== undefined) second.ck = 0;
  blocks.splice(i, 1, first, second);
  // normDoc toglie le righe vuote: i blocchi restano, ma la forma canonica si riprende
  return normDoc({ v: 2, blocks });
}

/**
 * Il blocco `i` si unisce al precedente (Backspace a inizio riga). Ritorna il documento e dove va il cursore (la fine del
 * blocco precedente). Un blocco speciale (elenco, citazione, codice) prima diventa un paragrafo normale.
 */
export function mergeWithPrevious(doc: Doc, i: number): { doc: Doc; at: number; block: number } {
  const b = doc.blocks[i];
  if (!b) return { doc, at: 0, block: i };
  const special = b.t === 'li' || (b.t === 'p' && (b.code || b.q || b.lvl));
  if (special) return { doc: setKind(doc, i, 'p'), at: 0, block: i };
  if (i === 0) return { doc, at: 0, block: 0 };
  const prev = doc.blocks[i - 1]!;
  const at = textOf(prev).length;
  const blocks = doc.blocks.slice();
  if (prev.t === 'fx' || b.t === 'fx') {
    if (textOf(b) === '') blocks.splice(i, 1);
    else if (textOf(prev) === '') blocks.splice(i - 1, 1);
    else return { doc, at: 0, block: i };
    return { doc: normDoc({ v: 2, blocks }), at, block: i - 1 };
  }
  blocks.splice(i - 1, 2, { ...prev, runs: [...prev.runs, ...b.runs] } as Block);
  return { doc: normDoc({ v: 2, blocks }), at, block: i - 1 };
}

/** Il tipo del blocco. */
export function kindOf(b: Block | undefined): BlockKind {
  if (!b) return 'p';
  if (b.t === 'fx') return 'fx';
  if (b.t === 'li') return b.ck !== undefined ? 'ck' : 'li';
  if (b.code) return 'code';
  if (b.q) return 'q';
  return 'p';
}

/** Cambia il tipo del blocco, tenendo il testo e le sue etichette. */
export function setKind(doc: Doc, i: number, kind: BlockKind, codeLang = 'python'): Doc {
  const b = doc.blocks[i];
  if (!b) return doc;
  if (kindOf(b) === kind) return doc;
  const runs = runsOf(b);
  const lvl = b.t === 'li' ? b.lvl : b.t === 'p' && b.lvl ? b.lvl : 1;
  let nb: Block;
  switch (kind) {
    case 'li':
      nb = { t: 'li', lvl, runs };
      break;
    case 'ck':
      nb = { t: 'li', lvl, runs, ck: 0 };
      break;
    case 'q':
      nb = { t: 'p', runs, q: 1 };
      break;
    case 'code':
      nb = {
        t: 'p',
        runs,
        code: codeLang in CODE_LANGS || codeLang === 'auto' ? codeLang : 'other',
      };
      break;
    case 'fx':
      nb = { t: 'fx', tex: runs.map(runText).join('') };
      break;
    default:
      nb = { t: 'p', runs };
  }
  return setBlock(doc, i, nb);
}

/** Rientro più (+1) o meno (-1): nei paragrafi 0..12, negli elenchi 1..12. */
export function indent(doc: Doc, i: number, delta: 1 | -1): Doc {
  const b = doc.blocks[i];
  if (!b) return doc;
  if (b.t === 'li')
    return setBlock(doc, i, { ...b, lvl: Math.max(1, Math.min(12, b.lvl + delta)) });
  if (b.t === 'p' && !b.code) {
    const lvl = Math.max(0, Math.min(12, (b.lvl ?? 0) + delta));
    const nb = { ...b } as typeof b;
    if (lvl) nb.lvl = lvl;
    else delete nb.lvl;
    return setBlock(doc, i, nb);
  }
  return doc;
}

/** Spunta o toglie la spunta a una casella. */
export function toggleChecked(doc: Doc, i: number): Doc {
  const b = doc.blocks[i];
  if (!b || b.t !== 'li' || b.ck === undefined) return doc;
  return setBlock(doc, i, { ...b, ck: b.ck === 1 ? 0 : 1 });
}
