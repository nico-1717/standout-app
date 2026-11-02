import { dailyFor, stateOf } from '@/features/habits/logic';
import type { HabitsRepo } from '@/features/habits/repo';
import type { PillsRepo } from '@/features/pills/repo';
import { addDaysIso } from '@/features/tasks/groups';

import {
  planReminders,
  type HabitDue,
  type Reminder,
  type ReminderSettings,
  type ReminderWords,
} from './plan';

/** Quanti giorni avanti si programmano: poi, a ogni apertura dell'app, si rifà. */
export const HORIZON_DAYS = 7;

/** Il telefono, visto da qui: quattro cose sole (così si prova senza telefono). */
export interface Notifier {
  /** true se si può mostrare notifiche */
  allowed(): Promise<boolean>;
  cancelAll(): Promise<void>;
  schedule(r: Reminder): Promise<void>;
}

/** Le abitudini «da costruire» previste in ciascuno dei prossimi giorni e non ancora fatte né saltate. */
export function habitsDue(habits: HabitsRepo, today: string, days = HORIZON_DAYS): HabitDue[] {
  const list = habits.list();
  const out: HabitDue[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDaysIso(today, i);
    for (const h of dailyFor(list, day)) {
      if (h.kind === 'quit') continue; // «da evitare»: non c'è niente da fare, quindi niente da ricordare
      if (i === 0) {
        const s = stateOf(h, day, habits.log(h.uuid, day), today);
        if (s.status === 'done' || s.status === 'skipped') continue;
      }
      out.push({ date: day, icon: h.icon, name: h.name });
    }
  }
  return out;
}

/** Un'impronta della lista: se non cambia, non serve toccare le notifiche già programmate. */
export const signatureOf = (list: Reminder[]): string =>
  list.map((r) => `${r.id}@${r.at.getTime()}#${r.title}|${r.body}`).join('\n');

/**
 * Rifà le notifiche dai dati di adesso: così una pastiglia presa, una terapia cambiata o un'abitudine spuntata
 * fanno sparire la notifica che non serve più. Se la lista è uguale a quella già programmata (`previous`) non
 * si tocca niente. Spente o senza permesso: si cancella tutto e non se ne programma nessuna.
 */
export async function rescheduleAll(opts: {
  notifier: Notifier;
  settings: ReminderSettings;
  pills: PillsRepo;
  habits: HabitsRepo;
  today: string;
  now: Date;
  words: ReminderWords;
  previous?: string | null;
}): Promise<{ count: number; signature: string }> {
  const { notifier, settings } = opts;
  const off = !settings.pills && !settings.habits;
  const list =
    off || !(await notifier.allowed())
      ? []
      : planReminders({
          now: opts.now,
          settings,
          pills: settings.pills ? opts.pills.upcoming(HORIZON_DAYS) : [],
          habits: settings.habits ? habitsDue(opts.habits, opts.today) : [],
          words: opts.words,
        });
  const signature = signatureOf(list);
  if (opts.previous === signature) return { count: list.length, signature };
  await notifier.cancelAll();
  for (const r of list) await notifier.schedule(r);
  return { count: list.length, signature };
}
