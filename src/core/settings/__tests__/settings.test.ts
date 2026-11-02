import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { SettingsStore, type Settings, type SettingsApi } from '../settings';

function setup(server: Settings = { ui_style: 'standard', accent: 'blue', lang: null }) {
  const db = memoryDb();
  migrate(db);
  const calls: string[] = [];
  const api: SettingsApi = {
    async getSettings() {
      calls.push('get');
      return { ...server };
    },
    async putSettings(patch) {
      calls.push('put ' + JSON.stringify(patch));
      Object.assign(server, patch);
      return { ...server };
    },
  };
  return { store: new SettingsStore(db), api, server, calls };
}

test('defaults, then local change works offline', () => {
  const { store } = setup();
  expect(store.read()).toEqual({ ui_style: 'standard', accent: 'blue', lang: null });
  store.update({ ui_style: 'paper' });
  expect(store.read().ui_style).toBe('paper');
  expect(store.hasPending()).toBe(true);
});

test('a local change is sent once, then the pending flag clears', async () => {
  const { store, api, server, calls } = setup();
  store.update({ accent: 'teal' });
  await store.sync(api);
  expect(calls).toEqual(['put {"accent":"teal"}']);
  expect(server.accent).toBe('teal');
  expect(store.hasPending()).toBe(false);
  await store.sync(api);
  expect(calls[1]).toBe('get');
});

test('server values (changed on the website) are adopted when nothing is pending', async () => {
  const { store, api } = setup({ ui_style: 'paper', accent: 'rose', lang: 'en' });
  const s = await store.sync(api);
  expect(s).toEqual({ ui_style: 'paper', accent: 'rose', lang: 'en' });
  expect(store.read()).toEqual(s);
});

test('a pending field is not overwritten by the server, the others are', async () => {
  const { store, api } = setup({ ui_style: 'paper', accent: 'rose', lang: 'en' });
  store.update({ lang: 'it' });
  const s = await store.sync(api);
  expect(s).toEqual({ ui_style: 'paper', accent: 'rose', lang: 'it' });
});

test('junk values from the server are cleaned', async () => {
  const { store, api } = setup({
    ui_style: 'x' as never,
    accent: 'pink' as never,
    lang: 'fr' as never,
  });
  expect(await store.sync(api)).toEqual({ ui_style: 'standard', accent: 'blue', lang: null });
});
