import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { AppLock, useAppLock } from '../AppLock';
import { LockCard } from '../LockCard';

let mockStored: string | null = null;
let mockAuth: 'ok' | 'failed' | 'unavailable' = 'ok';
let mockListener: ((s: string) => void) | null = null;
const mockAuthenticate = jest.fn(async () => mockAuth);

jest.mock('../store', () => ({
  readLockEnabled: async () => mockStored === '1',
  writeLockEnabled: async (on: boolean) => {
    mockStored = on ? '1' : null;
  },
}));
jest.mock('../biometrics', () => ({ authenticate: () => mockAuthenticate() }));

function Probe() {
  const { enabled, setEnabled } = useAppLock();
  return (
    <>
      <Text testID="probe-enabled">{String(enabled)}</Text>
      <Text testID="probe-on" onPress={() => void setEnabled(true, 'why')}>
        on
      </Text>
      <Text testID="content">content</Text>
    </>
  );
}
const flush = () => act(async () => undefined);

beforeEach(() => {
  mockStored = null;
  mockAuth = 'ok';
  mockListener = null;
  mockAuthenticate.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _: string,
    cb: (s: string) => void,
  ) => {
    mockListener = cb;
    return { remove: () => undefined };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

describe('AppLock', () => {
  test('off by default: shows the app, no cover, no prompt', async () => {
    await render(
      <AppLock>
        <Probe />
      </AppLock>,
    );
    await flush();
    expect(screen.getByTestId('content')).toBeTruthy();
    expect(screen.queryByTestId('app-lock-cover')).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  test('turning it on asks first, and a failed check leaves it off', async () => {
    mockAuth = 'failed';
    await render(
      <AppLock>
        <Probe />
      </AppLock>,
    );
    await flush();
    await fireEvent.press(screen.getByTestId('probe-on'));
    await flush();
    expect(screen.getByTestId('probe-enabled').props.children).toBe('false');
    expect(mockStored).toBeNull();
    mockAuth = 'ok';
    await fireEvent.press(screen.getByTestId('probe-on'));
    await flush();
    expect(screen.getByTestId('probe-enabled').props.children).toBe('true');
    expect(mockStored).toBe('1');
  });

  test('on: starts covered, asks by itself, and opens after a good check', async () => {
    mockStored = '1';
    await render(
      <AppLock>
        <Probe />
      </AppLock>,
    );
    await flush();
    await flush();
    expect(mockAuthenticate).toHaveBeenCalled();
    expect(screen.queryByTestId('app-lock-cover')).toBeNull();
  });

  test('a failed check keeps the cover with a message and a button to try again', async () => {
    mockStored = '1';
    mockAuth = 'failed';
    await render(
      <AppLock>
        <Probe />
      </AppLock>,
    );
    await flush();
    await flush();
    expect(screen.getByTestId('app-lock-cover')).toBeTruthy();
    expect(screen.getByTestId('app-lock-failed')).toBeTruthy();
    mockAuth = 'ok';
    await fireEvent.press(screen.getByTestId('app-lock-unlock'));
    await flush();
    expect(screen.queryByTestId('app-lock-cover')).toBeNull();
  });

  test('covers when the app leaves the front; locks again only after the grace time', async () => {
    mockStored = '1';
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await render(
      <AppLock>
        <Probe />
      </AppLock>,
    );
    await flush();
    await flush();
    expect(screen.queryByTestId('app-lock-cover')).toBeNull();
    mockAuthenticate.mockClear();

    await act(async () => mockListener?.('background'));
    expect(screen.getByTestId('app-lock-cover')).toBeTruthy();
    now.mockReturnValue(1_000_000 + 5_000);
    await act(async () => mockListener?.('active'));
    await flush();
    expect(screen.queryByTestId('app-lock-cover')).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();

    await act(async () => mockListener?.('background'));
    now.mockReturnValue(1_000_000 + 5_000 + 60_000);
    await act(async () => mockListener?.('active'));
    await flush();
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });
});

describe('LockCard', () => {
  const card = () => (
    <ThemeProvider>
      <AppLock>
        <LockCard />
      </AppLock>
    </ThemeProvider>
  );
  test('the switch turns the lock on after a good check', async () => {
    await render(card());
    await flush();
    await fireEvent(screen.getByTestId('lock-switch'), 'valueChange', true);
    await flush();
    expect(mockStored).toBe('1');
  });
  test('without Face ID, fingerprint or code, it explains and stays off', async () => {
    mockAuth = 'unavailable';
    await render(card());
    await flush();
    await fireEvent(screen.getByTestId('lock-switch'), 'valueChange', true);
    await flush();
    expect(mockStored).toBeNull();
    expect(screen.getByTestId('lock-message')).toBeTruthy();
  });
});
