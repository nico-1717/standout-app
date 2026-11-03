import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { DEFAULT_PLANNER_SETTINGS, type PlannerSettings } from '@/features/planner/settings';
import PlannerSettingsScreen from '../planner-settings';

let mockStyle: 'standard' | 'paper' = 'paper';
let mockSettings: PlannerSettings = DEFAULT_PLANNER_SETTINGS;
const mockUpdate = jest.fn((patch: Partial<PlannerSettings>) => {
  mockSettings = { ...mockSettings, ...patch };
});
const mockBack = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    uiStyle: mockStyle,
    plannerSettings: mockSettings,
    updatePlannerSettings: mockUpdate,
  }),
}));

beforeEach(() => {
  mockStyle = 'paper';
  mockSettings = DEFAULT_PLANNER_SETTINGS;
  mockUpdate.mockClear();
  mockBack.mockClear();
});

describe('planner settings screen', () => {
  test('colour, zoom, phrases and contrast change the settings', async () => {
    await render(
      <ThemeProvider>
        <PlannerSettingsScreen />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('ps-palette-sky'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ palette: 'sky' });
    await fireEvent.press(screen.getByTestId('ps-zoom-h1'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ zoom: 'h1' });
    await fireEvent(screen.getByTestId('ps-motivational'), 'valueChange', false);
    expect(mockUpdate).toHaveBeenLastCalledWith({ show_motivational: false });
    await fireEvent(screen.getByTestId('ps-affirmations'), 'valueChange', false);
    expect(mockUpdate).toHaveBeenLastCalledWith({ show_affirmations: false });
    await fireEvent.press(screen.getByTestId('ps-contrast-plus'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ contrast_level: 4 });
    await fireEvent.press(screen.getByTestId('ps-ambient-opacity-minus'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ ambient_opacity: 8 });
    await fireEvent(screen.getByTestId('ps-ambient'), 'valueChange', false);
    expect(mockUpdate).toHaveBeenLastCalledWith({ ambient_enabled: false });
  });

  test('steppers stop at their limits', async () => {
    mockSettings = { ...DEFAULT_PLANNER_SETTINGS, contrast_level: 5, ambient_opacity: 0 };
    await render(
      <ThemeProvider>
        <PlannerSettingsScreen />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('ps-contrast-plus'));
    await fireEvent.press(screen.getByTestId('ps-ambient-opacity-minus'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('the standard look has no page colour or trees; Done closes', async () => {
    mockStyle = 'standard';
    await render(
      <ThemeProvider>
        <PlannerSettingsScreen />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('ps-palette-sky')).toBeNull();
    expect(screen.queryByTestId('ps-ambient')).toBeNull();
    await fireEvent.press(screen.getByTestId('ps-done'));
    expect(mockBack).toHaveBeenCalled();
  });
});
