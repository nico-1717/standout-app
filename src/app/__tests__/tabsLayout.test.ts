import { readFileSync } from 'fs';
import { join } from 'path';

/* In questa versione di Expo Router `href: null` nasconde la scheda E rimanda alla Home chi ci naviga: nessuna scheda
   si nasconde così. La barra è la nostra (AppTabBar) e mostra tutte le pagine. */
test('the tab layout never hides a tab with `href: null` and uses the custom bar', () => {
  const src = readFileSync(join(__dirname, '..', '(tabs)', '_layout.tsx'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  expect(src).not.toMatch(/href:\s*null/);
  expect(src).toMatch(/<AppTabBar/);
  expect(src).toMatch(/BAR_IDS\.map/);
});
