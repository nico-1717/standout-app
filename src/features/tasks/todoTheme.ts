import { buyTheme, mix, type BuyTheme, type UiStyle } from '@/features/buy/buyTheme';
import type { Theme } from '@/core/theme/ThemeProvider';

/**
 * I colori della pagina Attività: sono le variabili --td-* di todo_widget.css. Nello stile «standard» seguono il
 * tema chiaro/scuro e l'accento; nello stile «carta» sono quelli crema del sito (uguali in chiaro e in scuro).
 */
export interface TodoTheme extends BuyTheme {
  accentSoft: string;
  lateSoft: string;
  /** il cestino: fondo e segno */
  delBg: string;
  delFg: string;
  dark: boolean;
}

export function todoTheme(style: UiStyle, th: Theme): TodoTheme {
  const bt = buyTheme(style, th);
  if (style === 'paper') {
    const pd = th.scheme === 'dark';
    return {
      ...bt,
      accentSoft: mix(bt.accent, bt.card, 0.2),
      lateSoft: pd ? '#3A2724' : '#F6E4E2',
      delBg: pd ? '#3A2724' : '#F3DCDC',
      delFg: pd ? '#E0928C' : '#8E5A5A',
      dark: pd,
    };
  }
  const dark = th.scheme === 'dark';
  return {
    ...bt,
    // nello standard il «pannello» dei chip è il fondo della pagina (chiaro) o il grigio di riempimento (scuro)
    panel: dark ? th.surface2 : th.bg,
    accentSoft: th.brandSoft,
    lateSoft: th.redSoft,
    delBg: th.redSoft,
    delFg: th.red,
    dark,
  };
}
