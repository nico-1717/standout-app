/** @jest-environment node */
/**
 * Il motore contro un server VERO (il sito di prova in locale). Si salta da solo se non c'è:
 *   STANDOUT_TEST_URL=http://127.0.0.1:8099 STANDOUT_TEST_USER=altro STANDOUT_TEST_PASSWORD=... npx jest engine.integration
 * Scrive nell'account indicato roba chiamata «prova app» e la toglie alla fine.
 */
import { memoryDb } from '@/core/db/__tests__/testDb';
import { HttpSyncApi } from '@/core/api/httpApi';
import { TasksRepo } from '@/features/tasks/repo';

import { SyncEngine } from '../engine';
import { pendingCount } from '../outbox';

import * as http from 'node:http';

const URL_ = process.env.STANDOUT_TEST_URL;

/** fetch minimo su node:http: l'ambiente di prova di Expo sostituisce quello globale con uno che non fa rete. */
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
            json: async () => JSON.parse(data),
          }),
        );
      },
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  })) as unknown as typeof fetch;
const maybe = URL_ ? describe : describe.skip;

async function login(): Promise<string> {
  const res = await nodeFetch(`${URL_}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.STANDOUT_TEST_USER,
      password: process.env.STANDOUT_TEST_PASSWORD,
      device_name: 'jest',
    }),
  });
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

function phone(api: HttpSyncApi) {
  const db = memoryDb();
  return { db, engine: new SyncEngine(db, api), repo: new TasksRepo(db) };
}

maybe('motore + server vero', () => {
  jest.setTimeout(60000);

  it('due telefoni: creare, modificare, spuntare, spostare, cancellare', async () => {
    const tok = await login();
    const api = () => new HttpSyncApi(URL_!, async () => tok, '0.0.0-test', 'jest', nodeFetch);
    const a = phone(api());
    const b = phone(api());
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    const base = a.repo.list().length;

    const x = a.repo.create({ title: 'prova app uno', due_date: '2099-01-02', due_time: '09:30' });
    const y = a.repo.create({ title: 'prova app due' });
    const figlia = a.repo.create({ title: 'prova app figlia' }, { parentUuid: x });
    expect(a.repo.list().length).toBe(base + 2);
    const rep = await a.engine.syncOnce();
    expect(rep.rejected).toBe(0);
    expect(pendingCount(a.db)).toBe(0);

    await b.engine.syncOnce();
    expect(b.repo.get(x)?.title).toBe('prova app uno');
    expect(b.repo.get(x)?.due_time).toBe('09:30');
    expect(b.repo.get(figlia)?.parent_uuid).toBe(x);

    // B sposta y in cima, A spunta x: modifiche a righe diverse
    b.repo.move(y, null, b.repo.list()[0].uuid);
    a.repo.update(x, { is_done: true, title: 'prova app uno (fatta)' });
    await Promise.all([a.engine.syncOnce(), b.engine.syncOnce()]);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.repo.get(x)?.is_done).toBe(1);
    expect(a.repo.get(y)?.sort_key).toBe(b.repo.get(y)?.sort_key);
    expect(a.repo.list().map((t) => t.uuid)).toEqual(b.repo.list().map((t) => t.uuid));

    // un titolo vuoto lo rifiuta il server: la riga torna com'era
    a.repo.update(y, { title: '' });
    const r2 = await a.engine.syncOnce();
    expect(r2.rejected).toBe(1);
    expect(a.repo.get(y)?.title).toBe('prova app due');

    // pulizia
    a.repo.remove(x);
    a.repo.remove(y);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.repo.get(x)).toBeNull();
    expect(b.repo.get(figlia)).toBeNull();
    expect(b.repo.get(y)).toBeNull();
    expect(b.repo.list().length).toBe(base);
  });
});
