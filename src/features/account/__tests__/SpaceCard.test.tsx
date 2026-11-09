import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { SpaceCard, formatBytes, spacePercent } from '../SpaceCard';

const mockStorage = jest.fn();
let mockRefused = 0;
const mockClear = jest.fn(() => {
  mockRefused = 0;
});

jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    account: { storage: mockStorage },
    services: { media: { spaceRefused: () => mockRefused, clearSpaceRefused: mockClear } },
  }),
}));

const ui = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);
const MB = 1024 * 1024;

beforeEach(() => {
  jest.clearAllMocks();
  mockRefused = 0;
});

describe('space numbers', () => {
  test('bytes read as B, KB, MB, GB', () => {
    expect(formatBytes(0, 'en')).toBe('0 B');
    expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatBytes(500 * MB, 'en')).toBe('500 MB');
    expect(formatBytes(3 * 1024 * MB, 'en')).toBe('3 GB');
  });
  test('percent is clamped, and empty with no limit', () => {
    expect(spacePercent({ used: 50, quota: 200 })).toBe(25);
    expect(spacePercent({ used: 900, quota: 200 })).toBe(100);
    expect(spacePercent({ used: 5, quota: 0 })).toBe(0);
  });
});

describe('Space card', () => {
  test('shows used / limit and the bar, without a warning when there is room', async () => {
    mockStorage.mockResolvedValue({ used: 100 * MB, quota: 500 * MB });
    await ui(<SpaceCard />);
    expect(await screen.findByTestId('space-text')).toHaveTextContent('100 MB used of 500 MB');
    expect(screen.getByTestId('space-bar').props.accessibilityValue.now).toBe(20);
    expect(screen.queryByTestId('space-warn')).toBeNull();
    expect(screen.queryByTestId('space-full')).toBeNull();
  });

  test('almost full → warning', async () => {
    mockStorage.mockResolvedValue({ used: 460 * MB, quota: 500 * MB });
    await ui(<SpaceCard />);
    expect(await screen.findByTestId('space-warn')).toBeTruthy();
  });

  test('full → stronger message', async () => {
    mockStorage.mockResolvedValue({ used: 500 * MB, quota: 500 * MB });
    await ui(<SpaceCard />);
    expect(await screen.findByTestId('space-full')).toBeTruthy();
  });

  test('no network and nothing refused: the card is not there', async () => {
    mockStorage.mockRejectedValue(new Error('offline'));
    await ui(<SpaceCard />);
    await Promise.resolve();
    expect(screen.queryByTestId('space-text')).toBeNull();
    expect(screen.queryByText('Space')).toBeNull();
  });

  test('refused files stay visible even offline, until the user says "Got it"', async () => {
    mockRefused = 3;
    mockStorage.mockRejectedValue(new Error('offline'));
    await ui(<SpaceCard />);
    expect(await screen.findByTestId('space-refused')).toHaveTextContent(/3 files were not saved/);
    await fireEvent.press(screen.getByTestId('space-ok'));
    expect(mockClear).toHaveBeenCalled();
    expect(screen.queryByTestId('space-refused')).toBeNull();
  });
});
