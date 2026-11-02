import type { Task } from './repo';

/** I gruppi del to do del sito (todo_barra.js, decoraTodo): in ritardo, oggi, domani, questa settimana, più avanti, senza data, fatte. */
export type TaskGroup = 'ritardo' | 'oggi' | 'domani' | 'settimana' | 'dopo' | 'senza' | 'fatte';

export const GROUP_ORDER: TaskGroup[] = [
  'ritardo',
  'oggi',
  'domani',
  'settimana',
  'dopo',
  'senza',
  'fatte',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** La data di oggi sul telefono, «AAAA-MM-GG» (le scadenze del sito sono date senza fuso). */
export function localToday(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** L'ora di adesso sul telefono, «HH:MM». */
export function localNow(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDaysIso(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const x = new Date(y!, m! - 1, d!);
  x.setDate(x.getDate() + n);
  return localToday(x);
}

/** In ritardo = data (e ora) passata e non spuntata (Todo.prototype.isLate del sito). */
export function isLate(
  t: Pick<Task, 'is_done' | 'due_date' | 'due_time'>,
  today: string,
  now: string,
): boolean {
  if (t.is_done || !t.due_date) return false;
  if (t.due_date < today) return true;
  if (t.due_date > today) return false;
  return !!(t.due_time && t.due_time.slice(0, 5) < now);
}

export function groupOf(
  t: Pick<Task, 'is_done' | 'due_date' | 'due_time'>,
  today: string,
  now: string,
): TaskGroup {
  if (t.is_done) return 'fatte';
  if (!t.due_date) return 'senza';
  if (isLate(t, today, now)) return 'ritardo';
  if (t.due_date === today) return 'oggi';
  if (t.due_date === addDaysIso(today, 1)) return 'domani';
  if (t.due_date < addDaysIso(today, 7)) return 'settimana';
  return 'dopo';
}

/**
 * L'ordine della pagina (td_api_elenco): prima le non fatte, prima quelle con data (le più vicine per prime),
 * a parità l'ora (senza ora in fondo), poi come le ha messe l'utente.
 */
export function sortLikeSite(tasks: Task[]): Task[] {
  return tasks.slice().sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done - b.is_done;
    if ((a.due_date === null) !== (b.due_date === null)) return a.due_date === null ? 1 : -1;
    if (a.due_date !== b.due_date) return (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1;
    if ((a.due_time === null) !== (b.due_time === null)) return a.due_time === null ? 1 : -1;
    if (a.due_time !== b.due_time) return (a.due_time ?? '') < (b.due_time ?? '') ? -1 : 1;
    return a.sort_key < b.sort_key ? -1 : a.sort_key > b.sort_key ? 1 : 0;
  });
}

/** Il giorno (sul telefono) in cui è stata spuntata: `done_at` arriva dal sito («AAAA-MM-GG HH:MM:SS») o dall'app (ISO con «Z»). */
export function doneDay(doneAt: string | null): string | null {
  if (!doneAt) return null;
  if (doneAt.endsWith('Z')) {
    const d = new Date(doneAt);
    return Number.isNaN(d.getTime()) ? null : localToday(d);
  }
  return doneAt.slice(0, 10);
}

/** «Quelle spuntate spariscono da sole il giorno dopo» (td_cleanup): finché il server non le toglie, qui non si vedono. */
export function visibleTasks<T extends Pick<Task, 'is_done'> & { done_at?: string | null }>(
  tasks: T[],
  today: string,
): T[] {
  return tasks.filter((t) => {
    if (!t.is_done) return true;
    const d = doneDay(t.done_at ?? null);
    return d === null || d >= today;
  });
}

/** Divide le attività nei gruppi del sito, nell'ordine del sito. I gruppi vuoti non compaiono. */
export function groupTasks(
  tasks: Task[],
  today: string,
  now: string = '00:00',
): { group: TaskGroup; tasks: Task[] }[] {
  const g = Object.fromEntries(GROUP_ORDER.map((k) => [k, [] as Task[]])) as Record<
    TaskGroup,
    Task[]
  >;
  for (const t of sortLikeSite(tasks)) g[groupOf(t, today, now)].push(t);
  return GROUP_ORDER.filter((k) => g[k].length > 0).map((k) => ({ group: k, tasks: g[k] }));
}
