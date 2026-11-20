import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PanResponder, type GestureResponderHandlers } from 'react-native';

import { haptic } from '@/ui/motion';

import { pxPerMinute, stepFor, type Zoom } from './layout';
import { PinchGesture, type Anchor } from './pinch';

interface Live {
  pxm: number;
  step: Zoom;
  pinching: boolean;
}

/**
 * Dove sta il pizzico adesso. Sta fuori da React: ogni movimento delle dita cambia la densità, ma a ridisegnarsi è solo
 * la griglia dell'ora (`usePinchPpm`); il resto della pagina si rifà soltanto quando cambia lo scatto o il gesto
 * comincia e finisce (`coarse`).
 */
export class PinchStore {
  live: Live | null = null;
  private listeners = new Set<() => void>();
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  snapshot = () => this.live;
  /** Le sole parti che interessano a tutta la pagina: lo scatto e se si sta pizzicando. */
  coarse = () => (this.live ? `${this.live.step}|${this.live.pinching ? 1 : 0}` : '-');
  set(next: Live | null) {
    const a = this.live;
    // stesso valore di prima (le dita fermano la densità contro il limite): niente da ridisegnare
    if (a && next && a.pxm === next.pxm && a.step === next.step && a.pinching === next.pinching)
      return;
    this.live = next;
    this.listeners.forEach((l) => l());
  }
}

/** La densità (pixel per minuto) da usare: quella viva mentre si pizzica o finché lo scatto salvato non la raggiunge. */
export function ppmOf(live: Live | null, zoom: Zoom): number {
  return live && (live.pinching || live.step === zoom) ? live.pxm : pxPerMinute(zoom);
}

interface Hooks {
  /** il minuto che sta sotto il punto dello schermo (pageY) a questa densità, e a che altezza della vista */
  anchorAt: (pageY: number, ppm: number) => Anchor;
  /** riporta quel minuto a quell'altezza a densità `ppm` */
  restore: (anchor: Anchor, ppm: number) => void;
  /** lo scatto da salvare, una volta sola, quando le dita si alzano */
  save: (zoom: Zoom) => void;
}

const dist = (t: readonly { pageX: number; pageY: number }[]) =>
  Math.hypot(t[0]!.pageX - t[1]!.pageX, t[0]!.pageY - t[1]!.pageY);

/**
 * Il gesto a due dita sulla giornata (`pinch()` del sito): vive in una classe perché il responder sta fuori dal
 * rendering. Cattura i tocchi solo quando le dita sono due, quindi scorrere con uno, toccare e trascinare un evento
 * o cambiare giorno con uno strisciata restano come prima.
 */
class PinchController {
  readonly responder;
  private gesture: PinchGesture | null = null;
  pending: Anchor | null = null;

  hold(anchor: Anchor) {
    this.pending = anchor;
  }
  private ppm = 0;

  constructor(
    private hooks: Hooks,
    private read: () => { step: Zoom; ppm: number },
    private set: (live: Live | null) => void,
  ) {
    const two = (e: { nativeEvent: { touches: readonly unknown[] } }) =>
      e.nativeEvent.touches.length === 2;
    this.responder = PanResponder.create({
      onStartShouldSetPanResponderCapture: two,
      onMoveShouldSetPanResponderCapture: two,
      onPanResponderTerminationRequest: () => !this.gesture,
      onPanResponderGrant: (e) => this.touch(e.nativeEvent.touches),
      onPanResponderMove: (e) => this.touch(e.nativeEvent.touches),
      onPanResponderEnd: (e) => {
        if (e.nativeEvent.touches.length < 2) this.end();
      },
      onPanResponderTerminate: () => this.end(),
    });
  }

  update(hooks: Hooks, read: () => { step: Zoom; ppm: number }) {
    this.hooks = hooks;
    this.read = read;
  }

