import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  brandFor,
  DEFAULT_ACCENT,
  palettes,
  type AccentId,
  type Palette,
  type SchemeName,
} from './tokens';

export interface Theme extends Palette {
  scheme: SchemeName;
  brand: string;
  brandSoft: string;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  accent = DEFAULT_ACCENT,
  children,
}: {
  accent?: AccentId;
  children: ReactNode;
}) {
  const scheme: SchemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useMemo<Theme>(
    () => ({ scheme, ...palettes[scheme], ...brandFor(scheme, accent) }),
    [scheme, accent],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme: manca il ThemeProvider');
  return theme;
}
