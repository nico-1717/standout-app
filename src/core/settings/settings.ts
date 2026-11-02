import type { SqlDb } from '../db/sqldb';
import { getState, setState } from '../sync/engine';
import { isAccentId, type AccentId } from '../theme/tokens';

/** Le impostazioni d'aspetto, uguali a quelle del sito (GET/PUT /api/v1/settings). */
export interface Settings {
  ui_style: 'standard' | 'paper';
  accent: AccentId;
  /** null = la lingua del telefono */
  lang: 'it' | 'en' | null;
}

export const DEFAULT_SETTINGS: Settings = { ui_style: 'standard', accent: 'blue', lang: null };

export interface SettingsApi {
  getSettings(): Promise<Settings>;
  putSettings(patch: Partial<Settings>): Promise<Settings>;
}

const KEY = 'settings';
const DIRTY = 'settings_dirty';

function clean(raw: unknown): Settings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ui_style: r.ui_style === 'paper' ? 'paper' : 'standard',
    accent: isAccentId(r.accent) ? r.accent : 'blue',
    lang: r.lang === 'it' || r.lang === 'en' ? r.lang : null,
  };
}

/**
 * Le impostazioni sul telefono. Si leggono e si cambiano subito, anche senza rete; ogni campo
 * cambiato resta «da inviare» finché il server non l'ha preso. Poi si scaricano quelle del server
 * (cambiate dal sito o da un altro telefono) tranne i campi ancora da inviare. Vince l'ultimo che
 * scrive: sono preferenze, non testi lunghi.
 */
export class SettingsStore {
  constructor(private readonly db: SqlDb) {}

  read(): Settings {
    const raw = getState(this.db, KEY);
    try {
      return raw ? clean(JSON.parse(raw)) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private dirty(): (keyof Settings)[] {
    try {
      return JSON.parse(getState(this.db, DIRTY) ?? '[]') as (keyof Settings)[];
    } catch {
      return [];
    }
  }

  update(patch: Partial<Settings>): Settings {
    const next = clean({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    const d = new Set(this.dirty());
    for (const k of Object.keys(patch) as (keyof Settings)[]) d.add(k);
    setState(this.db, DIRTY, JSON.stringify([...d]));
    return next;
  }

  hasPending(): boolean {
    return this.dirty().length > 0;
  }

  /** Invia i campi cambiati, poi prende quelli del server. Ritorna le impostazioni risultanti. */
  async sync(api: SettingsApi): Promise<Settings> {
    const dirty = this.dirty();
    let server: Settings;
    if (dirty.length) {
      const mine = this.read();
      const patch: Partial<Settings> = {};
      for (const k of dirty) (patch as Record<string, unknown>)[k] = mine[k];
      server = await api.putSettings(patch);
      // Se nel frattempo l'utente ha cambiato ancora qualcosa, quel campo resta da inviare.
      const now = this.read();
      const still = dirty.filter((k) => now[k] !== mine[k]);
      setState(this.db, DIRTY, JSON.stringify(still));
    } else {
      server = await api.getSettings();
    }
    const stillDirty = new Set(this.dirty());
    const local = this.read();
    const merged = clean(
      Object.fromEntries(
        (Object.keys(server) as (keyof Settings)[]).map((k) => [
          k,
          stillDirty.has(k) ? local[k] : server[k],
        ]),
      ),
    );
    setState(this.db, KEY, JSON.stringify(merged));
    return merged;
  }
}
