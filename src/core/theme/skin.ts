import type { Palette, SchemeName } from './tokens';

/**
 * Le due vesti dell'app, scelte nelle impostazioni (sullo stesso campo `ui_style` del sito):
 *  - «standard» = Glass: vetro morbido, forme molto arrotondate, barra delle schede che fluttua;
 *  - «paper»    = Calm paper: carta calda, titoli e numeri in serif, linee sottili al posto di ombre e riquadri.
 * Le proposte approvate da Nico il 7/11/2026 (campioni «Standout app – new style samples»).
 * I colori semantici (blu, verde, rosso…) restano quelli del sito: qui cambiano solo sfondi, testi e linee.
 */
export type UiStyle = 'standard' | 'paper';

type Surfaces = Pick<
  Palette,
  | 'bg'
  | 'surface'
  | 'surface2'
  | 'text'
  | 'text2'
  | 'text3'
  | 'hairline'
  | 'hairline2'
  | 'headerGlass'
>;

const SURFACES: Record<UiStyle, Record<SchemeName, Surfaces>> = {
  // Gli stessi grigi di iOS del sito (stile_standard.css: --so-*), chiaro e scuro.
  standard: {
    light: {
      bg: '#F2F2F7',
      surface: '#FFFFFF',
      surface2: '#E9E9EE',
      text: '#1C1C1E',
      text2: '#55555A',
      text3: '#6E6E73',
      hairline: 'rgba(60,60,67,.16)',
      hairline2: 'rgba(60,60,67,.28)',
      headerGlass: 'rgba(249,249,251,.94)',
    },
    dark: {
      bg: '#000000',
      surface: '#1C1C1E',
      surface2: '#2C2C2E',
      text: '#F5F5F7',
      text2: '#BDBDC2',
      text3: '#8E8E93',
      hairline: 'rgba(120,120,128,.40)',
      hairline2: 'rgba(120,120,128,.60)',
      headerGlass: 'rgba(22,22,24,.94)',
    },
  },
  paper: {
    light: {
      bg: '#F6F1E9',
      surface: '#FFFDF8',
      surface2: '#EFE8DB',
      text: '#26211A',
      text2: '#6B6152',
      text3: '#736A57',
      hairline: '#E3D9C8',
      hairline2: '#D4C8B2',
      headerGlass: 'rgba(246,241,233,.92)',
    },
    dark: {
      bg: '#14120F',
      surface: '#1D1A16',
      surface2: '#26221C',
      text: '#F2EBDD',
      text2: '#A89F8E',
      text3: '#948B7A',
      hairline: '#2E2922',
      hairline2: '#3B352C',
      headerGlass: 'rgba(20,18,15,.92)',
    },
  },
};

/** La forma delle cose: raggi, bordo e ombra delle carte, barra delle schede, caratteri dei titoli. */
export interface Shape {
  style: UiStyle;
  /** raggio delle carte e dei pulsanti */
  radiusCard: number;
  radiusButton: number;
  /** il filo luminoso attorno alle carte (Glass) o la linea sottile (Paper) */
  cardEdge: string;
  /** `boxShadow` delle carte; vuoto in Paper */
  cardShadow: string | undefined;
  /** la barra delle schede fluttua come una pillola (Glass) o è piatta con una linea (Paper) */
  floatingBar: boolean;
  barBg: string;
  /** il carattere dei titoli grandi e dei numeri grandi (solo Paper: Fraunces) */
  display: string | undefined;
  displayItalic: string | undefined;
  /** titolo di pagina */
  titleSize: number;
  titleWeight: '400' | '800';
}

/** Alto contrasto (interruttore locale in Altro › Stile): testi pieni e linee ben visibili, sfondi invariati. */
const HIGH_CONTRAST: Record<
  SchemeName,
  Pick<Surfaces, 'text' | 'text2' | 'text3' | 'hairline' | 'hairline2'>
> = {
  light: {
    text: '#000000',
    text2: '#262626',
    text3: '#3D3D3D',
    hairline: 'rgba(0,0,0,.45)',
    hairline2: 'rgba(0,0,0,.75)',
  },
  dark: {
    text: '#FFFFFF',
    text2: '#EBEBEB',
    text3: '#D2D2D2',
    hairline: 'rgba(255,255,255,.55)',
    hairline2: 'rgba(255,255,255,.85)',
  },
};

export function surfacesFor(style: UiStyle, scheme: SchemeName, highContrast = false): Surfaces {
  const base = SURFACES[style][scheme];
  return highContrast ? { ...base, ...HIGH_CONTRAST[scheme] } : base;
}

export function shapeFor(style: UiStyle, scheme: SchemeName): Shape {
  const dark = scheme === 'dark';
  if (style === 'paper') {
    return {
      style,
      radiusCard: 18,
      radiusButton: 12,
      cardEdge: SURFACES.paper[scheme].hairline,
      cardShadow: undefined,
      floatingBar: false,
      barBg: SURFACES.paper[scheme].bg,
      display: 'Fraunces_400Regular',
      displayItalic: 'Fraunces_400Regular_Italic',
      titleSize: 32,
      titleWeight: '400',
    };
  }
  return {
    style,
    // come sul sito (stile standard): carta piatta, angoli grandi, nessun bordo e nessuna ombra nel buio
    radiusCard: 24,
    radiusButton: 16,
    cardEdge: 'transparent',
    cardShadow: dark ? undefined : '0 1px 3px rgba(0,0,0,.06)',
    floatingBar: true,
    barBg: dark ? 'rgba(26,28,38,.92)' : 'rgba(255,255,255,.92)',
    display: undefined,
    displayItalic: undefined,
    titleSize: 30,
    titleWeight: '800',
  };
}
