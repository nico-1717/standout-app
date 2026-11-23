import type { Cells } from './formula';
import type { Items } from './neetcode';

/**
 * I blocchi di un Tracker. Ogni blocco è una riga: tipo, titolo, `config` (com'è fatto) e `data` (cosa c'è dentro),
 * gli ultimi due in JSON. La forma dipende dal tipo; chi legge un blocco rovinato o più nuovo dell'app riparte dai
 * valori di partenza invece di rompersi (`readConfig` / `readData`).
 */
export type BlockKind =
  'table' | 'counter' | 'progress' | 'checklist' | 'note' | 'review' | 'chart' | 'connection';

/** I tipi che l'app sa disegnare oggi. */
export const BUILDABLE: BlockKind[] = [
  'table',
  'counter',
  'progress',
  'checklist',
  'note',
  'review',
];
export const MAX_BLOCKS = 20;
export const MAX_ROWS = 200;
export const MAX_COLS = 12;

export interface TableConfig {
  cols: number;
  rows: number;
  headers: string[];
}
export interface TableData {
  cells: Cells;
}
export interface CounterConfig {
  step: number;
  unit: string;
}
export interface CounterData {
  value: number;
}
export interface ProgressConfig {
  goal: number;
  unit: string;
  /** il contatore da cui si legge il valore; senza, il valore si scrive a mano */
  source: string | null;
}
export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}
export interface ChecklistData {
  items: CheckItem[];
}
export interface NoteData {
  text: string;
}
export interface ReviewConfig {
  template: 'neetcode150';
}
/** Le proposte di oggi (restano finché è lo stesso giorno, anche se si chiude l'app). */
export interface Picks {
  date: string;
  review: number[];
  news: { id: number; note: string }[];
}
export interface ReviewData {
  items: Items;
  lastExport: string | null;
  picks: Picks | null;
}

export interface Block {
  uuid: string;
  project: string;
  kind: BlockKind;
  title: string;
  config: unknown;
  data: unknown;
  sortKey: string | null;
}

const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
const num = (x: unknown, d: number, lo = -1e12, hi = 1e12) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);

export const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export function tableConfig(x: unknown): TableConfig {
  const o = obj(x);
  const cols = Math.round(num(o.cols, 3, 1, MAX_COLS));
  const headers = Array.isArray(o.headers) ? o.headers.map((h) => str(h)) : [];
  return {
    cols,
    rows: Math.round(num(o.rows, 5, 1, MAX_ROWS)),
    headers: Array.from({ length: cols }, (_, i) => headers[i] ?? ''),
  };
}
export function tableData(x: unknown): TableData {
  const cells: Cells = {};
  for (const [k, v] of Object.entries(obj(obj(x).cells))) if (typeof v === 'string') cells[k] = v;
  return { cells };
}
export const counterConfig = (x: unknown): CounterConfig => ({
  step: num(obj(x).step, 1, 0.0001, 1e6),
  unit: str(obj(x).unit),
});
export const counterData = (x: unknown): CounterData => ({ value: num(obj(x).value, 0) });
export const progressConfig = (x: unknown): ProgressConfig => ({
  goal: num(obj(x).goal, 100, 0.0001),
  unit: str(obj(x).unit),
  source: typeof obj(x).source === 'string' ? (obj(x).source as string) : null,
});
export function checklistData(x: unknown): ChecklistData {
  const raw = obj(x).items;
  const items: CheckItem[] = [];
  if (Array.isArray(raw))
    for (const r of raw) {
      const o = obj(r);
      if (typeof o.id === 'string')
        items.push({ id: o.id, text: str(o.text), done: o.done === true });
    }
  return { items };
}
export const noteData = (x: unknown): NoteData => ({ text: str(obj(x).text) });
export function reviewData(x: unknown): ReviewData {
  const o = obj(x);
  const items: Items = {};
  for (const [k, v] of Object.entries(obj(o.items))) {
    const r = obj(v);
    if (typeof r.n === 'number' && typeof r.nextDue === 'string') items[k] = v as Items[string];
  }
  const pk = obj(o.picks);
  const picks: Picks | null =
    typeof pk.date === 'string' && Array.isArray(pk.review) && Array.isArray(pk.news)
      ? {
          date: pk.date,
          review: pk.review.filter((n): n is number => typeof n === 'number'),
          news: pk.news
            .map((e) => obj(e))
            .filter((e) => typeof e.id === 'number')
            .map((e) => ({ id: e.id as number, note: str(e.note) })),
        }
      : null;
  return { items, lastExport: typeof o.lastExport === 'string' ? o.lastExport : null, picks };
}

/** I valori di partenza di un blocco nuovo. */
export function emptyBlock(kind: BlockKind): { config: object; data: object } {
  switch (kind) {
    case 'table':
      return { config: { cols: 3, rows: 5, headers: ['', '', ''] }, data: { cells: {} } };
    case 'counter':
      return { config: { step: 1, unit: '' }, data: { value: 0 } };
    case 'progress':
      return { config: { goal: 100, unit: '', source: null }, data: { value: 0 } };
    case 'checklist':
      return { config: {}, data: { items: [] } };
    case 'note':
      return { config: {}, data: { text: '' } };
    case 'review':
      return {
        config: { template: 'neetcode150' },
        data: { items: {}, lastExport: null, picks: null },
      };
    default:
      return { config: {}, data: {} };
  }
}
