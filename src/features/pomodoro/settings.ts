import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/** La pausa che sta correndo (pomodoro_current_breaks): una sola per utente. */
export interface CurrentBreak {
  /** «AAAA-MM-GG HH:MM:SS» ora locale */
  start_time: string;
  planned_duration_min: number;
  project_uuid: string | null;
}

/** Le ultime scelte del Pomodoro (pomodoro_settings) e la pausa in corso: /api/v1/pomodoro/settings. */
export interface PomodoroSettings {
  last_mode: 0 | 1;
  last_pomodoro_duration_min: number;
  last_break_duration_min: number;
  last_display_style: 'cerchio' | 'clessidra';
  current_break: CurrentBreak | null;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  last_mode: 0,
  last_pomodoro_duration_min: 25,
  last_break_duration_min: 5,
  last_display_style: 'cerchio',
  current_break: null,
};

export interface PomodoroSettingsApi {
  getPomodoroSettings(): Promise<PomodoroSettings>;
  patchPomodoroSettings(patch: Partial<PomodoroSettings>): Promise<PomodoroSettings>;
}

const D = DEFAULT_POMODORO_SETTINGS;
const mins = (v: unknown, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(600, Math.max(1, Math.round(v))) : dflt;

function cleanBreak(v: unknown): CurrentBreak | null {
  const b = (v ?? null) as Record<string, unknown> | null;
  if (
    !b ||
    typeof b.start_time !== 'string' ||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(b.start_time)
  )
    return null;
  return {
    start_time: b.start_time,
    planned_duration_min: mins(b.planned_duration_min, 5),
    project_uuid: typeof b.project_uuid === 'string' ? b.project_uuid : null,
  };
}

export function cleanPomodoroSettings(raw: unknown): PomodoroSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    last_mode: r.last_mode === 1 ? 1 : 0,
    last_pomodoro_duration_min: mins(r.last_pomodoro_duration_min, D.last_pomodoro_duration_min),
    last_break_duration_min: mins(r.last_break_duration_min, D.last_break_duration_min),
    last_display_style: r.last_display_style === 'clessidra' ? 'clessidra' : 'cerchio',
    current_break: cleanBreak(r.current_break),
  };
}

const KEY = 'pomodoro_settings';
const DIRTY = 'pomodoro_settings_dirty';

/** Come PlannerSettingsStore: si cambia subito anche senza rete; ogni campo cambiato resta «da inviare» fino al server. */
export class PomodoroSettingsStore {
  constructor(private readonly db: SqlDb) {}

  read(): PomodoroSettings {
    const raw = getState(this.db, KEY);
    try {
      return raw ? cleanPomodoroSettings(JSON.parse(raw)) : D;
    } catch {
      return D;
    }
  }

  private dirty(): (keyof PomodoroSettings)[] {
    try {
      return JSON.parse(getState(this.db, DIRTY) ?? '[]') as (keyof PomodoroSettings)[];
    } catch {
      return [];
    }
  }

  update(patch: Partial<PomodoroSettings>): PomodoroSettings {
    const next = cleanPomodoroSettings({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    const d = new Set(this.dirty());
    for (const k of Object.keys(patch) as (keyof PomodoroSettings)[]) d.add(k);
    setState(this.db, DIRTY, JSON.stringify([...d]));
    return next;
  }

  hasPending(): boolean {
    return this.dirty().length > 0;
  }

  async sync(api: PomodoroSettingsApi): Promise<PomodoroSettings> {
    const dirty = this.dirty();
    let server: PomodoroSettings;
    if (dirty.length) {
      const mine = this.read();
      const patch: Record<string, unknown> = {};
      for (const k of dirty) patch[k] = mine[k];
      server = await api.patchPomodoroSettings(patch as Partial<PomodoroSettings>);
      const now = this.read();
      setState(
        this.db,
        DIRTY,
        JSON.stringify(dirty.filter((k) => JSON.stringify(now[k]) !== JSON.stringify(mine[k]))),
      );
    } else {
      server = await api.getPomodoroSettings();
    }
    const stillDirty = new Set(this.dirty());
    const local = this.read();
    const srv = cleanPomodoroSettings(server);
    const merged = cleanPomodoroSettings(
      Object.fromEntries(
        (Object.keys(srv) as (keyof PomodoroSettings)[]).map((k) => [
          k,
          stillDirty.has(k) ? local[k] : srv[k],
        ]),
      ),
    );
    setState(this.db, KEY, JSON.stringify(merged));
    return merged;
  }
}
