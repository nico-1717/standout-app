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

/** Quello che c'è in un giorno per un progetto: il suo colore, e se è solo pianificato (soft) o evidenziato a mano. */
export interface DayMark {
  id: string;
  color: string;
  soft: boolean;
}

/** Un tratto di linea dentro UNA settimana (riga 0..5, colonne 0..6). */
export interface LineSeg extends DayMark {
  row: number;
  from: number;
  to: number;
  /** il tratto comincia / finisce davvero qui (non continua dalla settimana prima / dopo): estremo arrotondato */
  capL: boolean;
  capR: boolean;
  lane: number;
}

const markKey = (m: DayMark) => `${m.id}|${m.soft ? 1 : 0}`;

/**
 * Dalle caselle del mese alle linee: per ogni progetto, i giorni di fila diventano UNA linea, spezzata solo dove va a
 * capo la settimana. Due progetti nello stesso giorno stanno su corsie diverse (come le barre della linea del tempo del
 * sito). Oltre `maxLanes` corsie un tratto non si disegna: la legenda sotto il calendario dice comunque tutto.
 */
export function lineSegments(days: DayMark[][], maxLanes = 3): LineSeg[] {
  const out: LineSeg[] = [];
  const has = (i: number, m: DayMark) =>
    i >= 0 && i < days.length && (days[i] ?? []).some((x) => markKey(x) === markKey(m));
  for (let row = 0; row < 6; row++) {
    const keys = new Map<string, DayMark>();
    for (let c = 0; c < 7; c++) for (const m of days[row * 7 + c] ?? []) keys.set(markKey(m), m);
    const segs: Omit<LineSeg, 'lane'>[] = [];
    for (const m of keys.values()) {
      for (let c = 0; c < 7; c++) {
        if (!has(row * 7 + c, m)) continue;
        const from = c;
        while (c + 1 < 7 && has(row * 7 + c + 1, m)) c++;
        segs.push({
          ...m,
          row,
          from,
          to: c,
          capL: !has(row * 7 + from - 1, m),
          capR: !has(row * 7 + c + 1, m),
        });
      }
    }
    segs.sort((a, b) => a.from - b.from || a.to - b.to || a.id.localeCompare(b.id));
    const laneEnd: number[] = [];
    for (const s of segs) {
      let lane = 0;
      while (laneEnd[lane] !== undefined && laneEnd[lane] >= s.from) lane++;
      laneEnd[lane] = s.to;
      if (lane < maxLanes) out.push({ ...s, lane });
    }
  }
  return out;
}

/** Quanti giorni DEL MESE mostrato ha ogni progetto (la legenda): ogni giorno conta una volta, anche se ha più segni. */
export function legendDays(
  days: DayMark[][],
  cells: string[],
  month: string,
): Map<string, { color: string; days: number }> {
  const out = new Map<string, { color: string; days: number }>();
  cells.forEach((d, i) => {
    if (d.slice(0, 7) !== month.slice(0, 7)) return;
    const seen = new Set<string>();
    for (const m of days[i] ?? []) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const cur = out.get(m.id) ?? { color: m.color, days: 0 };
      cur.days += 1;
      out.set(m.id, cur);
    }
  });
  return out;
}
