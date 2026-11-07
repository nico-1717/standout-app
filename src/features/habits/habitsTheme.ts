import { surfacesFor, type UiStyle } from '@/core/theme/skin';
import type { SchemeName } from '@/core/theme/tokens';

/**
 * I colori della pagina Abitudini, copiati da public/planner/habits.css (la pagina ha una sua
 * tavolozza, un poco diversa dal resto). `ink` è la «pastiglia» che prende un'abitudine fatta:
 * in chiaro una lastra di vetro, in scuro quasi nera. Il colore dell'abitudine (--h) filtra dentro.
 */
export interface HabitsTheme {
  scheme: SchemeName;
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  text: string;
  text2: string;
  text3: string;
  hairline: string;
  hairline2: string;
  red: string;
  green: string;
  accent: string;
  ink: string;
  ink2: string;
  inkText: string;
  inkText2: string;
  inkTrack: string;
  inkBarTrack: string;
  inkHairline: string;
  headerGlass: string;
}

export const DEFAULT_HABIT_ACCENT = '#7C5CFF';

export function habitsTheme(
  scheme: SchemeName,
  accent = DEFAULT_HABIT_ACCENT,
  style: UiStyle = 'standard',
): HabitsTheme {
  // sfondi, testi e linee delle due vesti (Glass / Calm paper); le «pastiglie» fatte restano quelle del sito
  const sf = surfacesFor(style, scheme);
  const base = habitsBase(scheme, accent);
  return {
    ...base,
    bg: sf.bg,
    surface: sf.surface,
    surface2: sf.surface2,
    surface3: sf.hairline2,
    text: sf.text,
    text2: sf.text2,
    text3: sf.text3,
    hairline: sf.hairline,
    hairline2: sf.hairline2,
    headerGlass: sf.headerGlass,
  };
}

function habitsBase(scheme: SchemeName, accent: string): HabitsTheme {
  if (scheme === 'dark') {
    return {
      scheme,
      bg: '#000000',
      surface: '#131316',
      surface2: '#1E1E22',
      surface3: '#2C2C31',
      text: '#F5F5F7',
      text2: '#98989F',
      text3: '#65656B',
      hairline: 'rgba(84,84,88,.36)',
      hairline2: 'rgba(84,84,88,.58)',
      red: '#FF453A',
      green: '#30D158',
      accent,
      ink: '#0E0E13',
      ink2: '#26262F',
      inkText: '#FFFFFF',
      inkText2: 'rgba(255,255,255,.62)',
      inkTrack: 'rgba(255,255,255,.2)',
      inkBarTrack: 'rgba(255,255,255,.18)',
      inkHairline: 'rgba(255,255,255,.14)',
      headerGlass: 'rgba(12,12,14,.78)',
    };
  }
  return {
    scheme,
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surface2: '#F2F2F7',
    surface3: '#E7E7EC',
    text: '#1C1C1E',
    text2: '#8A8A8E',
    text3: '#AEAEB2',
    hairline: 'rgba(60,60,67,.12)',
    hairline2: 'rgba(60,60,67,.22)',
    red: '#FF3B30',
    green: '#34C759',
    accent,
    ink: 'rgba(255,255,255,.6)',
    ink2: 'rgba(255,255,255,.32)',
    inkText: '#1C1C1E',
    inkText2: '#8A8A8E',
    inkTrack: 'rgba(60,60,67,.16)',
    inkBarTrack: 'rgba(60,60,67,.13)',
    inkHairline: 'rgba(255,255,255,.8)',
    headerGlass: 'rgba(249,249,251,.82)',
  };
}
