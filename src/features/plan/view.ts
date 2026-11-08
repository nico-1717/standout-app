import type { Project } from '@/features/projects/logic';

import {
  addDays,
  capacity,
  diffDays,
  inherit,
  mondayOf,
  rootOf,
  type BlockKind,
  type GoalKind,
  type Priority,
} from './engine';
import { summarize, type PlanBlock, type PlanRepo } from './repo';

/* Le tre viste della pagina Piano (oggi, panoramica, calendario), costruite dalle stesse funzioni del sito (piano_api.php:
   today, master, tree). Qui non si scrive niente: si leggono i dati e si calcolano le cifre da mostrare. */

const byUuid = (projects: Project[]) => new Map(projects.map((p) => [p.uuid, p]));

export interface TodayBlock {
  project: string;
  name: string;
  color: string;
  root: string;
  rootName: string;
  rootColor: string;
  kind: BlockKind;
  minutes: number;
  done: number;
  daily: boolean;
}

export interface SkippedBlock {
  project: string;
  name: string;
  missing: number;
  planned: number;
  done: number;
  moveTo: string | null;
}

export interface TodayView {
  today: string;
  blocks: TodayBlock[];
  skipped: SkippedBlock[];
  week: { planned: number; done: number };
  nextExam: { project: string; name: string; date: string; days: number } | null;
}

/** Cosa fare oggi: i blocchi (fatto/previsto), cosa è stato saltato ieri e dove si può spostare, la settimana, il prossimo esame. */
export function todayView(repo: PlanRepo, projects: Project[]): TodayView {
  const today = repo.today();
  const yesterday = addDays(today, -1);
  const names = byUuid(projects);
  const nodes = new Map(repo.nodes().map((n) => [n.id, n]));
  const goals = repo.goals();
  const done = repo.done(addDays(today, -14));
  const doneOn = (p: string, d: string) => done.get(p)?.get(d) ?? 0;

  const blocks: TodayBlock[] = [];
  const todays = repo
    .blocks(today, today)
    .sort((a, b) => (a.kind === b.kind ? b.minutes - a.minutes : a.kind < b.kind ? 1 : -1));
  for (const b of todays) {
    const p = names.get(b.project);
    if (!p) continue;
    const root = rootOf(nodes, b.project);
    const r = names.get(root);
    blocks.push({
      project: b.project,
      name: p.name,
      color: p.color,
      root,
      rootName: r?.name ?? '',
      rootColor: r?.color ?? '',
      kind: b.kind,
      minutes: b.minutes,
      done: doneOn(b.project, today),
      daily: goals.get(b.project)?.kind === 'daily',
    });
  }

  const settings = repo.settings();
  const busy = repo.busy(today, addDays(today, 10));
  const planned = new Map<string, number>();
  for (const b of repo.blocks(today, addDays(today, 10)))
    planned.set(b.day, (planned.get(b.day) ?? 0) + b.minutes);
  const skipped: SkippedBlock[] = [];
  for (const b of repo.blocks(yesterday, yesterday)) {
    if (b.kind !== 'study') continue;
    const p = names.get(b.project);
    if (!p) continue;
    const f = doneOn(b.project, yesterday);
    const missing = b.minutes - f;
    if (missing < 10 || f >= b.minutes * 0.5) continue;
    let moveTo: string | null = null;
    for (let i = 0; i <= 7; i++) {
      const d = addDays(today, i);
      const free = capacity(d, settings, busy, false) - (planned.get(d) ?? 0);
      if (free >= missing) {
        moveTo = d;
        break;
      }
    }
    skipped.push({
      project: b.project,
      name: p.name,
      missing,
      planned: b.minutes,
      done: f,
      moveTo,
    });
  }

  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  let weekPlanned = 0;
  for (const b of repo.blocks(monday, sunday)) if (b.kind === 'study') weekPlanned += b.minutes;
  const weekDone = repo.doneBetween(monday, sunday);

  let nextExam: TodayView['nextExam'] = null;
  for (const [id, o] of goals) {
    if (!o.active || o.kind !== 'exam' || !o.deadline || o.deadline < today || !names.has(id))
      continue;
    if (nextExam === null || o.deadline < nextExam.date)
      nextExam = {
        project: id,
        name: names.get(id)!.name,
        date: o.deadline,
        days: diffDays(today, o.deadline),
      };
  }
  return { today, blocks, skipped, week: { planned: weekPlanned, done: weekDone }, nextExam };
}

