import type { Theme } from '@/core/theme/ThemeProvider';
import { mix, type UiStyle } from '@/features/buy/buyTheme';

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
  /** la barra in alto, le pillole e le caselle come le disegna il sito (planner_*.css) */
  bar: string;
  pill: string;
  pillRing: string;
  field: string;
  fieldRing: string;
  tileRed: string;
  prioRing: string;
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
    // Calm paper: in chiaro la carta dell'agenda; in scuro la stessa carta ma scura, con i pastelli più vivi
    const night = th.scheme === 'dark';
    const ink = night ? [242, 235, 221] : [76, 70, 63];
    const a = (v: number) => `rgba(${ink.join(',')},${v})`;
    return {
      style,
      dark: night,
      page: night ? th.bg : '#FBF9F6',
      paper2: night ? '#1A1713' : '#F5F1EA',
      card: night ? th.surface : '#FFFDFA',
      ink: night ? th.text : '#4C463F',
      ink2: a(0.52 + 0.1 * k),
      ink3: a(0.3 + 0.1 * k),
      hair: a(0.05 + 0.028 * k),
      hair2: a(0.1 + 0.045 * k),
      accent,
      accentSoft: night ? mix(accent, th.surface, 0.3) : accentSoft,
      accentWash: night ? mix(accent, th.surface, 0.14) : accentWash,
      accentInk: night ? accent : accentInk,
      onAccent: night ? '#14120F' : '#FFFDFA',
      neutralEv: night ? '#3B352C' : '#E4DDD3',
      bar: night ? mix(th.bg, '#000000', 0.9) : 'rgba(251,249,246,.9)',
      pill: night ? th.surface : '#FFFDFA',
      pillRing: a(0.2),
      field: night ? '#1A1713' : '#F5F1EA',
      fieldRing: a(0.14),
      tileRed: '#E5534B',
      prioRing: '#C98F8F',
      sans: 'Jost_400Regular',
      serif: 'Fraunces_400Regular',
      serifLight: 'Fraunces_400Regular',
    };
  }
  // «Glass» sul sito: il planner ha i grigi di iOS (non il blu notte del resto del sito)
  const dark = th.scheme === 'dark';
  const brand = th.brand;
  const rgb = [1, 3, 5].map((i) => parseInt(brand.slice(i, i + 2), 16)).join(',');
  const known = brand === '#0A84FF' || brand === '#007AFF';
  return {
    style,
    dark,
    page: dark ? '#000000' : '#F2F2F7',
    paper2: dark ? '#000000' : '#F2F2F7',
    card: dark ? '#1C1C1E' : '#FFFFFF',
    ink: dark ? '#F5F5F7' : '#1C1C1E',
    ink2: dark ? 'rgba(235,235,245,.92)' : 'rgba(44,44,48,.92)',
    ink3: dark ? 'rgba(235,235,245,.73)' : 'rgba(44,44,48,.73)',
    hair: dark ? 'rgba(120,120,128,.4)' : 'rgba(60,60,67,.16)',
    hair2: dark ? 'rgba(235,235,245,.18)' : 'rgba(60,60,67,.16)',
    accent: brand,
    accentSoft: `rgba(${rgb},${dark ? 0.24 : 0.14})`,
    accentWash: `rgba(${rgb},${dark ? 0.13 : 0.07})`,
    accentInk: known
      ? dark
        ? '#64A8FF'
        : '#0062CC'
      : mix(brand, dark ? '#FFFFFF' : '#000000', 0.7),
    onAccent: '#FFFFFF',
    neutralEv: '#E4DDD3',
    bar: dark ? 'rgba(22,22,24,.94)' : 'rgba(249,249,251,.94)',
    pill: dark ? '#1C1C1E' : '#FFFFFF',
    pillRing: dark ? 'rgba(235,235,245,.36)' : 'rgba(44,44,48,.36)',
    field: dark ? '#2C2C2E' : '#E9E9EE',
    fieldRing: dark ? 'rgba(235,235,245,.22)' : 'rgba(44,44,48,.22)',
    tileRed: '#E5534B',
    prioRing: '#C98F8F',
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
  const base = pt.style === 'standard' ? 0.26 : 0.3;
  const share = importance === 'highest' ? 0.68 : importance === 'high' ? 0.52 : base;
  return mix(ev, pt.card.startsWith('#') ? pt.card : '#FFFDFA', share);
}
