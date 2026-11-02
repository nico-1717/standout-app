import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { upsertRow } from '@/core/sync/rows';
import type { WireRow } from '@/core/sync/types';

import { eventsInRange, spanDays, type EventRow } from '../events';
import gold from './fixtures/events.json';

// Il test d'oro: righe e risposte vengono dal SITO (scripts/gen-planner-events.php). Le righe passano per lo
// stesso cammino di quelle che arrivano dal server (upsertRow nel database del telefono) e poi si leggono.
function load(): EventRow[] {
  const db = memoryDb();
  migrate(db);
  for (const r of gold.rows) upsertRow(db, 'planner_events', r as unknown as WireRow);
  return db.all<EventRow>('SELECT * FROM planner_events');
}

const names = gold.names as Record<string, string>;

describe('events in a period match the website', () => {
  const rows = load();
  test.each(gold.cases.map((c) => [`${c.from} → ${c.to}`, c] as const))('%s', (_n, c) => {
    const mine = eventsInRange(rows, c.from, c.to)
      .filter((e) => names[e.masterUuid] !== undefined)
      .map((e) => ({
        name: names[e.uuid],
        master: names[e.masterUuid],
        title: e.title,
        date: e.date,
        end_date: e.endDate,
        giorni: e.days,
        start: e.start,
        end: e.end,
        all_day: e.allDay,
        occ_date: e.occDate,
        is_occurrence: e.isOccurrence,
        multiday: e.multiday,
      }));
    expect(mine).toEqual(c.events);
  });
});

describe('days of an event', () => {
  test('counts both ends, also across the March clock change', () => {
    expect(spanDays({ event_date: '2027-03-28', end_date: '2027-03-30' })).toBe(3);
    expect(spanDays({ event_date: '2026-11-10', end_date: null })).toBe(1);
    expect(spanDays({ event_date: '2026-11-10', end_date: '2026-11-08' })).toBe(1);
  });
});
