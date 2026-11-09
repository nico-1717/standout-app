import { render, screen } from '@testing-library/react-native';

import { Hourglass, bottomLevel, bottomSandPath, topSandPath } from '../Hourglass';

describe('hourglass sand', () => {
  test('a full top has its edge high up; an empty top is just the neck', () => {
    expect(topSandPath(0)).toBe('M 693,378 Z');
    expect(topSandPath(1)).toContain('M 450,190 Q 693,190 940,190');
  });

  test('the middle of the surface dips more as the top empties', () => {
    const mid = (fill: number) => Number(/Q 693,(\d+(?:\.\d+)?) 940/.exec(topSandPath(fill))![1]);
    expect(mid(0.5)).toBeGreaterThan(378 - 0.5 * 188);
    expect(mid(1)).toBe(190);
  });

  test('the bottom pile grows as the top empties, with a mound only while sand is falling', () => {
    expect(bottomLevel(1)).toEqual({ y: 614, mound: 0 });
    expect(bottomLevel(0)).toEqual({ y: 426, mound: 0 });
    expect(bottomLevel(0.5).mound).toBe(22);
    expect(bottomLevel(0.25).y).toBeLessThan(bottomLevel(0.75).y);
    expect(bottomSandPath(0)).toContain('L 940,426');
  });
});

describe('<Hourglass>', () => {
  test('draws at the width asked for, keeping the glass proportions', async () => {
    await render(<Hourglass fraction={0.3} running color="#f00" glass="#999" width={100} />);
    const style = screen.getByTestId('hourglass').props.style;
    expect(style.width).toBe(100);
    expect(style.height).toBeCloseTo(100 / (430 / 680), 5);
  });

  test('renders while still, finished and flipping without crashing', async () => {
    await render(<Hourglass fraction={1} running={false} color="#f00" glass="#999" flip />);
    expect(screen.getByTestId('hourglass')).toBeTruthy();
  });
});
