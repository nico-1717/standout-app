/**
 * I colori del Pomodoro, come sul sito (pomodoro.css): l'accento è il colore del progetto collegato; senza progetto è un
 * grigio neutro («--orange» sul sito, nome storico). I mescoli `color-mix` del CSS qui diventano numeri.
 */
import type { SchemeName } from '@/core/theme/tokens';

export const NEUTRAL_ACCENT: Record<SchemeName, string> = { dark: '#7A7A81', light: '#6E6E73' };

/** Traccia dell'anello (--track del sito). */
export const RING_TRACK: Record<SchemeName, string> = {
  dark: 'rgba(120,120,128,.26)',
  light: 'rgba(120,120,128,.14)',
};

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [122, 122, 129];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `#rrggbb` + trasparenza → `rgba(...)` (il «color-mix(in srgb, X 22%, transparent)» del CSS). */
export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

/** Mescola due colori `#rrggbb`: `p` è la parte del primo (0–1), come «color-mix(in srgb, A 42%, B)». */
export function mix(a: string, b: string, p: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const c = (i: number) => Math.round(x[i]! * p + y[i]! * (1 - p));
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}
