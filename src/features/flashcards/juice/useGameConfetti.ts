import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { cancelLater, later, newBurst, type Burst } from '@/features/habits/Confetti';

/** I colori della festa del gioco (quelli del sito). */
export const GAME_COLORS = [
  '#BF5AF2',
  '#0A84FF',
  '#30D158',
  '#FFD60A',
  '#FF9F0A',
  '#FF375F',
  '#64D2FF',
];

/**
 * I coriandoli di una partita: `fire(n)` lancia tre scoppi di colori diversi dal centro-alto dello schermo, uno dopo
 * l'altro. Lo strato lo disegna `<Confetti bursts={bursts} onDone={done} />`.
 */
export function useGameConfetti() {
  const { width, height } = useWindowDimensions();
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => cancelLater, []);

  const fire = useCallback(
    (n: number) => {
      const each = Math.max(20, Math.round(n / 3));
      const spots: [number, number, string, number][] = [
        [width * 0.5, height * 0.34, GAME_COLORS[0]!, 0],
        [width * 0.25, height * 0.4, GAME_COLORS[3]!, 140],
        [width * 0.75, height * 0.4, GAME_COLORS[2]!, 260],
      ];
      for (const [x, y, color, delay] of spots) {
        const add = () => setBursts((cur) => [...cur, newBurst(x, y, color, each)]);
        if (delay === 0) add();
        else later(add, delay);
      }
    },
    [width, height],
  );

  const done = useCallback((id: number) => setBursts((cur) => cur.filter((b) => b.id !== id)), []);
  const clear = useCallback(() => {
    cancelLater();
    setBursts([]);
  }, []);
  return { bursts, fire, done, clear };
}
