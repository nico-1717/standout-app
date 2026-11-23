import { useCallback, useEffect, useRef } from 'react';
import { usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/ui/motion';

import { ROW_H } from './calendarGrid';

/** Le caselle del mese: 6 settimane da 7 giorni. */
export const CELLS = 42;
/** Quanto deve spostarsi il dito di lato prima che si prenda il gesto; sotto, la pagina scorre in verticale. */
const GRAB_X = 10;
const LEAVE_Y = 14;

/** 0 = il dito non c'è passato, 1 = si sta accendendo, 2 = si sta spegnendo. */
export type Preview = SharedValue<number[]>;

function put<T>(sv: { value: T }, v: T) {
  'worklet';
  sv.value = v;
}

function blank(): number[] {
  'worklet';
  const a: number[] = [];
  for (let i = 0; i < CELLS; i++) a.push(0);
  return a;
}

export interface PaintOptions {
  /** spento con «Guarda» o senza un progetto scelto: il gesto non parte e la pagina scorre */
  enabled: boolean;
  /** «Cancella»: si spegne sempre, qualunque sia il primo giorno */
  erase: boolean;
  /** le 42 date della griglia */
  cells: string[];
  /** i giorni evidenziati del progetto scelto */
  painted: ReadonlySet<string>;
  today: string;
  /** a dito sollevato: i giorni che cambiano davvero */
  onCommit: (mode: 'add' | 'remove', days: string[]) => void;
}

/**
 * L'evidenziatore a trascinamento (bindPaint del sito), tutto sul thread dell'interfaccia: la casella sotto il dito si
 * accende subito, senza passare da JavaScript (prima ogni passo faceva un giro per React, e lo si sentiva a scatti).
 * JavaScript sa qualcosa solo a gesto finito, con i giorni da salvare. Il primo giorno toccato decide se si accende o si
 * spegne, e vale per tutto il gesto. Se il dito salta più caselle in un movimento, quelle in mezzo si prendono lo stesso.
 *
 * Un tocco fermo lo gestisce la casella; un trascinamento verticale lascia scorrere la pagina (failOffsetY).
 */
export function usePaintGesture(o: PaintOptions) {
  const preview = useSharedValue<number[]>(blank());
  const mask = useSharedValue<number[]>(blank());
  const minIdx = useSharedValue(0);
  const erase = useSharedValue(0);
  const width = useSharedValue(0);
  const mode = useSharedValue(0);
  const start = useSharedValue({ x: 0, y: 0 });
  const last = useSharedValue({ x: 0, y: 0 });

  const latest = useRef(o);
  useEffect(() => {
    latest.current = o;
  });

  // quello che il gesto deve sapere: dove sono i giorni evidenziati, da quando si può disegnare
  useEffect(() => {
    put(
      mask,
      o.cells.map((d) => (o.painted.has(d) ? 1 : 0)),
    );
    const i = o.cells.findIndex((d) => d >= o.today);
    put(minIdx, i < 0 ? CELLS : i);
    put(erase, o.erase ? 1 : 0);
    // il salvataggio è arrivato (o si è cambiato mese): l'anteprima ha fatto il suo lavoro
    put(preview, blank());
  }, [o.cells, o.painted, o.today, o.erase, mask, minIdx, erase, preview]);

  const commit = useCallback(
    (m: number, idx: number[]) => {
      const cur = latest.current;
      haptic.tap();
      cur.onCommit(
        m === 2 ? 'remove' : 'add',
        idx.map((i) => cur.cells[i]).filter((d): d is string => !!d),
      );
      // rete di sicurezza: se per qualche motivo il salvataggio non cambia nulla, l'anteprima non resta appesa
      setTimeout(() => put(preview, blank()), 700);
    },
    [preview],
  );
  const grabbed = useCallback(() => haptic.select(), []);

  /** Segna la casella sotto il punto, se si può disegnare lì e non l'ha già presa questo gesto. */
  function mark(x: number, y: number) {
    'worklet';
    const w = width.value;
    if (w <= 0 || x < 0 || y < 0 || x >= w) return;
    const row = Math.floor(y / ROW_H);
    if (row > 5) return;
    const i = row * 7 + Math.floor((x / w) * 7);
    if (i < minIdx.value || preview.value[i] !== 0) return;
    const next = preview.value.slice();
    next[i] = mode.value;
    put(preview, next);
  }

  /** Dal punto di prima a questo, a piccoli passi: un dito veloce non lascia buchi. */
  function visit(x: number, y: number) {
    'worklet';
    const from = last.value;
    const dist = Math.sqrt((x - from.x) * (x - from.x) + (y - from.y) * (y - from.y));
    const step = Math.max(8, width.value / 21);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let k = 1; k <= n; k++)
      mark(from.x + ((x - from.x) * k) / n, from.y + ((y - from.y) * k) / n);
    put(last, { x, y });
  }

  const pan = usePanGesture({
    enabled: o.enabled,
    maxPointers: 1,
    activeOffsetX: [-GRAB_X, GRAB_X],
    failOffsetY: [-LEAVE_Y, LEAVE_Y],
    onBegin: (e) => {
      'worklet';
      put(start, { x: e.x, y: e.y });
    },
    onActivate: (e) => {
      'worklet';
      const w = width.value;
      const s = start.value;
      const col = Math.floor((s.x / w) * 7);
      const row = Math.floor(s.y / ROW_H);
      const first = w > 0 && s.x >= 0 && s.y >= 0 && col <= 6 && row <= 5 ? row * 7 + col : -1;
      const was = first >= 0 && mask.value[first] === 1;
      put(mode, erase.value === 1 ? 2 : was ? 2 : 1);
      put(preview, blank());
      put(last, s);
      scheduleOnRN(grabbed);
      visit(s.x, s.y);
      visit(e.x, e.y);
    },
    onUpdate: (e) => {
      'worklet';
      visit(e.x, e.y);
    },
    onDeactivate: (e) => {
      'worklet';
      const changed: number[] = [];
      for (let i = 0; i < CELLS; i++) {
        const p = preview.value[i];
        if ((p === 1 && mask.value[i] === 0) || (p === 2 && mask.value[i] === 1)) changed.push(i);
      }
      if (e.canceled || !changed.length) put(preview, blank());
      else scheduleOnRN(commit, mode.value, changed);
    },
  });

  const setWidth = useCallback((w: number) => put(width, w), [width]);
  return { gesture: pan, preview, setWidth };
}
