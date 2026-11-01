import { accents, brandFor, hexToRgba, isAccentId, palettes } from '../tokens';

describe('tokens', () => {
  it('ha gli stessi colori del sito (base.css)', () => {
    expect(palettes.light.bg).toBe('#F2F2F7');
    expect(palettes.dark.surface).toBe('#1C1C1E');
    expect(palettes.dark.blue).toBe('#0A84FF');
  });

  it('accetta solo gli accenti della lista chiusa', () => {
    expect(isAccentId('coral')).toBe(true);
    expect(isAccentId('constructor')).toBe(false);
    expect(isAccentId('#ff0000')).toBe(false);
    expect(Object.keys(accents)).toHaveLength(6);
  });

  it('calcola marca e tono morbido', () => {
    expect(brandFor('light').brand).toBe('#007AFF');
    expect(brandFor('dark', 'teal').brand).toBe('#25B3A7');
    expect(hexToRgba('#007AFF', 0.09)).toBe('rgba(0,122,255,0.09)');
  });
});
