import type { TFunction } from 'i18next';

import raw from './habits_presets.json';
import type { Habit } from './logic';

/**
 * Colori, icone, unità e abitudini «pronte» — lo stesso file del sito (lib/data/habits_presets.json,
 * copiato con `npm run i18n:sync`). Il file è in italiano: ogni voce ha una chiave stabile e il
 * nome si traduce cercando `abitudini.<chiave>` nel dizionario; se manca resta il testo del file
 * (come fa lib/habits_core.php: una voce nuova si vede subito ma non rompe niente).
 */

export interface PaletteColor {
  key: string;
  name: string;
  hex: string;
  glow: string;
}
export interface DayPartInfo {
  key: Habit['day_part'];
  name: string;
  icon: string;
}
export interface Preset {
  key: string;
  name: string;
  icon: string;
  color: string;
  category: string; // slug della categoria di partenza
  kind: Habit['kind'];
  goal_type: Habit['goal_type'];
  target?: number;
  step?: number;
  unit?: string;
  frequency: {
    type: Habit['frequency_type'];
    weekdays?: string;
    times_per_week?: number;
    times_per_month?: number;
    interval_days?: number;
  };
  day_part: Habit['day_part'];
  motivation: string;
}

interface Raw {
  palette: PaletteColor[];
  units: string[];
  day_parts: (DayPartInfo & { from: string | null; to: string | null })[];
  icons: Record<string, string[]>;
  presets: Preset[];
}
const data = raw as unknown as Raw;

/** La stessa regola di lib/habits_core.php (iconv ASCII//TRANSLIT + minuscole + «_»): «€» non ha lettere e diventa «x». */
export function dictKey(text: string): string {
  const x = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return x === '' ? 'x' : x;
}

/** `abitudini.<chiave>` se esiste nel dizionario, altrimenti il testo di ripiego. */
function tr(t: TFunction, key: string, fallback: string): string {
  const full = `abitudini.${key}`;
  const s = t(full, { defaultValue: '' }) as string;
  return s && s !== full && !s.startsWith('<<') ? s : fallback;
}

export function palette(t: TFunction): PaletteColor[] {
  return data.palette.map((p) => ({ ...p, name: tr(t, `pal_${p.key}`, p.name) }));
}
export function dayParts(t: TFunction): DayPartInfo[] {
  return data.day_parts.map((p) => ({
    key: p.key,
    icon: p.icon,
    name: tr(t, `part_${p.key}`, p.name),
  }));
}
/** Le unità: `value` è ciò che si salva (tradotto, come fa il sito), `label` lo stesso. */
export function units(t: TFunction): string[] {
  return data.units.map((u) => tr(t, `unit_${dictKey(u)}`, u));
}
export function iconGroups(t: TFunction): { title: string; icons: string[] }[] {
  return Object.entries(data.icons).map(([g, icons]) => ({
    title: tr(t, `icone_${dictKey(g)}`, g),
    icons,
  }));
}
export function presets(t: TFunction): Preset[] {
  return data.presets.map((p) => ({
    ...p,
    name: tr(t, `pre_${p.key}`, p.name),
    motivation: tr(t, `pre_${p.key}_m`, p.motivation),
    unit: p.unit ? tr(t, `unit_${dictKey(p.unit)}`, p.unit) : p.unit,
  }));
}
export const DEFAULT_COLOR = data.palette[0]?.hex ?? '#7C5CFF';
