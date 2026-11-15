import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import { buyTheme } from '@/features/buy/buyTheme';

import { TodoTabs } from '../TodoTabs';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));

function Host({ current }: { current: 'todo' | 'buy' | 'pills' }) {
  const th = useTheme();
  return <TodoTabs current={current} bt={buyTheme('standard', th)} />;
}

const renderTabs = (current: 'todo' | 'buy' | 'pills') =>
  render(
    <ThemeProvider>
      <Host current={current} />
    </ThemeProvider>,
  );

describe('To do · To buy · Pills tabs', () => {
  beforeEach(() => mockNavigate.mockClear());

  test('shows the three lists and marks the current one', async () => {
    await renderTabs('buy');
    expect(screen.getByText('To do')).toBeTruthy();
    expect(screen.getByText('To buy')).toBeTruthy();
    expect(screen.getByText('Pills')).toBeTruthy();
    expect(screen.getByTestId('todo-tab-buy').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('todo-tab-todo').props.accessibilityState.selected).toBe(false);
  });

  test('tapping another list opens it; tapping the current one does nothing', async () => {
    await renderTabs('todo');
    await fireEvent.press(screen.getByTestId('todo-tab-pills'));
    expect(mockNavigate).toHaveBeenCalledWith('/pills');
    await fireEvent.press(screen.getByTestId('todo-tab-buy'));
    expect(mockNavigate).toHaveBeenCalledWith('/buy');
    mockNavigate.mockClear();
    await fireEvent.press(screen.getByTestId('todo-tab-todo'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
