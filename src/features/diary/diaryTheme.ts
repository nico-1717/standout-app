import { buyTheme, type UiStyle } from '@/features/buy/buyTheme';
import type { Theme } from '@/core/theme/ThemeProvider';

import type { DiaryFont, DiarySettings } from './settings';

/**
 * I colori e le scritture della pagina Diario: le variabili --dy-* di diario.css. Sulla carta sono quelli
 * del quaderno (crema, inchiostro caldo); nello stile standard seguono il tema chiaro/scuro e l'accento.
 */
export interface DiaryTheme {
  style: UiStyle;
  dark: boolean;
  page: string;
  card: string;
  paper2: string;
  edge: string;
  ink: string;
  ink2: string;
  ink3: string;
  pencil: string;
  rule: string;
  accent: string;
  accent2: string;
  onAccent: string;
  hair: string;
  sans: string | undefined;
  serif: string | undefined;
  serifLight: string | undefined;
  hand: string | undefined;
  /** altezza della riga di scrittura (px) e corpo del testo */
  size: number;
  line: number;
}

/** La scrittura che vale davvero nello stile in uso (stessa regola di fontEff() del sito). */
export function effectiveFont(style: UiStyle, key: DiaryFont): Exclude<DiaryFont, `std-${string}`> {
  if (style === 'standard')
    return (key.startsWith('std-') ? key.slice(4) : 'sistema') as Exclude<
      DiaryFont,
      `std-${string}`
    >;
  const k = key.replace(/^std-/, '');
  return (k === 'sistema' ? 'jost' : k) as Exclude<DiaryFont, `std-${string}`>;
}

const HAND: Record<string, string | undefined> = {
  caveat: 'Caveat_500Medium',
  kalam: 'Kalam_400Regular',
  patrick: 'PatrickHand_400Regular',
  cormorant: 'CormorantGaramond_400Regular',
  jost: 'Jost_400Regular',
  sistema: undefined,
};

export function diaryTheme(
  style: UiStyle,
  th: Theme,
  s: Pick<DiarySettings, 'font' | 'size'>,
): DiaryTheme {
  const bt = buyTheme(style, th);
  const hand = HAND[effectiveFont(style, s.font)];
  const line = Math.round(s.size * 1.62);
  if (style === 'paper') {
    const night = th.scheme === 'dark';
    return {
      style,
      dark: night,
      page: night ? th.bg : '#FDFCF9',
      card: night ? th.surface : '#FFFDFA',
      paper2: night ? '#1A1713' : '#F7F3EC',
      edge: night ? th.hairline : '#EFE8DD',
      ink: night ? th.text : '#4A443D',
      ink2: night ? th.text2 : '#8A8177',
      ink3: night ? th.text3 : '#BAB1A6',
      pencil: night ? th.text2 : '#8C857A',
      rule: night ? 'rgba(242,235,221,.10)' : 'rgba(120,133,148,.20)',
      accent: '#A9C3AE',
      accent2: night ? '#2A3A2F' : '#E7EFE8',
      onAccent: night ? '#14120F' : '#FFFDFA',
      hair: night ? th.hairline : 'rgba(74,68,61,.10)',
      sans: 'Jost_400Regular',
      serif: 'Fraunces_400Regular_Italic',
      serifLight: 'Fraunces_400Regular',
      hand,
      size: s.size,
      line,
    };
  }
  const dark = th.scheme === 'dark';
  return {
    style,
    dark,
    page: th.bg,
    card: th.surface,
    paper2: th.bg,
    edge: bt.hair,
    ink: bt.ink,
    ink2: bt.ink2,
    ink3: bt.ink3,
    pencil: bt.ink2,
    rule: dark ? 'rgba(235,235,245,.10)' : 'rgba(60,60,67,.09)',
    accent: th.brand,
    accent2: th.brandSoft,
    onAccent: '#FFFFFF',
    hair: bt.hair,
    sans: undefined,
    serif: undefined,
    serifLight: undefined,
    hand,
    size: s.size,
    line,
  };
}
