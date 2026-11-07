import type { Habit, HabitLog } from './logic';
import { addDays } from './logic';
import { bestStreakOf, type Ctx, type LogMap } from './stats';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type Metric =
  'streak' | 'total_checkins' | 'perfect_days' | 'completion_rate' | 'habit_count' | 'comeback';

export interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: Tier;
  metric: Metric;
  threshold: number;
  scope: 'habit' | 'global';
}

/**
 * Il catalogo dei traguardi: le 17 righe di `habit_achievements` del sito (esportate il 2026-11-03,
 * vedi docs/data/habit_achievements.sql), nello stesso ordine (`sort_order`). I testi sono quelli del sito.
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    code: 'streak_3',
    name: 'Primi passi',
    description: '3 giorni di fila su una stessa abitudine.',
    icon: '🌱',
    tier: 'bronze',
    metric: 'streak',
    threshold: 3,
    scope: 'habit',
  },
  {
    code: 'streak_7',
    name: 'Una settimana',
    description: '7 giorni di fila. La costanza inizia qui.',
    icon: '🔥',
    tier: 'bronze',
    metric: 'streak',
    threshold: 7,
    scope: 'habit',
  },
  {
    code: 'streak_21',
    name: 'Abitudine formata',
    description: '21 giorni di fila: ora è automatica.',
    icon: '⚡️',
    tier: 'silver',
    metric: 'streak',
    threshold: 21,
    scope: 'habit',
  },
  {
    code: 'streak_66',
    name: 'Sessantasei',
    description: '66 giorni di fila, la soglia scientifica.',
    icon: '🧠',
    tier: 'gold',
    metric: 'streak',
    threshold: 66,
    scope: 'habit',
  },
  {
    code: 'streak_100',
    name: 'Centenario',
    description: '100 giorni di fila su una singola abitudine.',
    icon: '💯',
    tier: 'gold',
    metric: 'streak',
    threshold: 100,
    scope: 'habit',
  },
  {
    code: 'streak_365',
    name: 'Un anno intero',
    description: '365 giorni di fila. Leggenda.',
    icon: '👑',
    tier: 'platinum',
    metric: 'streak',
    threshold: 365,
    scope: 'habit',
  },
  {
    code: 'checkins_50',
    name: 'Cinquanta spunte',
    description: '50 check-in totali.',
    icon: '✅',
    tier: 'bronze',
    metric: 'total_checkins',
    threshold: 50,
    scope: 'global',
  },
  {
    code: 'checkins_250',
    name: 'Macchina da guerra',
    description: '250 check-in totali.',
    icon: '🚀',
    tier: 'silver',
    metric: 'total_checkins',
    threshold: 250,
    scope: 'global',
  },
  {
    code: 'checkins_1000',
    name: 'Mille',
    description: '1000 check-in totali.',
    icon: '🏆',
    tier: 'platinum',
    metric: 'total_checkins',
    threshold: 1000,
    scope: 'global',
  },
  {
    code: 'perfect_1',
    name: 'Giornata perfetta',
    description: 'Tutte le abitudini del giorno completate.',
    icon: '🌟',
    tier: 'bronze',
    metric: 'perfect_days',
    threshold: 1,
    scope: 'global',
  },
  {
    code: 'perfect_7',
    name: 'Settimana perfetta',
    description: '7 giornate perfette.',
    icon: '💎',
    tier: 'silver',
    metric: 'perfect_days',
    threshold: 7,
    scope: 'global',
  },
  {
    code: 'perfect_30',
    name: 'Mese perfetto',
    description: '30 giornate perfette.',
    icon: '🪐',
    tier: 'gold',
    metric: 'perfect_days',
    threshold: 30,
    scope: 'global',
  },
  {
    code: 'rate_80',
    name: 'Ottanta per cento',
    description: '80% di completamento negli ultimi 30 giorni.',
    icon: '📈',
    tier: 'silver',
    metric: 'completion_rate',
    threshold: 80,
    scope: 'global',
  },
  {
    code: 'rate_95',
    name: 'Quasi impeccabile',
    description: '95% di completamento negli ultimi 30 giorni.',
    icon: '🎯',
    tier: 'gold',
    metric: 'completion_rate',
    threshold: 95,
    scope: 'global',
  },
  {
    code: 'habits_5',
    name: 'Sistema in piedi',
    description: '5 abitudini attive contemporaneamente.',
    icon: '🧩',
    tier: 'bronze',
    metric: 'habit_count',
    threshold: 5,
    scope: 'global',
  },
  {
    code: 'habits_10',
    name: 'Routine completa',
    description: '10 abitudini attive contemporaneamente.',
    icon: '🛠️',
    tier: 'silver',
    metric: 'habit_count',
    threshold: 10,
    scope: 'global',
  },
  {
    code: 'comeback_1',
    name: 'Ritorno',
    description: 'Ripresa dopo aver perso una streak di 7+ giorni.',
    icon: '🔁',
    tier: 'bronze',
    metric: 'comeback',
    threshold: 1,
    scope: 'global',
  },
];

export interface AchievementState extends Achievement {
  unlocked: boolean;
  /** valore raggiunto per questo traguardo (serie più lunga, check-in…) */
  value: number;
}

