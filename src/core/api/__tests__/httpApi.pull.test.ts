import { clearSyncLog, getSyncLog } from '../../sync/log';
import { HttpSyncApi } from '../httpApi';

const ok = (body: object) =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

function api(fetchFn: typeof fetch) {
  return new HttpSyncApi('https://x.test', async () => 'tok', '1.0.0', 'ios', fetchFn);
}

describe('pull con pagine più piccole', () => {
  beforeEach(() => clearSyncLog());

  it('se la connessione cade riprova con 50, 10 e 1 riga, e scrive tutto nel registro', async () => {
    const limits: string[] = [];
    const f = jest.fn(async (url: string) => {
      const limit = new URL(url).searchParams.get('limit') as string;
      limits.push(limit);
      if (limit !== '10') throw new TypeError('The network connection was lost.');
      return ok({ ok: true, changes: [], cursor: '5', more: false, rev: 'r1' });
    });
    const res = await api(f as unknown as typeof fetch).pull('s:1:2:3', 500);
    expect(res.cursor).toBe('5');
    expect(limits).toEqual(['500', '50', '10']);
    const log = getSyncLog().join('\n');
    expect(log).toContain('NO REPLY');
    expect(log).toContain('trying again with a page of 10');
    expect(log).toContain('server r1');
  });

  it('un errore del telefono o 4xx non si ripete: si passa subito all’errore', async () => {
    const f = jest.fn(async () => ({
      ok: false,
      status: 401,
      headers: { get: () => null },
      text: async () => JSON.stringify({ ok: false, code: 'invalid_token', error: 'no' }),
    })) as unknown as typeof fetch;
    await expect(api(f).pull('snapshot', 500)).rejects.toMatchObject({ code: 'invalid_token' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('se anche con 1 riga non risponde, lancia l’errore della rete', async () => {
    const f = jest.fn(async () => {
      throw new TypeError('lost');
    }) as unknown as typeof fetch;
    await expect(api(f).pull('snapshot', 500)).rejects.toThrow('lost');
    expect(f).toHaveBeenCalledTimes(4); // 500, 50, 10, 1
  });
});
