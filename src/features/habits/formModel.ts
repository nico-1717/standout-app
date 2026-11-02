import { addDays, type Habit } from './logic';
import type { Preset } from './presets';
import type { HabitInput } from './repo';

/**
 * Lo stato del modulo «Nuova abitudine / Modifica» (come `draft` in public/planner/habits.js).
 * I numeri che si scrivono a mano (obiettivo, passo, minuti) restano testo finché si salva.
 */
export interface HabitFormState {
  name: string;
  icon: string;
  color: string;
  motivation: string;
  preset_key: string | null;
  category_uuid: string | null;
  kind: Habit['kind'];
  goal_type: Habit['goal_type'];
  target: string;
  step: string;
  unit: string;
  frequency_type: Habit['frequency_type'];
  weekdays: string; // sette cifre, lunedì per primo
  times_per_week: number;
  times_per_month: number;
  interval_days: number;
  day_part: Habit['day_part'];
  duration_type: Habit['duration_type'];
  duration_days: number;
  start_date: string;
  end_date: string | null;
  planner_minutes: string;
}

export type FormError = 'name' | 'weekdays' | 'target' | 'step' | 'end_date' | 'planner_minutes';

/** I valori di partenza di una nuova abitudine: gli stessi del sito. */
export function newForm(today: string, color: string): HabitFormState {
  return {
    name: '',
    icon: '⭐️',
    color,
    motivation: '',
    preset_key: null,
    category_uuid: null,
    kind: 'build',
    goal_type: 'completion',
    target: '1',
    step: '1',
    unit: '',
    frequency_type: 'daily',
    weekdays: '1111111',
    times_per_week: 4,
    times_per_month: 12,
    interval_days: 2,
    day_part: 'any',
    duration_type: 'forever',
    duration_days: 30,
    start_date: today,
    end_date: null,
    planner_minutes: '',
  };
}

const num = (n: number) => String(Math.round(n * 100) / 100);

export function formFromHabit(h: Habit): HabitFormState {
  return {
    name: h.name,
    icon: h.icon,
    color: h.color,
    motivation: h.motivation ?? '',
    preset_key: h.preset_key || null,
    category_uuid: h.category_uuid,
    kind: h.kind,
    goal_type: h.goal_type,
    target: num(h.target_amount),
    step: num(h.step_amount),
    unit: h.unit,
    frequency_type: h.frequency_type,
    weekdays: h.weekdays,
    times_per_week: h.times_per_week,
    times_per_month: h.times_per_month,
    interval_days: h.interval_days,
    day_part: h.day_part,
    duration_type: h.duration_type,
    duration_days: h.duration_days || 30,
    start_date: h.start_date,
    end_date: h.end_date,
    planner_minutes: h.planner_minutes ? String(h.planner_minutes) : '',
  };
}

/** «Parti da un'abitudine pronta»: copia i campi del preset sul modulo (come il sito). */
export function applyPreset(
  f: HabitFormState,
  p: Preset,
  categories: { uuid: string; slug: string }[],
): HabitFormState {
  const cat = categories.find((c) => c.slug === p.category);
  const o: HabitFormState = {
    ...f,
    name: p.name,
    icon: p.icon,
    color: p.color,
    preset_key: p.key,
    motivation: p.motivation || '',
    category_uuid: cat ? cat.uuid : null,
    kind: p.kind,
    goal_type: p.goal_type,
    target: num(p.target ?? 1),
    step: num(p.step ?? 1),
    unit: p.unit ?? '',
    day_part: p.day_part,
    frequency_type: p.frequency.type,
  };
  if (p.frequency.weekdays) o.weekdays = p.frequency.weekdays;
  if (p.frequency.times_per_week) o.times_per_week = p.frequency.times_per_week;
  if (p.frequency.times_per_month) o.times_per_month = p.frequency.times_per_month;
  if (p.frequency.interval_days) o.interval_days = p.frequency.interval_days;
  return o;
}