  private touch(raw: readonly { pageX: number; pageY: number }[]) {
    if (raw.length < 2) return;
    const d = dist(raw);
    if (!this.gesture) {
      const cur = this.read();
      const mid = (raw[0]!.pageY + raw[1]!.pageY) / 2;
      const anchor = this.hooks.anchorAt(mid, cur.ppm);
      this.gesture = new PinchGesture(d, cur.step, cur.ppm, anchor);
      this.ppm = cur.ppm;
      this.set({ pxm: cur.ppm, step: cur.step, pinching: true });
      return;
    }
    const c = this.gesture.move(d);
    if (c.kind === 'none') return;
    this.pending = this.gesture.anchor;
    this.ppm = c.pxm;
    this.set({ pxm: c.pxm, step: c.step, pinching: true });
    if (c.kind === 'mode' || c.stepChanged) haptic.select();
  }

  private end() {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    const saved = g.result();
    if (saved) this.hooks.save(saved);
    this.set({ pxm: this.ppm, step: g.step, pinching: false });
  }
}

/**
 * Lo scatto e il gesto: lo scatto si ricava dalla densità continua che segue le dita. Fuori dal gesto vale quella
 * naturale dello scatto salvato. `anchor` tiene fermo l'orario che c'era sotto le dita.
 * La densità stessa non è qui (vedi `PinchStore`): chi la disegna la legge con `usePinchPpm`.
 */
export function usePinchZoom(zoom: Zoom, hooks: Hooks) {
  const [store] = useState(() => new PinchStore());
  const key = useSyncExternalStore(store.subscribe, store.coarse);
  const [liveStep, liveFlag] = key.split('|');
  const pinching = liveFlag === '1';
  const valid = key !== '-' && (pinching || liveStep === zoom);
  const step: Zoom = valid ? (liveStep as Zoom) : zoom;
  const zoomNow = useRef(zoom);
  const [ctl] = useState(
    () =>
      new PinchController(
        hooks,
        () => ({ step: 'm30', ppm: 0 }),
        (l) => store.set(l),
      ),
  );
  useEffect(() => {
    zoomNow.current = zoom;
    ctl.update(hooks, () => ({ step, ppm: ppmOf(store.live, zoomNow.current) }));
  });

  /** La densità di adesso, per chi non si ridisegna con lei. */
  const getPpm = () => ppmOf(store.live, zoomNow.current);

  /** Dal tastino della rotellina: si torna alla densità naturale di quello scatto. */
  const choose = (z: Zoom, anchor: Anchor) => {
    const target = pxPerMinute(z);
    ctl.hold(anchor);
    store.set({ pxm: target, step: z === 'agenda' ? 'agenda' : stepFor(target), pinching: false });
    hooks.save(z);
  };

  /** Dopo ogni cambio di densità l'orario agganciato torna dov'era (due volte: la lunghezza nuova arriva un attimo dopo). */
  const afterCommit = (ppm: number) => {
    const a = ctl.pending;
    if (!a) return undefined;
    hooks.restore(a, ppm);
    const id = requestAnimationFrame(() => hooks.restore(a, ppm));
    return () => cancelAnimationFrame(id);
  };

  return {
    step,
    pinching,
    store,
    getPpm,
    afterCommit,
    panHandlers: ctl.responder.panHandlers as GestureResponderHandlers,
    choose,
  };
}

export type PinchApi = ReturnType<typeof usePinchZoom>;

/**
 * La densità per la griglia dell'ora: si ridisegna a ogni movimento delle dita, da sola. Il giorno su cui sono
 * le dita (`current`) riporta l'orario agganciato dov'era dopo ogni cambio.
 */
export function usePinchPpm(pinch: PinchApi, zoom: Zoom, current: boolean): number {
  const live = useSyncExternalStore(pinch.store.subscribe, pinch.store.snapshot);
  const ppm = ppmOf(live, zoom);
  useLayoutEffect(
    () => (current ? pinch.afterCommit(ppm) : undefined),
    // `pinch` cambia a ogni rendering: conta solo la densità
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ppm, current],
  );
  return ppm;
}
