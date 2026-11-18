import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { DocView } from '../DocView';
import { TOKEN_COLORS } from '../highlight';
import { RichEditor } from '../RichEditor';

const code = JSON.stringify({
  v: 2,
  blocks: [
    { t: 'p', runs: [{ s: 'Pattern:' }] },
    { t: 'p', code: 'auto', runs: [{ s: 'for x in nums:' }] },
    { t: 'p', code: 'auto', hl: 1, runs: [{ s: '    cur += x # go' }] },
  ],
});
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;
const colorOf = (el: { props: { style?: unknown } }): string | undefined =>
  (StyleSheet.flatten(el.props.style as never) as { color?: string } | undefined)?.color;

describe('code in the viewer and in the editor', () => {
  test('the viewer shows one dark box with the language and coloured pieces', async () => {
    await render(wrap(<DocView testID="d" raw={code} />));
    expect(screen.getByTestId('doc-code-1-lang')).toHaveTextContent('Python');
    expect(colorOf(screen.getByText('for'))).toBe(TOKEN_COLORS.k);
    expect(colorOf(screen.getByText('# go'))).toBe(TOKEN_COLORS.c);
    expect(screen.queryByTestId('doc-code-2')).toBeNull();
  });

  test('the editor shows the same box and colours while you type', async () => {
    await render(wrap(<RichEditor value={code} onChange={() => undefined} testID="e" />));
    expect(screen.getByTestId('e-code-1')).toBeTruthy();
    expect(screen.getByTestId('e-block-1')).toHaveTextContent('for x in nums:');
    expect(screen.getByText('Python')).toBeTruthy();
  });
});
