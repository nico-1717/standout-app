import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

import type { AchievementState } from './achievements';

const KEY = 'habit_seen_awards';

/** I traguardi già mostrati a Nico (restano solo sul telefono). `null` = non ho mai guardato: i traguardi di oggi non fanno festa. */
export function loadSeen(db: SqlDb): Set<string> | null {
  const raw = getState(db, KEY);
  if (raw === null) return null;
  try {
    const list: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export function saveSeen(db: SqlDb, codes: Iterable<string>): void {
  setState(db, KEY, JSON.stringify([...new Set(codes)]));
}

/** I traguardi sbloccati e non ancora mostrati. Se non ho mai guardato, nessuno (si segnano tutti come visti). */
export function newlyUnlocked(
  awards: AchievementState[],
  seen: Set<string> | null,
): AchievementState[] {
  if (seen === null) return [];
  return awards.filter((a) => a.unlocked && !seen.has(a.code));
}
