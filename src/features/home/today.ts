import type { Habit } from '@/features/habits/logic';
import {
  dailyFor,
  isDue,
  isSuccess,
  ofKind,
  periodProgress,
  stateOf,
} from '@/features/habits/logic';
import type { HabitsRepo } from '@/features/habits/repo';
import type { EventView } from '@/features/planner/events';
import type { PlannerRepo } from '@/features/planner/repo';
import type { DoseView, PillsRepo } from '@/features/pills/repo';
import type { Task, TasksRepo } from '@/features/tasks/repo';

/** Un anello delle abitudini di oggi: «fatte su previste», uno per ritmo che l'utente ha davvero (pl_rings del sito). */
export interface HabitRing {
  key: 'daily' | 'weekly' | 'monthly' | 'interval';
  done: number;
  total: number;
}

export interface ImportantDate {
  title: string;
  date: string;
  time: string;
  days: number;
  color: string | null;
  strong: boolean;
}

export interface TodayData {
  today: string;
  tomorrow: string;
  /** gli eventi di oggi (anche quelli cominciati nei giorni scorsi e ancora in corso), per ora d'inizio */
  events: EventView[];
  tomorrowEvents: EventView[];
  /** l'evento in corso adesso, e il prossimo che comincia */
  current: EventView | null;
  next: EventView | null;
  rings: HabitRing[];
  /** le pastiglie in ritardo: arretrate dei giorni scorsi e quelle di oggi la cui ora è già passata */
  pillsLate: DoseView[];
  hasPills: boolean;
  /** le attività «di oggi»: scadenza oggi o già passata, non fatte */
  todos: Task[];
  todosDoneToday: number;
  /** poche cose da comprare: quelle con data arrivata, se no le più urgenti, se no la prima */
  buy: Task[];
  buyOpen: number;
  important: ImportantDate[];
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const addDay = (iso: string, n: number) => {
  const d = new Date(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)) + n,
    12,
  );
  return ymd(d);
};
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Quanto manca/è durato, in forma corta: «45 min», «2 h 10». */
export function minutesText(m: number): string {
  const t = Math.max(0, Math.round(m));
  const h = Math.floor(t / 60);
  const r = t % 60;
  return h ? (r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`) : `${t} min`;
}

export function habitRings(habits: Habit[], repo: HabitsRepo, today: string): HabitRing[] {
  const build = habits.filter((h) => h.kind !== 'quit' && !h.is_archived && h.start_date <= today);
  const logs = new Map(
    repo.logsBetween(today, today).map((l) => [`${l.habit_uuid}|${l.log_date}`, l]),
  );
  const out: HabitRing[] = [];
  const daily = dailyFor(build, today);
  let done = 0;
  let total = 0;
  for (const h of daily) {
    const s = stateOf(h, today, logs.get(`${h.uuid}|${today}`) ?? null, today);
    if (s.status === 'skipped') continue;
    total++;
    if (isSuccess(h, s)) done++;
  }
  if (total) out.push({ key: 'daily', done, total });
  for (const key of ['weekly', 'monthly'] as const) {
    let d = 0;
    let t = 0;
    for (const h of ofKind(build, key)) {
      const by = repo.statusByDate(h.uuid);
      const p = periodProgress(
        h,
        today,
        Object.keys(by).filter((x) => by[x] === 'done'),
      );
      t += p.target;
      d += Math.min(p.done, p.target);
    }
    if (t) out.push({ key, done: d, total: t });
  }
  // «ogni N giorni»: come le giornaliere, ma solo nei giorni in cui tocca
  let id = 0;
  let it = 0;
  for (const h of ofKind(build, 'interval')) {
    if (!isDue(h, today)) continue;
    const s = stateOf(h, today, logs.get(`${h.uuid}|${today}`) ?? null, today);
    if (s.status === 'skipped') continue;
    it++;
    if (isSuccess(h, s)) id++;
  }
  if (it) out.push({ key: 'interval', done: id, total: it });
  return out;
}

/** Tutto quello che «Oggi» mostra, dal database del telefono (home_api.php ?g=agenda,important,tasks,habits). */
export function buildToday(
  s: {
    planner: PlannerRepo;
    habits: HabitsRepo;
    pills: PillsRepo;
    tasks: TasksRepo;
  },
  now: Date,
): TodayData {
  const today = ymd(now);
  const tomorrow = addDay(today, 1);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const evs = s.planner.visibleEventsInRange(addDay(today, -1), addDay(today, 60));
  const startOf = (e: EventView) => (e.allDay || e.date < today ? -1 : toMin(e.start));
  const endOf = (e: EventView) => (e.allDay ? 1440 : e.endDate > today ? 1440 : toMin(e.end));
  const events = evs
    .filter((e) => e.date <= today && e.endDate >= today)
    .sort((a, b) => startOf(a) - startOf(b));
  const tomorrowEvents = evs
    .filter((e) => e.date === tomorrow)
    .sort((a, b) => startOf(a) - startOf(b));
  let current: EventView | null = null;
  let next: EventView | null = null;
  for (const e of events) {
    if (e.allDay || e.done) continue;
    const st = startOf(e);
    const en = endOf(e);
    if (st <= nowMin && nowMin < en && !current) current = e;
    else if (st > nowMin && !next) next = e;
  }

  const habits = s.habits.list();
  const rings = habitRings(habits, s.habits, today);

  const day = s.pills.day(today);
  const pending = (d: DoseView) => d.status === 'pending';
  const pillsLate = [
    ...day.late.filter(pending),
    ...day.doses.filter((d) => pending(d) && toMin(d.due_time) <= nowMin),
  ];
  const hasPills = s.pills.plans().length > 0;

  const todoAll = s.tasks.list('todo');
  const todos = todoAll.filter((t) => !t.is_done && t.due_date && t.due_date <= today);
  const todosDoneToday = todoAll.filter(
    (t) => t.is_done && t.done_at && t.done_at.slice(0, 10) === today,
  ).length;
  const buyAll = s.tasks.list('buy').filter((t) => !t.is_done);
  const due = buyAll.filter((t) => t.due_date && t.due_date <= today);
  const urgent = buyAll.filter((t) => t.buy_priority === 1);
  const buy = (due.length ? due : urgent.length ? urgent : buyAll.slice(0, 1)).slice(0, 4);

  const important: ImportantDate[] = evs
    .filter((e) => e.importance !== 'normal' && e.date >= today)
    .map((e) => ({
      title: e.title,
      date: e.date,
      time: e.allDay ? '' : e.start,
      days: daysBetween(today, e.date),
      color: e.color,
      strong: e.importance === 'highest',
    }))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
    .slice(0, 6);

  return {
    today,
    tomorrow,
    events,
    tomorrowEvents,
    current,
    next,
    rings,
    pillsLate,
    hasPills,
    todos,
    todosDoneToday,
    buy,
    buyOpen: buyAll.length,
    important,
  };
}
