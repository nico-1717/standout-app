/**
 * I token dell'aspetto, copiati dal sito (public/_assets/ui/base.css, tema "standard",
 * e lib/accent.php per i colori d'accento). NON si inventa niente qui:
 * se il sito cambia un valore, si cambia anche qui (e si controlla con lo screenshot).
 * Regola di Nico: l'app ha l'aspetto del sito di oggi. Un aspetto nuovo richiede
 * prima una proposta visiva e il suo OK.
 */

export type SchemeName = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  text3: string;
  hairline: string;
  hairline2: string;
  blue: string;
  green: string;
  red: string;
  orange: string;
  purple: string;
  teal: string;
  pink: string;
  indigo: string;
  blueSoft: string;
  greenSoft: string;
  redSoft: string;
  orangeSoft: string;
  purpleSoft: string;
  indigoSoft: string;
  headerGlass: string;
}

export const palettes: Record<SchemeName, Palette> = {
  light: {
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surface2: '#F2F2F7',
    text: '#1C1C1E',
    text2: '#8A8A8E',
    text3: '#AEAEB2',
    hairline: 'rgba(60,60,67,.12)',
    hairline2: 'rgba(60,60,67,.22)',
    blue: '#007AFF',
    green: '#34C759',
    red: '#FF3B30',
    orange: '#FF9500',
    purple: '#AF52DE',
    teal: '#30B0C7',
    pink: '#FF2D55',
    indigo: '#5856D6',
    blueSoft: 'rgba(0,122,255,.09)',
    greenSoft: 'rgba(52,199,89,.13)',
    redSoft: 'rgba(255,59,48,.12)',
    orangeSoft: 'rgba(255,149,0,.14)',
    purpleSoft: 'rgba(175,82,222,.12)',
    indigoSoft: 'rgba(88,86,214,.12)',
    headerGlass: 'rgba(249,249,251,.82)',
  },
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    text: '#F5F5F7',
    text2: '#98989F',
    text3: '#636366',
    hairline: 'rgba(84,84,88,.42)',
    hairline2: 'rgba(84,84,88,.62)',
    blue: '#0A84FF',
    green: '#30D158',
    red: '#FF453A',
    orange: '#FF9F0A',
    purple: '#BF5AF2',
    teal: '#40C8E0',
    pink: '#FF375F',
    indigo: '#5E5CE6',
    blueSoft: 'rgba(10,132,255,.16)',
    greenSoft: 'rgba(48,209,88,.17)',
    redSoft: 'rgba(255,69,58,.17)',
    orangeSoft: 'rgba(255,159,10,.18)',
    purpleSoft: 'rgba(191,90,242,.18)',
    indigoSoft: 'rgba(94,92,230,.18)',
    headerGlass: 'rgba(16,16,18,.78)',
  },
};

/** Palette chiusa dei colori d'accento (lib/accent.php, STANDOUT_ACCENTI). l = chiaro, d = scuro. */
export const accents = {
  blue: { l: '#007AFF', d: '#0A84FF' },
  indigo: { l: '#5856D6', d: '#7D7AFF' },
  violet: { l: '#8E44C8', d: '#BF5AF2' },
  teal: { l: '#0B7A75', d: '#25B3A7' },
  coral: { l: '#C2410C', d: '#FF7F45' },
  rose: { l: '#C2255C', d: '#FF5C8A' },
} as const;

export type AccentId = keyof typeof accents;
export const DEFAULT_ACCENT: AccentId = 'blue';

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(accents, value);
}

/** #RRGGBB + opacità → rgba(): per i toni "soft" dell'accento. */
export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Il colore di marca (--brand) per tema e accento scelti. */
export function brandFor(scheme: SchemeName, accent: AccentId = DEFAULT_ACCENT) {
  const hex = scheme === 'dark' ? accents[accent].d : accents[accent].l;
  return { brand: hex, brandSoft: hexToRgba(hex, scheme === 'dark' ? 0.16 : 0.09) };
}

/** Forme (base.css: --r-card, --r-btn, --r-pill, --r-chip). */
export const radius = { card: 22, button: 15, pill: 999, chip: 100 } as const;

/** Titolo di pagina: 21px, peso 800 (scelta di Nico del 28/10/2026). */
export const typography = {
  pageTitle: { fontSize: 21, fontWeight: '800' as const, letterSpacing: -0.42 },
  body: { fontSize: 16, lineHeight: 22 },
} as const;
