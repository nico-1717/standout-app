import { render, screen } from '@testing-library/react-native';

import { MonthScene } from '../MonthScene';

describe('<MonthScene>', () => {
  test.each([1, 4, 8, 11, 12])('month %i renders without crashing', async (m) => {
    await render(<MonthScene month={m} page="#F6F1E9" />);
    expect(screen.getByTestId('month-scene', { includeHiddenElements: true })).toBeTruthy();
  });

  test('a month that does not exist draws nothing', async () => {
    await render(<MonthScene month={0} page="#fff" />);
    expect(screen.queryByTestId('month-scene', { includeHiddenElements: true })).toBeNull();
  });

  test('is hidden from screen readers and ignores touches', async () => {
    await render(<MonthScene month={5} page="#fff" />);
    const scene = screen.getByTestId('month-scene', { includeHiddenElements: true });
    expect(scene.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(scene.props.pointerEvents).toBe('none');
  });
});
