import type { EventView } from './events';
import { minutesOf } from './model';

/**
 * Gli scatti del sito (`ZOOM` in 01_stato_e_server.js): `slot` è il passo in minuti, `h` quanti pixel è alta la
 * fascia a densità naturale (quella che si ottiene premendo il tastino invece di pizzicare). `agenda` = lista.
 */
export const ZOOMS = {
  agenda: { slotMin: 0, slotPx: 0 },
  h3: { slotMin: 180, slotPx: 54 },
  h1: { slotMin: 60, slotPx: 46 },
  m30: { slotMin: 30, slotPx: 44 },
  m15: { slotMin: 15, slotPx: 38 },
  m5: { slotMin: 5, slotPx: 26 },
} as const;
export type Zoom = keyof typeof ZOOMS;

/** Densità naturale di uno scatto: pixel per minuto (0 per la lista). */
export const pxPerMinute = (z: Zoom) => (ZOOMS[z].slotMin ? ZOOMS[z].slotPx / ZOOMS[z].slotMin : 0);

/** Il fondo è la densità dello scatto da tre ore; il tetto è un'ora alta 400 px (come PXM_MIN/PXM_MAX del sito). */
export const PXM_MIN = 54 / 180;
export const PXM_MAX = 400 / 60;

/**
 * Il passo più fitto che a questa densità resta leggibile: la soglia di ogni scatto è la SUA altezza naturale
 * (`scattoPer` del sito). Allargando le dita compaiono da sé gli orari di mezzo.
 */
export function stepFor(pxm: number): Exclude<Zoom, 'agenda'> {
  const order = ['m5', 'm15', 'm30', 'h1'] as const;
  for (const z of order) if (ZOOMS[z].slotMin * pxm >= ZOOMS[z].slotPx) return z;
  return 'h3';
}

/** Quanti passi ci sono fra due etichette «maggiori» (quelle in grassetto): 1 ora → ogni riga, 30' → ogni 2… */
export const majorEvery = (z: Zoom) => {
  const m = ZOOMS[z].slotMin;
  return m >= 60 ? 1 : m === 30 ? 2 : m === 15 ? 4 : 12;
};

/** Un blocco da disegnare nella colonna di un giorno. */
export interface Block {
  ev: EventView;
  top: number; // minuti dall'inizio del giorno
  height: number; // minuti
  col: number;
  cols: number;
}

/** Gli eventi di un giorno che vanno nella fascia in alto (tutto il giorno, o di più giorni). */
export function isBand(ev: EventView): boolean {
  return ev.allDay || ev.multiday;
}

const MIN_BLOCK = 15;

/**
 * Mette in colonna gli eventi che si sovrappongono (come fa la griglia del sito): ognuno prende la prima
 * colonna libera e il gruppo di eventi collegati si divide la larghezza.
 */
export function layoutDay(events: EventView[]): Block[] {
  const items = events
    .filter((e) => !isBand(e))
    .map((ev) => {
      const start = minutesOf(ev.start);
      const end = Math.max(minutesOf(ev.end), start + MIN_BLOCK);
      return { ev, top: start, height: end - start, col: 0, cols: 1, end };
    })
    .sort((a, b) => a.top - b.top || b.end - a.end);

  let cluster: typeof items = [];
  let clusterEnd = -1;
  const close = () => {
    const cols = cluster.reduce((m, b) => Math.max(m, b.col + 1), 1);
    for (const b of cluster) b.cols = cols;
    cluster = [];
  };
  const colEnds: number[] = [];
  for (const b of items) {
    if (cluster.length && b.top >= clusterEnd) {
      close();
      colEnds.length = 0;
    }
    let c = colEnds.findIndex((e) => e <= b.top);
    if (c < 0) c = colEnds.length;
    colEnds[c] = b.end;
    b.col = c;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) close();
  return items.map(({ ev, top, height, col, cols }) => ({ ev, top, height, col, cols }));
}

/** Di quanti minuti scatta un evento trascinato: quanto la griglia (5, 15 o 30 minuti; con gli zoom larghi 30). */
export function snapMinutes(z: Zoom): number {
  return z === 'm5' ? 5 : z === 'm15' ? 15 : 30;
}

/**
 * Dove cade un evento trascinato: l'inizio di prima più lo spostamento del dito (in pixel), a scatti, tenuto dentro il giorno
 * (l'evento non esce dalla mezzanotte: come `event_move` del sito, la fine non supera le 23:59).
 */
export function dropMinute(
  startMin: number,
  durationMin: number,
  dyPx: number,
  ppm: number,
  snap: number,
): number {
  const raw = startMin + dyPx / ppm;
  const snapped = Math.round(raw / snap) * snap;
  return Math.max(0, Math.min(1439 - durationMin, snapped));
}
