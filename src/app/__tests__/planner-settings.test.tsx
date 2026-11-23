import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

import '@/core/i18n';
import { wxState } from '@/core/account/accountApi';
import { weatherStore } from '@/features/planner/weather';
import { parseGcCalendars, parseGcStatus } from '@/features/planner/gcal';
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
const mockStatus = jest.fn();
const mockAccount = {
  gcStatus: () => mockStatus() as Promise<unknown>,
  gcCalendars: jest.fn(async () => parseGcCalendars({ google: [], mine: [] })),
  gcSync: jest.fn(async () => undefined),
  gcDisconnect: jest.fn(async () => undefined),
  gcRepair: jest.fn(async () => 2),
  gcSetModes: jest.fn(async () => undefined),
  gcMapSet: jest.fn(async () => undefined),
  gcPushSet: jest.fn(async () => undefined),
  gcConnectUrl: () => 'https://site.test/planner/google_calendar.php?action=connect',
  weather: jest.fn(async () => ({ enabled: false, giorni: {}, adesso: null })),
  weatherEnable: jest.fn(),
  weatherMode: jest.fn(),
};
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    account: mockAccount,
    services: { planner: mockPlanner },
    version: 0,
    uiStyle: mockStyle,
    plannerSettings: mockSettings,
    updatePlannerSettings: mockUpdate,
  }),
}));

const connected = {
  ok: true,
  configured: true,
  connected: true,
  email: 'nico@example.com',
  last_sync: '2026-11-18 14:03:00',
  calendar: 'Standout',
  modes: { dedicated: 'all', primary: 'none' },
  window: { back: 30, forward: 180 },
  build: 'v7',
};
beforeEach(() => {
  mockStatus.mockReset();
  mockStatus.mockImplementation(async () => parseGcStatus({ ok: true, configured: true }));
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

describe('Google Calendar card (as the website one)', () => {
  const open = async () => {
    await render(
      <ThemeProvider>
        <PlannerSettingsScreen />
      </ThemeProvider>,
    );
  };

  test('not connected: it opens by itself and the button goes to the website consent page', async () => {
    const link = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    await open();
    await waitFor(() => expect(screen.getByTestId('gc-connect')).toBeTruthy());
    expect(screen.getByTestId('ps-google-state')).toHaveTextContent('Not connected');
    await fireEvent.press(screen.getByTestId('gc-connect'));
    expect(link).toHaveBeenCalledWith(
      'https://site.test/planner/google_calendar.php?action=connect',
    );
  });

  test('connected: the header says who, and the body stays closed until you tap it', async () => {
    mockStatus.mockImplementation(async () => parseGcStatus(connected));
    await open();
    await waitFor(() =>
      expect(screen.getByTestId('ps-google-sub')).toHaveTextContent('nico@example.com'),
    );
    expect(screen.getByTestId('ps-google-state')).toHaveTextContent('Connected');
    expect(screen.queryByTestId('ps-google-body')).toBeNull();
    await fireEvent.press(screen.getByTestId('ps-google-head'));
    expect(screen.getByTestId('gc-when')).toHaveTextContent(/last sync: november 18, 14:03/);
    expect(screen.getByTestId('gc-bridge')).toBeTruthy();
  });

  test('sync, the two choices and the repair go to the server', async () => {
    mockStatus.mockImplementation(async () => parseGcStatus(connected));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await open();
    await waitFor(() => expect(screen.getByTestId('ps-google-head')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('ps-google-head'));
    await fireEvent.press(screen.getByTestId('gc-sync'));
    expect(mockAccount.gcSync).toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('gc-dedicated'));
    await fireEvent.press(screen.getByTestId('gc-dedicated-high'));
    expect(mockAccount.gcSetModes).toHaveBeenCalledWith({ gc_dedicated: 'high' });
    await fireEvent.press(screen.getByTestId('gc-primary'));
    await fireEvent.press(screen.getByTestId('gc-primary-highest'));
    expect(mockAccount.gcSetModes).toHaveBeenCalledWith({ gc_primary: 'highest' });

    // riparare chiede conferma, e poi dice quante copie ha tolto
    await fireEvent.press(screen.getByTestId('gc-repair'));
    const buttons = alert.mock.calls.at(-1)![2]!;
    await buttons.find((b) => b.style !== 'cancel')!.onPress!();
    await waitFor(() => expect(screen.getByTestId('gc-message')).toHaveTextContent(/^2 copies/));
  });

  test('disconnecting asks first', async () => {
    mockStatus.mockImplementation(async () => parseGcStatus(connected));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await open();
    await waitFor(() => expect(screen.getByTestId('ps-google-head')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('ps-google-head'));
    await fireEvent.press(screen.getByTestId('gc-disconnect'));
    expect(mockAccount.gcDisconnect).not.toHaveBeenCalled();
    await alert.mock.calls.at(-1)![2]!.find((b) => b.style === 'destructive')!.onPress!();
    expect(mockAccount.gcDisconnect).toHaveBeenCalled();
  });

  test('a server that cannot answer says so', async () => {
    mockStatus.mockImplementation(async () => Promise.reject(new Error('net')));
    await open();
    await fireEvent.press(screen.getByTestId('ps-google-head'));
    await waitFor(() => expect(screen.getByText('Status not available.')).toBeTruthy());
  });

  describe('weather: Automatic mode', () => {
    const manualState = () =>
      wxState({ enabled: true, place: 'Milano', lat: 45.46, lon: 9.19, auto: false });
    const start = async (here: { lat: number; lon: number } | null) => {
      weatherStore.state = manualState();
      weatherStore.locate = jest.fn(async () => here);
      mockAccount.weather.mockImplementation(async () => weatherStore.state as never);
      await open();
      await fireEvent.press(screen.getByTestId('ps-weather-mode-auto'));
    };

    test('uses the live position and saves it as Automatic', async () => {
      mockAccount.weatherEnable.mockImplementation(async () =>
        wxState({ enabled: true, place: 'Roma', lat: 41.9, lon: 12.5, auto: true }),
      );
      await start({ lat: 41.9, lon: 12.5 });
      await waitFor(() => expect(mockAccount.weatherEnable).toHaveBeenCalledWith(41.9, 12.5, true));
      expect(screen.queryByTestId('ps-weather-note')).toBeNull();
    });

    test('without a position it stays manual and says why', async () => {
      mockAccount.weatherEnable.mockClear();
      await start(null);
      await waitFor(() => expect(screen.getByTestId('ps-weather-note')).toBeTruthy());
      expect(mockAccount.weatherEnable).not.toHaveBeenCalled();
      expect(weatherStore.state?.auto).toBe(false);
    });
  });
});
