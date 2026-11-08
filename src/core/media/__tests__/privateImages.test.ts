import { PrivateImages, type PrivateFiles } from '../privateImages';

const UUID = '0190aaaa-bbbb-7ccc-8ddd-eeeeffff0001';
const NAME = 'b1_a8e52f2922fe19c1277b.png';

function setup(opts: { have?: string; fail?: boolean } = {}) {
  const calls: { url: string; headers: Record<string, string>; key: string }[] = [];
  const files: PrivateFiles = {
    existing: (key) => (opts.have && key === NAME ? opts.have : null),
    async download(url, headers, key) {
      calls.push({ url, headers, key });
      if (opts.fail) throw new Error('offline');
      return `file:///cache/${key}`;
    },
  };
  const images = new PrivateImages('https://x.test/', async () => 'tok', files, '1.2.3', 'ios');
  return { images, calls };
}

describe('PrivateImages', () => {
  test('downloads with the token from the media route', async () => {
    const { images, calls } = setup();
    expect(await images.get(UUID, NAME)).toBe(`file:///cache/${NAME}`);
    expect(calls).toEqual([
      {
        url: `https://x.test/api/v1/media/todos/${UUID}/buy_image`,
        headers: { Authorization: 'Bearer tok', 'X-App-Version': '1.2.3', 'X-App-Platform': 'ios' },
        key: NAME,
      },
    ]);
  });

  test('a copy already on the phone is used and nothing is downloaded', async () => {
    const { images, calls } = setup({ have: 'file:///cache/old.png' });
    expect(await images.get(UUID, NAME)).toBe('file:///cache/old.png');
    expect(calls).toHaveLength(0);
  });

  test('two asks at the same time download once', async () => {
    const { images, calls } = setup();
    await Promise.all([images.get(UUID, NAME), images.get(UUID, NAME)]);
    expect(calls).toHaveLength(1);
  });

  test('offline gives null, and the next ask tries again', async () => {
    const { images, calls } = setup({ fail: true });
    expect(await images.get(UUID, NAME)).toBeNull();
    expect(await images.get(UUID, NAME)).toBeNull();
    expect(calls).toHaveLength(2);
  });

  test('a bad uuid or a name the server would never choose is refused before any request', async () => {
    const { images, calls } = setup();
    expect(await images.get('../x', NAME)).toBeNull();
    expect(await images.get(UUID, '../../etc/passwd')).toBeNull();
    expect(await images.get(UUID, null)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
