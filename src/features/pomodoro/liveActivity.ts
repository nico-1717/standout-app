import { Platform } from 'react-native';

import PomodoroActivity from './PomodoroActivity';
import type { DesiredActivity } from './liveActivityState';

/** Toccando il Live Activity si apre la schermata del Pomodoro. */
const OPEN_URL = 'standout://pomodoro';

type Instance = ReturnType<typeof PomodoroActivity.getInstances>[number];

let current: Instance | null = null;
let lastKey: string | null = null;
let queue: Promise<void> = Promise.resolve();

async function endEverything(): Promise<void> {
  const all = new Map<string, Instance>();
  if (current) all.set(current.getId(), current);
  for (const a of PomodoroActivity.getInstances()) all.set(a.getId(), a);
  current = null;
  lastKey = null;
  await Promise.all([...all.values()].map((a) => a.end('immediate').catch(() => {})));
}

async function apply(desired: DesiredActivity | null): Promise<void> {
  if (!desired) {
    await endEverything();
    return;
  }
  if (desired.key === lastKey && current) return;
  const stale = desired.staleAt !== null ? new Date(desired.staleAt) : undefined;
  if (!current) {
    // dopo un riavvio dell'app il Live Activity può essere ancora lì: si riprende quello (e si chiudono i doppioni)
    const [first, ...extra] = PomodoroActivity.getInstances();
    await Promise.all(extra.map((a) => a.end('immediate').catch(() => {})));
    current = first ?? null;
  }
  if (current) {
    try {
      await current.update(desired.props, stale);
      lastKey = desired.key;
      return;
    } catch {
      // chiuso da chi lo usa (scorrendolo via): se ne fa uno nuovo
      current = null;
    }
  }
  current = PomodoroActivity.start(desired.props, OPEN_URL, stale);
  lastKey = desired.key;
}

/**
 * Allinea il Live Activity a quello che sta succedendo (`null` = niente da mostrare: lo chiude). Le chiamate si mettono in fila
 * e un errore non rompe mai l'app: il timer sul blocco schermo è un di più (come l'avviso di fine, vedi alarm.ts).
 */
export function syncLiveActivity(desired: DesiredActivity | null): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  queue = queue.then(() => apply(desired)).catch(() => {});
  return queue;
}
