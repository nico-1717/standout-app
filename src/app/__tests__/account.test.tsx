import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import i18n from '@/core/i18n';
import { ApiError } from '@/core/api/httpApi';
import { FieldsError } from '@/core/account/accountApi';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import AccountScreen, { exportName } from '../account';
import Forgot from '../forgot';
import Register from '../register';

const mockBack = jest.fn();
const mockSignOut = jest.fn(async () => ({ blocked: 0 }));
let mockUser = { id: 1, username: 'nico', email: 'n@x.it', email_verified: true, lang: 'en' };
const mockAccount = {
  devices: jest.fn(),
  changePassword: jest.fn(),
  deleteAccount: jest.fn(),
  exportData: jest.fn(),
  revokeDevice: jest.fn(),
  logoutEverywhere: jest.fn(),
  resendVerification: jest.fn(),
};
const mockAuth = { login: jest.fn(), register: jest.fn(), forgot: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => undefined) }));
const mockWrite = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri: string;
    constructor(_dir: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
    create() {}
    write(b: unknown) {
      mockWrite(b);
    }
  },
}));
jest.mock('@/core/app/AppProvider', () => ({
  BASE_URL: 'https://site',
  useApp: () => ({
    authState: { status: 'signedIn', user: mockUser, termsRequired: false },
    auth: mockAuth,
    account: mockAccount,
    signOut: mockSignOut,
  }),
}));

const T = (k: string) => i18n.t(k) as string;
const ui = (el: React.ReactElement) => render(<ThemeProvider accent="indigo">{el}</ThemeProvider>);
const dev = (id: number, current = false) => ({
  id,
  name: `Phone ${id}`,
  created_at: '2026-11-01 10:00:00',
  last_used_at: '2026-11-02 09:30:00',
  current,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 1, username: 'nico', email: 'n@x.it', email_verified: true, lang: 'en' };
  mockAccount.devices.mockResolvedValue([dev(1, true), dev(2)]);
});

describe('exportName', () => {
  test('uses the local date', () => {
    expect(exportName(new Date(2026, 10, 2))).toBe('standout-i-miei-dati-2026-11-02.zip');
  });
});

