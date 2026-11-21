import { PXM_MAX, PXM_MIN, naturalPpm, stepIndexFor } from './layout';

/**
 * Il gesto a due dita, ricalcato da `pinch()` in 07_navigazione.js del sito, senza niente di grafico. Sono funzioni
 * semplici che girano sul thread dell'interfaccia (a ogni fotogramma, senza passare da JavaScript):
 * - la densità (pixel per minuto) segue le dita in modo continuo, e da lei si ricava lo scatto;
 * - dalla lista basta un accenno di apertura (×1,05) per rientrare negli orari, a 3 ore;
 * - dalle 3 ore, stringendo oltre l'80 % del minimo, si passa alla lista (una volta sola per gesto);
 * - nessuno degli scatti attraversati si salva: lo si fa alla fine, una volta.
 */
export interface PinchSt {
  /** la scala che le dita avevano quando il gesto (o il suo secondo tratto) è cominciato */
  base: number;
  ppm0: number;
  /** lo scatto di partenza del tratto (indice, 0 = lista) */
  step0: number;
  step: number;
  switched: boolean;
}

export interface PinchMove {
  st: PinchSt;
  ppm: number;
  kind: 'none' | 'density' | 'mode';
}

/** Un numero che non c'è (o non è un numero) non deve mai arrivare a una misura: sul telefono un NaN fa chiudere l'app. */
export function finiteOr(v: unknown, fallback: number): number {
  'worklet';
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function pinchBegin(step: number, ppm: number, scale: number): PinchSt {
  'worklet';
  return {
    base: finiteOr(scale, 1) || 1,
    ppm0: step === 0 ? 0 : finiteOr(ppm, 0),
    step0: step,
    step,
    switched: false,
  };
}

export function pinchMove(st: PinchSt, scale: number): PinchMove {
  'worklet';
  // le dita non hanno dato una scala: si resta dov'è
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return { st, ppm: 0, kind: 'none' };
  const ratio = scale / (st.base || 1);
  if (st.step === 0) {
    if (ratio > 1.05 && !st.switched) {
      // si rientra negli orari al passo più largo e il gesto riparte da qui, come se fosse cominciato sulle 3 ore
      const ppm = naturalPpm(1);
      return {
        st: { base: scale, ppm0: ppm, step0: 1, step: 1, switched: false },
        ppm,
        kind: 'mode',
      };
    }
    return { st, ppm: 0, kind: 'none' };
  }
  const raw = st.ppm0 * ratio;
  if (!st.switched && st.step0 === 1 && raw <= PXM_MIN * 0.8) {
    return { st: { ...st, switched: true, step: 0 }, ppm: 0, kind: 'mode' };
  }
  const ppm = Math.max(PXM_MIN, Math.min(PXM_MAX, raw));
  return { st: { ...st, step: stepIndexFor(ppm) }, ppm, kind: 'density' };
}
