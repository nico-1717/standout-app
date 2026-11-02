import type { EventView } from './events';
import { minutesOf } from './model';

/** Pixel per minuto a ogni zoom: la fascia «30 min» è alta 44px (--slot-h del sito). */
export const ZOOMS = {
  agenda: { slotMin: 60, slotPx: 56 },
  h3: { slotMin: 180, slotPx: 44 },
  h1: { slotMin: 60, slotPx: 44 },
  m30: { slotMin: 30, slotPx: 44 },
  m15: { slotMin: 15, slotPx: 44 },
  m5: { slotMin: 5, slotPx: 44 },
} as const;
export type Zoom = keyof typeof ZOOMS;

export const pxPerMinute = (z: Zoom) => ZOOMS[z].slotPx / ZOOMS[z].slotMin;

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
