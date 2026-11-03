import {
  addDays,
  isDue,
  isoWeekday,
  monthStart,
  stateOf,
  weekStart,
  isSuccess,
  type DayState,
  type Habit,
  type HabitLog,
} from './logic';

/**
 * Le statistiche di un'abitudine, copiate da public/planner/habits.js (streakOf, bestStreakOf,
 * windowStats, monthCalendar, heatmap, weekdayBars, monthlyBars…). Funzioni pure: ricevono i
 * check-in dell'abitudine come mappa «giorno → check-in» e il giorno di oggi. Il test d'oro
 * (__tests__/statsGolden.test.ts) le confronta coi numeri che il sito mostra sugli stessi dati.
 */

export type LogMap = Map<string, HabitLog>; // chiave: «YYYY-MM-DD»

export interface Ctx {
  today: string;
  logs: LogMap;
}

export const WEEK_HUES = ['#7C5CFF', '#0A84FF', '#00C7BE', '#FF2D8F', '#00E0A0'];

export const stateAt = (h: Habit, day: string, c: Ctx): DayState =>
  stateOf(h, day, c.logs.get(day) ?? null, c.today);

export const successAt = (h: Habit, day: string, c: Ctx): boolean =>
  isSuccess(h, stateAt(h, day, c));

const isFuture = (d: string, today: string) => d > today;

function monthEndOf(d: string): string {
  const [y, m] = d.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}
const prevMonthStart = (d: string) => monthStart(addDays(d, -1));
const nextMonthStart = (d: string) => addDays(monthEndOf(d), 1);

/** Quante volte «fatta» nella settimana o nel mese che comincia a `start` (come weeklyProgress/monthlyProgress). */
function periodDone(c: Ctx, start: string, weekly: boolean): number {
  const end = weekly ? addDays(start, 6) : monthEndOf(start);
  let n = 0;
  for (const [d, l] of c.logs) if (l.status === 'done' && d >= start && d <= end) n++;
  return n;
}

const isPeriodic = (h: Habit) =>
  h.kind !== 'quit' && (h.frequency_type === 'weekly' || h.frequency_type === 'monthly');

function periodTarget(h: Habit): number {
  return Math.max(1, h.frequency_type === 'weekly' ? h.times_per_week : h.times_per_month);
}

