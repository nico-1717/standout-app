import { render, screen } from '@testing-library/react-native';

import { BreakScene } from '../BreakScene';

describe('BreakScene', () => {
  test('draws at the width asked, with the website proportions, and is drawn at that size', async () => {
    await render(<BreakScene color="#000000" accent="#25B3A7" width={240} testID="scene" />);
    const svg = screen.getByTestId('scene');
    expect(svg.props.style.width).toBe(240);
    expect(svg.props.style.height).toBeCloseTo((240 * 132) / 320, 5);
  });

  test('renders in the default size too', async () => {
    await render(<BreakScene color="#fff" accent="#0f0" />);
    expect(screen.getByTestId('break-scene').props.style.width).toBe(300);
  });
});
