import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

import { PALETTES, type PaletteKey } from './plannerTheme';

/** Le impostazioni del planner (tabella `planner_settings` del sito, /api/v1/planner/settings). */
export const ZOOMS = ['agenda', 'h3', 'h1', 'm30', 'm15', 'm5'] as const;
export type Zoom = (typeof ZOOMS)[number];

export interface PlannerSettings {
  palette: PaletteKey;
  zoom: Zoom;
  day_start_hour: number;
  show_motivational: boolean;
  show_affirmations: boolean;
  default_view: 'day' | 'month';
  /** il lunedì della settimana 1 (lo decide il server, il telefono non lo cambia) */
  first_week_start: string | null;
  first_week_number: number;
  ambient_enabled: boolean;
  ambient_opacity: number;
  fabs_open: boolean;
  contrast_level: number;
  days_visible: number;
}

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
  palette: 'sage',
  zoom: 'm30',
  day_start_hour: 6,
  show_motivational: true,
  show_affirmations: true,
  default_view: 'day',
  first_week_start: null,
  first_week_number: 1,
  ambient_enabled: true,
  ambient_opacity: 9,
  fabs_open: true,
  contrast_level: 3,
  days_visible: 3,
};

export interface PlannerSettingsApi {
  getPlannerSettings(): Promise<PlannerSettings>;
  patchPlannerSettings(patch: Partial<PlannerSettings>): Promise<PlannerSettings>;
}

const D = DEFAULT_PLANNER_SETTINGS;
const num = (v: unknown, min: number, max: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : dflt;
const bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : dflt);

/** Rimette in riga qualunque cosa arrivi (stessi limiti del server). */
export function cleanPlannerSettings(raw: unknown): PlannerSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    palette:
      typeof r.palette === 'string' && r.palette in PALETTES
        ? (r.palette as PaletteKey)
        : D.palette,
    zoom: (ZOOMS as readonly unknown[]).includes(r.zoom) ? (r.zoom as Zoom) : D.zoom,
    day_start_hour: num(r.day_start_hour, 0, 23, D.day_start_hour),
    show_motivational: bool(r.show_motivational, D.show_motivational),
    show_affirmations: bool(r.show_affirmations, D.show_affirmations),
    default_view: r.default_view === 'month' ? 'month' : 'day',
    first_week_start:
      typeof r.first_week_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.first_week_start)
        ? r.first_week_start
        : null,
    first_week_number: num(r.first_week_number, 1, 9999, D.first_week_number),
    ambient_enabled: bool(r.ambient_enabled, D.ambient_enabled),
    ambient_opacity: num(r.ambient_opacity, 0, 10, D.ambient_opacity),
    fabs_open: bool(r.fabs_open, D.fabs_open),
    contrast_level: num(r.contrast_level, 1, 5, D.contrast_level),
    days_visible: num(r.days_visible, 1, 7, D.days_visible),
  };
}

const KEY = 'planner_settings';
const DIRTY = 'planner_settings_dirty';

/** Come DiarySettingsStore: si cambia subito anche senza rete; ogni campo cambiato resta «da inviare» fino al server. */
export class PlannerSettingsStore {
  constructor(private readonly db: SqlDb) {}

  read(): PlannerSettings {
    const raw = getState(this.db, KEY);
    try {
      return raw ? cleanPlannerSettings(JSON.parse(raw)) : D;
    } catch {
      return D;
    }
  }

  private dirty(): (keyof PlannerSettings)[] {
    try {
      return JSON.parse(getState(this.db, DIRTY) ?? '[]') as (keyof PlannerSettings)[];
    } catch {
      return [];
    }
  }

  update(patch: Partial<Omit<PlannerSettings, 'first_week_start'>>): PlannerSettings {
    const next = cleanPlannerSettings({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    const d = new Set(this.dirty());
    for (const k of Object.keys(patch) as (keyof PlannerSettings)[]) d.add(k);
    setState(this.db, DIRTY, JSON.stringify([...d]));
    return next;
  }

  hasPending(): boolean {
    return this.dirty().length > 0;
  }

  async sync(api: PlannerSettingsApi): Promise<PlannerSettings> {
    const dirty = this.dirty();
    let server: PlannerSettings;
    if (dirty.length) {
      const mine = this.read();
      const patch: Record<string, unknown> = {};
      for (const k of dirty) patch[k] = mine[k];
      server = await api.patchPlannerSettings(patch as Partial<PlannerSettings>);
      const now = this.read();
      setState(this.db, DIRTY, JSON.stringify(dirty.filter((k) => now[k] !== mine[k])));
    } else {
      server = await api.getPlannerSettings();
    }
    const stillDirty = new Set(this.dirty());
    const local = this.read();
    const srv = cleanPlannerSettings(server);
    const merged = cleanPlannerSettings(
      Object.fromEntries(
        (Object.keys(srv) as (keyof PlannerSettings)[]).map((k) => [
          k,
          stillDirty.has(k) ? local[k] : srv[k],
        ]),
      ),
    );
    setState(this.db, KEY, JSON.stringify(merged));
    return merged;
  }
}
