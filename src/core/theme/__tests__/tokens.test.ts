import { shapeFor, surfacesFor, type UiStyle } from '../skin';
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

/** Luminanza relativa e rapporto di contrasto (WCAG 2.1) di due colori «#RRGGBB». */
function ratio(a: string, b: string) {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe('le due vesti (Glass e Calm paper)', () => {
  const styles: UiStyle[] = ['standard', 'paper'];
  const schemes = ['light', 'dark'] as const;

  it.each(styles.flatMap((s) => schemes.map((c) => [s, c] as const)))(
    '%s/%s: testo e testo secondario si leggono (almeno 4.5:1) su sfondo e carta',
    (style, scheme) => {
      const p = surfacesFor(style, scheme);
      expect(ratio(p.text, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.text2, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.text2, p.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(styles.flatMap((s) => schemes.map((c) => [s, c] as const)))(
    '%s/%s: il grigio dei testi piccoli (text3) arriva a 4.5:1 su sfondo e carta',
    (style, scheme) => {
      const p = surfacesFor(style, scheme);
      expect(ratio(p.text3, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.text3, p.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(styles.flatMap((s) => schemes.map((c) => [s, c] as const)))(
    '%s/%s: con «Alto contrasto» tutti i testi arrivano a 7:1',
    (style, scheme) => {
      const p = surfacesFor(style, scheme, true);
      for (const t of [p.text, p.text2, p.text3]) {
        expect(ratio(t, p.bg)).toBeGreaterThanOrEqual(7);
        expect(ratio(t, p.surface)).toBeGreaterThanOrEqual(7);
      }
      expect(surfacesFor(style, scheme, true).bg).toBe(surfacesFor(style, scheme).bg);
    },
  );

  it('Glass ha ombra morbida e barra fluttuante; Paper ha linee sottili, serif e barra piatta', () => {
    const g = shapeFor('standard', 'light');
    const p = shapeFor('paper', 'light');
    expect(g.floatingBar).toBe(true);
    expect(g.cardShadow).toBeDefined();
    expect(g.display).toBeUndefined();
    expect(p.floatingBar).toBe(false);
    expect(p.cardShadow).toBeUndefined();
    expect(p.display).toBe('Fraunces_400Regular');
    expect(p.radiusCard).toBeLessThan(g.radiusCard);
  });
});
