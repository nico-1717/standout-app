import * as ImageManipulator from 'expo-image-manipulator';

import {
  LINK_TIMEOUT_MS,
  MAX_LINK_BYTES,
  downloadImage,
  imageFromLink,
  sniffImage,
  usableLink,
} from '../fetchImage';

jest.mock('../phoneFiles', () => ({ keepFile: jest.fn((uri: string) => `kept:${uri}`) }));

const created: { name: string; data: Uint8Array | null; deleted: boolean }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache/' },
  File: class {
    uri: string;
    exists = true;
    private rec: { name: string; data: Uint8Array | null; deleted: boolean };
    constructor(dir: string, name: string) {
      this.uri = dir + name;
      this.rec = { name, data: null, deleted: false };
      created.push(this.rec);
    }
    create() {}
    write(d: Uint8Array) {
      this.rec.data = d;
    }
    delete() {
      this.rec.deleted = true;
    }
  },
}));

const ctx = (
  ImageManipulator as unknown as { __ctx: { resize: jest.Mock; renderAsync: jest.Mock } }
).__ctx;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

const reply = (bytes: Uint8Array, over: Partial<{ ok: boolean; len: string | null }> = {}) =>
  jest.fn(async () => ({
    ok: over.ok ?? true,
    headers: { get: () => (over.len === undefined ? null : over.len) },
    arrayBuffer: async (): Promise<ArrayBuffer> =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  }));

describe('sniffImage', () => {
  test('knows the four formats from the first bytes', () => {
    expect(sniffImage(JPG)).toBe('jpg');
    expect(sniffImage(PNG)).toBe('png');
    expect(sniffImage(GIF)).toBe('gif');
    expect(sniffImage(WEBP)).toBe('webp');
  });
  test('refuses everything else', () => {
    expect(sniffImage(new TextEncoder().encode('<html>hi</html>'))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    expect(
      sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])),
    ).toBeNull();
  });
});

describe('usableLink', () => {
  test('only http and https, no password inside, not too long', () => {
    expect(usableLink(' https://a.b/c.png ')).toBe('https://a.b/c.png');
    expect(usableLink('http://a.b/c.png')).toBe('http://a.b/c.png');
    expect(usableLink('file:///etc/passwd')).toBeNull();
    expect(usableLink('javascript:alert(1)')).toBeNull();
    expect(usableLink('https://user:pw@a.b/c.png')).toBeNull();
    expect(usableLink('not a link')).toBeNull();
    expect(usableLink('')).toBeNull();
    expect(usableLink('https://a.b/' + 'x'.repeat(2000))).toBeNull();
  });
});

describe('downloadImage', () => {
  test('gives the bytes and the real kind', async () => {
    const got = await downloadImage('https://a.b/c', reply(PNG));
    expect(got?.kind).toBe('png');
    expect(got?.bytes.length).toBe(PNG.length);
  });
  test('a bad link never calls the network', async () => {
    const f = reply(PNG);
    expect(await downloadImage('ftp://a.b/c.png', f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  test('an error answer, a web page, an empty answer and a big file give null', async () => {
    expect(await downloadImage('https://a.b/c', reply(PNG, { ok: false }))).toBeNull();
    expect(
      await downloadImage('https://a.b/c', reply(new TextEncoder().encode('<html></html>'))),
    ).toBeNull();
    expect(await downloadImage('https://a.b/c', reply(new Uint8Array()))).toBeNull();
    expect(
      await downloadImage('https://a.b/c', reply(PNG, { len: String(MAX_LINK_BYTES + 1) })),
    ).toBeNull();
    const big = new Uint8Array(MAX_LINK_BYTES + 1);
    big.set(PNG);
    expect(await downloadImage('https://a.b/c', reply(big))).toBeNull();
  });
  test('a network error gives null, not a crash', async () => {
    const f = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await downloadImage('https://a.b/c', f)).toBeNull();
  });
  test('a slow site is stopped after the timeout', async () => {
    jest.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const slow = jest.fn(
        (_u: string, init: { signal: AbortSignal }) =>
          new Promise<never>((_, reject) => {
            signal = init.signal;
            init.signal.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const p = downloadImage('https://a.b/c', slow as never);
      await jest.advanceTimersByTimeAsync(LINK_TIMEOUT_MS + 1);
      expect(await p).toBeNull();
      expect(signal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('imageFromLink', () => {
  beforeEach(() => {
    created.length = 0;
    ctx.resize.mockClear();
  });
  test('turns the picture into a kept jpeg and removes the temporary file', async () => {
    const r = await imageFromLink('https://a.b/c.png', reply(PNG));
    expect(r).toEqual({ uri: 'kept:file:///cache/resized.jpg', mime: 'image/jpeg' });
    expect(created).toHaveLength(1);
    expect(created[0]!.name.endsWith('.png')).toBe(true);
    expect(created[0]!.data?.length).toBe(PNG.length);
    expect(created[0]!.deleted).toBe(true);
    expect(ctx.resize).not.toHaveBeenCalled();
  });
  test('a big picture is resized to 1600 on the long side', async () => {
    ctx.renderAsync.mockResolvedValueOnce({
      width: 4000,
      height: 3000,
      saveAsync: jest.fn(),
    });
    await imageFromLink('https://a.b/c.jpg', reply(JPG));
    expect(ctx.resize).toHaveBeenCalledWith({ width: 1600, height: 1200 });
  });
  test('a link that is not a picture gives null and writes nothing', async () => {
    expect(
      await imageFromLink('https://a.b/c', reply(new TextEncoder().encode('hello'))),
    ).toBeNull();
    expect(created).toHaveLength(0);
  });
  test('if the converter fails, the result is null and the temporary file is still removed', async () => {
    ctx.renderAsync.mockRejectedValueOnce(new Error('bad image'));
    expect(await imageFromLink('https://a.b/c.png', reply(PNG))).toBeNull();
    expect(created[0]!.deleted).toBe(true);
  });
});
