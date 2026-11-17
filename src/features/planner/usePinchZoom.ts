import { useEffect, useLayoutEffect, useState } from 'react';
import { PanResponder, type GestureResponderHandlers } from 'react-native';

import { haptic } from '@/ui/motion';

import { pxPerMinute, stepFor, type Zoom } from './layout';
import { PinchGesture, type Anchor } from './pinch';

interface Live {
  pxm: number;
  step: Zoom;
  pinching: boolean;
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
 * La densità degli orari: continua mentre si pizzica, e lo scatto si ricava da lei. Fuori dal gesto vale quella
 * naturale dello scatto salvato. `anchor` tiene fermo l'orario che c'era sotto le dita.
 */
export function usePinchZoom(zoom: Zoom, hooks: Hooks) {
  const [live, setLive] = useState<Live | null>(null);
  const valid = live && (live.pinching || live.step === zoom);
  const step: Zoom = valid ? live.step : zoom;
  const ppm = valid ? live.pxm : pxPerMinute(zoom);
  const [ctl] = useState(
    () =>
      new PinchController(
        hooks,
        () => ({ step: 'm30', ppm: 0 }),
        (l) => setLive(l),
      ),
  );
  useEffect(() => {
    ctl.update(hooks, () => ({ step, ppm }));
  });
  // dopo ogni cambio di densità l'orario agganciato torna dov'era (due volte: la lunghezza nuova arriva un attimo dopo)
  useLayoutEffect(() => {
    const a = ctl.pending;
    if (!a) return;
    hooks.restore(a, ppm);
    const id = requestAnimationFrame(() => hooks.restore(a, ppm));
    return () => cancelAnimationFrame(id);
    // `hooks` cambia a ogni rendering: conta solo la densità
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppm, ctl]);

  /** Dal tastino della rotellina: si torna alla densità naturale di quello scatto. */
  const choose = (z: Zoom, anchor: Anchor) => {
    const target = pxPerMinute(z);
    ctl.hold(anchor);
    setLive({ pxm: target, step: z === 'agenda' ? 'agenda' : stepFor(target), pinching: false });
    hooks.save(z);
  };
  return {
    ppm,
    step,
    pinching: !!live?.pinching,
    panHandlers: ctl.responder.panHandlers as GestureResponderHandlers,
    choose,
  };
}
