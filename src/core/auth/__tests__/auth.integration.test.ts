/** @jest-environment node */
/**
 * Accesso contro un server VERO (sito di prova in locale). Si salta da solo se non c'è:
 *   STANDOUT_TEST_URL=http://127.0.0.1:8099 STANDOUT_TEST_USER=altro STANDOUT_TEST_PASSWORD=... npx jest auth.integration
 */
import * as http from 'node:http';

import { AuthService, type SecretStore } from '../authService';

const URL_ = process.env.STANDOUT_TEST_URL;

const nodeFetch = ((
  input: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
) =>
  new Promise((resolve, reject) => {
    const u = new URL(input);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: init.method ?? 'GET',
        headers: init.headers,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () =>
          resolve({
            ok: (res.statusCode ?? 0) < 400,
            status: res.statusCode,
            text: async () => data,
          }),
        );
      },
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  })) as unknown as typeof fetch;

const mem = (): SecretStore => {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
  };
};

(URL_ ? describe : describe.skip)('AuthService against a real server', () => {
  test('login → token works → refresh → logout', async () => {
    const a = new AuthService(URL_!, mem(), 'jest', nodeFetch);
    await expect(a.login(process.env.STANDOUT_TEST_USER!, 'wrong-password')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await a.login(process.env.STANDOUT_TEST_USER!, process.env.STANDOUT_TEST_PASSWORD!);
    expect(a.getState().status).toBe('signedIn');
    const t1 = await a.getAccessToken();
    const t2 = await a.refresh();
    expect(t2).not.toBe(t1);
    await a.logout();
    expect(a.getState().status).toBe('signedOut');
  });
});
