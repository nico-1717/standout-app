import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { unzip } from '../inflate';
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
});
