import type { SqlDb } from '../db/sqldb';
import { getState, setState } from '../sync/engine';

/** Preferenze che restano su questo telefono (il sito non le ha): non si sincronizzano. */
export interface LocalPrefs {
  /** colori più forti e linee ben visibili (Altro › Stile) */
  highContrast: boolean;
  /** in Pomodoro, la clessidra al posto dell'anello */
  hourglass: boolean;
}

export const DEFAULT_LOCAL_PREFS: LocalPrefs = { highContrast: false, hourglass: false };

const KEY = 'local_prefs';

function clean(raw: unknown): LocalPrefs {
  const r = (raw ?? {}) as Record<string, unknown>;
  return { highContrast: r.highContrast === true, hourglass: r.hourglass === true };
}

export class LocalPrefsStore {
  constructor(private readonly db: SqlDb) {}

  read(): LocalPrefs {
    try {
      const raw = getState(this.db, KEY);
      return raw ? clean(JSON.parse(raw)) : DEFAULT_LOCAL_PREFS;
    } catch {
      return DEFAULT_LOCAL_PREFS;
    }
  }

  update(patch: Partial<LocalPrefs>): LocalPrefs {
    const next = clean({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    return next;
  }
}
