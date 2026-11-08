/**
 * I coriandoli delle abitudini (burst/tick di planner/habits.js). La fisica del sito va a passi da un fotogramma: ogni passo
 * la velocità verticale cresce di 0.28, quella orizzontale scende dell'1%, la vita cala di 0.016. Qui la posizione dopo `n`
 * passi si calcola con la formula chiusa (somma di una serie), così l'animazione è una sola cifra che sale da 0 a `FRAMES`
 * e non serve ricalcolare niente a ogni fotogramma.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
}

export interface Pose {
  x: number;
  y: number;
  rotate: number;
  opacity: number;
}

/** I colori in più, scelti a caso con il colore dell'abitudine (45% delle volte). */
export const EXTRA_COLORS = ['#FFCC00', '#FF2D8F', '#00E0A0', '#0A84FF'];

/** Quanti passi dura un pezzetto: la vita parte da 1 e cala di 0.016 a passo. */
export const FRAMES = Math.ceil(1 / 0.016);

/** Un lancio di `n` pezzetti da (x, y). `rng` dà numeri da 0 a 1 (nei test è fisso). */
export function makeBurst(
  x: number,
  y: number,
  color: string,
  n = 26,
  rng: () => number = Math.random,
): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rng() * 0.5;
    const v = 3.4 + rng() * 6.2;
    out.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 2.4,
      size: 2.6 + rng() * 4.4,
      rot: rng() * 6.28,
      vr: (rng() - 0.5) * 0.4,
      color: rng() < 0.55 ? color : EXTRA_COLORS[Math.floor(rng() * 4)]!,
    });
  }
  return out;
}

/** Dove sta un pezzetto dopo `n` passi (0 = appena lanciato). Fuori da 0..FRAMES l'opacità è 0. */
export function particleAt(p: Particle, n: number): Pose {
  'worklet';
  const step = Math.min(Math.max(n, 0), FRAMES);
  const k = 0.99;
  // x: ogni passo vx *= k poi x += vx → vx0·(k + k² + … + kⁿ)
  const x = p.x + (p.vx * k * (1 - Math.pow(k, step))) / (1 - k);
  // y: vy cresce di g e poi si somma: n·vy0 + g·n(n+1)/2
  const g = 0.28;
  const y = p.y + p.vy * step + (g * step * (step + 1)) / 2;
  const life = 1 - 0.016 * step;
  return { x, y, rotate: p.rot + p.vr * step, opacity: Math.max(0, life) };
}
