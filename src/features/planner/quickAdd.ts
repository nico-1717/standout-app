import { addDays, isDue, isoWeekday, type Habit, type HabitLog } from '@/features/habits/logic';
import type { Project } from '@/features/projects/logic';

/** Un'abitudine o un progetto preferito che si può mettere in agenda con due tocchi. */
export interface QuickItem {
  kind: 'habit' | 'project';
  uuid: string;
  name: string;
  icon: string | null;
  color: string;
  /** durata proposta in minuti: quella scritta nell'abitudine (planner_minutes) o 30 (60 per un progetto) */
  minutes: number;
  /** per le abitudini settimanali «2/3» (fatte / obiettivo della settimana) */
  progress: string | null;
}

export interface QuickLists {
  habits: QuickItem[];
  weekly: QuickItem[];
  projects: QuickItem[];
}

const byName = (a: QuickItem, b: QuickItem) =>
  a.name.localeCompare(b.name, 'it', { sensitivity: 'base' });

/**
 * Cosa si può aggiungere nel giorno `date`, come pl_habits_for_date / pl_habits_for_week / pl_favorites del sito:
 * le abitudini «da costruire» previste quel giorno (non le settimanali), le settimanali con il conto della
 * settimana, e i progetti preferiti in ordine alfabetico.
 */
export function quickLists(input: {
  habits: Habit[];
  logs: HabitLog[];
  projects: Project[];
  date: string;
}): QuickLists {
  const { habits, logs, projects, date } = input;
  const monday = addDays(date, -(isoWeekday(date) - 1));
  const sunday = addDays(monday, 6);
  const done = new Map<string, number>();
  for (const l of logs) {
    if (l.status === 'done' && l.log_date >= monday && l.log_date <= sunday) {
      done.set(l.habit_uuid, (done.get(l.habit_uuid) ?? 0) + 1);
    }
  }
  const mk = (h: Habit, progress: string | null): QuickItem => ({
    kind: 'habit',
    uuid: h.uuid,
    name: h.name,
    icon: h.icon || null,
    color: h.color,
    minutes: h.planner_minutes ?? 30,
    progress,
  });
  const build = habits.filter((h) => !h.is_archived && h.kind === 'build');
  return {
    habits: build
      .filter((h) => h.frequency_type !== 'weekly' && isDue(h, date))
      .map((h) => mk(h, null)),
    weekly: build
      .filter(
        (h) =>
          h.frequency_type === 'weekly' &&
          h.start_date <= sunday &&
          (!h.end_date || h.end_date >= monday),
      )
      .map((h) => mk(h, `${done.get(h.uuid) ?? 0}/${Math.max(1, h.times_per_week)}`)),
    projects: projects
      .filter((p) => p.is_favorite === 1)
      .map((p): QuickItem => ({
        kind: 'project',
        uuid: p.uuid,
        name: p.name,
        icon: null,
        color: p.color,
        minutes: 60,
        progress: null,
      }))
      .sort(byName),
  };
}

/** «HH:MM» valido → «HH:MM» con lo zero davanti, altrimenti null. */
export function cleanTime(raw: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}
