import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

import { DEFAULT_GRADE_SETTINGS, type GradeSettings } from './logic';

export interface GradeSettingsApi {
  getGradeSettings(): Promise<GradeSettings>;
  patchGradeSettings(patch: Partial<GradeSettings>): Promise<GradeSettings>;
}

const D = DEFAULT_GRADE_SETTINGS;
const numIn = (v: unknown, lo: number, hi: number, dflt: number, dec = 2) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.round(Math.min(hi, Math.max(lo, v)) * 10 ** dec) / 10 ** dec
    : dflt;
const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** Come sul server (voti.php save_settings): numeri tenuti dentro i limiti, il massimo della tesi mai sotto il minimo. */
export function cleanGradeSettings(raw: unknown): GradeSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const thMin = numIn(r.thesis_min_points, 0, 30, D.thesis_min_points);
  const thMax = Math.max(thMin, numIn(r.thesis_max_points, 0, 30, D.thesis_max_points));
  return {
    program_key: str(r.program_key, 80),
    program_label: str(r.program_label, 160),
    faculty_key: str(r.faculty_key, 60),
    accent_color:
      typeof r.accent_color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(r.accent_color)
        ? r.accent_color.toUpperCase()
        : D.accent_color,
    total_cfu: Math.round(numIn(r.total_cfu, 1, 600, D.total_cfu, 0)),
    grade_base: Math.round(numIn(r.grade_base, 30, 200, D.grade_base, 0)),
    honors_value: numIn(r.honors_value, 30, 40, D.honors_value),
    target_average: r.target_average == null ? null : numIn(r.target_average, 18, 31, 18),
    target_source: r.target_source === 'simulation' ? 'simulation' : 'manual',
    thesis_min_points: thMin,
    thesis_max_points: thMax,
    round_half_up: r.round_half_up === false ? false : true,
  };
}

const KEY = 'grade_settings';
const DIRTY = 'grade_settings_dirty';

/** Le impostazioni del corso: si cambiano subito sul telefono, anche senza rete; ogni campo cambiato resta «da inviare» fino al server. */
export class GradeSettingsStore {
  constructor(private readonly db: SqlDb) {}

  read(): GradeSettings {
    const raw = getState(this.db, KEY);
    try {
      return raw ? cleanGradeSettings(JSON.parse(raw)) : D;
    } catch {
      return D;
    }
  }

  private dirty(): (keyof GradeSettings)[] {
    try {
      return JSON.parse(getState(this.db, DIRTY) ?? '[]') as (keyof GradeSettings)[];
    } catch {
      return [];
    }
  }

  update(patch: Partial<GradeSettings>): GradeSettings {
    const next = cleanGradeSettings({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    const d = new Set(this.dirty());
    for (const k of Object.keys(patch) as (keyof GradeSettings)[]) d.add(k);
    setState(this.db, DIRTY, JSON.stringify([...d]));
    return next;
  }

  hasPending(): boolean {
    return this.dirty().length > 0;
  }

  async sync(api: GradeSettingsApi): Promise<GradeSettings> {
    const dirty = this.dirty();
    let server: GradeSettings;
    if (dirty.length) {
      const mine = this.read();
      const patch: Record<string, unknown> = {};
      for (const k of dirty) patch[k] = mine[k];
      server = await api.patchGradeSettings(patch as Partial<GradeSettings>);
      const now = this.read();
      setState(
        this.db,
        DIRTY,
        JSON.stringify(dirty.filter((k) => JSON.stringify(now[k]) !== JSON.stringify(mine[k]))),
      );
    } else {
      server = await api.getGradeSettings();
    }
    const stillDirty = new Set(this.dirty());
    const local = this.read();
    const srv = cleanGradeSettings(server);
    const merged = cleanGradeSettings(
      Object.fromEntries(
        (Object.keys(srv) as (keyof GradeSettings)[]).map((k) => [
          k,
          stillDirty.has(k) ? local[k] : srv[k],
        ]),
      ),
    );
    setState(this.db, KEY, JSON.stringify(merged));
    return merged;
  }
}
