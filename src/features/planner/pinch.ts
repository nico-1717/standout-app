import { PXM_MAX, PXM_MIN, ZOOMS, pxPerMinute, stepFor, type Zoom } from './layout';

/** Il minuto che sta sotto le dita al primo tocco e a che altezza dello schermo (si tiene inchiodato lì). */
export interface Anchor {
  min: number;
  y: number;
}

export type PinchChange =
  | { kind: 'none' }
  | { kind: 'density'; pxm: number; step: Zoom; stepChanged: boolean }
  | { kind: 'mode'; step: Zoom; pxm: number };

/**
 * Il gesto a due dita, ricalcato da `pinch()` in 07_navigazione.js del sito, senza niente di grafico:
 * - la densità (pixel per minuto) segue le dita in modo continuo, e da lei si ricava lo scatto;
 * - dalla lista basta un accenno di apertura (×1,05) per rientrare negli orari, a 3 ore;
 * - dalle 3 ore, stringendo oltre l'80 % del minimo, si passa alla lista (una volta sola per gesto);
 * - nessuno degli scatti attraversati si salva: lo si fa alla fine, una volta.
 */
export class PinchGesture {
  private startDist = 1;
  private pxm0 = 0;
  private step0: Zoom = 'm30';
  private switched = false;
  private lastStep: Zoom = 'm30';
  readonly startedAt: Zoom;
  anchor: Anchor;

  constructor(dist: number, step: Zoom, pxm: number, anchor: Anchor) {
    this.startDist = dist || 1;
    this.step0 = step;
    this.startedAt = step;
    this.lastStep = step;
    this.pxm0 = step === 'agenda' ? 0 : pxm;
    this.anchor = anchor;
  }

  get step(): Zoom {
    return this.lastStep;
  }

  move(dist: number): PinchChange {
    const ratio = dist / (this.startDist || 1);
    if (this.lastStep === 'agenda') {
      if (ratio > 1.05 && !this.switched) {
        // si rientra negli orari al passo più largo e il gesto riparte da qui, come se fosse cominciato sulle 3 ore
        const pxm = pxPerMinute('h3');
        this.startDist = dist || 1;
        this.pxm0 = pxm;
        this.step0 = 'h3';
        this.lastStep = 'h3';
        this.switched = false;
        return { kind: 'mode', step: 'h3', pxm };
      }
      return { kind: 'none' };
    }
    const pxm = this.pxm0 * ratio;
    if (!this.switched && this.step0 === 'h3' && pxm <= PXM_MIN * 0.8) {
      this.switched = true;
      this.lastStep = 'agenda';
      return { kind: 'mode', step: 'agenda', pxm: 0 };
    }
    const clamped = Math.max(PXM_MIN, Math.min(PXM_MAX, pxm));
    const step = stepFor(clamped);
    const stepChanged = step !== this.lastStep;
    this.lastStep = step;
    return { kind: 'density', pxm: clamped, step, stepChanged };
  }

  /** Lo scatto da salvare alla fine, se è cambiato rispetto a quando si è cominciato. */
  result(): Zoom | null {
    return this.lastStep !== this.startedAt ? this.lastStep : null;
  }
}

export const ZOOM_KEYS = Object.keys(ZOOMS) as Zoom[];