export interface MasterGoal {
  project: string;
  name: string;
  color: string;
  status: string;
  active: boolean;
  kind: GoalKind;
  priority: Priority;
  minutes: number;
  done: number;
  planned: number;
  missing: number;
  deadline: string | null;
  kids: number;
}

export interface MasterWeek {
  start: string;
  cap: number;
  parts: Record<string, number>;
}

export interface MasterView {
  goals: MasterGoal[];
  weeks: MasterWeek[];
  neededMin: number;
  freeMin: number;
  missingMin: number;
  fits: boolean;
  end: string;
  units: number;
  /** i progetti di primo livello senza obiettivo (per «Aggiungi un obiettivo») */
  available: { project: string; name: string; color: string }[];
}

/** Tutti gli obiettivi contro il tempo libero, settimana per settimana. */
export function masterView(repo: PlanRepo, projects: Project[]): MasterView {
  const today = repo.today();
  const settings = repo.settings();
  const res = repo.compute(null);
  const goals = repo.goals();
  const done = repo.done();
  const nodes = res.nodes;

  const unitRoots = new Map<string, string>();
  for (const id of res.info.keys()) unitRoots.set(id, rootOf(nodes, id));
  const rootsWithUnits = new Set(unitRoots.values());

  const plannedByRoot = new Map<string, number>();
  const weekParts = new Map<string, Map<string, number>>();
  for (const [day, per] of res.rows) {
    const w = mondayOf(day);
    for (const [id, kinds] of per) {
      const root = rootOf(nodes, id);
      const sum = (kinds.study ?? 0) + (kinds.review ?? 0);
      plannedByRoot.set(root, (plannedByRoot.get(root) ?? 0) + sum);
      let parts = weekParts.get(w);
      if (!parts) weekParts.set(w, (parts = new Map()));
      parts.set(root, (parts.get(root) ?? 0) + sum);
    }
  }
  const missingByRoot = new Map<string, number>();
  let missingTotal = 0;
  for (const [id, m] of res.deficit) {
    missingTotal += m;
    const root = rootOf(nodes, id);
    missingByRoot.set(root, (missingByRoot.get(root) ?? 0) + m);
  }

  const out: MasterGoal[] = [];
  const available: MasterView['available'] = [];
  for (const p of projects) {
    if (p.parent_uuid !== null) continue;
    const og = goals.get(p.uuid) ?? null;
    const attivo = rootsWithUnits.has(p.uuid);
    if (!og && !attivo) {
      if (p.status !== 'completed')
        available.push({ project: p.uuid, name: p.name, color: p.color });
      continue;
    }
    let all = 0;
    for (const [id, root] of unitRoots) if (root === p.uuid) all += goals.get(id)?.minutes ?? 0;
    out.push({
      project: p.uuid,
      name: p.name,
      color: p.color,
      status: p.status,
      active: og?.active ?? false,
      kind: og?.kind ?? 'plain',
      priority: og?.priority ?? 'should',
      minutes: Math.max(all, og?.minutes ?? 0),
      done: repo.doneInBranch(p.uuid, og?.since ?? null, done),
      planned: plannedByRoot.get(p.uuid) ?? 0,
      missing: missingByRoot.get(p.uuid) ?? 0,
      deadline: og?.deadline ?? null,
      kids: nodes.get(p.uuid)?.kids.length ?? 0,
    });
  }

  const start = mondayOf(today);
  const end = res.end;
  const nw = Math.min(30, Math.max(1, Math.ceil((diffDays(start, end) + 1) / 7)));
  const weeks: MasterWeek[] = [];
  let free = 0;
  for (let i = 0; i < nw; i++) {
    const w = addDays(start, 7 * i);
    let cap = 0;
    for (let k = 0; k < 7; k++) {
      const d = addDays(w, k);
      if (d >= today && d <= end) cap += capacity(d, settings, res.busy, false);
    }
    free += cap;
    weeks.push({ start: w, cap, parts: Object.fromEntries(weekParts.get(w) ?? []) });
  }
  let needed = 0;
  for (const u of res.info.values()) needed += u.tot;
  return {
    goals: out,
    weeks,
    neededMin: needed,
    freeMin: free,
    missingMin: missingTotal,
    fits: missingTotal === 0,
    end,
    units: res.info.size + res.dailyCount,
    available,
  };
}

