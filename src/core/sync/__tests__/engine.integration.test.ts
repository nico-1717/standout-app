/** @jest-environment node */
/**
 * Il motore contro un server VERO (il sito di prova in locale). Si salta da solo se non c'è:
 *   STANDOUT_TEST_URL=http://127.0.0.1:8099 STANDOUT_TEST_USER=altro STANDOUT_TEST_PASSWORD=... npx jest engine.integration
 * Scrive nell'account indicato roba chiamata «prova app» e la toglie alla fine.
 */
import { memoryDb } from '@/core/db/__tests__/testDb';
import { HttpSyncApi } from '@/core/api/httpApi';
import { CategoriesRepo } from '@/features/buy/categoriesRepo';
import {
  applyPreset,
  formFromHabit,
  newForm,
  toInput,
  toPatch,
  validate,
} from '@/features/habits/formModel';
import { presets } from '@/features/habits/presets';
import { HabitCategoriesRepo, HabitsRepo } from '@/features/habits/repo';
import { HabitSettingsStore } from '@/features/habits/habitSettings';
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

  it('to buy: categoria e articolo con prezzo, priorita e link arrivano sull altro telefono', async () => {
    const tok = await login();
    const api = () => new HttpSyncApi(URL_!, async () => tok, '0.0.0-test', 'jest', nodeFetch);
    const a = phone(api());
    const b = phone(api());
    const catsA = new CategoriesRepo(a.db);
    const catsB = new CategoriesRepo(b.db);
    await a.engine.syncOnce();
    await b.engine.syncOnce();

    const c = catsA.create('prova app categoria', '#E8B86B');
    const item = a.repo.create(
      {
        title: 'prova app latte',
        buy_category_uuid: c,
        buy_price_cents: 189,
        buy_priority: 1,
        buy_url: 'https://example.com/latte',
      },
      { listType: 'buy' },
    );
    const rep = await a.engine.syncOnce();
    expect(rep.rejected).toBe(0);
    await b.engine.syncOnce();
    expect(catsB.list().find((x) => x.uuid === c)).toMatchObject({
      name: 'prova app categoria',
      color: '#E8B86B',
    });
    expect(b.repo.get(item)).toMatchObject({
      list_type: 'buy',
      buy_category_uuid: c,
      buy_price_cents: 189,
      buy_priority: 1,
      buy_url: 'https://example.com/latte',
    });

    // il prezzo cambia sul secondo telefono, poi si cancella la categoria: l'articolo resta, senza categoria
    b.repo.update(item, { buy_price_cents: 250 });
    await b.engine.syncOnce();
    await a.engine.syncOnce();
    expect(a.repo.get(item)?.buy_price_cents).toBe(250);
    catsA.remove(c);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.repo.get(item)?.buy_category_uuid).toBeNull();

    a.repo.remove(item);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.repo.get(item)).toBeNull();
  });

  it('abitudini: due telefoni, check-in come stato del giorno, categoria, cancellazione a cascata', async () => {
    const tok = await login();
    const api = () => new HttpSyncApi(URL_!, async () => tok, '0.0.0-test', 'jest', nodeFetch);
    const romeToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const mk = () => {
      const p = phone(api());
      return {
        ...p,
        habits: new HabitsRepo(p.db, undefined, undefined, romeToday),
        cats: new HabitCategoriesRepo(p.db),
      };
    };
    const a = mk();
    const b = mk();
    await a.engine.syncOnce();
    // avanzi di una prova interrotta: via, o i nomi doppi farebbero rifiutare le modifiche
    for (const x of [...a.habits.list(), ...a.habits.list({ archived: true })]) {
      if (x.name.startsWith('prova app')) a.habits.remove(x.uuid);
    }
    for (const x of a.cats.list()) if (x.name.startsWith('prova app')) a.cats.remove(x.uuid);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    const today = romeToday();
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);

    const c = a.cats.create('prova app cat', '🧪', '#336699');
    const h = a.habits.create({
      name: 'prova app acqua',
      icon: '💧',
      category_uuid: c,
      goal_type: 'quantity',
      target_amount: 8,
      step_amount: 1,
      unit: 'bicchieri',
      start_date: yesterday,
    });
    a.habits.checkIn(h, today, 'increment');
    a.habits.checkIn(h, today, 'increment');
    a.habits.checkIn(h, yesterday, 'set', 8);
    a.habits.setNote(h, today, { note: 'bene', mood: 4 });
    const rep = await a.engine.syncOnce();
    expect(rep.rejected).toBe(0);
    expect(pendingCount(a.db)).toBe(0);

    await b.engine.syncOnce();
    expect(b.habits.get(h)).toMatchObject({
      name: 'prova app acqua',
      category_uuid: c,
      target_amount: 8,
      unit: 'bicchieri',
    });
    expect(b.habits.log(h, today)).toMatchObject({
      amount: 2,
      status: 'partial',
      note: 'bene',
      mood: 4,
    });
    expect(b.habits.log(h, yesterday)).toMatchObject({ amount: 8, status: 'done' });
    // lo stato lo rifa il server: quello del telefono A e quello arrivato a B coincidono
    await a.engine.syncOnce();
    expect(a.habits.log(h, today)).toMatchObject({ amount: 2, status: 'partial' });

    // B porta oggi a 8 → fatto; A la saltata di ieri
    b.habits.checkIn(h, today, 'set', 8);
    a.habits.checkIn(h, yesterday, 'skip');
    await Promise.all([a.engine.syncOnce(), b.engine.syncOnce()]);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(a.habits.log(h, today)?.status).toBe('done');
    expect(b.habits.log(h, yesterday)?.status).toBe('skipped');

    // annullare
    a.habits.checkIn(h, today, 'clear');
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.habits.log(h, today)?.note).toBe('bene'); // la nota tiene viva la riga
    expect(b.habits.log(h, today)?.amount).toBe(0);

    // archiviare, poi cancellare: i check-in spariscono dall'altro telefono
    a.habits.archive(h);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.habits.get(h)?.is_archived).toBe(1);
    a.habits.remove(h);
    a.cats.remove(c);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.habits.get(h)).toBeNull();
    expect(b.habits.log(h, yesterday)).toBeNull();
    expect(b.cats.list().find((x) => x.uuid === c)).toBeUndefined();
  });

  it('modulo abitudine: tutti i campi (preset, categoria di sistema, durata, minuti) passano dal server e tornano uguali', async () => {
    const tok = await login();
    const api = () => new HttpSyncApi(URL_!, async () => tok, '0.0.0-test', 'jest', nodeFetch);
    const romeToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const mk = () => {
      const p = phone(api());
      return {
        ...p,
        habits: new HabitsRepo(p.db, undefined, undefined, romeToday),
        cats: new HabitCategoriesRepo(p.db),
      };
    };
    const a = mk();
    const b = mk();
    await a.engine.syncOnce();
    for (const x of [...a.habits.list(), ...a.habits.list({ archived: true })])
      if (x.name.startsWith('prova form')) a.habits.remove(x.uuid);
    await a.engine.syncOnce();
    await b.engine.syncOnce();

    const water = presets(((k: string) => k) as never).find((x) => x.key === 'drink_water')!;
    const health = a.cats.list().find((c) => c.slug === 'health');
    let f = applyPreset(
      newForm(romeToday(), '#7C5CFF'),
      water,
      a.cats.list().map((c) => ({ uuid: c.uuid, slug: c.slug ?? '' })),
    );
    f = {
      ...f,
      name: 'prova form acqua',
      day_part: 'morning',
      duration_type: 'days',
      duration_days: 21,
      planner_minutes: '15',
      frequency_type: 'daily',
      weekdays: '1111100',
    };
    expect(validate(f)).toEqual([]);
    const h = a.habits.create(toInput(f));
    let rep = await a.engine.syncOnce();
    expect(rep.rejected).toBe(0);
    await b.engine.syncOnce();
    expect(b.habits.get(h)).toMatchObject({
      name: 'prova form acqua',
      preset_key: 'drink_water',
      category_uuid: health?.uuid ?? null,
      goal_type: 'quantity',
      target_amount: 8,
      day_part: 'morning',
      weekdays: '1111100',
      duration_type: 'days',
      duration_days: 21,
      planner_minutes: 15,
    });
    expect(b.habits.get(h)?.end_date).toBeTruthy();

    // modifica: da «21 giorni» a «per sempre», settimanale, senza minuti, da evitare
    const was = a.habits.get(h)!;
    a.habits.update(
      h,
      toPatch(was, {
        ...formFromHabit(was),
        duration_type: 'forever',
        frequency_type: 'weekly',
        times_per_week: 3,
        planner_minutes: '',
        kind: 'quit',
        motivation: 'meno è meglio',
      }),
    );
    rep = await a.engine.syncOnce();
    expect(rep.rejected).toBe(0);
    await b.engine.syncOnce();
    expect(b.habits.get(h)).toMatchObject({
      duration_type: 'forever',
      duration_days: null,
      end_date: null,
      frequency_type: 'weekly',
      times_per_week: 3,
      planner_minutes: null,
      kind: 'quit',
      motivation: 'meno è meglio',
    });
    a.habits.remove(h);
    await a.engine.syncOnce();
  });

  it("impostazioni delle abitudini: un telefono le cambia, l'altro le vede; poi si rimettono", async () => {
    const tok = await login();
    const api = () => new HttpSyncApi(URL_!, async () => tok, '0.0.0-test', 'jest', nodeFetch);
    const a = new HabitSettingsStore(memoryDb());
    const b = new HabitSettingsStore(memoryDb());
    const before = await a.sync(api());
    try {
      a.update({
        visible_days: before.visible_days === 17 ? 18 : 17,
        group_by_day_part: !before.group_by_day_part,
      });
      const sent = await a.sync(api());
      expect(sent.visible_days).not.toBe(before.visible_days);
      const seen = await b.sync(api());
      expect(seen).toMatchObject({
        visible_days: sent.visible_days,
        group_by_day_part: sent.group_by_day_part,
      });
    } finally {
      a.update({
        visible_days: before.visible_days,
        group_by_day_part: before.group_by_day_part,
      });
      await a.sync(api());
    }
  });
});
