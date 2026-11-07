import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PressScale, Rise, riseDelay, STAGGER_MS } from '../motion';

describe('motion', () => {
  test('the delay grows by one step per item and stops growing after 8 items', () => {
    expect(riseDelay(0)).toBe(0);
    expect(riseDelay(3)).toBe(3 * STAGGER_MS);
    expect(riseDelay(40)).toBe(8 * STAGGER_MS);
  });

  test('Rise shows its content', async () => {
    await render(
      <Rise index={2}>
        <Text>hello</Text>
      </Rise>,
    );
    expect(screen.getByText('hello')).toBeTruthy();
  });

  test('PressScale still passes the press through', async () => {
    const onPress = jest.fn();
    await render(
      <PressScale testID="p" onPress={onPress} accessibilityRole="button">
        <Text>go</Text>
      </PressScale>,
    );
    await fireEvent.press(screen.getByTestId('p'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
