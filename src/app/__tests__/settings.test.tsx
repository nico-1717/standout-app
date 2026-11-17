import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import { Text } from 'react-native';

import SettingsScreen from '../(tabs)/settings';

const mockUpdateLocalPrefs = jest.fn();
const mockSetUiStyle = jest.fn();
let mockHigh = false;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/lock/LockCard', () => ({ LockCard: () => null }));
jest.mock('@/features/reminders/RemindersCard', () => ({ RemindersCard: () => null }));
jest.mock('@/features/account/SpaceCard', () => ({ SpaceCard: () => null }));
jest.mock('@/ui/SyncBadge', () => ({ SyncBadge: () => null }));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    authState: { status: 'signedIn', user: { email: 'a@b.c', username: 'nico' } },
    services: null,
    syncInfo: { status: 'idle', lastSyncAt: null, pending: 0 },
    signOut: jest.fn(),
    version: 0,
    uiStyle: 'standard',
    setUiStyle: mockSetUiStyle,
    settings: { ui_style: 'standard', accent: 'blue', lang: null },
    updateSettings: jest.fn(),
    localPrefs: {
      highContrast: mockHigh,
      bar: jest.requireActual('@/core/settings/bar').DEFAULT_BAR,
    },
    updateLocalPrefs: mockUpdateLocalPrefs,
  }),
}));

describe('settings: high contrast', () => {
  beforeEach(() => {
    mockUpdateLocalPrefs.mockClear();
    mockHigh = false;
  });

  test('the switch shows the current value and changes the local preference', async () => {
    await render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );
    const sw = screen.getByTestId('high-contrast');
    expect(sw.props.value).toBe(false);
    await fireEvent(sw, 'valueChange', true);
    expect(mockUpdateLocalPrefs).toHaveBeenCalledWith({ highContrast: true });
  });

  test('when it is on, the theme text is full black (light) and the switch is on', async () => {
    mockHigh = true;
    function Probe() {
      const th = useTheme();
      return <Text testID="probe">{th.text}</Text>;
    }
    await render(
      <ThemeProvider highContrast>
        <Probe />
        <SettingsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('high-contrast').props.value).toBe(true);
    expect(screen.getByTestId('probe')).toHaveTextContent(/^#(000000|FFFFFF)$/);
  });
});

describe('settings: bottom bar editor', () => {
  beforeEach(() => mockUpdateLocalPrefs.mockClear());
  const open = () =>
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );

  test('lists Home and Planner as pinned and the other pages as scrollable', async () => {
    await open();
    expect(screen.getByTestId('bar-row-home')).toBeTruthy();
    expect(screen.getByTestId('bar-row-pomodoro')).toBeTruthy();
    // Da comprare, Pillole e Lingue stanno dentro altre icone: di base sono fra le nascoste
    expect(screen.getByTestId('bar-row-buy')).toBeTruthy();
    expect(screen.queryByTestId('bar-empty-hidden')).toBeNull();
    // «Altro» non si nasconde
    expect(screen.queryByTestId('bar-hide-settings')).toBeNull();
  });

  test('pinning, hiding and moving save the new bar', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('bar-pin-todo'));
    expect(mockUpdateLocalPrefs).toHaveBeenLastCalledWith({
      bar: expect.objectContaining({ pinned: ['home', 'planner', 'todo'] }),
    });
    await fireEvent.press(screen.getByTestId('bar-hide-diary'));
    expect(mockUpdateLocalPrefs).toHaveBeenLastCalledWith({
      bar: expect.objectContaining({ hidden: ['buy', 'pills', 'languages', 'diary'] }),
    });
    await fireEvent.press(screen.getByTestId('bar-down-home'));
    expect(mockUpdateLocalPrefs).toHaveBeenLastCalledWith({
      bar: expect.objectContaining({ order: expect.arrayContaining(['home']) }),
    });
    await fireEvent.press(screen.getByTestId('bar-reset'));
    expect(mockUpdateLocalPrefs).toHaveBeenLastCalledWith({
      bar: expect.objectContaining({
        pinned: ['home', 'planner'],
        hidden: ['buy', 'pills', 'languages'],
      }),
    });
  });
});
