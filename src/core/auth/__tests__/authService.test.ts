import { AuthService, type SecretStore } from '../authService';

function memStore(): SecretStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
  };
}

const user = { id: 1, username: 'nico', email: null, email_verified: false, lang: 'en' };
const packet = (n: number, expires = 900) => ({
  ok: true,
  access_token: `a${n}`,
  expires_in: expires,
  refresh_token: `r${n}`,
  user,
  terms_required: false,
});

function fakeFetch(handler: (path: string, body: any) => { status?: number; json: any }) {
  const calls: { path: string; body: any; auth?: string }[] = [];
  const fn = (async (url: string, init: any) => {
    const path = url.replace(/^.*\/api\/v1/, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, body, auth: init.headers.Authorization });
    const r = handler(path, body);
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      text: async () => JSON.stringify(r.json),
    };
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('AuthService', () => {
  test('login saves the session and restore reads it back', async () => {
    const store = memStore();
    const f = fakeFetch(() => ({ json: packet(1) }));
    const a = new AuthService('https://x', store, 'Pixel', f.fn);
    await a.login('nico', 'pw');
    expect(a.getState().status).toBe('signedIn');
    expect(f.calls[0].body).toEqual({ identifier: 'nico', password: 'pw', device_name: 'Pixel' });
    const b = new AuthService('https://x', store, 'Pixel', f.fn);
    await b.restore();
    expect(b.getState().status).toBe('signedIn');
    expect(await b.getAccessToken()).toBe('a1');
  });

  test('restore without a saved session → signedOut', async () => {
    const a = new AuthService('https://x', memStore(), 'P', fakeFetch(() => ({ json: {} })).fn);
    await a.restore();
    expect(a.getState().status).toBe('signedOut');
  });

  test('parallel requests with an expired token trigger ONE refresh', async () => {
    let now = 0;
    const f = fakeFetch((path) => ({ json: path === '/auth/login' ? packet(1, 60) : packet(2) }));
    const a = new AuthService('https://x', memStore(), 'P', f.fn, () => now);
    await a.login('n', 'p');
    now = 45_000; // dentro il margine di 30 s dalla scadenza
    const tokens = await Promise.all([a.getAccessToken(), a.getAccessToken(), a.getAccessToken()]);
    expect(tokens).toEqual(['a2', 'a2', 'a2']);
    expect(f.calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
    expect(f.calls.find((c) => c.path === '/auth/refresh')!.body).toEqual({ refresh_token: 'r1' });
  });

  test('token_reused closes the session cleanly', async () => {
    let now = 0;
    const store = memStore();
    const f = fakeFetch((path) =>
      path === '/auth/login'
        ? { json: packet(1, 60) }
        : { status: 401, json: { ok: false, code: 'token_reused', error: 'reused' } },
    );
    const a = new AuthService('https://x', store, 'P', f.fn, () => now);
    await a.login('n', 'p');
    now = 100_000;
    await expect(a.getAccessToken()).rejects.toMatchObject({ code: 'token_reused' });
    expect(a.getState()).toEqual({ status: 'signedOut', reason: 'session_closed' });
    expect(store.data.size).toBe(0);
  });

  test('a network error on refresh keeps the session (offline is not logout)', async () => {
    let now = 0;
    let offline = false;
    const f = fakeFetch(() => ({ json: packet(1, 60) }));
    const fn = (async (...a: any[]) => {
      if (offline) throw new TypeError('Network request failed');
      return (f.fn as any)(...a);
    }) as unknown as typeof fetch;
    const a = new AuthService('https://x', memStore(), 'P', fn, () => now);
    await a.login('n', 'p');
    now = 100_000;
    offline = true;
    await expect(a.getAccessToken()).rejects.toThrow('Network');
    expect(a.getState().status).toBe('signedIn');
  });

  test('wrong password → invalid_credentials, nothing saved', async () => {
    const store = memStore();
    const f = fakeFetch(() => ({
      status: 401,
      json: { ok: false, code: 'invalid_credentials', error: 'bad' },
    }));
    const a = new AuthService('https://x', store, 'P', f.fn);
    await expect(a.login('n', 'bad')).rejects.toMatchObject({
      code: 'invalid_credentials',
      status: 401,
    });
    expect(store.data.size).toBe(0);
  });

  test('logout works offline and clears the session', async () => {
    const store = memStore();
    let fail = false;
    const f = fakeFetch(() => ({ json: packet(1) }));
    const fn = (async (...a: any[]) => {
      if (fail) throw new TypeError('offline');
      return (f.fn as any)(...a);
    }) as unknown as typeof fetch;
    const a = new AuthService('https://x', store, 'P', fn);
    await a.login('n', 'p');
    fail = true;
    await a.logout();
    expect(a.getState().status).toBe('signedOut');
    expect(store.data.size).toBe(0);
  });

  test('acceptTerms sends {accept:true} with the bearer token', async () => {
    const f = fakeFetch((path) => ({
      json: path === '/auth/login' ? { ...packet(1), terms_required: true } : { ok: true },
    }));
    const a = new AuthService('https://x', memStore(), 'P', f.fn);
    await a.login('n', 'p');
    expect(a.getState()).toMatchObject({ status: 'signedIn', termsRequired: true });
    await a.acceptTerms();
    const c = f.calls.find((x) => x.path === '/auth/accept_terms')!;
    expect(c.body).toEqual({ accept: true });
    expect(c.auth).toBe('Bearer a1');
    expect(a.getState()).toMatchObject({ termsRequired: false });
  });
});

describe('AuthService register and forgot', () => {
  test('register posts the form and saves the session', async () => {
    const store = memStore();
    const f = fakeFetch(() => ({ json: packet(1) }));
    const a = new AuthService('https://x', store, 'Pixel', f.fn);
    await a.register({
      username: 'nico',
      email: 'n@x.it',
      password: 'longpassword1',
      passwordConfirm: 'longpassword1',
      accept: true,
    });
    expect(f.calls[0].path).toBe('/auth/register');
    expect(f.calls[0].body).toMatchObject({
      username: 'nico',
      password_confirm: 'longpassword1',
      accetto: true,
      device_name: 'Pixel',
    });
    expect(a.getState().status).toBe('signedIn');
  });

  test('register shows the fields the server rejects', async () => {
    const f = fakeFetch(() => ({
      status: 422,
      json: { ok: false, error: 'validation', fields: { email: 'Taken' } },
    }));
    const a = new AuthService('https://x', memStore(), 'Pixel', f.fn);
    const e = await a
      .register({ username: 'n', email: 'e', password: 'p', passwordConfirm: 'p', accept: false })
      .catch((x) => x);
    expect(e.fields).toEqual({ email: 'Taken' });
    expect(a.getState().status).not.toBe('signedIn');
  });

  test('forgot posts only the identifier', async () => {
    const f = fakeFetch(() => ({ json: { ok: true } }));
    const a = new AuthService('https://x', memStore(), 'Pixel', f.fn);
    await a.forgot('nico');
    expect(f.calls[0]).toMatchObject({ path: '/auth/forgot', body: { identifier: 'nico' } });
  });
});
