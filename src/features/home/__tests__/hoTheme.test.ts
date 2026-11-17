import { shapeFor, surfacesFor } from '@/core/theme/skin';
import { brandFor, palettes } from '@/core/theme/tokens';
import type { Theme } from '@/core/theme/ThemeProvider';
import { titleStyle } from '@/ui/kit';

import { hoTheme, hoTitle } from '../HomeKit';

const theme = (style: 'standard' | 'paper', scheme: 'light' | 'dark'): Theme => ({
  scheme,
  ...palettes[scheme],
  ...surfacesFor(style, scheme),
  ...shapeFor(style, scheme),
  ...brandFor(scheme, 'blue'),
  highContrast: false,
});

describe('Home theme follows the chosen look', () => {
  test('Glass keeps the website greys and the bold titles', () => {
    const ho = hoTheme(theme('standard', 'light'));
    expect(ho.bg).toBe('#F2F2F7');
    expect(ho.display).toBeUndefined();
    expect(hoTitle(ho, 26)).toMatchObject({ fontWeight: '800' });
  });

  test('Calm paper: warm paper, thin lines instead of shadows, serif titles', () => {
    const th = theme('paper', 'light');
    const ho = hoTheme(th);
    expect(ho.bg).toBe(th.bg);
    expect(ho.surface).toBe(th.surface);
    expect(ho.shadow).toContain('0 0 0 0.5px');
    expect(ho.display).toBe('Fraunces_400Regular');
    const t = hoTitle(ho, 26);
    expect(t).toMatchObject({ fontFamily: 'Fraunces_400Regular', fontSize: 26 });
    expect(t).not.toHaveProperty('fontWeight');
    // the vivid colours stay the same in both looks
    expect(ho.green).toBe(hoTheme(theme('standard', 'light')).green);
  });

  test('dark paper uses the dark paper surfaces', () => {
    const th = theme('paper', 'dark');
    expect(hoTheme(th).bg).toBe(th.bg);
  });
});

describe('titleStyle', () => {
  test('serif and a little bigger in paper, bold in Glass', () => {
    expect(titleStyle({ display: 'Fraunces_400Regular' }, 20)).toMatchObject({
      fontFamily: 'Fraunces_400Regular',
      fontSize: 26,
    });
    expect(titleStyle({ display: undefined }, 20)).toMatchObject({
      fontSize: 20,
      fontWeight: '800',
    });
  });
});
