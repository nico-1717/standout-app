import { addDays, dow } from './engine';
import type { CalendarNode } from './view';

export const ROW_H = 58;

/** Le 42 caselle del mese (6 settimane, si comincia di lunedì): dal lunedì prima del primo del mese. */
export function gridRange(month: string): { from: string; to: string } {
  const first = `${month.slice(0, 7)}-01`;
  const from = addDays(first, -(dow(first) - 1));
  return { from, to: addDays(from, 41) };
}

/** Il giorno sotto un punto della griglia (coordinate relative alla griglia), o null se è fuori. */
export function cellAt(
  x: number,
  y: number,
  width: number,
  from: string,
  rowH = ROW_H,
): string | null {
  if (width <= 0 || x < 0 || y < 0 || x >= width) return null;
  const col = Math.floor((x / width) * 7);
  const row = Math.floor(y / rowH);
  if (row < 0 || row > 5 || col < 0 || col > 6) return null;
  return addDays(from, row * 7 + col);
}

/** Il primo del mese prima / dopo / quello di oggi. */
export function shiftMonth(month: string, by: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + by;
  const d = new Date(y, m, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Il progetto con tutto il suo ramo. */
export function branchOf(nodes: CalendarNode[], id: string): string[] {
  const kids = new Map(nodes.map((n) => [n.project, n.kids]));
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    if (!kids.has(x)) continue;
    out.push(x);
    for (const k of kids.get(x)!) stack.push(k);
  }
  return out;
}

/**
 * Le file di pastiglie del calendario generale: una per ogni livello del percorso. Si parte dai progetti principali; il
 * progetto scelto (e ognuno dei suoi antenati) apre sotto di sé la fila dei propri sotto-progetti.
 */
export function chipRows(
  nodes: CalendarNode[],
  sel: string | null,
): { parent: string | null; ids: string[] }[] {
  const byId = new Map(nodes.map((n) => [n.project, n]));
  const open = (parent: string | null) =>
    nodes
      .filter(
        (n) =>
          (parent === null ? n.parent === null || !byId.has(n.parent) : n.parent === parent) &&
          n.status !== 'completed',
      )
      .map((n) => n.project);
  const rows: { parent: string | null; ids: string[] }[] = [{ parent: null, ids: open(null) }];
  const chain: string[] = [];
  let x = sel;
  for (let guard = 0; x && byId.has(x) && guard < 30; guard++) {
    chain.unshift(x);
    x = byId.get(x)!.parent;
  }
  for (const id of chain) {
    const k = open(id);
    if (k.length) rows.push({ parent: id, ids: k });
  }
  return rows;
}

/** Il progetto scelto è un antenato di `id`? (la pastiglia sta sul suo percorso) */
export function isAncestorOfSel(nodes: CalendarNode[], sel: string | null, id: string): boolean {
  const byId = new Map(nodes.map((n) => [n.project, n]));
  let x = sel;
  for (let guard = 0; x && byId.has(x) && guard < 30; guard++) {
    x = byId.get(x)!.parent;
    if (x === id) return true;
  }
  return false;
}

/** Testo scuro o chiaro sopra un colore, secondo quanto è chiaro. */
export function inkOn(color: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color || '');
  if (!m) return '#1C1C1E';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1C1C1E' : '#FFFFFF';
}
