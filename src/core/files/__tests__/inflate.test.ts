import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inflate, unzip } from '../inflate';
import { zipStore } from '../zipStore';

const fx = (n: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, 'fixtures', n)));
const text = (b: Uint8Array | undefined): string => new TextDecoder().decode(b);

describe('unzip', () => {
  test('opens stored and deflated files from a real zip (levels 1 and 9, binary, empty, tiny)', () => {
    const files = unzip(fx('mixed.zip'));
    expect([...files.keys()].sort()).toEqual([
      'best.txt',
      'dir/noise.bin',
      'empty.txt',
      'fast.txt',
      'short.txt',
      'stored.txt',
    ]);
    const big = readFileSync(join(__dirname, 'fixtures', 'mixed.expected.txt'), 'utf8');
    expect(text(files.get('stored.txt'))).toBe('stored ciao');
    expect(text(files.get('fast.txt'))).toBe(big);
    expect(text(files.get('best.txt'))).toBe(big);
    expect(files.get('dir/noise.bin')).toEqual(fx('noise.bin'));
    expect(text(files.get('empty.txt'))).toBe('');
    expect(text(files.get('short.txt'))).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  test('also reads what zipStore writes', () => {
    const files = unzip(zipStore([{ name: 'a/b.txt', data: 'è così' }]));
    expect(text(files.get('a/b.txt'))).toBe('è così');
  });

  test('a file that is not a zip, or is cut short, gives an error instead of garbage', () => {
    expect(() => unzip(new Uint8Array([1, 2, 3, 4]))).toThrow();
    const z = fx('mixed.zip');
    expect(() => unzip(z.subarray(0, z.length - 40))).toThrow();
  });

  test('a ZIP bomb is stopped: the limit counts what comes out, not what the header says', () => {
    const z = unzip(fx('mixed.zip')); // il file vero apre bene
    expect(z.get('best.txt')!.length).toBeGreaterThan(1000);
    // un flusso deflate di soli blocchi «ripeti 258 byte» che cresce senza fine: si ferma al tetto
    const mixed = fx('mixed.zip');
    const view = new DataView(mixed.buffer, mixed.byteOffset, mixed.byteLength);
    let end = mixed.length - 22;
    while (view.getUint32(end, true) !== 0x06054b50) end--;
    // prima voce con compressione 8: ne prendiamo i byte compressi e li rileggiamo con un tetto piccolo
    let at = view.getUint32(end + 16, true);
    for (let i = 0; i < view.getUint16(end + 10, true); i++) {
      const method = view.getUint16(at + 10, true);
      const csize = view.getUint32(at + 20, true);
      const local = view.getUint32(at + 42, true);
      const nameLen = view.getUint16(at + 28, true);
      const start =
        local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      if (method === 8 && csize > 50) {
        const raw = mixed.subarray(start, start + csize);
        expect(() => inflate(raw, 10 ** 9, 100)).toThrow('troppo grande');
        expect(inflate(raw, 10 ** 9).length).toBeGreaterThan(100); // un hint bugiardo non basta ad allocare miliardi di byte
        return;
      }
      at += 46 + nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    }
    throw new Error('no deflated entry in the fixture');
  });
});
