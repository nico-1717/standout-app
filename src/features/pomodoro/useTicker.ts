import { useEffect, useRef, useState } from 'react';

/**
 * L'ora che scorre (solo se `on`): si aggiorna ogni `everyMs` (come sul sito, dove il quadrante batte ogni 250 ms, così
 * l'anello e la scintilla si muovono davvero) e, una volta al secondo, fa girare `onTick` (chiude i timer scaduti).
 */
export function useTicker(on: boolean, onTick: (nowMs: number) => void, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  const tick = useRef(onTick);
  const lastSecond = useRef(0);
  useEffect(() => {
    tick.current = onTick;
  });
  useEffect(() => {
    const run = () => {
      const n = Date.now();
      setNow(n);
      const second = Math.floor(n / 1000);
      if (second === lastSecond.current) return;
      lastSecond.current = second;
      tick.current(n);
    };
    const first = setTimeout(run, 0);
    if (!on) return () => clearTimeout(first);
    const id = setInterval(run, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [on, everyMs]);
  return now;
}
