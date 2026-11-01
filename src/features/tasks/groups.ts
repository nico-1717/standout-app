import type { Task } from './repo';

export type TaskGroup = 'overdue' | 'today' | 'later' | 'done';

/** La data di oggi sul telefono, «AAAA-MM-GG» (le scadenze del sito sono date senza fuso). */
export function localToday(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Divide le attività nei gruppi della lista (stessi nomi del sito): in ritardo, oggi, più avanti
 * (anche senza data), fatte. L'ordine dentro ogni gruppo resta quello dell'utente (sort_key).
 * I gruppi vuoti non compaiono.
 */
export function groupTasks(tasks: Task[], today: string): { group: TaskGroup; tasks: Task[] }[] {
  const g: Record<TaskGroup, Task[]> = { overdue: [], today: [], later: [], done: [] };
  for (const t of tasks) {
    if (t.is_done) g.done.push(t);
    else if (t.due_date !== null && t.due_date < today) g.overdue.push(t);
    else if (t.due_date === today) g.today.push(t);
    else g.later.push(t);
  }
  return (['overdue', 'today', 'later', 'done'] as TaskGroup[])
    .filter((k) => g[k].length > 0)
    .map((k) => ({ group: k, tasks: g[k] }));
}