const parse = (s: string) => Number(s.replace(',', '.'));

/** Cosa non va nel modulo (vuoto = si può salvare). Stesse regole del server (lib/habits_api.php). */
export function validate(f: HabitFormState): FormError[] {
  const e: FormError[] = [];
  if (!f.name.trim()) e.push('name');
  if (f.frequency_type === 'daily' && !f.weekdays.includes('1')) e.push('weekdays');
  if (f.goal_type === 'quantity') {
    const t = parse(f.target);
    const s = parse(f.step);
    if (!(t > 0 && t <= 1_000_000)) e.push('target');
    if (!(s > 0 && s <= 1_000_000)) e.push('step');
  }
  if (f.duration_type === 'end_date' && (!f.end_date || f.end_date < f.start_date))
    e.push('end_date');
  if (f.planner_minutes.trim() !== '') {
    const m = Number(f.planner_minutes);
    if (!Number.isInteger(m) || m < 0 || m > 1440) e.push('planner_minutes');
  }
  return e;
}

const chars = (s: string, max: number) => Array.from(s).slice(0, max).join('');

/** Dal modulo ai campi che il repo salva. */
export function toInput(f: HabitFormState): HabitInput & { name: string } {
  const quantity = f.goal_type === 'quantity';
  const minutes = f.planner_minutes.trim() === '' ? 0 : Number(f.planner_minutes);
  const out: HabitInput & { name: string } = {
    name: chars(f.name.trim(), 120),
    icon: chars(f.icon, 8) || '⭐️',
    color: f.color,
    motivation: f.motivation.trim() ? chars(f.motivation.trim(), 255) : null,
    preset_key: f.preset_key,
    category_uuid: f.category_uuid,
    kind: f.kind,
    goal_type: f.goal_type,
    frequency_type: f.frequency_type,
    weekdays: f.weekdays,
    times_per_week: f.times_per_week,
    times_per_month: f.times_per_month,
    interval_days: f.interval_days,
    day_part: f.day_part,
    duration_type: f.duration_type,
    start_date: f.start_date,
    planner_minutes: minutes > 0 ? minutes : null,
  };
  if (quantity) {
    out.target_amount = parse(f.target);
    out.step_amount = parse(f.step);
    out.unit = chars(f.unit.trim(), 24);
  }
  if (f.duration_type === 'days') out.duration_days = f.duration_days;
  if (f.duration_type === 'end_date') out.end_date = f.end_date;
  return out;
}

/**
 * Per una modifica si manda solo ciò che è cambiato: meno da sincronizzare e meno conflitti
 * con un altro telefono che ha toccato un altro campo della stessa abitudine.
 */
export function toPatch(h: Habit, f: HabitFormState): HabitInput {
  const next = toInput(f) as Record<string, unknown>;
  const was = h as unknown as Record<string, unknown>;
  const norm = (v: unknown) => (v === '' || v === undefined ? null : v);
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) {
    if (norm(v) === norm(was[k])) continue;
    patch[k] = v;
  }
  // il passaggio a «a quantità» o a «da fare/da evitare» cambia il significato dei numeri: li rimandiamo insieme
  if ('goal_type' in patch && f.goal_type === 'quantity') {
    patch.target_amount = next.target_amount;
    patch.step_amount = next.step_amount;
    patch.unit = next.unit;
  }
  if (('duration_type' in patch || 'start_date' in patch) && f.duration_type === 'days')
    patch.duration_days = f.duration_days;
  return patch as HabitInput;
}

/** Con una data d'inizio futura l'abitudine sta fra le «future» finché non arriva quel giorno. */
export const isFutureStart = (f: Pick<HabitFormState, 'start_date'>, today: string) =>
  f.start_date > today;

/** Il giorno più lontano che si può scegliere per «Fino al»: quello di partenza non basta, serve almeno lui. */
export const minEndDate = (f: Pick<HabitFormState, 'start_date'>) => addDays(f.start_date, 0);
