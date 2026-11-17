import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { DEFAULT_BAR, moveBar } from '@/core/settings/bar';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { AppTabBar } from '../AppTabBar';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
let mockBar = DEFAULT_BAR;
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ localPrefs: { bar: mockBar } }),
}));

const bar = (name = 'home') =>
  render(
    <ThemeProvider>
      <AppTabBar
        state={{ routes: [{ name }], index: 0 } as never}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />
    </ThemeProvider>,
  );

beforeEach(() => {
  mockNavigate.mockClear();
  mockBar = DEFAULT_BAR;
});

test('shows every page: pinned ones, a divider, then the scrollable ones', async () => {
  await bar();
  for (const id of [
    'home',
    'planner',
    'todo',
    'buy',
    'pills',
    'habits',
    'pomodoro',
    'diary',
    'grades',
    'flashcards',
    'languages',
    'projects',
    'settings',
  ])
    expect(screen.getByTestId(`bar-${id}`)).toBeTruthy();
  expect(screen.getByTestId('bar-divider')).toBeTruthy();
});

test('a hidden page is not in the bar, and no divider without pinned pages', async () => {
  mockBar = moveBar({ ...DEFAULT_BAR, pinned: [] }, { kind: 'hide', id: 'diary', on: true });
  await bar();
  expect(screen.queryByTestId('bar-diary')).toBeNull();
  expect(screen.queryByTestId('bar-divider')).toBeNull();
});

test('To do / To buy / Pills open already scrolled to the tabs; other pages do not', async () => {
  await bar();
  await fireEvent.press(screen.getByTestId('bar-buy'));
  expect(mockNavigate).toHaveBeenLastCalledWith({
    pathname: '/buy',
    params: { focus: expect.any(String) },
  });
  await fireEvent.press(screen.getByTestId('bar-todo'));
  expect(mockNavigate).toHaveBeenLastCalledWith({
    pathname: '/',
    params: { focus: expect.any(String) },
  });
  await fireEvent.press(screen.getByTestId('bar-habits'));
  expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/habits', params: undefined });
});
