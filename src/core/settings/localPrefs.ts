import type { SqlDb } from '../db/sqldb';
import { getState, setState } from '../sync/engine';

/** Ogni quante carte arriva un checkpoint del gioco (0 = spento). */
export const CHECKPOINT_STEPS = [0, 5, 10, 15, 20, 25] as const;
export const DEFAULT_CHECKPOINT = 10;
export const cleanCheckpoint = (v: unknown): number =>
  typeof v === 'number' && (CHECKPOINT_STEPS as readonly number[]).includes(v)
    ? v
    : DEFAULT_CHECKPOINT;

/** La lingua in cui si dicono i comandi della partita a voce: '' = quella dell'app. */
export const VOICE_LANGS = ['', 'it-IT', 'en-US', 'en-GB'] as const;
export const cleanVoiceLang = (v: unknown): string =>
  typeof v === 'string' && (VOICE_LANGS as readonly string[]).includes(v) ? v : '';
/** Cosa legge la voce nelle parole: le quattro cifre del sito («1100»). */
export const cleanVoiceRead = (v: unknown): string =>
  typeof v === 'string' && /^[01][12][01][012]$/.test(v) ? v : '1100';

/** Preferenze che restano su questo telefono (il sito non le ha): non si sincronizzano. */
export interface LocalPrefs {
  /** colori più forti e linee ben visibili (Altro › Stile) */
  highContrast: boolean;
  /** flashcard: ogni quante carte c'è un checkpoint (0 = spento; come `fcv_checkpoint` del sito, per dispositivo) */
  fcCheckpoint: number;
  /** flashcard: i suoni del gioco (come `fcv_suoni` del sito, per dispositivo) */
  fcSounds: boolean;
  /** flashcard a voce: lingua dei comandi ('' = quella dell'app) */
  fcVoiceLang: string;
  /** flashcard a voce, parole: cosa si legge (`fcv_lettura` del sito) */
  fcVoiceRead: string;
}

export const DEFAULT_LOCAL_PREFS: LocalPrefs = {
  highContrast: false,
  fcCheckpoint: DEFAULT_CHECKPOINT,
  fcSounds: true,
  fcVoiceLang: '',
  fcVoiceRead: '1100',
};

const KEY = 'local_prefs';

function clean(raw: unknown): LocalPrefs {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    highContrast: r.highContrast === true,
    fcCheckpoint: cleanCheckpoint(r.fcCheckpoint),
    fcSounds: r.fcSounds !== false,
    fcVoiceLang: cleanVoiceLang(r.fcVoiceLang),
    fcVoiceRead: cleanVoiceRead(r.fcVoiceRead),
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
