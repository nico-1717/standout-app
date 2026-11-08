import { useEffect, useState } from 'react';
import { PanResponder } from 'react-native';

import { haptic } from '@/ui/motion';

interface Callbacks {
  /** il trascinamento è finito con questo spostamento in pixel */
  onDrop: (dy: number) => void;
  /** il blocco è «in mano» al dito (la pagina non deve scorrere) o è stato lasciato */
  onActive: (active: boolean) => void;
}

/**
 * Il gesto di un evento mosso a mano: un tocco lungo lo «arma», poi il movimento è del blocco e non della pagina.
 * Sta in una classe (come `DragGesture` del riordino) perché il responder vive fuori dal rendering.
 */
class MoveGesture {
  private armed = false;
  private grabbed = false;
  readonly responder;

  constructor(
    private cb: Callbacks,
    private readonly setDy: (dy: number | null) => void,
  ) {
    const finish = (d: number) => {
      const wasArmed = this.armed;
      this.armed = false;
      this.grabbed = false;
      this.setDy(null);
      this.cb.onActive(false);
      if (wasArmed) this.cb.onDrop(d);
    };
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // preso il tocco lungo, il movimento è del blocco anche se un figlio (il Pressable) tiene già il gesto
      onMoveShouldSetPanResponderCapture: () => this.armed,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        this.grabbed = true;
      },
      onPanResponderMove: (_e, g) => this.setDy(g.dy),
      onPanResponderRelease: (_e, g) => finish(g.dy),
      onPanResponderTerminate: (_e, g) => finish(g.dy),
    });
  }

  update(cb: Callbacks) {
    this.cb = cb;
  }

  arm() {
    this.armed = true;
    this.grabbed = false;
    this.setDy(0);
    this.cb.onActive(true);
    haptic.select();
  }

  /** Un tocco lungo lasciato senza muoversi non sposta nulla. */
  release() {
    setTimeout(() => {
      if (this.armed && !this.grabbed) {
        this.armed = false;
        this.setDy(null);
        this.cb.onActive(false);
      }
    }, 0);
  }
}

/**
 * Spostare un evento con un tocco lungo e poi il trascinamento (come sul sito: 300 ms fermi, poi il blocco segue il dito).
 * Ritorna `dy` (null = nessun trascinamento in corso), `arm` e `release` per il Pressable e i `panHandlers`.
 */
export function useEventDrag(cb: Callbacks) {
  const [dy, setDy] = useState<number | null>(null);
  const [gesture] = useState(() => new MoveGesture(cb, setDy));
  useEffect(() => {
    gesture.update(cb);
  });
  return {
    dy,
    panHandlers: gesture.responder.panHandlers,
    arm: () => gesture.arm(),
    release: () => gesture.release(),
  };
}
