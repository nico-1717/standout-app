import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FLIP_MS, FLIP_PERSPECTIVE, FlipCard } from '../FlipCard';

const faces = (flipped: boolean) => (
  <FlipCard
    flipped={flipped}
    front={<Text testID="q">question</Text>}
    back={<Text testID="a">answer</Text>}
  />
);

describe('<FlipCard>', () => {
  test('turns like the website: half a second, with depth', () => {
    expect(FLIP_MS).toBe(550);
    expect(FLIP_PERSPECTIVE).toBe(1400);
  });

  test('only the face that is showing can be read', async () => {
    const { rerender } = await render(faces(false));
    expect(screen.getByTestId('q')).toBeTruthy();
    expect(screen.queryByTestId('a')).toBeNull();
    await rerender(faces(true));
    expect(screen.getByTestId('a')).toBeTruthy();
    expect(screen.queryByTestId('q')).toBeNull();
  });
});
