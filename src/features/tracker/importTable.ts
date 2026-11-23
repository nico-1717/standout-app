import { MAX_COLS, MAX_ROWS } from './blocks';
import { cellKey } from './formula';

export interface Imported {
  cols: number;
  rows: number;
  cells: Record<string, string>;
}

/** Spezza una riga rispettando le virgolette («a,"b,c"» → a | b,c). */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Il separatore più frequente nella prima riga: tabulazione (copia da un foglio), «;» o «,». */
const pickSeparator = (first: string): string =>
  ['\t', ';', ','].reduce(
    (best, s) => (first.split(s).length > first.split(best).length ? s : best),
    '\t',
  );

function fromJson(text: string): string[][] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || !data.length) return null;
  if (data.every((r) => Array.isArray(r)))
    return data.map((r) => (r as unknown[]).map((c) => String(c ?? '')));
  if (data.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    const heads: string[] = [];
    for (const r of data as Record<string, unknown>[])
      for (const k of Object.keys(r)) if (!heads.includes(k)) heads.push(k);
    const cell = (v: unknown) =>
      v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
    return [heads, ...(data as Record<string, unknown>[]).map((r) => heads.map((h) => cell(r[h])))];
  }
  return null;
}

/**
 * Da testo incollato a una tabella del Tracker: un elenco JSON (di oggetti o di righe), oppure righe separate da
 * tabulazione, «;» o «,». La prima riga è l'intestazione. Si tiene quello che ci sta (12 colonne, 200 righe).
 * `null` se non c'è una tabella vera (almeno due righe, o una riga con due colonne).
 */
export function parseTable(text: string): Imported | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let grid = trimmed.startsWith('[') ? fromJson(trimmed) : null;
  if (!grid) {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const sep = pickSeparator(lines[0] ?? '');
    grid = lines.map((l) => splitLine(l, sep));
  }
  const cols = Math.min(MAX_COLS, Math.max(...grid.map((r) => r.length)));
  if (grid.length < 2 && cols < 2) return null;
  const rows = Math.min(MAX_ROWS, grid.length);
  const cells: Record<string, string> = {};
  grid.slice(0, rows).forEach((r, y) => {
    r.slice(0, cols).forEach((v, x) => {
      const value = v.slice(0, 200);
      if (value !== '') cells[cellKey(x, y)] = value;
    });
  });
  return { cols, rows, cells };
}

/** Un indirizzo che il collegamento accetta: solo https, con un nome di sito. */
export function cleanUrl(raw: string): string | null {
  const v = raw.trim();
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(v) || v.length > 300) return null;
  return v;
}

export const hostOf = (url: string): string =>
  url.replace(/^https:\/\//i, '').split(/[/?#]/)[0] ?? url;
