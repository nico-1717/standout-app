/**
 * Le regole delle abitudini, uguali a quelle del sito (lib/habits_core.php): quando un'abitudine è
 * prevista, come un check-in cambia quantità e stato, come si conta la serie. Funzioni pure: stesse
 * date come testo «YYYY-MM-DD», nessun fuso orario (il giorno lo decide chi chiama).
 * Il server rifà gli stessi calcoli quando riceve il check-in: se i due non coincidessero, vince il server
 * e il telefono si rimette a posto al prossimo scarico. Per questo ogni regola qui ha un test.
 */

export interface Habit {
  uuid: string;
  category_uuid: string | null;
  preset_key: string | null;
  name: string;
  icon: string;
  color: string;
  motivation: string | null;
  kind: 'build' | 'quit';
  goal_type: 'completion' | 'quantity';
  target_amount: number;
  step_amount: number;
  unit: string;
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'interval';
  weekdays: string;
  times_per_week: number;
  times_per_month: number;
  interval_days: number;
  day_part: 'any' | 'morning' | 'afternoon' | 'evening' | 'night';
  duration_type: 'forever' | 'days' | 'end_date';
  duration_days: number | null;
  start_date: string;
  end_date: string | null;
  planner_minutes: number | null;
  is_archived: number;
  sort_key: string;
}

export type LogStatus = 'done' | 'partial' | 'skipped' | 'failed';

export interface HabitLog {
  uuid: string;
  habit_uuid: string;
  log_date: string;
  status: LogStatus;
  amount: number;
  completions: number;
  target_amount: number;
  note: string | null;
  mood: number | null;
}

export type CheckInMode = 'increment' | 'decrement' | 'set' | 'toggle' | 'skip' | 'fail' | 'clear';

/* ---------------- date come testo ---------------- */

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(d: string, n: number): string {
  return fromMs(toMs(d) + n * DAY_MS);
}
/** 1 = lunedì … 7 = domenica (come date('N') del sito). */
export function isoWeekday(d: string): number {
  return ((new Date(toMs(d)).getUTCDay() + 6) % 7) + 1;
}
export const weekStart = (d: string) => addDays(d, -(isoWeekday(d) - 1));
export const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
function monthEnd(d: string): string {
  const [y, m] = d.split('-').map(Number);
  return fromMs(Date.UTC(y, m, 0));
}
const prevMonthStart = (ms: string) => monthStart(addDays(ms, -1));

/* ---------------- prevista in quel giorno? ---------------- */

export function isDue(h: Habit, day: string): boolean {
  if (day < h.start_date) return false;
  if (h.end_date && day > h.end_date) return false;
  switch (h.frequency_type) {
    case 'daily':
      return h.weekdays.charAt(isoWeekday(day) - 1) === '1';
    case 'interval': {
      const step = Math.max(1, h.interval_days);
      const diff = Math.floor((toMs(day) - toMs(h.start_date)) / DAY_MS);
      return diff >= 0 && diff % step === 0;
    }
    default:
      return true; // weekly / monthly: si può spuntare ogni giorno, l'obiettivo è per periodo
  }
}

/* ---------------- un check-in ---------------- */

export interface LogState {
  status: LogStatus;
  amount: number;
  completions: number;
}

/**
 * Come hb_log_imposta(): da cosa c'è oggi (o niente) e dal gesto dell'utente, a quantità, stato e
 * numero di spunte. `removed` = la riga non serve più (nessuna quantità, nessuna nota).
 */
export function applyCheckIn(
  h: Pick<Habit, 'kind' | 'goal_type' | 'target_amount' | 'step_amount'>,
  current: LogState | null,
  mode: CheckInMode,
  value = 0,
  hasNote = false,
): LogState & { removed: boolean } {
  const target = h.target_amount;
  const step = Math.max(0.01, h.step_amount);
  const isQuit = h.kind === 'quit';
  let amount = current?.amount ?? 0;
  let completions = current?.completions ?? 0;
  let status: LogStatus = current?.status ?? 'partial';

  switch (mode) {
    case 'increment':
      amount += h.goal_type === 'quantity' ? step : target;
      completions++;
      break;
    case 'decrement':
      amount -= h.goal_type === 'quantity' ? step : target;
      completions--;
      break;
    case 'set':
      amount = value;
      completions = step > 0 ? Math.ceil(amount / step) : 1;
      break;
    case 'toggle':
      if (isQuit ? amount > 0 : status === 'done') {
        amount = 0;
        completions = 0;
      } else {
        amount = target;
        completions = Math.max(1, completions);
      }
      break;
    case 'skip':
      status = status === 'skipped' ? 'partial' : 'skipped';
      break;
    case 'fail':
      status = status === 'failed' ? 'partial' : 'failed';
      amount = status === 'failed' ? 1 : 0;
      break;
    case 'clear':
      amount = 0;
      completions = 0;
      status = 'partial';
      break;
  }
  if (amount < 0) amount = 0;
  if (completions < 0) completions = 0;

  if (mode !== 'skip' && mode !== 'fail') {
    if (isQuit) {
      status =
        h.goal_type === 'quantity' && target > 0
          ? amount >= target
            ? 'failed'
            : 'partial'
          : amount > 0
            ? 'failed'
            : 'partial';
    } else {
      status = amount >= target && target > 0 ? 'done' : 'partial';
    }
  }
  const removed = amount <= 0 && status === 'partial' && !hasNote;
  return { status, amount, completions, removed };
}

/* ---------------- la serie ---------------- */

function periodDone(byDate: Record<string, LogStatus>, start: string, weekly: boolean): number {
  const end = weekly ? addDays(start, 6) : monthEnd(start);
  let n = 0;
  for (const [d, s] of Object.entries(byDate)) if (s === 'done' && d >= start && d <= end) n++;
  return n;
}

/** Serie corrente (giorni, o settimane/mesi per le abitudini settimanali/mensili). Come hb_current_streak(). */
export function currentStreak(h: Habit, byDate: Record<string, LogStatus>, today: string): number {
  const isQuit = h.kind === 'quit';
  if (!isQuit && (h.frequency_type === 'weekly' || h.frequency_type === 'monthly')) {
    const weekly = h.frequency_type === 'weekly';
    const target = Math.max(1, weekly ? h.times_per_week : h.times_per_month);
    const first = weekly ? weekStart(h.start_date) : monthStart(h.start_date);
    const current = weekly ? weekStart(today) : monthStart(today);
    let streak = 0;
    let p = current;
    for (let guard = 0; p >= first && guard < 600; guard++) {
      if (periodDone(byDate, p, weekly) >= target) streak++;
      else if (p !== current) break; // il periodo in corso non rompe la serie
      p = weekly ? addDays(p, -7) : prevMonthStart(p);
    }
    return streak;
  }
  let streak = 0;
  for (let i = 0; i < 1000; i++) {
    const d = addDays(today, -i);
    if (d < h.start_date) break;
    if (!isDue(h, d)) continue;
    const s = byDate[d] ?? null;
    if (isQuit) {
      if (s === 'failed') break;
      streak++;
      continue;
    }
    if (s === 'done') {
      streak++;
      continue;
    }
    if (s === 'skipped') continue;
    if (i === 0) continue; // oggi non ancora fatto: non rompe
    break;
  }
  return streak;
}
