import { useEffect, useState } from 'react';
import { PanResponder } from 'react-native';

import { haptic } from '@/ui/motion';

/**
 * Dove cade il blocco che si sta posando con il dito (`growGhost` del sito). Un'abitudine ha la sua durata e trascinando
 * si SPOSTA (`fixed` = i suoi minuti); tutto il resto parte dal punto premuto e si ALLUNGA col dito, mai sotto uno scatto.
 */
export function placeRange(o: {
  /** dove si è premuto, in pixel dall'inizio del giorno */
  y0: number;
  /** quanto il dito si è mosso, in pixel */
  dy: number;
  ppm: number;
  /** i minuti di un blocco di durata fissa (l'abitudine), altrimenti null */
  fixed: number | null;
  /** lo scatto dei minuti (5, 15, 30) e quello della riga */
  snap: number;
  slot: number;
}): { start: number; end: number } {
  const ppm = o.ppm || 1;
  const down = o.y0 / ppm;
  const now = (o.y0 + o.dy) / ppm;
  if (o.fixed !== null) {
    const dur = Math.max(1, Math.min(1440, o.fixed));
    const start = Math.max(0, Math.min(1440 - dur, Math.floor(now / o.snap) * o.snap));
    return { start, end: start + dur };
  }
  const slot = Math.min(o.slot, 60);
  const start = Math.max(0, Math.min(1440 - slot, Math.floor(down / slot) * slot));
  const end = Math.max(start + slot, Math.min(1440, Math.ceil(now / o.snap) * o.snap));
  return { start, end };
}

interface Callbacks {
  /** il dito è stato alzato: il punto premuto e di quanto si è mosso (pixel) */
  onDrop: (y0: number, dy: number) => void;
  /** il blocco è in mano al dito (la pagina non deve scorrere) o è stato lasciato */
  onActive: (active: boolean) => void;
}

export type PlacePos = { y0: number; dy: number };

/** Tocco lungo su un punto libero della griglia, poi il dito comanda il blocco fino a quando lo si lascia. */
class PlaceGesture {
  private armed = false;
  private grabbed = false;
  private y0 = 0;
  readonly responder;

  constructor(
    private cb: Callbacks,
    private readonly setPos: (p: PlacePos | null) => void,
  ) {
    const finish = (dy: number) => {
      const wasArmed = this.armed;
      this.armed = false;
      this.grabbed = false;
      this.setPos(null);
      this.cb.onActive(false);
      if (wasArmed) this.cb.onDrop(this.y0, dy);
    };
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: () => this.armed,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        this.grabbed = true;
      },
      onPanResponderMove: (_e, g) => this.setPos({ y0: this.y0, dy: g.dy }),
      onPanResponderRelease: (_e, g) => finish(g.dy),
      onPanResponderTerminate: (_e, g) => finish(g.dy),
    });
  }

  update(cb: Callbacks) {
    this.cb = cb;
  }

  arm(y0: number) {
    this.armed = true;
    this.grabbed = false;
    this.y0 = y0;
    this.setPos({ y0, dy: 0 });
    this.cb.onActive(true);
    haptic.select();
  }

  /** Alzato senza essersi mosso: il tocco lungo vale come un tocco, il blocco si posa dov'è. */
  release() {
    setTimeout(() => {
      if (this.armed && !this.grabbed) {
        this.armed = false;
        this.setPos(null);
        this.cb.onActive(false);
        this.cb.onDrop(this.y0, 0);
      }
    }, 0);
  }
}

export function useGridPlace(cb: Callbacks) {
  const [pos, setPos] = useState<PlacePos | null>(null);
  const [gesture] = useState(() => new PlaceGesture(cb, setPos));
  useEffect(() => {
    gesture.update(cb);
  });
  return {
    pos,
    panHandlers: gesture.responder.panHandlers,
    arm: (y0: number) => gesture.arm(y0),
    release: () => gesture.release(),
  };
}
