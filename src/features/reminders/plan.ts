/**
 * Quali notifiche programmare. Niente telefono qui dentro: arrivano le prese e le abitudini ancora da fare, e
 * escono le notifiche in ordine di ora. L'orologio lo passa chi chiama.
 */

export interface ReminderSettings {
  pills: boolean;
  habits: boolean;
  /** l'ora della notifica delle abitudini, «HH:MM» */
  habitTime: string;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  pills: false,
  habits: false,
  habitTime: '20:00',
};

export const validTime = (s: unknown): s is string =>
  typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function cleanReminders(raw: unknown): ReminderSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    pills: r.pills === true,
    habits: r.habits === true,
    habitTime: validTime(r.habitTime) ? r.habitTime : DEFAULT_REMINDERS.habitTime,
  };
}

export interface PillDue {
  due_date: string;
  due_time: string;
  name: string;
  plan_dose: string;
}

export interface HabitDue {
  date: string;
  icon: string;
  name: string;
}

export interface Reminder {
  /** stabile: la stessa notifica ha sempre lo stesso id */
  id: string;
  kind: 'pill' | 'habits';
  at: Date;
  title: string;
  body: string;
}

export interface ReminderWords {
  pillsTitle: string;
  habitsTitle: string;
}

/** iOS tiene al massimo 64 notifiche programmate: ne teniamo meno, le più vicine. */
export const MAX_SCHEDULED = 60;

/** «AAAA-MM-GG» + «HH:MM» → una data sul telefono (ora locale). */
export function localDate(day: string, hhmm: string): Date {
  return new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    Number(hhmm.slice(0, 2)),
    Number(hhmm.slice(3, 5)),
    0,
    0,
  );
}

export function planReminders(opts: {
  now: Date;
  settings: ReminderSettings;
  pills: PillDue[];
  habits: HabitDue[];
  words: ReminderWords;
  limit?: number;
}): Reminder[] {
  const { now, settings, words } = opts;
  const out: Reminder[] = [];

  if (settings.pills) {
    // più pastiglie alla stessa ora fanno una notifica sola
    const groups = new Map<string, PillDue[]>();
    for (const d of opts.pills) {
      const k = `${d.due_date} ${d.due_time}`;
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    for (const [k, list] of groups) {
      const at = localDate(k.slice(0, 10), k.slice(11, 16));
      if (at.getTime() <= now.getTime()) continue;
      // lo stesso nome due volte (due prese dello stesso farmaco) si scrive una volta
      const names = [
        ...new Set(list.map((d) => (d.plan_dose ? `${d.name} (${d.plan_dose})` : d.name))),
      ];
      out.push({
        id: `pill-${k}`,
        kind: 'pill',
        at,
        title: words.pillsTitle,
        body: names.join(', '),
      });
    }
  }

  if (settings.habits) {
    const days = new Map<string, HabitDue[]>();
    for (const h of opts.habits) days.set(h.date, [...(days.get(h.date) ?? []), h]);
    for (const [day, list] of days) {
      const at = localDate(day, settings.habitTime);
      if (at.getTime() <= now.getTime()) continue;
      out.push({
        id: `habits-${day}`,
        kind: 'habits',
        at,
        title: words.habitsTitle,
        body: list.map((h) => `${h.icon} ${h.name}`.trim()).join(', '),
      });
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));
  return out.slice(0, opts.limit ?? MAX_SCHEDULED);
}
