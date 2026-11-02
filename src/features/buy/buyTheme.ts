import type { Theme } from '@/core/theme/ThemeProvider';

export type UiStyle = 'standard' | 'paper';

/** Mescola due colori «#RRGGBB»: `ratio` è la parte del primo (come color-mix(in srgb) del sito). */
export function mix(a: string, b: string, ratio: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  const out = x.map((v, i) => Math.round(v * ratio + y[i]! * (1 - ratio)));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** «#RRGGBB» + opacità → rgba(). */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export interface BuyTheme {
  style: UiStyle;
  page: string;
  card: string;
  panel: string;
  ink: string;
  ink2: string;
  ink3: string;
  hair: string;
  accent: string;
  onAccent: string;
  late: string;
  footBg: string;
  footFg: string;
  /** i nomi dei caratteri: in Scontrino si usano Jost, Cormorant e Caveat come sul sito */
  sans: string | undefined;
  serif: string | undefined;
  hand: string | undefined;
}

/**
 * I colori del to buy nelle due vesti. «Corsie» usa i colori del tema (chiaro/scuro); «Scontrino»
 * è carta color crema, uguale in chiaro e in scuro come sul sito (i valori sono quelli di todo_widget.css).
 */
export function buyTheme(style: UiStyle, th: Theme): BuyTheme {
  if (style === 'paper') {
    return {
      style,
      page: '#F5F1EA',
      card: '#FFFDFA',
      panel: '#F5F1EA',
      ink: '#4A443D',
      ink2: '#8A8177',
      ink3: '#B7AEA3',
      hair: 'rgba(74,68,61,.12)',
      accent: th.brand,
      onAccent: '#FFFFFF',
      late: '#B4645F',
      footBg: '#4A443D',
      footFg: '#FFFDFA',
      sans: 'Jost_400Regular',
      serif: 'CormorantGaramond_500Medium_Italic',
      hand: 'Caveat_500Medium',
    };
  }
  const dark = th.scheme === 'dark';
  return {
    style,
    page: th.bg,
    card: th.surface,
    panel: th.bg,
    ink: th.text,
    ink2: th.text2,
    ink3: th.text3,
    hair: th.hairline,
    accent: th.brand,
    onAccent: '#FFFFFF',
    late: th.red,
    footBg: dark ? '#3A3A3C' : '#1C1C1E',
    footFg: dark ? '#F5F5F7' : '#FFFFFF',
    sans: undefined,
    serif: undefined,
    hand: undefined,
  };
}