/**
 * Le cifre da cui dipendono i traguardi, calcolate come fa il sito quando registra un check-in
 * (hb_evaluate_achievements in lib/habits_core.php): tutti i check-in «fatti», le giornate in cui TUTTI i
 * log del giorno sono «fatti» (almeno uno), la percentuale degli ultimi 30 giorni (saltati esclusi), le abitudini
 * attive e la serie più lunga di una singola abitudine. Il sito non assegna mai «Ritorno» (metrica non valutata).
 */
export function achievementValues(habits: Habit[], logs: HabitLog[], today: string) {
  let done = 0;
  const perDay = new Map<string, { all: number; notDone: number }>();
  const from30 = addDays(today, -30);
  let done30 = 0;
  let all30 = 0;
  const byHabit = new Map<string, LogMap>();
  for (const l of logs) {
    const d = perDay.get(l.log_date) ?? { all: 0, notDone: 0 };
    d.all += 1;
    if (l.status !== 'done') d.notDone += 1;
    perDay.set(l.log_date, d);
    if (l.status === 'done') done += 1;
    if (l.log_date >= from30) {
      if (l.status === 'done') done30 += 1;
      if (l.status !== 'skipped') all30 += 1;
    }
    let m = byHabit.get(l.habit_uuid);
    if (!m) byHabit.set(l.habit_uuid, (m = new Map()));
    m.set(l.log_date, l);
  }
  let perfect = 0;
  for (const d of perDay.values()) if (d.all > 0 && d.notDone === 0) perfect += 1;
  const active = habits.filter((h) => !h.is_archived);
  const empty: LogMap = new Map();
  let bestStreak = 0;
  for (const h of habits) {
    const ctx: Ctx = { today, logs: byHabit.get(h.uuid) ?? empty };
    bestStreak = Math.max(bestStreak, bestStreakOf(h, ctx));
  }
  return {
    streak: bestStreak,
    total_checkins: done,
    perfect_days: perfect,
    completion_rate: all30 > 0 ? Math.round((done30 * 100) / all30) : 0,
    habit_count: active.length,
    comeback: 0,
  } satisfies Record<Metric, number>;
}

/** Tutti i traguardi con lo stato «sbloccato» di oggi. */
export function evaluateAchievements(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
): AchievementState[] {
  const v = achievementValues(habits, logs, today);
  return ACHIEVEMENTS.map((a) => {
    const value = v[a.metric];
    return { ...a, value, unlocked: a.metric !== 'comeback' && value >= a.threshold };
  });
}
