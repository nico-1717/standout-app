import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScreenError } from '../ScreenError';

describe('ScreenError', () => {
  test('shows the real message and lets you try again', async () => {
    const retry = jest.fn();
    await render(<ScreenError error={new Error('boom in the dial')} retry={retry} />);
    expect(screen.getByTestId('screen-error-text')).toHaveTextContent(/boom in the dial/);
    await fireEvent.press(screen.getByTestId('screen-error-retry'));
    expect(retry).toHaveBeenCalled();
  });
});
