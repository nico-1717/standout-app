import months from './months.json';

/**
 * La scena del mese (planner_ambient.json + 02_fascia_alta.js del sito), qui senza disegnare niente:
 * decide quali pezzi ci sono e dove stanno. Il caso del sito è `Math.random()`; qui un generatore con seme,
 * così la scena di un mese è sempre la stessa e si può provare.
 */

export type ParticleType = 'snow' | 'petal' | 'leaf' | 'seed' | 'rain' | 'mote' | 'star';
export type DrifterType =
  'butterfly' | 'bee' | 'ladybug' | 'dragonfly' | 'firefly' | 'bird' | 'swallow';

type ParticleCfg = {
  type: ParticleType;
  count?: number;
  colors?: string[];
  size?: [number, number];
  duration?: [number, number];
  sway?: number;
};
type DrifterCfg = {
  type: DrifterType;
  count?: number;
  color?: string;
  duration?: number;
  size?: number;
};

export type MonthCfg = {
  label: string;
  tree: string;
  animal?: string;
  treeColor?: string;
  animalColor?: string;
  particles?: ParticleCfg[];
  drifters?: DrifterCfg[];
  sky?: [string, string];
};

export function monthConfig(month: number): MonthCfg | null {
  const all = months.months as unknown as Record<string, MonthCfg>;
  return all[String(month)] ?? null;
}

/** mulberry32: numeri «a caso» sempre uguali per lo stesso seme. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Particle = {
  type: ParticleType;
  /** posizione orizzontale in % della larghezza */
  left: number;
  size: number;
  color: string;
  /** secondi per un giro */
  duration: number;
  /** a che punto del giro parte, da 0 a 1 */
  phase: number;
  sway: number;
  /** solo le stelle, ferme: quanto in alto, in % */
  top: number;
};

export type Drifter = {
  type: DrifterType;
  /** in % dell'altezza */
  top: number;
  size: number;
  color: string;
  duration: number;
  phase: number;
  /** secondi del saliscendi */
  bob: number;
};

const between = (r: () => number, a: number, b: number) => a + r() * (b - a);

export function buildParticles(cfg: MonthCfg, seed: number): Particle[] {
  const r = rng(seed);
  const out: Particle[] = [];
  for (const p of cfg.particles ?? []) {
    const still = p.type === 'star';
    const colors = p.colors?.length ? p.colors : ['#FFFFFF'];
    for (let n = 0; n < (p.count ?? 8); n++) {
      const dur = still
        ? between(r, 3, 6)
        : between(r, p.duration?.[0] ?? 16, p.duration?.[1] ?? 26);
      out.push({
        type: p.type,
        left: between(r, -2, 98),
        size: between(r, p.size?.[0] ?? 4, p.size?.[1] ?? 8),
        color: colors[n % colors.length] ?? '#FFFFFF',
        duration: dur,
        phase: r(),
        sway: between(r, -(p.sway ?? 20), p.sway ?? 20),
        top: still ? between(r, 6, 62) : 0,
      });
    }
  }
  return out;
}

export function buildDrifters(cfg: MonthCfg, seed: number): Drifter[] {
  const r = rng(seed ^ 0x9e3779b9);
  const out: Drifter[] = [];
  for (const d of cfg.drifters ?? []) {
    for (let n = 0; n < (d.count ?? 1); n++) {
      out.push({
        type: d.type,
        top: between(r, 8, 62),
        size: d.size ?? 15,
        color: d.color ?? '#B7AEA3',
        duration: (d.duration ?? 42) + between(r, -6, 6),
        phase: r(),
        bob: between(r, 2.4, 4.2),
      });
    }
  }
  return out;
}

/** Chi cammina e chi vola (02_fascia_alta.js): gli altri animali stanno fermi. */
export const WALKERS = ['cane', 'tartaruga', 'riccio'];
export const FLYERS = ['slitta'];

/** Posizione e misura di ogni animale (le «manopole» `--bestia-*` di planner_base.css). */
export type AnimalBox = { x: number; down: number; w: number; h: number };
const BASE_BOX: AnimalBox = { x: 62, down: 2, w: 38, h: 34 };
const BOXES: Record<string, Partial<AnimalBox>> = {
  cane: { down: -5, w: 46, h: 40 },
  tartaruga: { down: -3, w: 33, h: 30 },
  riccio: { down: -3, w: 30, h: 20 },
  gatto_dorme: { x: 33, down: -2, w: 48, h: 22 },
  slitta: { w: 70, h: 45 },
  scoiattolo: { x: 40, down: -4, w: 55, h: 27 },
  criceto: { x: 20, down: -5, w: 55, h: 27 },
  anatra: { x: 37, down: -5, w: 50, h: 23 },
  coniglio: { x: 30, down: -5, w: 55, h: 27 },
  talpa: { x: 33, down: -7, w: 40, h: 22 },
  pinguino: { x: 35, down: -5, w: 55, h: 27 },
  volpe: { x: 35, down: -5, w: 55, h: 27 },
};
export const animalBox = (name: string): AnimalBox => ({ ...BASE_BOX, ...BOXES[name] });

/** L'albero: un riquadro che si stira (mask-size 100% 100%), il tronco cade al 34% della larghezza. */
export const TREE_BOX = { x: 34, w: 190, h: 160, down: -32 };

/** Quanto è visibile la scena: la barra delle impostazioni va da 0 a 10, di partenza 9. */
export const ambientOpacity = (setting: number | undefined): number =>
  Math.max(0, Math.min(10, setting ?? 9)) / 10;

/** Un animale in un riquadro «contain», appoggiato in basso al centro. */
export function fitContain(shape: { w: number; h: number }, box: { w: number; h: number }) {
  const k = Math.min(box.w / shape.w, box.h / shape.h);
  return { w: shape.w * k, h: shape.h * k };
}
