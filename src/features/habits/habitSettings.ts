import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/** Le impostazioni della pagina Abitudini (tabella `habit_settings` del sito, GET/PATCH /api/v1/habits/settings). */
export interface HabitSettings {
  week_start: number;
  default_view: 'list' | 'table';
  visible_days: number;
  accent_color: string;
  theme_mode: 'auto' | 'light' | 'dark';
  show_archived: boolean;
  group_by_day_part: boolean;
  haptics_enabled: boolean;
  sound_enabled: boolean;
  confetti_enabled: boolean;
  carousel_autoplay: boolean;
  carousel_interval_s: number;
  chart_range_days: number;
  streak_freezes: number;
}

export const DEFAULT_HABIT_SETTINGS: HabitSettings = {
  week_start: 1,
  default_view: 'list',
  visible_days: 11,
  accent_color: '#7C5CFF',
  theme_mode: 'auto',
  show_archived: false,
  group_by_day_part: true,
  haptics_enabled: true,
  sound_enabled: true,
  confetti_enabled: true,
  carousel_autoplay: true,
  carousel_interval_s: 6,
  chart_range_days: 30,
  streak_freezes: 3,
};

export interface HabitSettingsApi {
  getHabitSettings(): Promise<HabitSettings>;
  patchHabitSettings(patch: Partial<HabitSettings>): Promise<HabitSettings>;
}

const D = DEFAULT_HABIT_SETTINGS;
const int = (v: unknown, min: number, max: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/** Rimette in riga qualunque cosa arrivi (stessi limiti del server): un valore strano diventa quello di partenza. */
export function cleanHabitSettings(raw: unknown): HabitSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    week_start: int(r.week_start, 1, 7, D.week_start),
    default_view: r.default_view === 'table' ? 'table' : 'list',
    visible_days: int(r.visible_days, 5, 31, D.visible_days),
    accent_color:
      typeof r.accent_color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(r.accent_color)
        ? r.accent_color.toUpperCase()
        : D.accent_color,
    theme_mode: r.theme_mode === 'light' || r.theme_mode === 'dark' ? r.theme_mode : 'auto',
    show_archived: bool(r.show_archived, D.show_archived),
    group_by_day_part: bool(r.group_by_day_part, D.group_by_day_part),
    haptics_enabled: bool(r.haptics_enabled, D.haptics_enabled),
    sound_enabled: bool(r.sound_enabled, D.sound_enabled),
    confetti_enabled: bool(r.confetti_enabled, D.confetti_enabled),
    carousel_autoplay: bool(r.carousel_autoplay, D.carousel_autoplay),
    carousel_interval_s: int(r.carousel_interval_s, 3, 30, D.carousel_interval_s),
    chart_range_days: int(r.chart_range_days, 7, 365, D.chart_range_days),
    streak_freezes: int(r.streak_freezes, 0, 255, D.streak_freezes),
  };
}

// Il sito ammette anche la vista «stats» come vista di partenza: qui la si legge come «list».

const KEY = 'habit_settings';
const DIRTY = 'habit_settings_dirty';

/**
 * Le impostazioni delle abitudini sul telefono: stesso metodo di SettingsStore. Si cambiano subito, anche
 * senza rete; ogni campo cambiato resta «da inviare» finché il server non l'ha preso, poi si scaricano
 * quelle del server (tranne i campi ancora da inviare). Vince l'ultimo che scrive.
 */
export class HabitSettingsStore {
  constructor(private readonly db: SqlDb) {}

  read(): HabitSettings {
    const raw = getState(this.db, KEY);
    try {
      return raw ? cleanHabitSettings(JSON.parse(raw)) : D;
    } catch {
      return D;
    }
  }

  private dirty(): (keyof HabitSettings)[] {
    try {
      return JSON.parse(getState(this.db, DIRTY) ?? '[]') as (keyof HabitSettings)[];
    } catch {
      return [];
    }
  }

  update(patch: Partial<HabitSettings>): HabitSettings {
    const next = cleanHabitSettings({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    const d = new Set(this.dirty());
    for (const k of Object.keys(patch) as (keyof HabitSettings)[]) d.add(k);
    setState(this.db, DIRTY, JSON.stringify([...d]));
    return next;
  }

  hasPending(): boolean {
    return this.dirty().length > 0;
  }

  async sync(api: HabitSettingsApi): Promise<HabitSettings> {
    const dirty = this.dirty();
    let server: HabitSettings;
    if (dirty.length) {
      const mine = this.read();
      const patch: Record<string, unknown> = {};
      // streak_freezes non si cambia da qui (il sito non lo permette): non lo si invia mai
      for (const k of dirty) if (k !== 'streak_freezes') patch[k] = mine[k];
      server = Object.keys(patch).length
        ? await api.patchHabitSettings(patch as Partial<HabitSettings>)
        : await api.getHabitSettings();
      const now = this.read();
      setState(this.db, DIRTY, JSON.stringify(dirty.filter((k) => now[k] !== mine[k])));
    } else {
      server = await api.getHabitSettings();
    }
    const stillDirty = new Set(this.dirty());
    const local = this.read();
    const srv = cleanHabitSettings(server);
    const merged = cleanHabitSettings(
      Object.fromEntries(
        (Object.keys(srv) as (keyof HabitSettings)[]).map((k) => [
          k,
          stillDirty.has(k) ? local[k] : srv[k],
        ]),
      ),
    );
    setState(this.db, KEY, JSON.stringify(merged));
    return merged;
  }
}
