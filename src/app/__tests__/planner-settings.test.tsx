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
const mockPush = jest.fn();
const mockPlanner = {
  categories: () => [
    { uuid: 'c2', name: 'Work', color: '#123456' },
    { uuid: 'c1', name: 'Art', color: '#654321' },
  ],
  routines: () => [{ uuid: 'r1', name: 'Morning', color: '#abcdef' }],
};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: { planner: mockPlanner },
    version: 0,
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
  mockPush.mockClear();
});

const slide = (id: string, name: 'increment' | 'decrement') =>
  fireEvent(screen.getByTestId(id), 'accessibilityAction', { nativeEvent: { actionName: name } });

describe('planner settings popup (as the website one)', () => {
  test('colour, zoom, phrases, trees and the sliders change the settings', async () => {
    await render(
      <ThemeProvider>
        <PlannerSettingsScreen />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('ps-palette-sky'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ palette: 'sky' });
    await fireEvent.press(screen.getByTestId('ps-zoom'));
    await fireEvent.press(screen.getByTestId('ps-zoom-h1'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ zoom: 'h1' });
    await fireEvent.press(screen.getByTestId('ps-motivational'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ show_motivational: false });
    await fireEvent.press(screen.getByTestId('ps-affirmations'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ show_affirmations: false });
    await slide('ps-contrast', 'increment');
    expect(mockUpdate).toHaveBeenLastCalledWith({ contrast_level: 4 });
    await slide('ps-ambient-opacity', 'decrement');
    expect(mockUpdate).toHaveBeenLastCalledWith({ ambient_opacity: 8 });
    await fireEvent.press(screen.getByTestId('ps-ambient'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ ambient_enabled: false });
  });

  test('sliders stop at their limits', async () => {
    mockSettings = { ...DEFAULT_PLANNER_SETTINGS, contrast_level: 5, ambient_opacity: 0 };
    await render(
      <ThemeProvider>
        <PlannerSettingsScreen />
      </ThemeProvider>,
    );
    await slide('ps-contrast', 'increment');
    await slide('ps-ambient-opacity', 'decrement');
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, { contrast_level: 5 });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, { ambient_opacity: 0 });
  });

  test('categories and routines are folded sections that open on a tap and lead to their pages', async () => {
    await render(
      <ThemeProvider>
        <PlannerSettingsScreen />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('ps-cat-c1')).toBeNull();
    await fireEvent.press(screen.getByTestId('ps-fold-categories'));
    expect(screen.getByTestId('ps-cat-c1')).toBeTruthy();
    expect(screen.getByTestId('ps-cat-c2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ps-cat-add'));
    expect(mockPush).toHaveBeenLastCalledWith('/planner-manage');
    await fireEvent.press(screen.getByTestId('ps-fold-routines'));
    await fireEvent.press(screen.getByTestId('ps-routine-r1'));
    expect(mockPush).toHaveBeenLastCalledWith('/planner-routines');
  });

  test('the standard look has no page colour or trees; Close closes', async () => {
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
