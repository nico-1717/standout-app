import { useEffect, useRef, useState } from 'react';

/** L'ora che scorre: si aggiorna ogni secondo (solo se `on`) e, a ogni battito, fa girare `onTick` (chiude i timer scaduti). */
export function useTicker(on: boolean, onTick: (nowMs: number) => void): number {
  const [now, setNow] = useState(() => Date.now());
  const tick = useRef(onTick);
  useEffect(() => {
    tick.current = onTick;
  });
  useEffect(() => {
    const run = () => {
      const n = Date.now();
      setNow(n);
      tick.current(n);
    };
    const first = setTimeout(run, 0);
    if (!on) return () => clearTimeout(first);
    const id = setInterval(run, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [on]);
  return now;
}
