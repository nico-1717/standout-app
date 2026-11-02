import {
  addDays,
  dailyFor,
  dayProgress,
  isDue,
  isoWeekday,
  isSuccess,
  type Habit,
  type HabitLog,
} from './logic';
import { bestStreakOf, stateAt, streakOf, windowStats, type Ctx, type LogMap } from './stats';

/**
 * Le statistiche di TUTTE le abitudini insieme (carosello, «Statistiche», «Vista tabella»), copiate da
 * habits.js (globalStreak, countDone, perfectDaysCount, rangeRate, statCards, categoryBars, rankingHTML,
 * weekGridHTML). Il test d'oro le confronta con ciò che il sito mostra sugli stessi dati.
 */

/** Tutti i check-in, chiave «uuid|giorno» (come dayProgress di logic.ts). */
export type AllLogs = Map<string, HabitLog>;

export function allLogsOf(logs: HabitLog[]): AllLogs {
  const m: AllLogs = new Map();
  for (const l of logs) m.set(`${l.habit_uuid}|${l.log_date}`, l);
  return m;
}

/** I check-in di una sola abitudine, per giorno. */
export function ctxFor(allLogs: AllLogs, today: string): (h: Habit) => Ctx {
  const byHabit = new Map<string, LogMap>();
  for (const l of allLogs.values()) {
    let m = byHabit.get(l.habit_uuid);
    if (!m) byHabit.set(l.habit_uuid, (m = new Map()));
    m.set(l.log_date, l);
  }
  const empty: LogMap = new Map();
  return (h) => ({ today, logs: byHabit.get(h.uuid) ?? empty });
}

const active = (habits: Habit[]) => habits.filter((h) => !h.is_archived);

