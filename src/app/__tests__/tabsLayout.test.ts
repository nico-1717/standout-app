import { readFileSync } from 'fs';
import { join } from 'path';

/* In questa versione di Expo Router `href: null` nasconde la scheda E rimanda alla Home chi ci naviga: To buy e Pills
   (che si aprono dalle schede di To do) devono restare navigabili. */
test('the tab layout never hides a tab with `href: null`', () => {
  const src = readFileSync(join(__dirname, '..', '(tabs)', '_layout.tsx'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  expect(src).not.toMatch(/href:\s*null/);
  expect(src).toMatch(/name="buy"[\s\S]*?tabBarButton: \(\) => null/);
  expect(src).toMatch(/name="pills"[\s\S]*?tabBarButton: \(\) => null/);
});
