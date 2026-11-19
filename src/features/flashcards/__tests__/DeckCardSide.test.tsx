import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { DeckCardSide } from '../DeckCardSide';

const side = (full = false) =>
  render(
    <ThemeProvider>
      <DeckCardSide
        testID="side"
        label="Answer"
        raw="a very long text"
        image={null}
        audio={null}
        full={full}
      />
    </ThemeProvider>,
  );

const measure = (height: number) =>
  fireEvent(screen.getByTestId('side-measure'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
  });

test('a short text stays as it is, a text taller than the ceiling moves into a fixed-height scrolling box', async () => {
  await side();
  expect(screen.getByTestId('side-scroll')).toBeTruthy();
  await measure(120);
  expect(screen.queryByTestId('side-box')).toBeNull();
  await measure(400);
  expect(screen.getByTestId('side-box').props.style).toMatchObject({ height: 190 });
  // il contenuto è alto quanto il testo misurato: sporge dal riquadro, quindi scorre
  expect(screen.getByTestId('side-box').props.contentContainerStyle).toMatchObject({
    minHeight: 400,
  });
  await measure(120);
  expect(screen.queryByTestId('side-box')).toBeNull();
});

test('with full cards the text has no box that scrolls', async () => {
  await side(true);
  expect(screen.queryByTestId('side-scroll')).toBeNull();
});