/** Giorni perfetti di fila; i giorni senza abitudini previste non contano e non rompono; oggi aperto non rompe. */
export function globalStreak(habits: Habit[], logs: AllLogs, today: string): number {
  let streak = 0;
  let cursor = today;
  for (let guard = 0; guard < 900; guard++) {
    if (dailyFor(habits, cursor).length === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    const p = dayProgress(habits, cursor, logs, today);
    if (p.total === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (p.done === p.total) streak++;
    else if (cursor === today) {
      /* giornata ancora aperta */
    } else break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function countDone(logs: AllLogs, from: string, to: string): number {
  let n = 0;
  for (const l of logs.values())
    if (l.status === 'done' && l.log_date >= from && l.log_date <= to) n++;
  return n;
}

export function perfectDaysCount(habits: Habit[], logs: AllLogs, today: string): number {
  let n = 0;
  for (let cursor = addDays(today, -364); cursor <= today; cursor = addDays(cursor, 1)) {
    const p = dayProgress(habits, cursor, logs, today);
    if (p.total > 0 && p.done === p.total) n++;
  }
  return n;
}

export function lastNPcts(habits: Habit[], logs: AllLogs, today: string, n: number): number[] {
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--)
    out.push(dayProgress(habits, addDays(today, -i), logs, today).pct);
  return out;
}

/** Quota di giorni riusciti, su tutte le abitudini, negli ultimi `days` giorni. */
export function rangeRate(
  habits: Habit[],
  days: number,
  ctxOf: (h: Habit) => Ctx,
  today: string,
): number {
  const from = addDays(today, -(days - 1));
  let due = 0;
  let ok = 0;
  for (const h of active(habits)) {
    const w = windowStats(h, from, today, ctxOf(h));
    due += w.due;
    ok += w.ok;
  }
  return due ? ok / due : 0;
}

export function bestOverall(habits: Habit[], ctxOf: (h: Habit) => Ctx): number {
  let best = 0;
  for (const h of habits) best = Math.max(best, bestStreakOf(h, ctxOf(h)));
  return best;
}

export interface StatCardData {
  key: 'streak' | 'today' | 'month' | 'rate' | 'total' | 'perfect' | 'best';
  color: string;
  emoji: string;
  /** chiave di testo (abitudini.*) oppure, per «today», il giorno scelto */
  kicker: string;
  kickerIsDay?: boolean;
  value: number;
  suffix: string;
  sub: { key: string; params?: Record<string, string | number> };
  spark?: number[];
  ring?: number;
}

/** Le sette carte del carosello (statCards del sito). `monthName` = nome del mese di oggi, minuscolo. */
export function statCards(
  habits: Habit[],
  logs: AllLogs,
  selected: string,
  today: string,
  monthName: string,
): StatCardData[] {
  const list = active(habits);
  const ctxOf = ctxFor(logs, today);
  const prog = dayProgress(list, selected, logs, today);
  const monthStart = `${today.slice(0, 8)}01`;
  const g = globalStreak(list, logs, today);
  const w30 = rangeRate(list, 30, ctxOf, today);
  const best = bestOverall(list, ctxOf);
  const last7 = lastNPcts(list, logs, today, 7);
  return [
    {
      key: 'streak',
      color: '#FF6B35',
      emoji: '🔥',
      kicker: 'abitudini.serie_attuale',
      value: g,
      suffix: '',
      sub: { key: g > 0 ? 'abitudini.giorni_perfetti_fila' : 'abitudini.completa_tutto_oggi' },
      spark: last7,
    },
    {
      key: 'today',
      color: '#7C5CFF',
      emoji: '✅',
      kicker: selected,
      kickerIsDay: true,
      value: prog.done,
      suffix: `/${prog.total}`,
      sub: prog.total
        ? { key: 'abitudini.pct_della_giornata', params: { pct: Math.round(prog.pct * 100) } }
        : { key: 'abitudini.nessuna_abitudine_prevista_l' },
      ring: prog.pct,
    },
    {
      key: 'month',
      color: '#0A84FF',
      emoji: '📅',
      kicker: 'abitudini.questo_mese',
      value: countDone(logs, monthStart, today),
      suffix: '',
      sub: { key: 'abitudini.checkin_in_mese', params: { mese: monthName } },
      spark: last7,
    },
    {
      key: 'rate',
      color: '#00E0A0',
      emoji: '📈',
      kicker: 'abitudini.ultimi_30_giorni',
      value: Math.round(w30 * 100),
      suffix: '%',
      sub: { key: 'abitudini.tasso_completamento' },
      ring: w30,
    },
    {
      key: 'total',
      color: '#FFCC00',
      emoji: '🏆',
      kicker: 'abitudini.da_sempre',
      value: countDone(logs, '0000-01-01', today),
      suffix: '',
      sub: { key: 'abitudini.completate_in_totale' },
      spark: last7,
    },
    {
      key: 'perfect',
      color: '#FF2D8F',
      emoji: '💎',
      kicker: 'abitudini.giornate_perfette',
      value: perfectDaysCount(list, logs, today),
      suffix: '',
      sub: { key: 'abitudini.giorni_tutto_completato' },
      spark: last7,
    },
    {
      key: 'best',
      color: '#BF5AF2',
      emoji: '👑',
      kicker: 'abitudini.record_personale',
      value: best,
      suffix: '',
      sub: { key: 'abitudini.la_serie_piu_lunga_mai' },
      ring: best ? Math.min(1, g / best) : 0,
    },
  ];
}

export interface CategoryRow {
  uuid: string | null;
  name: string;
  color: string;
  ok: number;
  due: number;
}

/** «Per categoria»: completate / previste negli ultimi `days` giorni. `cats`: id → {name,color} già tradotti. */
export function categoryRows(
  habits: Habit[],
  days: number,
  ctxOf: (h: Habit) => Ctx,
  today: string,
  cats: Map<string, { name: string; color: string }>,
  noCategory: string,
): CategoryRow[] {
  const from = addDays(today, -(days - 1));
  const by = new Map<string, CategoryRow>();
  for (const h of active(habits)) {
    const c = h.category_uuid ? cats.get(h.category_uuid) : undefined;
    const key = c ? h.category_uuid! : '';
    let r = by.get(key);
    if (!r)
      by.set(
        key,
        (r = {
          uuid: c ? key : null,
          name: c ? c.name : noCategory,
          color: c ? c.color : '#8E8E93',
          ok: 0,
          due: 0,
        }),
      );
    const w = windowStats(h, from, today, ctxOf(h));
    r.ok += w.ok;
    r.due += w.due;
  }
  return [...by.values()].filter((r) => r.due > 0).sort((a, b) => b.ok - a.ok);
}

export interface RankRow {
  habit: Habit;
  rate: number;
  ok: number;
  due: number;
  streak: number;
}

/** Classifica per tasso di completamento negli ultimi `days` giorni. */
export function ranking(
  habits: Habit[],
  days: number,
  ctxOf: (h: Habit) => Ctx,
  today: string,
): RankRow[] {
  const from = addDays(today, -(days - 1));
  return active(habits)
    .map((h) => {
      const c = ctxOf(h);
      const w = windowStats(h, from, today, c);
      return { habit: h, rate: w.rate, ok: w.ok, due: w.due, streak: streakOf(h, c) };
    })
    .filter((r) => r.due > 0)
    .sort((a, b) => b.rate - a.rate);
}

/** «Equilibrio delle aree»: quota riuscita per categoria (almeno 3 categorie con dati per disegnarlo). */
export function radarData(
  habits: Habit[],
  days: number,
  ctxOf: (h: Habit) => Ctx,
  today: string,
  cats: { uuid: string; name: string }[],
): { name: string; v: number }[] {
  const from = addDays(today, -(days - 1));
  const out: { name: string; v: number }[] = [];
  for (const c of cats) {
    let ok = 0;
    let due = 0;
    for (const h of active(habits)) {
      if (h.category_uuid !== c.uuid) continue;
      const w = windowStats(h, from, today, ctxOf(h));
      ok += w.ok;
      due += w.due;
    }
    if (due > 0) out.push({ name: c.name, v: ok / due });
  }
  return out;
}

export type WeekCell = 'done' | 'partial' | 'skipped' | 'failed' | 'none' | 'na';

/** «Settimana per abitudine»: la settimana di oggi, lunedì per primo. */
export function weekGrid(habits: Habit[], today: string, ctxOf: (h: Habit) => Ctx) {
  const start = addDays(today, -(isoWeekday(today) - 1));
  return active(habits).map((h) => ({
    habit: h,
    cells: Array.from({ length: 7 }, (_, i): WeekCell => {
      const d = addDays(start, i);
      if (!isDue(h, d) || d > today) return 'na';
      const s = stateAt(h, d, ctxOf(h)).status;
      return s === 'done' || s === 'clean'
        ? 'done'
        : s === 'partial'
          ? 'partial'
          : s === 'skipped'
            ? 'skipped'
            : s === 'failed'
              ? 'failed'
              : 'none';
    }),
  }));
}

/** Una riga della «Vista tabella»: stati dei giorni e percentuale. */
export function tableRow(h: Habit, dates: string[], ctxOf: (h: Habit) => Ctx) {
  let ok = 0;
  let due = 0;
  const cells = dates.map((d): WeekCell => {
    if (!isDue(h, d) || d > ctxOf(h).today) return 'na';
    due++;
    const st = stateAt(h, d, ctxOf(h));
    if (st.status === 'done' || st.status === 'clean') {
      ok++;
      return 'done';
    }
    if (st.status === 'partial') {
      if (isSuccess(h, st)) ok++;
      return 'partial';
    }
    return st.status === 'skipped' ? 'skipped' : st.status === 'failed' ? 'failed' : 'none';
  });
  return { cells, pct: due ? Math.round((ok / due) * 100) : 0 };
}
