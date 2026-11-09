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
    localPrefs: { highContrast: mockHigh },
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
