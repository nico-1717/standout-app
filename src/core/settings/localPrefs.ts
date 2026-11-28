import type { SqlDb } from '../db/sqldb';
import { getState, setState } from '../sync/engine';
import { DEFAULT_BAR, cleanBar, type BarPrefs } from './bar';

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

/** Quali carte mostra la vista di un mazzo (il filtro delle impostazioni del sito): tutte, da imparare, imparate, doppie. */
export const FC_VIEW_STATUSES = ['all', '0', '1', 'dup'] as const;
export type FcViewStatus = (typeof FC_VIEW_STATUSES)[number];
export const cleanViewStatus = (v: unknown): FcViewStatus =>
  (FC_VIEW_STATUSES as readonly unknown[]).includes(v) ? (v as FcViewStatus) : 'all';

/** Le categorie come elenco o come griglia di riquadri (`standout_cat_vista` del sito). */
export type TreeView = 'list' | 'grid';
export const cleanTreeView = (v: unknown): TreeView => (v === 'grid' ? 'grid' : 'list');

/** Preferenze che restano su questo telefono (il sito non le ha): non si sincronizzano. */
export interface LocalPrefs {
  /** colori più forti e linee ben visibili (Altro › Stile) */
  highContrast: boolean;
  /** flashcard: ogni quante carte c'è un checkpoint (0 = spento; come `fcv_checkpoint` del sito, per dispositivo) */
  fcCheckpoint: number;
  /** flashcard: i suoni del gioco (come `fcv_suoni` del sito, per dispositivo) */
  fcSounds: boolean;
  /** flashcard: la lettura ad alta voce fuori dalla partita a voce (`tts-mode` del sito): mai, al tocco, automatica */
  fcReadMode: 'no' | 'click' | 'auto';
  /** flashcard a voce: lingua dei comandi ('' = quella dell'app) */
  fcVoiceLang: string;
  /** flashcard a voce, parole: cosa si legge (`fcv_lettura` del sito) */
  fcVoiceRead: string;
  /** la nota veloce di To do / To buy / Pills è chiusa (resta solo la sua riga) */
  noteCollapsed: boolean;
  /** vista di un mazzo: quali carte (le impostazioni della vista del sito, `fc_view_prefs`, per dispositivo) */
  fcViewStatus: FcViewStatus;
  /** vista di un mazzo: le carte per intero, senza scorrere dentro */
  fcFullCards: boolean;
  /** vista di un mazzo: anche gli esempi per intero */
  fcFullExamples: boolean;
  /** le categorie (studio e lingue): elenco o griglia */
  fcTreeView: TreeView;
  /** la pagina di una carta salva da sola mentre si scrive */
  fcAutosave: boolean;
  /** la barra in basso: ordine, schede fissate a sinistra e schede nascoste */
  bar: BarPrefs;
}

export const DEFAULT_LOCAL_PREFS: LocalPrefs = {
  highContrast: false,
  fcCheckpoint: DEFAULT_CHECKPOINT,
  fcSounds: true,
  fcReadMode: 'click',
  fcVoiceLang: '',
  fcVoiceRead: '1100',
  noteCollapsed: false,
  fcViewStatus: 'all',
  fcFullCards: false,
  fcFullExamples: false,
  fcTreeView: 'list',
  fcAutosave: true,
  bar: DEFAULT_BAR,
};

const KEY = 'local_prefs';

function clean(raw: unknown): LocalPrefs {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    highContrast: r.highContrast === true,
    fcCheckpoint: cleanCheckpoint(r.fcCheckpoint),
    fcSounds: r.fcSounds !== false,
    fcReadMode: r.fcReadMode === 'no' || r.fcReadMode === 'auto' ? r.fcReadMode : 'click',
    fcVoiceLang: cleanVoiceLang(r.fcVoiceLang),
    fcVoiceRead: cleanVoiceRead(r.fcVoiceRead),
    noteCollapsed: r.noteCollapsed === true,
    fcViewStatus: cleanViewStatus(r.fcViewStatus),
    fcFullCards: r.fcFullCards === true,
    fcFullExamples: r.fcFullExamples === true,
    fcTreeView: cleanTreeView(r.fcTreeView),
    fcAutosave: r.fcAutosave !== false,
    bar: cleanBar(r.bar),
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
