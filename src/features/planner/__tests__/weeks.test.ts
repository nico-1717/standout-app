import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { plannerWeekUuid } from '@/core/sync/uuid5';
import { DEFAULT_PLANNER_SETTINGS, PlannerSettingsStore, cleanPlannerSettings } from '../settings';

import { PlannerRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  const repo = new PlannerRepo(
    db,
    () => '2026-11-03T10:00:00Z',
    () => 'x',
    undefined,
    7,
  );
  return { db, repo };
}
const first = { first_week_start: '2026-09-07', first_week_number: 1 };

describe('week number', () => {
  test('the id of a week is the same one the server computes', () => {
    // valore calcolato dal PHP del sito: sync_uuid_settimana(7, '2030-02-04')
    expect(plannerWeekUuid(7, '2030-02-04')).toBe('99506019-3092-5dd3-9868-5772150a7887');
  });

  test('counts from the first week of the settings', () => {
    const { repo } = setup();
    expect(repo.weekNumber('2026-09-07', first)).toBe(1);
    expect(repo.weekNumber('2026-11-02', first)).toBe(9);
    // prima della settimana 1 non scende sotto 1
    expect(repo.weekNumber('2026-08-03', first)).toBe(1);
    // senza impostazioni: la settimana guardata è la numero 1
    expect(repo.weekNumber('2026-11-02', { first_week_start: null, first_week_number: 1 })).toBe(1);
  });

  test('a number written by hand renumbers the next weeks, not the old ones', () => {
    const { db, repo } = setup();
    repo.setWeekNumber('2026-11-02', 20);
    expect(repo.weekNumber('2026-11-02', first)).toBe(20);
    expect(repo.weekNumber('2026-11-16', first)).toBe(22);
    expect(repo.weekNumber('2026-10-26', first)).toBe(8);
    const b = nextBatch(db, 10);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({
      table: 'planner_weeks',
      uuid: plannerWeekUuid(7, '2026-11-02'),
      op: 'upsert',
    });
    expect(b[0]!.patch).toEqual({ week_start: '2026-11-02', week_number: 20 });
    repo.setWeekNumber('2026-11-02', 21);
    expect(repo.weekRow('2026-11-02')).toMatchObject({ week_number: 21, number_edited: 1 });
    expect(nextBatch(db, 10).length).toBeGreaterThan(0);
  });

  test('the number is clamped between 1 and 9999', () => {
    const { repo } = setup();
    repo.setWeekNumber('2026-11-02', 0);
    expect(repo.weekRow('2026-11-02')?.week_number).toBe(1);
    repo.setWeekNumber('2026-11-02', 123456);
    expect(repo.weekRow('2026-11-02')?.week_number).toBe(9999);
  });
});

describe('planner settings store', () => {
  test('cleans anything that arrives', () => {
    const c = cleanPlannerSettings({
      palette: 'nope',
      zoom: 'h1',
      day_start_hour: 99,
      days_visible: 0,
    });
    expect(c.palette).toBe('sage');
    expect(c.zoom).toBe('h1');
    expect(c.day_start_hour).toBe(23);
    expect(c.days_visible).toBe(1);
  });

  test('a change is kept on the phone and sent once, the server value wins for the rest', async () => {
    const { db } = setup();
    const store = new PlannerSettingsStore(db);
    expect(store.read()).toEqual(DEFAULT_PLANNER_SETTINGS);
    store.update({ zoom: 'h1' });
    expect(store.hasPending()).toBe(true);
    const patches: unknown[] = [];
    const api = {
      getPlannerSettings: async () => DEFAULT_PLANNER_SETTINGS,
      patchPlannerSettings: async (p: object) => {
        patches.push(p);
        return {
          ...DEFAULT_PLANNER_SETTINGS,
          zoom: 'h1' as const,
          first_week_start: '2026-09-07',
          palette: 'sky' as never,
        };
      },
    };
    const out = await store.sync(api);
    expect(patches).toEqual([{ zoom: 'h1' }]);
    expect(out.first_week_start).toBe('2026-09-07');
    expect(store.hasPending()).toBe(false);
    expect(store.read().zoom).toBe('h1');
  });
});
