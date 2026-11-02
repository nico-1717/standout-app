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

/* ---------------- stato del giorno per la schermata (come stateOf/dayProgress di habits.js) ---------------- */

export type UiStatus = 'done' | 'partial' | 'failed' | 'skipped' | 'empty' | 'clean';

export interface DayState {
  status: UiStatus;
  amount: number;
  target: number;
  /** 0..1: quanto è avanti (per le «da evitare» a quantità: quanto margine resta) */
  pct: number;
}

/** Stato di un'abitudine in un giorno, normalizzato per l'interfaccia. */
export function stateOf(h: Habit, day: string, log: HabitLog | null, today: string): DayState {
  const target = h.goal_type === 'quantity' ? h.target_amount : 1;
  const amount = log ? log.amount : 0;
  const future = day > today;
  if (h.kind === 'quit') {
    const q = log ? log.status : !future && day >= h.start_date ? 'clean' : 'empty';
    if (q === 'skipped') return { status: 'skipped', amount: 0, target, pct: 0 };
    if (q === 'failed') return { status: 'failed', amount, target, pct: 0 };
    if (h.goal_type === 'quantity' && q === 'partial' && amount > 0) {
      return {
        status: 'partial',
        amount,
        target,
        pct: target > 0 ? Math.max(0, 1 - amount / target) : 0,
      };
    }
    return { status: future ? 'empty' : 'clean', amount: 0, target, pct: 1 };
  }
  const status: string = log ? log.status : 'empty';
  const pct = target > 0 ? Math.min(1, amount / target) : 0;
  if (status === 'skipped') return { status: 'skipped', amount, target, pct: 0 };
  if (amount >= target && target > 0) return { status: 'done', amount, target, pct: 1 };
  if (amount > 0) return { status: 'partial', amount, target, pct };
  return { status: 'empty', amount: 0, target, pct: 0 };
}

/** «Conta come riuscito»: per le «da evitare» anche restare sotto la soglia. */
export function isSuccess(h: Habit, s: DayState): boolean {
  return h.kind === 'quit' ? s.status === 'clean' || s.status === 'partial' : s.status === 'done';
}

/** Le abitudini giornaliere previste in un giorno (le settimanali, mensili e a intervallo hanno sezioni loro). */
export function dailyFor(habits: Habit[], day: string): Habit[] {
  return habits.filter((h) => !h.is_archived && h.frequency_type === 'daily' && isDue(h, day));
}

export function dayProgress(
  habits: Habit[],
  day: string,
  logs: Map<string, HabitLog>,
  today: string,
): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const h of dailyFor(habits, day)) {
    const s = stateOf(h, day, logs.get(`${h.uuid}|${day}`) ?? null, today);
    if (s.status === 'skipped') continue;
    total++;
    if (isSuccess(h, s)) done++;
  }
  return { done, total, pct: total ? done / total : 0 };
}

/** Le abitudini attive di un tipo di frequenza. */
export function ofKind(habits: Habit[], kind: Habit['frequency_type']): Habit[] {
  return habits.filter((h) => !h.is_archived && h.frequency_type === kind);
}

/** Quante volte «fatta» in un periodo (settimana di `day`, mese di `day`, o il turno corrente per «ogni N giorni»). */
export function periodProgress(
  h: Habit,
  day: string,
  doneDates: string[],
): { done: number; target: number; daysToNext?: number; step?: number } {
  if (h.frequency_type === 'weekly') {
    const s = weekStart(day);
    const e = addDays(s, 6);
    return {
      done: doneDates.filter((d) => d >= s && d <= e).length,
      target: Math.max(1, h.times_per_week || 1),
    };
  }
  if (h.frequency_type === 'monthly') {
    const m = day.slice(0, 7);
    return {
      done: doneDates.filter((d) => d.slice(0, 7) === m).length,
      target: Math.max(1, h.times_per_month || 1),
    };
  }
  const step = Math.max(1, h.interval_days || 1);
  const since = Math.floor(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${h.start_date}T00:00:00Z`)) / 86_400_000,
  );
  if (since < 0) return { done: 0, target: 1, daysToNext: -since, step };
  const from = addDays(h.start_date, since - (since % step));
  const to = addDays(from, step - 1);
  const n = doneDates.filter((d) => d >= from && d <= to).length;
  return { done: Math.min(1, n), target: 1, daysToNext: step - (since % step), step };
}

/** Il messaggio sotto «Oggi» (stesse soglie del sito). */
export function dayMessageKey(p: { total: number; pct: number }): string {
  if (p.total === 0) return 'abitudini.nessuna_abitudine_prevista';
  const pct = Math.round(p.pct * 100);
  if (pct === 100) return 'abitudini.giornata_perfetta_chiusa_cosi';
  if (pct >= 60) return 'abitudini.ci_sei_quasi_tieni_il';
  if (pct > 0) return 'abitudini.hai_iniziato_continua';
  return 'abitudini.il_primo_check_in_e';
}

/** Giorni perfetti di fila fino a oggi (oggi non ancora completo non rompe la serie). */
export function perfectStreak(
  habits: Habit[],
  logs: Map<string, HabitLog>,
  today: string,
  maxDays = 400,
): number {
  let n = 0;
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(today, -i);
    const p = dayProgress(habits, d, logs, today);
    if (p.total === 0) {
      if (i === 0) continue;
      // un giorno senza abitudini previste non rompe e non conta
      if (habits.every((h) => d < h.start_date)) break;
      continue;
    }
    if (p.pct === 1) n++;
    else if (i === 0) continue;
    else break;
  }
  return n;
}

/**
 * Lo scorrimento di una riga (swipeAllowed/swipeMode del sito). dir +1 = fare / «ci sono cascato», -1 = annullare.
 * Una direzione vale solo se porta a un vero cambio: niente da annullare = la riga resta ferma.
 */
export function swipeAllowed(h: Habit, s: DayState, dir: 1 | -1): boolean {
  const qty = h.goal_type === 'quantity';
  if (dir > 0) {
    if (qty) return true; // le quantità si possono sempre aumentare
    return h.kind === 'quit' ? s.status !== 'failed' : s.status !== 'done';
  }
  if (qty) return s.amount > 0;
  return h.kind === 'quit' ? s.status === 'failed' : s.status === 'done';
}

export function swipeMode(h: Habit, dir: 1 | -1): CheckInMode {
  if (h.goal_type === 'quantity') return dir > 0 ? 'increment' : 'decrement';
  return h.kind === 'quit' ? 'fail' : 'toggle';
}
