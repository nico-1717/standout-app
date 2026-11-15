import { useEffect, useState } from 'react';
import { PanResponder, type GestureResponderHandlers } from 'react-native';

/**
 * Un tratto orizzontale sulla pagina cambia giorno (o settimana, o mese): come scorrere sul sito. Sta in una classe
 * (come `MoveGesture`) perché il responder vive fuori dal rendering. I tratti più verticali che orizzontali non contano.
 */
class DaySwipe {
  readonly responder;

  constructor(private step: (delta: number) => void) {
    this.responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -64) this.step(1);
        else if (g.dx >= 64) this.step(-1);
      },
    });
  }

  update(step: (delta: number) => void) {
    this.step = step;
  }
}

export function useDaySwipe(step: (delta: number) => void): GestureResponderHandlers {
  const [swipe] = useState(() => new DaySwipe(step));
  useEffect(() => {
    swipe.update(step);
  });
  return swipe.responder.panHandlers;
}
