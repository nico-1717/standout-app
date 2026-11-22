import en from '../lang/en.json';
import it from '../lang/it.json';

// the app's i18n uses single braces ({n}); a doubled {{n}} would show up raw on screen
const raw = (o: unknown, path = ''): string[] =>
  typeof o === 'string'
    ? o.includes('{{')
      ? [path]
      : []
    : o && typeof o === 'object'
      ? Object.entries(o).flatMap(([k, v]) => raw(v, path ? `${path}.${k}` : k))
      : [];

test('no translation uses double-brace placeholders', () => {
  expect(raw(en)).toEqual([]);
  expect(raw(it)).toEqual([]);
});
