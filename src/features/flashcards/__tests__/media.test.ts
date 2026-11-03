import { cardAudioUrl, cardImageUrl } from '../media';

describe('card media addresses', () => {
  test('a server-chosen name becomes an address in the media folder', () => {
    expect(cardImageUrl('a1b2c3d4e5.png')).toMatch(/\/media\/flashcard_images\/a1b2c3d4e5\.png$/);
    expect(cardAudioUrl('rec_01-x.mp3')).toMatch(/\/media\/flashcard_audio\/rec_01-x\.mp3$/);
  });
  test('anything that could change the path is refused', () => {
    for (const bad of [
      '../x.png',
      'a/b.png',
      'a b.png',
      '.hidden.png',
      'x.png?y=1',
      'http://e.com/x.png',
      '',
      '  ',
      null,
      undefined,
      'noext',
    ]) {
      expect(cardImageUrl(bad as string | null)).toBeNull();
    }
  });
});
