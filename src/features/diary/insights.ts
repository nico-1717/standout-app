import { addDaysIso } from '@/features/tasks/groups';

import { monthEnd, weekStart } from './logic';

/**
 * Il diario in numeri (diario_anno.php del sito). I dati li calcola il server (`/api/v1/diary/insights`): dentro ci sono
 * anche i pomodori e le abitudini di tutto l'anno, che il telefono non ha tutti. Qui c'è solo il modo di leggerli:
 * le stesse somme e medie del sito (diario_anno.js).
 */

/** Un giorno compatto: [umore, energia, parole, voci, abitudini fatte, previste, pomodori, minuti]. */
export type CompactDay = [
  number | null,
  number | null,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface YearLine {
  anno: number;
  giorni: number;
  scritti: number;
  parole: number;
  umore: number | null;
  energia: number | null;
  abitudini_pct: number | null;
  pomodori: number;
  minuti: number;
}

export interface Insights {
  year: number;
  today: string;
  days: Record<string, CompactDay>;
  anni: YearLine[];
}

export interface Day {
  m: number | null;
  e: number | null;
  w: number;
  l: number;
  hd: number;
  hu: number;
  p: number;
  f: number;
}

export function dayOf(data: Insights, date: string): Day | null {
  const x = data.days[date];
  return x ? { m: x[0], e: x[1], w: x[2], l: x[3], hd: x[4], hu: x[5], p: x[6], f: x[7] } : null;
}

export const written = (x: Day | null) => !!x && (x.w > 0 || x.l > 0);

export type Layer = 'm' | 'e' | 'h';

/** I colori: l'umore dal rosso al verde, l'energia dal celeste al blu, le abitudini in viola. */
export const LAYER_COLORS: Record<Layer, string[]> = {
  m: ['#E07A6B', '#EFA96A', '#E9CF6E', '#A8CF8E', '#57B07B'],
  e: ['#D3E2F4', '#A9C6EB', '#7DA6DE', '#5487D0', '#3466B8'],
  h: ['#E9E1F7', '#CDBDEE', '#A991DF', '#8A6BD0', '#6A49B8'],
};

/** Il livello 1..5 di un giorno per il colore scelto (null = niente da colorare). */
export function levelOf(x: Day | null, layer: Layer): number | null {
  if (!x) return null;
  if (layer === 'm') return x.m;
  if (layer === 'e') return x.e;
  if (!x.hu) return null;
  const p = Math.min(1, x.hd / x.hu);
  return p <= 0 ? 1 : Math.min(5, 1 + Math.round(p * 4));
}

export interface Summary {
  giorni: number;
  scritti: number;
  parole: number;
  umore: number | null;
  energia: number | null;
  pct: number | null;
  fatte: number;
  pomodori: number;
  minuti: number;
}

const mean = (a: number[]) => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);

export function summarise(days: (Day | null)[]): Summary {
  const m: number[] = [];
  const e: number[] = [];
  let scritti = 0;
  let parole = 0;
  let hd = 0;
  let hu = 0;
  let pomodori = 0;
  let minuti = 0;
  for (const x of days) {
    if (!x) continue;
    if (x.m !== null) m.push(x.m);
    if (x.e !== null) e.push(x.e);
    if (written(x)) scritti++;
    parole += x.w;
    hd += x.hd;
    hu += x.hu;
    pomodori += x.p;
    minuti += x.f;
  }
  return {
    giorni: days.length,
    scritti,
    parole,
    umore: mean(m),
    energia: mean(e),
    pct: hu > 0 ? Math.round(Math.min(1, hd / hu) * 100) : null,
    fatte: hd,
    pomodori,
    minuti,
  };
}

export interface Row {
  /** da dove si apre il diario (un giorno) e l'anno, per le righe degli anni */
  key: string;
  date: string | null;
  year: number | null;
  from: string;
  to: string;
  summary: Summary;
}

/** Le ultime settimane dell'anno (fino a 16, dalla più recente), contando solo i giorni già passati. */
export function weekRows(data: Insights, limit = 16): Row[] {
  const lastDay = data.today < `${data.year}-12-31` ? data.today : `${data.year}-12-31`;
  let monday = weekStart(lastDay);
  const rows: Row[] = [];
  for (let k = 0; k < limit; k++, monday = addDaysIso(monday, -7)) {
    const days: (Day | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDaysIso(monday, i);
      if (d <= data.today && d.startsWith(String(data.year))) days.push(dayOf(data, d));
    }
    if (!days.length) {
      if (addDaysIso(monday, 6) < `${data.year}-01-01`) break;
      continue;
    }
    rows.push({
      key: monday,
      date: monday,
      year: null,
      from: monday,
      to: addDaysIso(monday, 6),
      summary: summarise(days),
    });
  }
  return rows;
}

/** I mesi dell'anno già iniziati, dal più recente. */
export function monthRows(data: Insights): Row[] {
  const rows: Row[] = [];
  for (let m = 12; m >= 1; m--) {
    const first = `${data.year}-${String(m).padStart(2, '0')}-01`;
    const last = monthEnd(first);
    const days: (Day | null)[] = [];
    for (let d = first; d <= last; d = addDaysIso(d, 1))
      if (d <= data.today) days.push(dayOf(data, d));
    if (!days.length) continue;
    rows.push({
      key: first,
      date: first,
      year: null,
      from: first,
      to: last,
      summary: summarise(days),
    });
  }
  return rows;
}

/** Gli anni a confronto, dal più recente. */
export function yearRows(data: Insights): Row[] {
  return [...data.anni].reverse().map((y) => ({
    key: String(y.anno),
    date: null,
    year: y.anno,
    from: `${y.anno}-01-01`,
    to: `${y.anno}-12-31`,
    summary: {
      giorni: y.giorni,
      scritti: y.scritti,
      parole: y.parole,
      umore: y.umore,
      energia: y.energia,
      pct: y.abitudini_pct,
      fatte: 0,
      pomodori: y.pomodori,
      minuti: y.minuti,
    },
  }));
}
