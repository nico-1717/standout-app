import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { DocView } from '../../DocView';
import { MathView } from '../MathView';

describe('MathView', () => {
  test('draws every piece of a fraction and keeps the LaTeX as the spoken label', async () => {
    await render(<MathView testID="m" tex="\frac{a+b}{c}" color="#000" />);
    expect(screen.getByTestId('m').props.accessibilityLabel).toBe('\\frac{a+b}{c}');
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('c')).toBeTruthy();
    expect(screen.getByText('+')).toBeTruthy();
  });

  test.each([
    'x_i^2',
    '\\sqrt[3]{x}',
    '\\sum_{i=1}^{n} i',
    '\\int_0^1 f',
    '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}',
    '\\left(\\frac{a}{b}\\right)',
    '\\vec{v}',
    '\\overline{AB}',
    '\\foo',
  ])('draws %s without errors', async (tex) => {
    const view = await render(<MathView tex={tex} color="#000" />);
    expect(view.toJSON()).not.toBeNull();
  });

  test('an empty formula draws nothing', async () => {
    const view = await render(<MathView tex="  " color="#000" />);
    expect(view.toJSON()).toBeNull();
  });
});

describe('DocView formulas', () => {
  const doc = (blocks: unknown[]) => JSON.stringify({ v: 2, blocks });
  test('a block formula and an inline formula are drawn, not shown as LaTeX', async () => {
    await render(
      <ThemeProvider>
        <DocView
          testID="dv"
          raw={doc([
            { t: 'fx', tex: '\\frac{1}{2}' },
            { t: 'p', runs: [{ s: 'valore ' }, { x: 'x^2' }] },
          ])}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('doc-fx-0').props.accessibilityLabel).toBe('\\frac{1}{2}');
    expect(screen.queryByText('\\frac{1}{2}')).toBeNull();
    expect(screen.getByText('valore')).toBeTruthy();
  });
});