describe('Account screen', () => {
  test('lists the devices; only the other ones can be signed out', async () => {
    await ui(<AccountScreen />);
    expect(await screen.findByTestId('device-1')).toBeTruthy();
    expect(screen.queryByTestId('device-revoke-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('device-revoke-2'));
    await waitFor(() => expect(mockAccount.revokeDevice).toHaveBeenCalledWith(2));
    expect(mockAccount.devices).toHaveBeenCalledTimes(2);
  });

  test('change password logs in again with the new password', async () => {
    mockAccount.changePassword.mockResolvedValue(undefined);
    await ui(<AccountScreen />);
    await fireEvent.changeText(screen.getByTestId('pw-current'), 'old-password');
    await fireEvent.changeText(screen.getByTestId('pw-new'), 'new-password-1');
    await fireEvent.changeText(screen.getByTestId('pw-again'), 'new-password-1');
    await fireEvent.press(screen.getByTestId('pw-save'));
    await waitFor(() => expect(mockAuth.login).toHaveBeenCalledWith('nico', 'new-password-1'));
    expect(mockAccount.changePassword).toHaveBeenCalledWith(
      'old-password',
      'new-password-1',
      'new-password-1',
    );
    expect((await screen.findByTestId('pw-note')).props.children).toBe(
      T('app.password_cambiata_qui'),
    );
    expect(screen.getByTestId('pw-current').props.value).toBe('');
  });

  test('change password shows the server text under the right field', async () => {
    mockAccount.changePassword.mockRejectedValue(
      new FieldsError(422, 'validation', 'bad', { attuale: 'Wrong password' }),
    );
    await ui(<AccountScreen />);
    await fireEvent.press(screen.getByTestId('pw-save'));
    expect((await screen.findByTestId('pw-error-attuale')).props.children).toBe('Wrong password');
    expect(mockAuth.login).not.toHaveBeenCalled();
  });

  test('download writes the ZIP and opens the share sheet', async () => {
    const Sharing = jest.requireMock('expo-sharing');
    mockAccount.exportData.mockResolvedValue(new Uint8Array([80, 75]));
    await ui(<AccountScreen />);
    await fireEvent.press(screen.getByTestId('export-btn'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect(mockWrite).toHaveBeenCalledWith(new Uint8Array([80, 75]));
    expect(Sharing.shareAsync.mock.calls[0][0]).toMatch(
      /standout-i-miei-dati-\d{4}-\d\d-\d\d\.zip$/,
    );
  });

  test('download failure shows a message and does not share', async () => {
    const Sharing = jest.requireMock('expo-sharing');
    mockAccount.exportData.mockRejectedValue(new ApiError(500, 'x', 'x'));
    await ui(<AccountScreen />);
    await fireEvent.press(screen.getByTestId('export-btn'));
    expect((await screen.findByTestId('export-note')).props.children).toBe(T('app.scarica_errore'));
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  test('sign out everywhere asks first, then signs out here too', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockAccount.logoutEverywhere.mockResolvedValue(undefined);
    await ui(<AccountScreen />);
    await fireEvent.press(screen.getByTestId('logout-all'));
    expect(mockAccount.logoutEverywhere).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => {
      buttons[1].onPress?.();
    });
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ discardPending: true }));
    expect(mockAccount.logoutEverywhere).toHaveBeenCalled();
  });

  test('if the server cannot sign out everywhere, this phone stays signed in', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockAccount.logoutEverywhere.mockRejectedValue(new Error('offline'));
    await ui(<AccountScreen />);
    await fireEvent.press(screen.getByTestId('logout-all'));
    await act(async () => {
      alert.mock.calls[0][2]![1].onPress?.();
    });
    await screen.findByTestId('devices-note');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  test('delete needs the tick and the password; then the phone is wiped', async () => {
    mockAccount.deleteAccount.mockResolvedValue(undefined);
    await ui(<AccountScreen />);
    await fireEvent.changeText(screen.getByTestId('delete-password'), 'secret');
    await fireEvent.press(screen.getByTestId('delete-btn'));
    expect(mockAccount.deleteAccount).not.toHaveBeenCalled(); // not ticked yet
    await fireEvent(screen.getByTestId('delete-ack'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('delete-btn'));
    await waitFor(() => expect(mockAccount.deleteAccount).toHaveBeenCalledWith('secret'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ discardPending: true }));
  });

  test('a wrong password on delete keeps the account and the data', async () => {
    mockAccount.deleteAccount.mockRejectedValue(
      new FieldsError(403, 'bad_password', 'x', { password: 'Wrong password.' }),
    );
    await ui(<AccountScreen />);
    await fireEvent.changeText(screen.getByTestId('delete-password'), 'nope');
    await fireEvent(screen.getByTestId('delete-ack'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('delete-btn'));
    expect((await screen.findByTestId('delete-note')).props.children).toBe('Wrong password.');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  test('the verification banner shows only for an unverified email', async () => {
    await ui(<AccountScreen />);
    expect(screen.queryByTestId('verify-banner')).toBeNull();
  });

  test('resend verification reports what the server said', async () => {
    mockUser = { ...mockUser, email_verified: false };
    mockAccount.resendVerification.mockResolvedValue('attendi');
    await ui(<AccountScreen />);
    await fireEvent.press(screen.getByTestId('verify-resend'));
    expect((await screen.findByTestId('verify-note')).props.children).toBe(
      T('verifica_email.avviso_attendi'),
    );
  });
});

describe('Register screen', () => {
  test('sends the form, with the checkbox state', async () => {
    mockAuth.register.mockResolvedValue(undefined);
    await ui(<Register />);
    await fireEvent.changeText(screen.getByTestId('reg-username'), ' nico ');
    await fireEvent.changeText(screen.getByTestId('reg-email'), 'n@x.it');
    await fireEvent.changeText(screen.getByTestId('reg-password'), 'longpassword1');
    await fireEvent.changeText(screen.getByTestId('reg-password2'), 'longpassword1');
    await fireEvent.press(screen.getByTestId('reg-accept'));
    await fireEvent.press(screen.getByText(T('auth.crea_account')));
    await waitFor(() => expect(mockAuth.register).toHaveBeenCalled());
    expect(mockAuth.register).toHaveBeenCalledWith({
      username: 'nico',
      email: 'n@x.it',
      password: 'longpassword1',
      passwordConfirm: 'longpassword1',
      accept: true,
    });
  });

  test('shows the server error under each field', async () => {
    mockAuth.register.mockRejectedValue(
      new FieldsError(422, 'validation', 'x', { email: 'Already used', username: 'Taken' }),
    );
    await ui(<Register />);
    await fireEvent.press(screen.getByText(T('auth.crea_account')));
    expect((await screen.findByTestId('reg-error-email')).props.children).toBe('Already used');
    expect(screen.getByTestId('reg-error-username').props.children).toBe('Taken');
  });

  test('a network failure shows the network message', async () => {
    mockAuth.register.mockRejectedValue(new TypeError('Network request failed'));
    await ui(<Register />);
    await fireEvent.press(screen.getByText(T('auth.crea_account')));
    expect(await screen.findByText(T('auth.err_rete'))).toBeTruthy();
  });
});

describe('Forgot screen', () => {
  test('asks for something to look up first', async () => {
    await ui(<Forgot />);
    await fireEvent.press(screen.getByText(T('password_reset.invia')));
    expect(await screen.findByText(T('password_reset.err_vuoto'))).toBeTruthy();
    expect(mockAuth.forgot).not.toHaveBeenCalled();
  });

  test('shows the same answer once sent', async () => {
    mockAuth.forgot.mockResolvedValue(undefined);
    await ui(<Forgot />);
    await fireEvent.changeText(screen.getByTestId('forgot-id'), 'nico');
    await fireEvent.press(screen.getByText(T('password_reset.invia')));
    expect(await screen.findByTestId('forgot-done')).toBeTruthy();
    expect(mockAuth.forgot).toHaveBeenCalledWith('nico');
  });

  test('too many requests shows the rate message', async () => {
    mockAuth.forgot.mockRejectedValue(new ApiError(429, 'rate_limited', 'x'));
    await ui(<Forgot />);
    await fireEvent.changeText(screen.getByTestId('forgot-id'), 'nico');
    await fireEvent.press(screen.getByText(T('password_reset.invia')));
    expect(await screen.findByText(T('password_reset.err_troppe'))).toBeTruthy();
  });
});
