import type { SqlDb } from '../db/sqldb';
import { getState, setState } from '../sync/engine';

/** Ogni quante carte arriva un checkpoint del gioco (0 = spento). */
export const CHECKPOINT_STEPS = [0, 5, 10, 15, 20, 25] as const;
export const DEFAULT_CHECKPOINT = 10;
export const cleanCheckpoint = (v: unknown): number =>
  typeof v === 'number' && (CHECKPOINT_STEPS as readonly number[]).includes(v)
    ? v
    : DEFAULT_CHECKPOINT;

/** Preferenze che restano su questo telefono (il sito non le ha): non si sincronizzano. */
export interface LocalPrefs {
  /** colori più forti e linee ben visibili (Altro › Stile) */
  highContrast: boolean;
  /** flashcard: ogni quante carte c'è un checkpoint (0 = spento; come `fcv_checkpoint` del sito, per dispositivo) */
  fcCheckpoint: number;
  /** flashcard: i suoni del gioco (come `fcv_suoni` del sito, per dispositivo) */
  fcSounds: boolean;
}

export const DEFAULT_LOCAL_PREFS: LocalPrefs = {
  highContrast: false,
  fcCheckpoint: DEFAULT_CHECKPOINT,
  fcSounds: true,
};

const KEY = 'local_prefs';

function clean(raw: unknown): LocalPrefs {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    highContrast: r.highContrast === true,
    fcCheckpoint: cleanCheckpoint(r.fcCheckpoint),
    fcSounds: r.fcSounds !== false,
  };
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
