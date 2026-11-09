import { ApiError } from '../../api/httpApi';
import { AccountApi, FieldsError } from '../accountApi';

type Reply = { status?: number; json?: unknown; bytes?: number[] };

function make(handler: (method: string, path: string, body: any) => Reply) {
  const calls: { method: string; url: string; body: any; headers: Record<string, string> }[] = [];
  const fn = (async (url: string, init: any) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, url, body, headers: init.headers });
    const r = handler(init.method, url.replace(/^https:\/\/site/, ''), body);
    const status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      text: async () => JSON.stringify(r.json ?? {}),
      arrayBuffer: async () => new Uint8Array(r.bytes ?? []).buffer,
    };
  }) as unknown as typeof fetch;
  return { api: new AccountApi('https://site/', async () => 'tok', '1.2.3', 'ios', fn), calls };
}

describe('AccountApi', () => {
  test('every call carries the bearer token and the app headers', async () => {
    const { api, calls } = make(() => ({ json: { ok: true, devices: [] } }));
    await api.devices();
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
    expect(calls[0].headers['X-App-Version']).toBe('1.2.3');
    expect(calls[0].headers['X-App-Platform']).toBe('ios');
    expect(calls[0].url).toBe('https://site/api/v1/auth/devices');
  });

  test('changePassword sends the website field names', async () => {
    const { api, calls } = make(() => ({ json: { success: true } }));
    await api.changePassword('old', 'new-password-1', 'new-password-1');
    expect(calls[0].url).toBe('https://site/account/cambia_password.php');
    expect(calls[0].body).toEqual({
      attuale: 'old',
      nuova: 'new-password-1',
      conferma: 'new-password-1',
    });
  });

  test('a validation error becomes a FieldsError with the text per field', async () => {
    const { api } = make(() => ({
      status: 422,
      json: { success: false, errori: { nuova: 'Too short' } },
    }));
    const e = await api.changePassword('a', 'b', 'b').catch((x) => x);
    expect(e).toBeInstanceOf(FieldsError);
    expect(e.fields).toEqual({ nuova: 'Too short' });
  });

  test('ok:false with a 200 status is still an error', async () => {
    const { api } = make(() => ({ json: { ok: false, error: 'bad_password', message: 'No' } }));
    const e = await api.deleteAccount('x').catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('bad_password');
  });

  test('deleteAccount asks for the password and the confirmation', async () => {
    const { api, calls } = make(() => ({ json: { ok: true } }));
    await api.deleteAccount('secret');
    expect(calls[0].body).toEqual({ password: 'secret', conferma: true });
  });

  test('exportData returns the bytes of the ZIP', async () => {
    const { api, calls } = make(() => ({ bytes: [80, 75, 3, 4] }));
    const out = await api.exportData();
    expect(Array.from(out)).toEqual([80, 75, 3, 4]);
    expect(calls[0].method).toBe('POST');
  });

  test('exportData throws on a server error', async () => {
    const { api } = make(() => ({ status: 429, json: { ok: false, error: 'rate_limited' } }));
    await expect(api.exportData()).rejects.toBeInstanceOf(ApiError);
  });

  test('revoke and logout everywhere use the right routes', async () => {
    const { api, calls } = make(() => ({ json: { ok: true } }));
    await api.revokeDevice(7);
    await api.logoutEverywhere();
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: 'https://site/api/v1/auth/devices/7' });
    expect(calls[1]).toMatchObject({ method: 'POST', url: 'https://site/api/v1/auth/logout_all' });
  });

  test('resendVerification returns the status, even on ok:false', async () => {
    const a = make(() => ({ status: 429, json: { ok: false, stato: 'attendi' } }));
    expect(await a.api.resendVerification()).toBe('attendi');
    const b = make(() => ({ json: { ok: true, stato: 'inviata' } }));
    expect(await b.api.resendVerification()).toBe('inviata');
    const c = make(() => ({ status: 500 }));
    expect(await c.api.resendVerification()).toBe('errore');
  });
  test('storage reads used and quota as numbers', async () => {
    const { api, calls } = make(() => ({ json: { ok: true, used: '1234', quota: 524288000 } }));
    expect(await api.storage()).toEqual({ used: 1234, quota: 524288000 });
    expect(calls[0].url).toBe('https://site/api/v1/storage');
  });

  test('placeSearch: under 3 letters makes no call; otherwise it sends the clean text and the language', async () => {
    const { api, calls } = make(() => ({
      json: {
        ok: true,
        places: [
          {
            name: 'Duomo',
            detail: 'Milano',
            full: 'Duomo, Milano',
            ref: 'r1',
            lat: null,
            lon: null,
          },
          { name: 'Bar', detail: '', full: 'Bar', ref: 'r2', lat: 41.9, lon: 12.5 },
        ],
      },
    }));
    expect(await api.placeSearch(' du ', 'it')).toEqual([]);
    expect(calls).toHaveLength(0);
    const r = await api.placeSearch('  duomo   di milano ', 'it');
    expect(calls[0].url).toBe('https://site/api/v1/places/search?q=duomo%20di%20milano&lang=it');
    expect(r.map((p) => [p.ref, p.lat, p.lon])).toEqual([
      ['r1', null, null],
      ['r2', 41.9, 12.5],
    ]);
  });

  test('placeDetails gives the point, null for 404, and throws for other errors', async () => {
    const ok = make(() => ({ json: { ok: true, place: { lat: 1, lon: 2, full: 'x', ref: 'r' } } }));
    expect(await ok.api.placeDetails('r', 'en')).toEqual({ lat: 1, lon: 2, full: 'x', ref: 'r' });
    expect(ok.calls[0].url).toBe('https://site/api/v1/places/details?ref=r&lang=en');
    const nf = make(() => ({
      status: 404,
      json: { ok: false, code: 'not_found', error: 'Not found' },
    }));
    expect(await nf.api.placeDetails('r', 'en')).toBeNull();
    const rl = make(() => ({
      status: 429,
      json: { ok: false, code: 'rate_limited', error: 'Too many' },
    }));
    await expect(rl.api.placeDetails('r', 'en')).rejects.toBeInstanceOf(ApiError);
  });
  test('diaryAiRun posts to the website page with the language; "expected" refusals are replies, not errors', async () => {
    const { api, calls } = make(() => ({
      status: 200,
      json: { ok: false, error: 'limite_piano', stima: 40, disponibili: 10 },
    }));
    const r = await api.diaryAiRun({ azione: 'stima', anno: 2026, q: 3 }, 'it-IT');
    expect(r).toMatchObject({ ok: false, error: 'limite_piano', stima: 40 });
    expect(calls[0].url).toBe('https://site/planner/diario_ai.php?lang=it');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ azione: 'stima', anno: 2026, q: 3 });
  });

  test('diaryAiRun: a server page that is not JSON is an error', async () => {
    const fn = (async () => ({
      ok: false,
      status: 502,
      text: async () => '<html>',
    })) as unknown as typeof fetch;
    const api = new AccountApi('https://site', async () => 't', '1', 'ios', fn);
    await expect(api.diaryAiRun({}, 'en')).rejects.toBeInstanceOf(ApiError);
  });
});
