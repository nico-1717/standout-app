import type { Theme } from '@/core/theme/ThemeProvider';
import { buyTheme, mix, type UiStyle } from '@/features/buy/buyTheme';

/** Le dodici tinte del planner (.pl-palette-* di planner_base.css): accento, fondo morbido, fondo leggero, inchiostro. */
export const PALETTES = {
  sage: ['#A9C3AE', '#DCE8DD', '#EEF4EF', '#4A5B4E'],
  mint: ['#A5CCC4', '#D7EAE5', '#EDF5F3', '#456159'],
  blush: ['#E7B9C0', '#F6E1E4', '#FBF0F1', '#6E4A50'],
  lavender: ['#C2B8DC', '#E6E1F1', '#F3F0F8', '#544B6B'],
  butter: ['#E8D4A2', '#F6EBD2', '#FAF4E7', '#6A5A36'],
  sky: ['#B0C7DD', '#DCE7F0', '#EFF4F8', '#465768'],
  clay: ['#DDBCA6', '#F1E0D3', '#F8F1EB', '#6B5344'],
  rose: ['#DFAFB4', '#F3DCDF', '#FAF0F1', '#6B474B'],
  sea: ['#9FC2C6', '#DBEAEB', '#EFF6F6', '#40585B'],
  olive: ['#BFC49B', '#E7E9D4', '#F5F6EC', '#565A3B'],
  plum: ['#C3A9BE', '#E9DCE7', '#F7F1F6', '#5B4657'],
  sand: ['#E0CDA9', '#F3E9D6', '#FAF5EC', '#645639'],
} as const;
export type PaletteKey = keyof typeof PALETTES;

/** #RGB → #RRGGBB (i colori degli eventi possono essere scritti corti). */
export function longHex(c: string | null | undefined, fallback: string): string {
  if (!c) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(c);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : fallback;
}

export interface PlannerTheme {
  style: UiStyle;
  dark: boolean;
  page: string;
  paper2: string;
  card: string;
  ink: string;
  ink2: string;
  ink3: string;
  hair: string;
  hair2: string;
  accent: string;
  accentSoft: string;
  accentWash: string;
  accentInk: string;
  onAccent: string;
  neutralEv: string;
  /** altezza di una fascia di 30 minuti e pixel per minuto */
  sans: string | undefined;
  serif: string | undefined;
  serifLight: string | undefined;
}

/**
 * «Carta e cielo» (planner_base.css). Sulla carta i colori sono quelli dell'agenda; nello stile standard
 * seguono il tema chiaro/scuro. `contrast` è il «quanto marcato» delle impostazioni (1–5, di solito 3).
 */
export function plannerTheme(
  style: UiStyle,
  th: Theme,
  palette: PaletteKey = 'sage',
  contrast = 3,
): PlannerTheme {
  const [accent, accentSoft, accentWash, accentInk] = PALETTES[palette] ?? PALETTES.sage;
  const k = contrast;
  if (style === 'paper') {
    const ink = [76, 70, 63];
    const a = (v: number) => `rgba(${ink.join(',')},${v})`;
    return {
      style,
      dark: false,
      page: '#FBF9F6',
      paper2: '#F5F1EA',
      card: '#FFFDFA',
      ink: '#4C463F',
      ink2: a(0.52 + 0.1 * k),
      ink3: a(0.3 + 0.1 * k),
      hair: a(0.05 + 0.028 * k),
      hair2: a(0.1 + 0.045 * k),
      accent,
      accentSoft,
      accentWash,
      accentInk,
      onAccent: '#FFFDFA',
      neutralEv: '#E4DDD3',
      sans: 'Jost_400Regular',
      serif: 'CormorantGaramond_400Regular',
      serifLight: 'CormorantGaramond_300Light',
    };
  }
  const bt = buyTheme(style, th);
  const dark = th.scheme === 'dark';
  return {
    style,
    dark,
    page: th.bg,
    paper2: th.bg,
    card: th.surface,
    ink: bt.ink,
    ink2: bt.ink2,
    ink3: bt.ink3,
    hair: bt.hair,
    hair2: dark ? 'rgba(235,235,245,.18)' : 'rgba(60,60,67,.16)',
    accent: th.brand,
    accentSoft: th.brandSoft,
    accentWash: th.brandSoft,
    accentInk: th.brand,
    onAccent: '#FFFFFF',
    neutralEv: dark ? '#3A3A3C' : '#E4E4E9',
    sans: undefined,
    serif: undefined,
    serifLight: undefined,
  };
}

/** Il colore di un evento: il suo, quello della categoria, o il neutro. */
export function eventColor(
  pt: PlannerTheme,
  ev: { color: string | null },
  category: { color: string } | null | undefined,
): string {
  return longHex(ev.color ?? category?.color, pt.neutralEv);
}

/** Lo sfondo di un blocco: il colore mescolato alla carta, più forte per gli importanti. */
export function blockBackground(pt: PlannerTheme, ev: string, importance: string): string {
  const share = importance === 'highest' ? 0.68 : importance === 'high' ? 0.52 : 0.3;
  return mix(ev, pt.card.startsWith('#') ? pt.card : '#FFFDFA', share);
}
