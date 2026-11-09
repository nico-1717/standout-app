import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** Un numero che sale da 0 al valore in `ms` (con «Riduci movimento» compare già finito). */
export function useCountUp(target: number, ms = 700, decimals = 0): number {
  const still = useReducedMotion();
  // quanto del cammino è fatto, per quale valore: un valore nuovo riparte da zero senza toccare lo stato nell'effetto
  const [run, setRun] = useState({ target, x: 0 });
  useEffect(() => {
    if (still || target <= 0) return;
    const start = Date.now();
    const id = setInterval(() => {
      const x = Math.min(1, (Date.now() - start) / ms);
      setRun({ target, x });
      if (x >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [target, ms, still]);
  if (still || target <= 0) return target;
  const x = run.target === target ? run.x : 0;
  const eased = 1 - Math.pow(1 - x, 3);
  const f = 10 ** decimals;
  return Math.round(target * eased * f) / f;
}
