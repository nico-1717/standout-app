import {
  addDays,
  isDue,
  isoWeekday,
  monthStart,
  weekStart,
  type Habit,
  type HabitLog,
} from '@/features/habits/logic';

/**
 * Le regole del diario, uguali a quelle del sito (lib/diary_core.php): gli anelli delle abitudini, il
 * riepilogo di un mese. Funzioni pure sulle date come testo «YYYY-MM-DD».
 */

export type ListType = 'good' | 'learned';

export interface DiaryItem {
  uuid: string;
  content: string;
  sort_order: number;
}

export interface DiaryDay {
  date: string;
  mood: number | null;
  energy: number | null;
  note: string;
  good: DiaryItem[];
  learned: DiaryItem[];
}

export type RingKey = 'daily' | 'weekly' | 'monthly' | 'interval';
export interface Ring {
  key: RingKey;
  done: number;
  total: number;
}

export interface MonthDay {
  mood: number | null;
  energy: number | null;
  has_text: boolean;
  has_lists: boolean;
}

export interface MonthSummary {
  month: string;
  days: Record<string, MonthDay>;
  stats: {
    mood_mode: number | null;
    mood_avg: number | null;
    energy_avg: number | null;
    filled: number;
    total: number;
  };
  learned: { date: string; content: string }[];
}

/** Limiti del sito: il testo del giorno, una voce di elenco, voci per elenco. */
export const NOTE_MAX = 20000;
export const ITEM_MAX = 300;
export const ITEMS_PER_LIST = 100;

/** «Fatto» per il diario: segnato come fatto, oppure la quantità ha raggiunto l'obiettivo. */
const isOk = (l: HabitLog) => l.status === 'done' || l.amount >= l.target_amount;

function monthEnd(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Gli anelli concentrici: un cerchio per famiglia di frequenza, solo per le famiglie che hanno almeno
 * un'abitudine «da costruire». Dal ritmo più stretto al più largo (il primo si disegna all'interno).
 */
export function diaryRings(habits: Habit[], logs: HabitLog[], date: string): Ring[] {
  const monday = weekStart(date);
  const sunday = addDays(monday, 6);
  const month = date.slice(0, 7);
  const done = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!isOk(l)) continue;
    if (!done.has(l.habit_uuid)) done.set(l.habit_uuid, new Set());
    done.get(l.habit_uuid)!.add(l.log_date);
  }
  const count: Record<RingKey, { done: number; total: number }> = {
    daily: { done: 0, total: 0 },
    weekly: { done: 0, total: 0 },
    monthly: { done: 0, total: 0 },
    interval: { done: 0, total: 0 },
  };
  for (const h of habits) {
    if (h.kind !== 'build' || h.is_archived) continue;
    if (date < h.start_date) continue;
    if (h.end_date && date > h.end_date) continue;
    const mine = done.get(h.uuid) ?? new Set<string>();
    const t = h.frequency_type;
    if (t === 'daily' || t === 'interval') {
      if (!isDue(h, date)) continue;
      count[t].total++;
      if (mine.has(date)) count[t].done++;
    } else if (t === 'weekly') {
      const n = [...mine].filter((g) => g >= monday && g <= sunday).length;
      const goal = Math.max(1, h.times_per_week);
      count.weekly.total += goal;
      count.weekly.done += Math.min(n, goal); // oltre l'obiettivo l'anello non si gonfia
    } else if (t === 'monthly') {
      const n = [...mine].filter((g) => g.slice(0, 7) === month).length;
      const goal = Math.max(1, h.times_per_month);
      count.monthly.total += goal;
      count.monthly.done += Math.min(n, goal);
    }
  }
  return (['daily', 'weekly', 'monthly', 'interval'] as RingKey[])
    .filter((k) => count[k].total > 0)
    .map((k) => ({ key: k, ...count[k] }));
}

/** Le abitudini «da fare» del giorno (giornaliere e a intervallo) con lo stato di oggi, per il riepilogo. */
export function habitsOfTheDay(
  habits: Habit[],
  logs: HabitLog[],
  date: string,
): { uuid: string; name: string; icon: string; color: string; done: boolean }[] {
  const ok = new Set(logs.filter((l) => l.log_date === date && isOk(l)).map((l) => l.habit_uuid));
  return habits
    .filter(
      (h) =>
        h.kind === 'build' &&
        !h.is_archived &&
        (h.frequency_type === 'daily' || h.frequency_type === 'interval') &&
        isDue(h, date),
    )
    .map((h) => ({
      uuid: h.uuid,
      name: h.name,
      icon: h.icon,
      color: h.color,
      done: ok.has(h.uuid),
    }));
}

/** Le abitudini della settimana con quante volte sono già fatte (senza tetto: cinque su quattro conta cinque). */
export function weeklyOfTheDay(
  habits: Habit[],
  logs: HabitLog[],
  date: string,
): { uuid: string; name: string; icon: string; color: string; done: number; target: number }[] {
  const monday = weekStart(date);
  const sunday = addDays(monday, 6);
  return habits
    .filter(
      (h) =>
        h.kind === 'build' &&
        !h.is_archived &&
        h.frequency_type === 'weekly' &&
        h.start_date <= sunday &&
        !(h.end_date && h.end_date < monday),
    )
    .map((h) => ({
      uuid: h.uuid,
      name: h.name,
      icon: h.icon,
      color: h.color,
      target: Math.max(1, h.times_per_week),
      done: logs.filter(
        (l) =>
          l.habit_uuid === h.uuid &&
          l.status === 'done' &&
          l.log_date >= monday &&
          l.log_date <= sunday,
      ).length,
    }));
}

const avg = (a: number[]) =>
  a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100 : null;

/** Un mese: i giorni scritti, le medie, tutto quello che ho imparato (come dg_mese del sito). */
export function summariseMonth(
  month: string,
  journal: {
    entry_date: string;
    mood: number | null;
    energy: number | null;
    note: string | null;
  }[],
  lists: { entry_date: string; list_type: string; content: string }[],
): MonthSummary {
  const days: Record<string, MonthDay> = {};
  const moods: number[] = [];
  const energies: number[] = [];
  for (const r of [...journal].sort((a, b) => a.entry_date.localeCompare(b.entry_date))) {
    days[r.entry_date] = {
      mood: r.mood,
      energy: r.energy,
      has_text: (r.note ?? '').trim() !== '',
      has_lists: false,
    };
    if (r.mood !== null) moods.push(r.mood);
    if (r.energy !== null) energies.push(r.energy);
  }
  const learned: { date: string; content: string }[] = [];
  for (const l of lists) {
    if (!l.content) continue;
    days[l.entry_date] ??= { mood: null, energy: null, has_text: false, has_lists: true };
    days[l.entry_date].has_lists = true;
    if (l.list_type === 'learned') learned.push({ date: l.entry_date, content: l.content });
  }
  const filled = Object.values(days).filter((d) => d.has_text || d.has_lists).length;
  // l'umore più frequente; a pari voti, il primo comparso
  let mode: number | null = null;
  let best = 0;
  const seen = new Map<number, number>();
  for (const m of moods) seen.set(m, (seen.get(m) ?? 0) + 1);
  for (const [m, n] of seen)
    if (n > best) {
      best = n;
      mode = m;
    }
  return {
    month,
    days,
    stats: {
      mood_mode: mode,
      mood_avg: avg(moods),
      energy_avg: avg(energies),
      filled,
      total: Number(monthEnd(`${month}-01`).slice(8)),
    },
    learned,
  };
}

export { addDays, isoWeekday, monthEnd, monthStart, weekStart };
