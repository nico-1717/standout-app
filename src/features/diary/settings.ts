import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/** Carattere, grandezza e carta della pagina diario (tabella `diary_settings` del sito, /api/v1/diary/settings). */
export const DIARY_FONTS = [
  'caveat',
  'kalam',
  'patrick',
  'cormorant',
  'jost',
  'sistema',
  'std-caveat',
  'std-kalam',
  'std-patrick',
  'std-cormorant',
  'std-jost',
] as const;
export type DiaryFont = (typeof DIARY_FONTS)[number];
export type DiaryPaper = 'lined' | 'dotted' | 'plain';

export interface DiarySettings {
  font: DiaryFont;
  size: number;
  paper: DiaryPaper;
}

export const DEFAULT_DIARY_SETTINGS: DiarySettings = { font: 'caveat', size: 18, paper: 'lined' };

export interface DiarySettingsApi {
  getDiarySettings(): Promise<DiarySettings>;
  patchDiarySettings(patch: Partial<DiarySettings>): Promise<DiarySettings>;
}

const D = DEFAULT_DIARY_SETTINGS;

/** Rimette in riga qualunque cosa arrivi (stessi limiti del server). */
export function cleanDiarySettings(raw: unknown): DiarySettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const size = typeof r.size === 'number' && Number.isFinite(r.size) ? Math.round(r.size) : D.size;
  return {
    font: (DIARY_FONTS as readonly unknown[]).includes(r.font) ? (r.font as DiaryFont) : D.font,
    size: Math.min(26, Math.max(14, size)),
    paper: r.paper === 'dotted' || r.paper === 'plain' ? r.paper : 'lined',
  };
}

const KEY = 'diary_settings';
const DIRTY = 'diary_settings_dirty';

/** Come HabitSettingsStore: si cambia subito anche senza rete, ogni campo cambiato resta «da inviare» fino al server. */
export class DiarySettingsStore {
  constructor(private readonly db: SqlDb) {}

  read(): DiarySettings {
    const raw = getState(this.db, KEY);
    try {
      return raw ? cleanDiarySettings(JSON.parse(raw)) : D;
    } catch {
      return D;
    }
  }

  private dirty(): (keyof DiarySettings)[] {
    try {
      return JSON.parse(getState(this.db, DIRTY) ?? '[]') as (keyof DiarySettings)[];
    } catch {
      return [];
    }
  }

  update(patch: Partial<DiarySettings>): DiarySettings {
    const next = cleanDiarySettings({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    const d = new Set(this.dirty());
    for (const k of Object.keys(patch) as (keyof DiarySettings)[]) d.add(k);
    setState(this.db, DIRTY, JSON.stringify([...d]));
    return next;
  }

  hasPending(): boolean {
    return this.dirty().length > 0;
  }

  async sync(api: DiarySettingsApi): Promise<DiarySettings> {
    const dirty = this.dirty();
    let server: DiarySettings;
    if (dirty.length) {
      const mine = this.read();
      const patch: Record<string, unknown> = {};
      for (const k of dirty) patch[k] = mine[k];
      server = await api.patchDiarySettings(patch as Partial<DiarySettings>);
      const now = this.read();
      setState(this.db, DIRTY, JSON.stringify(dirty.filter((k) => now[k] !== mine[k])));
    } else {
      server = await api.getDiarySettings();
    }
    const stillDirty = new Set(this.dirty());
    const local = this.read();
    const srv = cleanDiarySettings(server);
    const merged = cleanDiarySettings(
      Object.fromEntries(
        (Object.keys(srv) as (keyof DiarySettings)[]).map((k) => [
          k,
          stillDirty.has(k) ? local[k] : srv[k],
        ]),
      ),
    );
    setState(this.db, KEY, JSON.stringify(merged));
    return merged;
  }
}
