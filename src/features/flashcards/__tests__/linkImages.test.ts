import { MAX_LINK_JOBS, attachLinkImages, type LinkJob } from '../linkImages';

const job = (i: number): LinkJob => ({
  table: 'fc_vocab_cards',
  uuid: `u${i}`,
  slot: 'image',
  url: `https://a.b/${i}.png`,
});

describe('attachLinkImages', () => {
  test('puts each picture in the queue, skips links that give nothing, and reports progress', async () => {
    const put = jest.fn();
    const seen: [number, number][] = [];
    const fetchImage = jest.fn(async (url: string) =>
      url.endsWith('/1.png') ? null : { uri: `kept:${url}`, mime: 'image/jpeg' as const },
    );
    const r = await attachLinkImages(
      { putFile: put },
      [job(0), job(1), job(2)],
      (d, t) => seen.push([d, t]),
      fetchImage,
    );
    expect(r).toEqual({ added: 2, total: 3 });
    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenCalledWith(
      'fc_vocab_cards',
      'u0',
      'image',
      'kept:https://a.b/0.png',
      'image/jpeg',
    );
    expect(put).not.toHaveBeenCalledWith(
      'fc_vocab_cards',
      'u1',
      'image',
      expect.anything(),
      expect.anything(),
    );
    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
  test('takes only the first MAX_LINK_JOBS links', async () => {
    const fetchImage = jest.fn(async () => null);
    const r = await attachLinkImages(
      { putFile: jest.fn() },
      Array.from({ length: MAX_LINK_JOBS + 20 }, (_, i) => job(i)),
      undefined,
      fetchImage,
    );
    expect(r.total).toBe(MAX_LINK_JOBS);
    expect(fetchImage).toHaveBeenCalledTimes(MAX_LINK_JOBS);
  });
});
