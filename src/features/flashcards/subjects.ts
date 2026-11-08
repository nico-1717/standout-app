import type { SubjectRow } from './game';

/**
 * Lo storico visto per giorno e per materia (fc_history.php): le barre dell'attività e l'albero delle materie. Il calcolo
 * delle barre e dei rami è quello del sito (`sfc_attivita`, `preparaMaterie`).
 */

/* ---------------- attività ---------------- */

export type ActivityStep = 'day' | 'week' | 'month';
export interface ActivityBar {
  /** il primo giorno della barra (AAAA-MM-GG) */
  d: string;
  n: number;
}

const dayMs = 86_400_000;
const at = (iso: string): number => Date.parse(`${iso}T12:00:00Z`);
const isoOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Le risposte per giorno, in al massimo una sessantina di barre: per giorno (fino a 62 giorni), per settimana (fino a
 * 434) o per mese. `from`/`to` vuoti: dal primo giorno con risposte, fino a oggi.
 */
export function groupActivity(
  perDay: ReadonlyMap<string, number>,
  from: string,
  to: string,
  today: string,
): { step: ActivityStep; bars: ActivityBar[] } {
  const first = [...perDay.keys()].sort()[0];
  const end = to || today;
  let start = from || first || today;
  if (start > end) start = end;
  const t0 = at(start);
  const t1 = at(end);
  const days = Math.round((t1 - t0) / dayMs) + 1;
  const step: ActivityStep = days <= 62 ? 'day' : days <= 434 ? 'week' : 'month';
  const bars = new Map<string, number>();
  for (let t = t0; t <= t1; t += dayMs) {
    const day = isoOf(t);
    const key =
      step === 'day'
        ? day
        : step === 'week'
          ? isoOf(t0 + Math.floor((t - t0) / dayMs / 7) * 7 * dayMs)
          : `${day.slice(0, 7)}-01`;
    bars.set(key, (bars.get(key) ?? 0) + (perDay.get(day) ?? 0));
  }
  return { step, bars: [...bars].map(([d, n]) => ({ d, n })) };
}

/* ---------------- materie ---------------- */

export interface SubjectTotals {
  cards: number;
  learnt: number;
  ok: number;
  ko: number;
  seconds: number;
  last: string;
  /** tutti i mazzi del ramo (il suo e quelli sotto): per far partire una partita su tutto il ramo */
  ids: string[];
  /** quante sotto-materie non hanno avuto risposte nel periodo */
  untouched: number;
  /** 0–1: media dei completamenti pesata sulle carte */
  completion: number;
}

export interface SubjectNode {
  row: SubjectRow;
  /** archiviata lei o un mazzo sopra di lei */
  archived: boolean;
  total: SubjectTotals;
}

export interface SubjectTree {
  nodes: Map<string, SubjectNode>;
  children: Map<string | null, string[]>;
}

/** Ogni materia porta i numeri di tutto il suo ramo; le archiviate (e i loro rami) restano fuori dalle somme. */
export function buildSubjects(rows: readonly SubjectRow[]): SubjectTree {
  const byId = new Map(rows.map((r) => [r.uuid, r]));
  const children = new Map<string | null, string[]>();
  for (const r of rows) {
    const p = r.parent && byId.has(r.parent) ? r.parent : null;
    children.set(p, [...(children.get(p) ?? []), r.uuid]);
  }
  const nodes = new Map<string, SubjectNode>();
  const num = new Map<string, number>();
  const den = new Map<string, number>();

  const walk = (id: string, archivedAbove: boolean, depth: number): SubjectTotals => {
    const row = byId.get(id)!;
    const archived = archivedAbove || row.archived;
    const t: SubjectTotals = {
      cards: row.cards,
      learnt: row.learnt,
      ok: row.ok,
      ko: row.ko,
      seconds: row.seconds,
      last: row.last,
      ids: [id],
      untouched: 0,
      completion: 0,
    };
    let cn = row.completion * row.cards;
    let cd = row.cards;
    for (const kid of depth > 60 ? [] : (children.get(id) ?? [])) {
      const s = walk(kid, archived, depth + 1);
      if (nodes.get(kid)!.archived) continue;
      t.cards += s.cards;
      t.learnt += s.learnt;
      t.ok += s.ok;
      t.ko += s.ko;
      t.seconds += s.seconds;
      if (s.last > t.last) t.last = s.last;
      t.ids.push(...s.ids);
      cn += num.get(kid) ?? 0;
      cd += den.get(kid) ?? 0;
      if (s.cards > 0 && s.ok + s.ko === 0) t.untouched += 1 + s.untouched;
      else t.untouched += s.untouched;
    }
    t.completion = cd > 0 ? cn / cd : 0;
    num.set(id, cn);
    den.set(id, cd);
    nodes.set(id, { row, archived, total: t });
    return t;
  };
  for (const id of children.get(null) ?? []) walk(id, false, 0);
  return { nodes, children };
}

export const isTouched = (n: SubjectNode): boolean => n.total.ok + n.total.ko > 0;

/** I figli che si vedono: non archiviati e con almeno una carta (sotto). */
export function visibleSubjects(tree: SubjectTree, parent: string | null): string[] {
  return (tree.children.get(parent) ?? []).filter((id) => {
    const n = tree.nodes.get(id)!;
    return !n.archived && n.total.cards > 0;
  });
}

export type UntouchedOrder = 'tempo_fa' | 'da_imparare' | 'alfa';
export type PlayedOrder = 'tempo' | 'precisione' | 'carte' | 'alfa';
export const UNTOUCHED_ORDERS: UntouchedOrder[] = ['tempo_fa', 'da_imparare', 'alfa'];
export const PLAYED_ORDERS: PlayedOrder[] = ['tempo', 'precisione', 'carte', 'alfa'];

const byName = (a: SubjectNode, b: SubjectNode): number =>
  a.row.name.localeCompare(b.row.name, undefined, { sensitivity: 'base' });

export function sortUntouched(
  tree: SubjectTree,
  ids: readonly string[],
  order: UntouchedOrder,
): string[] {
  const n = (id: string) => tree.nodes.get(id)!;
  return [...ids].sort((a, b) => {
    const ta = n(a).total;
    const tb = n(b).total;
    if (order === 'da_imparare') return tb.cards - tb.learnt - (ta.cards - ta.learnt);
    if (order === 'alfa') return byName(n(a), n(b));
    return ta.last.localeCompare(tb.last);
  });
}

export function sortPlayed(
  tree: SubjectTree,
  ids: readonly string[],
  order: PlayedOrder,
): string[] {
  const n = (id: string) => tree.nodes.get(id)!;
  return [...ids].sort((a, b) => {
    const ta = n(a).total;
    const tb = n(b).total;
    if (order === 'precisione') return ta.ok / (ta.ok + ta.ko) - tb.ok / (tb.ok + tb.ko);
    if (order === 'carte') return tb.ok + tb.ko - (ta.ok + ta.ko);
    if (order === 'alfa') return byName(n(a), n(b));
    return tb.seconds - ta.seconds;
  });
}

/** La precisione in percentuale, o `null` se non c'è nessuna risposta. */
export const accuracyPct = (ok: number, ko: number): number | null =>
  ok + ko > 0 ? Math.round((ok / (ok + ko)) * 100) : null;
