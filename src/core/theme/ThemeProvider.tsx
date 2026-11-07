import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { shapeFor, surfacesFor, type Shape, type UiStyle } from './skin';
import {
  brandFor,
  DEFAULT_ACCENT,
  palettes,
  type AccentId,
  type Palette,
  type SchemeName,
} from './tokens';

export interface Theme extends Palette, Omit<Shape, 'style'> {
  scheme: SchemeName;
  /** la vesti scelta nelle impostazioni: «standard» (Glass) o «paper» (Calm paper) */
  style: UiStyle;
  brand: string;
  brandSoft: string;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  accent = DEFAULT_ACCENT,
  uiStyle = 'standard',
  children,
}: {
  accent?: AccentId;
  uiStyle?: UiStyle;
  children: ReactNode;
}) {
  const scheme: SchemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useMemo<Theme>(
    () => ({
      scheme,
      ...palettes[scheme],
      ...surfacesFor(uiStyle, scheme),
      ...shapeFor(uiStyle, scheme),
      ...brandFor(scheme, accent),
    }),
    [scheme, accent, uiStyle],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme: manca il ThemeProvider');
  return theme;
}
