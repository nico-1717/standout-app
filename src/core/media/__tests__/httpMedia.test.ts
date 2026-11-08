import { ApiError } from '@/core/api/httpApi';

import { HttpMediaApi } from '../httpMedia';

const U = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

function make(res: { status: number; body: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      text: async () => (typeof res.body === 'string' ? res.body : JSON.stringify(res.body)),
    };
  }) as unknown as typeof fetch;
  const api = new HttpMediaApi('https://x.test/', async () => 'TOKEN', '1.2.3', 'ios', fetchFn);
  return { api, calls };
}

describe('HttpMediaApi', () => {
  test('put sends a multipart form with the token to the right address and returns the name', async () => {
    const { api, calls } = make({ status: 200, body: { ok: true, name: 'a_1.jpg' } });
    const r = await api.put('fc_study_cards', U, 'question_image', {
      uri: 'file:///a.jpg',
      mime: 'image/jpeg',
    });
    expect(r).toEqual({ name: 'a_1.jpg' });
    expect(calls[0]!.url).toBe(`https://x.test/api/v1/media/fc_study_cards/${U}/question_image`);
    expect(calls[0]!.init.method).toBe('POST');
    const h = calls[0]!.init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer TOKEN');
    expect(h['Content-Type']).toBeUndefined();
    expect(calls[0]!.init.body).toBeInstanceOf(FormData);
  });

  test('remove sends DELETE', async () => {
    const { api, calls } = make({ status: 200, body: { ok: true } });
    await api.remove('todos', U, 'buy_image');
    expect(calls[0]!.init.method).toBe('DELETE');
    expect(calls[0]!.url).toBe(`https://x.test/api/v1/media/todos/${U}/buy_image`);
  });

  test('server errors become ApiError with status and code', async () => {
    const { api } = make({
      status: 422,
      body: { ok: false, code: 'validation', error: 'The file is not valid' },
    });
    const err = await api
      .put('fc_study_cards', U, 'question_image', { uri: 'f', mime: 'image/jpeg' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'validation' });
  });

  test('a page that is not JSON still fails cleanly', async () => {
    const { api } = make({ status: 500, body: '<html>oops</html>' });
    await expect(api.remove('todos', U, 'buy_image')).rejects.toMatchObject({ status: 500 });
  });

  test('refuses addresses that are not in the closed list', async () => {
    const { api, calls } = make({ status: 200, body: { ok: true } });
    await expect(api.remove('users' as never, U, 'avatar')).rejects.toThrow();
    await expect(api.remove('todos', '../x', 'buy_image')).rejects.toThrow();
    await expect(api.remove('todos', U, 'title')).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
