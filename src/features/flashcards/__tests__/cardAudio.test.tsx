import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as audio from 'expo-audio';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { CardAudio } from '../CardAudio';

const mocked = audio as unknown as {
  __player: { play: jest.Mock };
  useAudioPlayer: jest.Mock;
  useAudioPlayerStatus: jest.Mock;
};

const wrap = (n: string | null) => (
  <ThemeProvider>
    <CardAudio name={n} testID="aud" />
  </ThemeProvider>
);

beforeEach(() => {
  mocked.__player.play.mockClear();
  mocked.useAudioPlayer.mockClear();
  mocked.useAudioPlayerStatus.mockReturnValue({ didJustFinish: false, playing: false });
});

describe('CardAudio', () => {
  test('draws nothing without a valid file name', async () => {
    await render(wrap(null));
    expect(screen.queryByTestId('aud')).toBeNull();
    await render(wrap('../evil.mp3'));
    expect(screen.queryByTestId('aud')).toBeNull();
  });

  test('no player is made until it is tapped; a tap plays the file from the site', async () => {
    await render(wrap('rec_1.m4a'));
    expect(mocked.useAudioPlayer).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('aud'));
    expect(mocked.useAudioPlayer).toHaveBeenCalledWith({
      uri: expect.stringMatching(/\/media\/flashcard_audio\/rec_1\.m4a$/),
    });
    await waitFor(() => expect(mocked.__player.play).toHaveBeenCalled());
    expect(screen.getByTestId('aud').props.accessibilityState.selected).toBe(true);
  });

  test('a second tap stops it, and it stops by itself when the file ends', async () => {
    const view = await render(wrap('rec_1.m4a'));
    await fireEvent.press(screen.getByTestId('aud'));
    await fireEvent.press(screen.getByTestId('aud'));
    expect(screen.getByTestId('aud').props.accessibilityState.selected).toBe(false);
    await fireEvent.press(screen.getByTestId('aud'));
    mocked.useAudioPlayerStatus.mockReturnValue({ didJustFinish: true, playing: false });
    await view.rerender(wrap('rec_1.m4a'));
    expect(screen.getByTestId('aud').props.accessibilityState.selected).toBe(false);
  });
});
