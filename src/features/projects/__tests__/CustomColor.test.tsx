import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { CustomColor, toHex6 } from '../CustomColor';

// il selettore usa i worklet di Reanimated, che in Jest non passano dal plugin di Babel: qui basta sapere che si apre
jest.mock('reanimated-color-picker', () => {
  const { View } = jest.requireActual('react-native');
  const Box = ({ children }: { children?: unknown }) => <View>{children as never}</View>;
  return { __esModule: true, default: Box, HueSlider: Box, Panel1: Box, Preview: Box };
});

describe('CustomColor', () => {
  it('writes the colour the way the site does: #RRGGBB, upper case, no alpha', () => {
    expect(toHex6('#ff9500')).toBe('#FF9500');
    expect(toHex6('34c759ff')).toBe('#34C759');
  });

  it('opens the picker and gives back the colour only on Apply', async () => {
    const onPick = jest.fn();
    await render(
      <ThemeProvider>
        <CustomColor value="#ff9500" onPick={onPick} />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('custom-color-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('custom-color'));
    expect(screen.getByTestId('custom-color-sheet')).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('custom-color-done'));
    expect(onPick).toHaveBeenCalledWith('#FF9500');
  });
});