/** Serie corrente: giorni di fila (neutro il «saltato», oggi aperto non rompe); per settimanali/mensili, periodi di fila. */
export function streakOf(h: Habit, c: Ctx): number {
  if (isPeriodic(h)) {
    const weekly = h.frequency_type === 'weekly';
    const first = weekly ? weekStart(h.start_date) : monthStart(h.start_date);
    const current = weekly ? weekStart(c.today) : monthStart(c.today);
    let streak = 0;
    let p = current;
    for (let guard = 0; p >= first && guard < 600; guard++) {
      if (periodDone(c, p, weekly) >= periodTarget(h)) streak++;
      else if (p !== current) break;
      p = weekly ? addDays(p, -7) : prevMonthStart(p);
    }
    return streak;
  }
  let streak = 0;
  let cursor = c.today;
  for (let guard = 0; guard < 1200; guard++) {
    if (cursor < h.start_date) break;
    if (isDue(h, cursor)) {
      const st = stateAt(h, cursor, c);
      if (isSuccess(h, st)) streak++;
      else if (st.status === 'skipped') {
        /* neutro */
      } else if (cursor === c.today) {
        /* la giornata è ancora aperta */
      } else break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Il record: la serie più lunga mai raggiunta, rifatta da tutti i check-in che il telefono ha. */
export function bestStreakOf(h: Habit, c: Ctx): number {
  let best = 0;
  let run = 0;
  if (isPeriodic(h)) {
    const weekly = h.frequency_type === 'weekly';
    let p = weekly ? weekStart(h.start_date) : monthStart(h.start_date);
    const last = weekly ? weekStart(c.today) : monthStart(c.today);
    for (let guard = 0; p <= last && guard < 600; guard++) {
      if (periodDone(c, p, weekly) >= periodTarget(h)) {
        run++;
        if (run > best) best = run;
      } else run = 0;
      p = weekly ? addDays(p, 7) : nextMonthStart(p);
    }
    return best;
  }
  let cursor = h.start_date;
  for (let guard = 0; cursor <= c.today && guard < 1500; guard++) {
    if (isDue(h, cursor)) {
      const st = stateAt(h, cursor, c);
      if (isSuccess(h, st)) {
        run++;
        if (run > best) best = run;
      } else if (st.status !== 'skipped') run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  return best;
}

export interface WindowStats {
  due: number;
  ok: number;
  skipped: number;
  failed: number;
  amount: number;
  rate: number;
}

/** Giorni previsti e riusciti fra due giorni (estremi inclusi). */
export function windowStats(h: Habit, from: string, to: string, c: Ctx): WindowStats {
  let due = 0;
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let amount = 0;
  let cursor = from < h.start_date ? h.start_date : from;
  for (let guard = 0; cursor <= to && guard < 1500; guard++) {
    if (isDue(h, cursor)) {
      const st = stateAt(h, cursor, c);
      amount += st.amount;
      if (st.status === 'skipped') skipped++;
      else {
        due++;
        if (isSuccess(h, st)) ok++;
        if (st.status === 'failed') failed++;
      }
    }
    cursor = addDays(cursor, 1);
  }
  return { due, ok, skipped, failed, amount, rate: due ? ok / due : 0 };
}

export const totalCheckins = (c: Ctx): number => {
  let n = 0;
  for (const l of c.logs.values()) if (l.status === 'done') n++;
  return n;
};

/* ---------------- calendario del mese ---------------- */

export type CalState = 'done' | 'partial' | 'skipped' | 'failed' | 'none';
export interface CalCell {
  day: string;
  num: number;
  due: boolean;
  state: CalState;
  today: boolean;
  future: boolean;
}

/** Il mese `ym` («YYYY-MM») come righe di sette giorni, lunedì per primo; `null` = casella vuota di riempimento. */
export function monthCalendar(h: Habit, ym: string, c: Ctx): (CalCell | null)[] {
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const lead = isoWeekday(first) - 1;
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const out: (CalCell | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= last; d++) {
    const day = `${ym}-${String(d).padStart(2, '0')}`;
    const st = stateAt(h, day, c).status;
    out.push({
      day,
      num: d,
      due: isDue(h, day),
      state:
        st === 'done' || st === 'clean'
          ? 'done'
          : st === 'partial'
            ? 'partial'
            : st === 'skipped'
              ? 'skipped'
              : st === 'failed'
                ? 'failed'
                : 'none',
      today: day === c.today,
      future: isFuture(day, c.today),
    });
  }
  return out;
}

export const addMonths = (ym: string, delta: number): string => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/* ---------------- heatmap annuale ---------------- */

export interface HeatWeek {
  /** mese (0..11) se questa colonna è la prima del mese, altrimenti null */
  month: number | null;
  /** sette livelli 0..4, lunedì per primo; -1 = giorno nel futuro */
  levels: number[];
}

export const heatLevel = (v: number): number =>
  v <= 0 ? 0 : v < 0.34 ? 1 : v < 0.67 ? 2 : v < 1 ? 3 : 4;

/** Un quadratino al giorno, 52 settimane + la corrente, parte di lunedì (come heatmap()). */
export function heatmap(valueFn: (day: string) => number, today: string): HeatWeek[] {
  let start = addDays(today, -363);
  while (isoWeekday(start) !== 1) start = addDays(start, -1);
  const weeks: HeatWeek[] = [];
  let lastMonth = -1;
  for (let cursor = start; cursor <= addDays(today, 6);) {
    const m = Number(cursor.slice(5, 7)) - 1;
    const week: HeatWeek = { month: m !== lastMonth ? m : null, levels: [] };
    lastMonth = m;
    for (let i = 0; i < 7; i++) {
      week.levels.push(cursor > today ? -1 : heatLevel(valueFn(cursor)));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/* ---------------- barre ---------------- */

export interface Bar {
  value: number; // 0..1
  label: string;
  color: string;
  highlight: boolean;
}

/** Barre degli ultimi `days` giorni (una per giorno; sopra 62, una per settimana). `color` fisso o i colori che ruotano. */
export function barsLast(
  days: number,
  valueFn: (day: string) => number,
  today: string,
  color?: string,
): Bar[] {
  const out: Bar[] = [];
  if (days > 62) {
    const weeks = Math.ceil(days / 7);
    for (let w = weeks - 1; w >= 0; w--) {
      let sum = 0;
      let n = 0;
      for (let d = 0; d < 7; d++) {
        const day = addDays(today, -(w * 7 + d));
        if (day < addDays(today, -(days - 1))) break;
        sum += valueFn(day);
        n++;
      }
      out.push({
        value: n ? sum / n : 0,
        label: '',
        color: color ?? WEEK_HUES[(weeks - 1 - w) % WEEK_HUES.length]!,
        highlight: w === 0,
      });
    }
    return out;
  }
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({
      value: valueFn(day),
      label: days <= 31 ? String(Number(day.slice(8))) : '',
      color: color ?? WEEK_HUES[Math.floor((days - 1 - i) / 7) % WEEK_HUES.length]!,
      highlight: day === today,
    });
  }
  return out;
}

/** Giorni forti e deboli: la quota di giorni riusciti per ogni giorno della settimana (lunedì per primo). */
export function weekdayRates(
  habits: Habit[],
  today: string,
  ctxOf: (h: Habit) => Ctx,
  single: boolean,
) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const due = [0, 0, 0, 0, 0, 0, 0];
  const first = single ? habits[0]!.start_date : addDays(today, -180);
  let cursor = first < addDays(today, -365) ? addDays(today, -365) : first;
  for (let guard = 0; cursor <= today && guard < 400; guard++) {
    const i = isoWeekday(cursor) - 1;
    for (const h of habits) {
      if (!isDue(h, cursor)) continue;
      due[i]!++;
      if (successAt(h, cursor, ctxOf(h))) counts[i]!++;
    }
    cursor = addDays(cursor, 1);
  }
  return counts.map((n, i) => (due[i] ? n / due[i]! : 0));
}

/** Quante volte «fatta» in ciascun mese dell'anno di oggi. */
export function monthlyCounts(logsList: HabitLog[], year: number): number[] {
  const counts = new Array<number>(12).fill(0);
  for (const l of logsList) {
    if (l.status !== 'done' || Number(l.log_date.slice(0, 4)) !== year) continue;
    counts[Number(l.log_date.slice(5, 7)) - 1]!++;
  }
  return counts;
}

/**
 * «Quando ti muovi»: i check-in per ora del giorno (0..23) negli ultimi `days` giorni. Conta i check-in fatti o in corso
 * (come il sito, che conta gli eventi con delta positivo), all'ora locale in cui sono stati scritti.
 */
export function checkInHours(logsList: HabitLog[], today: string, days = 90): number[] {
  const hours = new Array<number>(24).fill(0);
  const from = addDays(today, -(days - 1));
  for (const l of logsList) {
    if (!l.first_logged_at || l.log_date < from || l.log_date > today) continue;
    if (l.status !== 'done' && l.status !== 'partial') continue;
    const at = new Date(l.first_logged_at);
    // testo senza fuso («2026-11-03 09:10:00»): è già all'ora locale
    const h = /[zZ]|[+-]\d\d:?\d\d$/.test(l.first_logged_at)
      ? at.getHours()
      : Number(l.first_logged_at.slice(11, 13));
    if (Number.isFinite(h) && h >= 0 && h < 24) hours[h]!++;
  }
  return hours;
}
