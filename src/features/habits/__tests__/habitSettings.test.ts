import { migrate } from '@/core/db/migrations';
import { memoryDb } from '@/core/db/__tests__/testDb';

import {
  cleanHabitSettings,
  DEFAULT_HABIT_SETTINGS,
  HabitSettingsStore,
  type HabitSettings,
  type HabitSettingsApi,
} from '../habitSettings';

function fakeApi(server: HabitSettings) {
  const calls: Partial<HabitSettings>[] = [];
  const api: HabitSettingsApi = {
    getHabitSettings: async () => server,
    patchHabitSettings: async (patch) => {
      calls.push(patch);
      server = { ...server, ...patch };
      return server;
    },
  };
  return { api, calls, set: (s: HabitSettings) => (server = s) };
}

function store() {
  const db = memoryDb();
  migrate(db);
  return new HabitSettingsStore(db);
}

describe('cleanHabitSettings', () => {
  test('strange values become the safe ones, numbers stay in the server limits', () => {
    const c = cleanHabitSettings({
      visible_days: 99,
      chart_range_days: 1,
      accent_color: 'red',
      default_view: 'stats',
      confetti_enabled: 'yes',
    });
    expect(c.visible_days).toBe(31);
    expect(c.chart_range_days).toBe(7);
    expect(c.accent_color).toBe('#7C5CFF');
    expect(c.default_view).toBe('list');
    expect(c.confetti_enabled).toBe(true);
  });
});

describe('HabitSettingsStore', () => {
  test('starts from the website defaults', () => {
    expect(store().read()).toEqual(DEFAULT_HABIT_SETTINGS);
  });

  test('sends only the changed fields, then takes the server answer', async () => {
    const s = store();
    const f = fakeApi({ ...DEFAULT_HABIT_SETTINGS, chart_range_days: 90 });
    s.update({ visible_days: 14, accent_color: '#0a84ff' });
    expect(s.hasPending()).toBe(true);
    const out = await s.sync(f.api);
    expect(f.calls).toEqual([{ visible_days: 14, accent_color: '#0A84FF' }]);
    expect(s.hasPending()).toBe(false);
    expect(out.chart_range_days).toBe(90); // arriva dal server (cambiato dal sito)
    expect(out.visible_days).toBe(14);
  });

  test('with nothing to send it just reads the server', async () => {
    const s = store();
    const f = fakeApi({ ...DEFAULT_HABIT_SETTINGS, group_by_day_part: false });
    const out = await s.sync(f.api);
    expect(f.calls).toHaveLength(0);
    expect(out.group_by_day_part).toBe(false);
  });

  test('a field changed again while sending stays to be sent', async () => {
    const s = store();
    const f = fakeApi(DEFAULT_HABIT_SETTINGS);
    s.update({ visible_days: 12 });
    const api: HabitSettingsApi = {
      ...f.api,
      patchHabitSettings: async (p) => {
        s.update({ visible_days: 20 }); // il tocco arriva mentre la richiesta è in volo
        return f.api.patchHabitSettings(p);
      },
    };
    const out = await s.sync(api);
    expect(s.hasPending()).toBe(true);
    expect(out.visible_days).toBe(20);
  });

  test('streak_freezes is never sent (the website does not allow changing it)', async () => {
    const s = store();
    const f = fakeApi(DEFAULT_HABIT_SETTINGS);
    s.update({ streak_freezes: 1 });
    await s.sync(f.api);
    expect(f.calls).toHaveLength(0);
  });
});