export interface CalendarNode {
  project: string;
  name: string;
  color: string;
  status: string;
  parent: string | null;
  kids: string[];
  /** minuti dell'obiettivo e fatti dal ramo */
  minutes: number;
  doneMin: number;
  kind: GoalKind | null;
  priority: Priority | null;
  deadline: string | null;
  deadlineEff: string | null;
  since: string | null;
}

export interface CalendarView {
  today: string;
  nodes: CalendarNode[];
  paint: Map<string, Set<string>>;
  plan: PlanBlock[];
  /** minuti fatti: giorno → progetto → minuti */
  done: Map<string, Map<string, number>>;
  cap: Map<string, { cap: number; busy: number }>;
}

/** Quello che serve per disegnare un progetto (e il suo ramo) nel calendario, da `from` a `to`. */
export function calendarView(
  repo: PlanRepo,
  projects: Project[],
  root: string | null,
  from: string,
  to: string,
): CalendarView {
  const today = repo.today();
  const names = byUuid(projects);
  const nodes = repo.nodes();
  const map = new Map(nodes.map((n) => [n.id, n]));
  const goals = repo.goals();
  const done = repo.done();
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const stack = [id];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x) || !map.has(x)) continue;
      seen.add(x);
      ids.push(x);
      for (const k of [...map.get(x)!.kids].reverse()) stack.push(k);
    }
  };
  if (root) push(root);
  else for (const n of nodes) if (n.parent === null) push(n.id);

  const outNodes: CalendarNode[] = ids.map((id) => {
    const p = names.get(id);
    const o = goals.get(id) ?? null;
    return {
      project: id,
      name: p?.name ?? '',
      color: p?.color ?? '#8E8E93',
      status: p?.status ?? 'in_progress',
      parent: map.get(id)?.parent ?? null,
      kids: map.get(id)?.kids ?? [],
      minutes: o?.minutes ?? 0,
      doneMin: repo.doneInBranch(id, o?.since ?? null, done),
      kind: o?.kind ?? null,
      priority: o?.priority ?? null,
      deadline: o?.deadline ?? null,
      deadlineEff: inherit(map, goals, id, 'deadline'),
      since: o?.since ?? null,
    };
  });
  const keep = new Set(ids);
  const paint = new Map<string, Set<string>>();
  for (const [p, days] of repo.painted(from, to)) if (keep.has(p)) paint.set(p, days);
  const settings = repo.settings();
  const busy = repo.busy(from, to);
  const cap = new Map<string, { cap: number; busy: number }>();
  for (let d = from; d <= to; d = addDays(d, 1))
    cap.set(d, { cap: capacity(d, settings, busy, true), busy: busy.get(d) ?? 0 });
  const dayDone = new Map<string, Map<string, number>>();
  for (const id of ids)
    for (const [d, m] of done.get(id) ?? [])
      if (d >= from && d <= to) {
        let x = dayDone.get(d);
        if (!x) dayDone.set(d, (x = new Map()));
        x.set(id, m);
      }
  return { today, nodes: outNodes, paint, plan: repo.blocks(from, to, ids), done: dayDone, cap };
}

export { summarize };
