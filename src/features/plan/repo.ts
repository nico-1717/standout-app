import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireValue } from '@/core/sync/types';
import { perUserUuid, planDayUuid, planGoalUuid, planPaintUuid } from '@/core/sync/uuid5';

import {
  GOAL_KINDS,
  PRIORITIES,
  addDays,
  diffDays,
  dow,
  mondayOf,
  measuredPace,
  plan,
  rootOf,
  subtree,
  type BlockKind,
  type Goal,
  type GoalKind,
  type PlanNode,
  type PlanResult,
  type PlanSettings,
  type Priority,
} from './engine';

/* ---------------- tipi ---------------- */

/** Le impostazioni come stanno salvate: `null` = «usa il ritmo misurato». */
export interface StoredSettings {
  weekdayMin: number | null;
  weekendMin: number | null;
  restDow: number;
  bufferDays: number;
  floorMin: number;
  maxSubjects: number;
  reviews: boolean;
  overrides: Record<string, number>;
}

export interface ResolvedSettings extends PlanSettings {
  stored: StoredSettings;
  measured: { weekday: number; weekend: number; days: number; enough: boolean };
}

export interface GoalInput {
  kind?: GoalKind;
  priority?: Priority;
  active?: boolean;
  minutes?: number;
  locked?: boolean;
  /** `undefined` = non si tocca, `null` = si toglie */
  deadline?: string | null;
  start?: string | null;
  items?: number | null;
  unitMinutes?: number | null;
  /** date, tipo e priorità anche ai sotto-progetti */
  cascade?: boolean;
}

export interface SplitItem {
  uuid: string;
  minutes: number;
  locked: boolean;
}

export interface PlanBlock {
  project: string;
  day: string;
  kind: BlockKind;
  minutes: number;
  source: 'auto' | 'manual';
}

export interface AutoplanSummary {
  applied: boolean;
  totalMin: number;
  missingMin: number;
  warnings: { project: string; minutes: number; painted: number }[];
  first: string | null;
  last: string | null;
  weeks: Record<string, number>;
  units: number;
  fits: boolean;
}

interface TemplateItem {
  path: string;
  minutes: number;
  kind: GoalKind;
  priority: Priority;
  locked: boolean;
}

export interface Template {
  uuid: string;
  name: string;
}

interface GoalRow {
  uuid: string;
  project_uuid: string;
  active: number;
  minutes: number;
  locked: number;
  kind: string;
  priority: string;
  start_date: string | null;
  deadline: string | null;
  since: string | null;
  items: number | null;
  unit_minutes: number | null;
}

const GOAL_COLS =
  'uuid, project_uuid, active, minutes, locked, kind, priority, start_date, deadline, since, items, unit_minutes';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function asKind(v: string): GoalKind {
  return (GOAL_KINDS as string[]).includes(v) ? (v as GoalKind) : 'plain';
}

function asPriority(v: string): Priority {
  return (PRIORITIES as string[]).includes(v) ? (v as Priority) : 'should';
}

function toGoal(r: GoalRow): Goal {
  return {
    active: r.active === 1,
    minutes: r.minutes,
    locked: r.locked === 1,
    kind: asKind(r.kind),
    priority: asPriority(r.priority),
    start: r.start_date,
    deadline: r.deadline,
    since: r.since,
    items: r.items,
    unitMinutes: r.unit_minutes,
  };
}

/** Minuti da «HH:MM» (anche «HH:MM:SS»). */
function hm(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

/** Riassunto di un piano calcolato: le stesse cifre dell'anteprima del sito. */
export function summarize(res: PlanResult): Omit<AutoplanSummary, 'applied'> {
  let total = 0;
  const weeks: Record<string, number> = {};
  let first: string | null = null;
  let last: string | null = null;
  for (const [day, per] of res.rows) {
    for (const kinds of per.values()) {
      for (const m of Object.values(kinds)) {
        total += m ?? 0;
        const w = mondayOf(day);
        weeks[w] = (weeks[w] ?? 0) + (m ?? 0);
      }
    }
    if (first === null || day < first) first = day;
    if (last === null || day > last) last = day;
  }
  let missing = 0;
  const warnings: AutoplanSummary['warnings'] = [];
  for (const [project, m] of res.deficit) {
    missing += m;
    const u = res.info.get(project);
    warnings.push({ project, minutes: m, painted: u?.dip ? u.utili.length : 0 });
  }
  const ordered: Record<string, number> = {};
  for (const k of Object.keys(weeks).sort()) ordered[k] = weeks[k];
  return {
    totalMin: total,
    missingMin: missing,
    warnings,
    first,
    last,
    weeks: ordered,
    units: res.info.size + res.dailyCount,
    fits: missing === 0,
  };
}

/**
 * Il piano dei progetti sul telefono: obiettivi, giorni evidenziati, blocchi del giorno, «il tuo tempo» e i modelli.
 * Ogni azione fa quello che fa la stessa azione di piano_api.php; le righe hanno gli stessi uuid del server
 * (UUIDv5 di progetto/giorno/tipo), così telefono e sito scrivono sulla stessa riga.
 */
export class PlanRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly userId: number | string,
    private readonly now: () => Date = () => new Date(),
    private readonly clockIso: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  today(): string {
    return localDay(this.now());
  }

  /* ---------------- lettura ---------------- */

  /** I progetti nell'ordine della lista, con i figli nello stesso ordine. */
  nodes(): PlanNode[] {
    const rows = this.db.all<{ uuid: string; parent_uuid: string | null; status: string }>(
      'SELECT uuid, parent_uuid, status FROM projects ORDER BY sort_key, uuid',
    );
    const map = new Map<string, PlanNode>();
    for (const r of rows)
      map.set(r.uuid, { id: r.uuid, parent: r.parent_uuid, status: r.status, kids: [] });
    for (const n of map.values()) if (n.parent !== null) map.get(n.parent)?.kids.push(n.id);
    return [...map.values()];
  }

  goals(): Map<string, Goal> {
    const out = new Map<string, Goal>();
    for (const r of this.db.all<GoalRow>(`SELECT ${GOAL_COLS} FROM plan_goals`))
      out.set(r.project_uuid, toGoal(r));
    return out;
  }

  private goalRow(projectUuid: string): GoalRow | null {
    return (
      this.db.all<GoalRow>(`SELECT ${GOAL_COLS} FROM plan_goals WHERE project_uuid = ?`, [
        projectUuid,
      ])[0] ?? null
    );
  }

  /** Minuti fatti: progetto → giorno → minuti, da una data in poi (tutto lo storico se manca). */
  done(from = '2000-01-01'): Map<string, Map<string, number>> {
    const out = new Map<string, Map<string, number>>();
    const rows = this.db.all<{ p: string; d: string; s: number }>(
      `SELECT project_uuid AS p, substr(start_time,1,10) AS d, SUM(COALESCE(duration_seconds,0)) AS s
       FROM pomodoro_sessions WHERE project_uuid IS NOT NULL AND substr(start_time,1,10) >= ?
       GROUP BY project_uuid, substr(start_time,1,10)`,
      [from],
    );
    for (const r of rows) {
      let m = out.get(r.p);
      if (!m) out.set(r.p, (m = new Map()));
      m.set(r.d, Math.round(r.s / 60));
    }
    return out;
  }

  /** Minuti di Pomodoro con un progetto fra due giorni (estremi inclusi). */
  doneBetween(from: string, to: string): number {
    const r = this.db.all<{ s: number | null }>(
      `SELECT SUM(COALESCE(duration_seconds,0)) AS s FROM pomodoro_sessions
       WHERE project_uuid IS NOT NULL AND substr(start_time,1,10) BETWEEN ? AND ?`,
      [from, to],
    )[0];
    return Math.round((r?.s ?? 0) / 60);
  }

  /** Minuti di Pomodoro per giorno (di qualsiasi progetto): serve al ritmo misurato. */
  private minutesPerDay(from: string, to: string): Map<string, number> {
    const out = new Map<string, number>();
    for (const r of this.db.all<{ d: string; s: number }>(
      `SELECT substr(start_time,1,10) AS d, SUM(COALESCE(duration_seconds,0)) AS s
       FROM pomodoro_sessions WHERE substr(start_time,1,10) >= ? AND substr(start_time,1,10) < ?
       GROUP BY substr(start_time,1,10)`,
      [from, to],
    ))
      out.set(r.d, r.s / 60);
    return out;
  }

  /** I blocchi dei giorni nell'intervallo (estremi inclusi). */
  blocks(from: string, to: string, projects?: string[]): PlanBlock[] {
    const rows = this.db.all<{
      p: string;
      d: string;
      k: BlockKind;
      m: number;
      s: 'auto' | 'manual';
    }>(
      'SELECT project_uuid AS p, day AS d, kind AS k, minutes AS m, source AS s FROM plan_days WHERE day BETWEEN ? AND ? ORDER BY day, kind',
      [from, to],
    );
    const keep = projects ? new Set(projects) : null;
    return rows
      .filter((r) => !keep || keep.has(r.p))
      .map((r) => ({ project: r.p, day: r.d, kind: r.k, minutes: r.m, source: r.s }));
  }

  /** I giorni evidenziati: progetto → giorni (da una data in poi, o nell'intervallo). */
  painted(from: string, to?: string): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    const rows = to
      ? this.db.all<{ p: string; d: string }>(
          'SELECT project_uuid AS p, day AS d FROM plan_paint WHERE day BETWEEN ? AND ?',
          [from, to],
        )
      : this.db.all<{ p: string; d: string }>(
          'SELECT project_uuid AS p, day AS d FROM plan_paint WHERE day >= ?',
          [from],
        );
    for (const r of rows) {
      let s = out.get(r.p);
      if (!s) out.set(r.p, (s = new Set()));
      s.add(r.d);
    }
    return out;
  }

  /** I blocchi di studio messi a mano da una data in poi: giorno → progetto → minuti. */
  manual(from: string): Map<string, Map<string, number>> {
    const out = new Map<string, Map<string, number>>();
    for (const r of this.db.all<{ d: string; p: string; m: number }>(
      "SELECT day AS d, project_uuid AS p, minutes AS m FROM plan_days WHERE source = 'manual' AND kind = 'study' AND day >= ?",
      [from],
    )) {
      let m = out.get(r.d);
      if (!m) out.set(r.d, (m = new Map()));
      m.set(r.p, r.m);
    }
    return out;
  }

  /**
   * Minuti già presi dal planner (lezioni, visite…): solo eventi veri, senza ripetizione e senza progetto; quelli di tutto
   * il giorno contano 0 / 120 / 240 minuti secondo l'importanza.
   */
  busy(from: string, to: string): Map<string, number> {
    const out = new Map<string, number>();
    const rows = this.db.all<{
      event_date: string;
      is_all_day: number;
      importance: string;
      start_time: string;
      end_time: string;
    }>(
      `SELECT event_date, is_all_day, importance, start_time, end_time FROM planner_events
       WHERE event_date BETWEEN ? AND ? AND rrule IS NULL AND COALESCE(is_cancelled,0) = 0
         AND item_type = 'event' AND project_uuid IS NULL AND COALESCE(is_completed,0) = 0`,
      [from, to],
    );
    for (const r of rows) {
      let m: number;
      if (r.is_all_day === 1)
        m = r.importance === 'normal' ? 0 : r.importance === 'high' ? 120 : 240;
      else m = Math.max(0, Math.min(600, hm(r.end_time) - hm(r.start_time)));
      out.set(r.event_date, (out.get(r.event_date) ?? 0) + Math.round(m));
    }
    return out;
  }

  storedSettings(): StoredSettings {
    const r = this.db.all<{
      weekday_min: number | null;
      weekend_min: number | null;
      rest_dow: number;
      buffer_days: number;
      floor_min: number;
      max_subjects: number;
      reviews: number;
      overrides: string | null;
    }>('SELECT * FROM plan_settings')[0];
    let overrides: Record<string, number> = {};
    if (r?.overrides) {
      try {
        const j = JSON.parse(r.overrides) as unknown;
        if (j && typeof j === 'object')
          for (const [d, m] of Object.entries(j as Record<string, unknown>))
            if (DAY_RE.test(d) && typeof m === 'number') overrides[d] = clamp(m, 0, 1440);
      } catch {
        overrides = {};
      }
    }
    return {
      weekdayMin: r?.weekday_min ?? null,
      weekendMin: r?.weekend_min ?? null,
      restDow: r?.rest_dow ?? 0,
      bufferDays: r?.buffer_days ?? 0,
      floorMin: r?.floor_min ?? 15,
      maxSubjects: r?.max_subjects ?? 3,
      reviews: (r?.reviews ?? 0) === 1,
      overrides,
    };
  }

  settings(): ResolvedSettings {
    const today = this.today();
    const stored = this.storedSettings();
    const measured = measuredPace(today, this.minutesPerDay(addDays(today, -60), today));
    return {
      restDow: stored.restDow,
      bufferDays: stored.bufferDays,
      floorMin: stored.floorMin,
      maxSubjects: stored.maxSubjects,
      reviews: stored.reviews,
      weekdayEff: stored.weekdayMin ?? measured.weekday,
      weekendEff: stored.weekendMin ?? measured.weekend,
      overrides: stored.overrides,
      stored,
      measured,
    };
  }

  /** Calcola il piano (anche solo di un ramo). Non scrive niente. */
  compute(root: string | null = null): PlanResult {
    const today = this.today();
    const s = this.settings();
    return plan({
      today,
      nodes: this.nodes(),
      goals: this.goals(),
      done: this.done(),
      manual: this.manual(today),
      painted: this.painted(today),
      busy: this.busy(today, addDays(today, 402)),
      settings: s,
      root,
    });
  }

  /* ---------------- obiettivi ---------------- */

  /** Scrive i campi dati di un obiettivo (crea la riga se manca). Ritorna se qualcosa è cambiato. */
  private writeGoal(
    projectUuid: string,
    fields: Partial<{
      active: boolean;
      minutes: number;
      locked: boolean;
      kind: GoalKind;
      priority: Priority;
      start_date: string | null;
      deadline: string | null;
      since: string | null;
      items: number | null;
      unit_minutes: number | null;
    }>,
  ): void {
    const now = this.clockIso();
    const old = this.goalRow(projectUuid);
    if (old) {
      const patch: Record<string, WireValue> = {};
      const local: Record<string, WireValue> = {};
      const cur: Record<string, unknown> = {
        active: old.active === 1,
        minutes: old.minutes,
        locked: old.locked === 1,
        kind: old.kind,
        priority: old.priority,
        start_date: old.start_date,
        deadline: old.deadline,
        since: old.since,
        items: old.items,
        unit_minutes: old.unit_minutes,
      };
      for (const [k, v] of Object.entries(fields)) {
        if (cur[k] === v) continue;
        patch[k] = v as WireValue;
        local[k] = v as WireValue;
      }
      if (!Object.keys(patch).length) return;
      patchRow(this.db, 'plan_goals', old.uuid, { ...local, updated_at: now });
      enqueue(this.db, { table: 'plan_goals', uuid: old.uuid, op: 'upsert', patch }, now);
      return;
    }
    const uuid = planGoalUuid(projectUuid);
    const full = {
      active: true,
      minutes: 0,
      locked: false,
      kind: 'plain' as GoalKind,
      priority: 'should' as Priority,
      start_date: null,
      deadline: null,
      since: null,
      items: null,
      unit_minutes: null,
      ...fields,
    };
    upsertRow(this.db, 'plan_goals', { uuid, project_uuid: projectUuid, ...full, updated_at: now });
    enqueue(
      this.db,
      {
        table: 'plan_goals',
        uuid,
        op: 'upsert',
        isCreate: true,
        patch: { project_uuid: projectUuid, ...full },
      },
      now,
    );
  }

  /**
   * Tempo, tipo, priorità e date di UN progetto (goal_save). Un obiettivo «a elementi» ha minuti = voci × minuti a voce;
   * `since` (da quando si contano i pomodori) è oggi la prima volta che il tempo passa da 0 a qualcosa.
   */
  saveGoal(projectUuid: string, input: GoalInput): number {
    const old = this.goalRow(projectUuid);
    const kind = input.kind ?? (old ? asKind(old.kind) : 'plain');
    const priority = input.priority ?? (old ? asPriority(old.priority) : 'should');
    const active = input.active ?? (old ? old.active === 1 : true);
    const items =
      input.items === undefined
        ? (old?.items ?? null)
        : input.items === null
          ? null
          : clamp(input.items, 0, 100000);
    const unit =
      input.unitMinutes === undefined
        ? (old?.unit_minutes ?? null)
        : input.unitMinutes === null
          ? null
          : clamp(input.unitMinutes, 0, 1440);
    let minutes = clamp(input.minutes ?? old?.minutes ?? 0, 0, 600000);
    if (kind === 'count' && items !== null && unit !== null && items > 0 && unit > 0)
      minutes = clamp(items * unit, 0, 600000);
    const locked = input.locked ?? (old ? old.locked === 1 : false);
    const deadline = input.deadline === undefined ? (old?.deadline ?? null) : input.deadline;
    const start = input.start === undefined ? (old?.start_date ?? null) : input.start;
    let since = old?.since ?? null;
    if (!old || (old.minutes === 0 && minutes > 0)) since = this.today();
    for (const d of [deadline, start]) if (d !== null && !DAY_RE.test(d)) return old?.minutes ?? 0;

    this.db.transaction(() => {
      this.writeGoal(projectUuid, {
        active,
        minutes,
        locked,
        kind,
        priority,
        start_date: start,
        deadline,
        since,
        items,
        unit_minutes: unit,
      });
      if (input.cascade) {
        for (const k of this.descendants(projectUuid)) {
          const g = this.goalRow(k);
          if (g) this.writeGoal(k, { kind, priority, deadline, start_date: start });
          else
            this.writeGoal(k, {
              active,
              minutes: 0,
              kind,
              priority,
              deadline,
              start_date: start,
              since: null,
            });
        }
      }
    });
    return minutes;
  }

  private descendants(projectUuid: string): string[] {
    const nodes = new Map(this.nodes().map((n) => [n.id, n]));
    return subtree(nodes, projectUuid).filter((x) => x !== projectUuid);
  }

  /**
   * Le ore di un progetto divise fra i figli (split_save). La matematica dei cursori la fa la schermata; qui si ricontrolla che
   * la somma torni: la differenza va sul figlio più grande non bloccato.
   */
  saveSplit(projectUuid: string, total: number, items: SplitItem[]): SplitItem[] {
    const kids = new Set(this.nodes().find((n) => n.id === projectUuid)?.kids ?? []);
    const rows = new Map<string, { m: number; l: boolean }>();
    for (const it of items)
      if (kids.has(it.uuid)) rows.set(it.uuid, { m: clamp(it.minutes, 0, 600000), l: it.locked });
    if (!rows.size) return [];
    const tot = clamp(total, 0, 600000);
    let sum = 0;
    for (const r of rows.values()) sum += r.m;
    const diff = tot - sum;
    if (diff !== 0) {
      let best: string | null = null;
      for (const [id, r] of rows) if (!r.l && (best === null || r.m > rows.get(best)!.m)) best = id;
      if (best === null) best = rows.keys().next().value ?? null;
      if (best !== null) rows.get(best)!.m = Math.max(0, rows.get(best)!.m + diff);
    }
    const parent = this.goalRow(projectUuid);
    const kind = parent ? asKind(parent.kind) : 'plain';
    const priority = parent ? asPriority(parent.priority) : 'should';
    const today = this.today();
    this.db.transaction(() => {
      this.writeGoal(projectUuid, {
        active: true,
        minutes: tot,
        kind: parent ? kind : 'plain',
        priority: parent ? priority : 'should',
        since: parent?.since ?? today,
      });
      for (const [id, r] of rows) {
        const c = this.goalRow(id);
        this.writeGoal(id, {
          active: true,
          minutes: r.m,
          locked: r.l,
          kind: c ? asKind(c.kind) : kind,
          priority: c ? asPriority(c.priority) : priority,
          since: c?.since ?? today,
        });
      }
    });
    return [...rows].map(([uuid, r]) => ({ uuid, minutes: r.m, locked: r.l }));
  }

  /** Dividi in parti uguali (con il resto ai primi), rispettando i lucchetti: ritorna i minuti proposti per ogni figlio. */
  static evenSplit(
    total: number,
    kids: { uuid: string; minutes: number; locked: boolean }[],
  ): SplitItem[] {
    const lockedSum = kids.filter((k) => k.locked).reduce((a, k) => a + k.minutes, 0);
    const free = kids.filter((k) => !k.locked);
    const pool = Math.max(0, total - lockedSum);
    const base = free.length ? Math.floor(pool / free.length) : 0;
    let extra = free.length ? pool - base * free.length : 0;
    return kids.map((k) => {
      if (k.locked) return { uuid: k.uuid, minutes: k.minutes, locked: true };
      const m = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      return { uuid: k.uuid, minutes: m, locked: false };
    });
  }

  /* ---------------- evidenziatore e blocchi ---------------- */

  /** L'evidenziatore: aggiungi giorni, toglili, o svuota tutto. Ritorna quanti giorni restano evidenziati. */
  paint(projectUuid: string, mode: 'add' | 'remove' | 'clear', days: string[] = []): number {
    const list = [...new Set(days.filter((d) => DAY_RE.test(d)))].slice(0, 400);
    const now = this.clockIso();
    this.db.transaction(() => {
      if (mode === 'clear') {
        for (const r of this.db.all<{ uuid: string }>(
          'SELECT uuid FROM plan_paint WHERE project_uuid = ?',
          [projectUuid],
        )) {
          deleteRow(this.db, 'plan_paint', r.uuid);
          enqueue(this.db, { table: 'plan_paint', uuid: r.uuid, op: 'delete' }, now);
        }
        return;
      }
      for (const day of list) {
        const uuid = planPaintUuid(projectUuid, day);
        const has = this.db.all('SELECT 1 FROM plan_paint WHERE uuid = ?', [uuid]).length > 0;
        if (mode === 'add' && !has) {
          upsertRow(this.db, 'plan_paint', { uuid, project_uuid: projectUuid, day });
          enqueue(
            this.db,
            {
              table: 'plan_paint',
              uuid,
              op: 'upsert',
              isCreate: true,
              patch: { project_uuid: projectUuid, day },
            },
            now,
          );
        } else if (mode === 'remove' && has) {
          deleteRow(this.db, 'plan_paint', uuid);
          enqueue(this.db, { table: 'plan_paint', uuid, op: 'delete' }, now);
        }
      }
    });
    return (
      this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM plan_paint WHERE project_uuid = ?', [
        projectUuid,
      ])[0]?.n ?? 0
    );
  }

  private putBlock(
    projectUuid: string,
    day: string,
    kind: BlockKind,
    minutes: number,
    source: 'auto' | 'manual',
  ): void {
    const uuid = planDayUuid(projectUuid, day, kind);
    const now = this.clockIso();
    const old = this.db.all<{ minutes: number; source: string }>(
      'SELECT minutes, source FROM plan_days WHERE uuid = ?',
      [uuid],
    )[0];
    if (old) {
      if (old.minutes === minutes && old.source === source) return;
      const patch: Record<string, WireValue> = {};
      if (old.minutes !== minutes) patch.minutes = minutes;
      if (old.source !== source) patch.source = source;
      patchRow(this.db, 'plan_days', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'plan_days', uuid, op: 'upsert', patch }, now);
      return;
    }
    upsertRow(this.db, 'plan_days', {
      uuid,
      project_uuid: projectUuid,
      day,
      kind,
      minutes,
      source,
      updated_at: now,
    });
    enqueue(
      this.db,
      {
        table: 'plan_days',
        uuid,
        op: 'upsert',
        isCreate: true,
        patch: { project_uuid: projectUuid, day, kind, minutes, source },
      },
      now,
    );
  }

  private dropBlock(projectUuid: string, day: string, kind: BlockKind): void {
    const uuid = planDayUuid(projectUuid, day, kind);
    if (!this.db.all('SELECT 1 FROM plan_days WHERE uuid = ?', [uuid]).length) return;
    deleteRow(this.db, 'plan_days', uuid);
    enqueue(this.db, { table: 'plan_days', uuid, op: 'delete' }, this.clockIso());
  }

  /** Un blocco di studio messo (o tolto, con 0 minuti) a mano. */
  setDay(projectUuid: string, day: string, minutes: number): boolean {
    if (!DAY_RE.test(day)) return false;
    const m = clamp(minutes, 0, 1440);
    this.db.transaction(() => {
      if (m <= 0) this.dropBlock(projectUuid, day, 'study');
      else this.putBlock(projectUuid, day, 'study', m, 'manual');
    });
    return true;
  }

  /* ---------------- pianifica per me ---------------- */

  /**
   * Anteprima o applica. Applicando si cancella solo il piano AUTOMATICO futuro dei progetti in gioco (i blocchi messi a mano
   * restano) e si scrive quello nuovo; i blocchi uguali a prima non si toccano, così la coda resta corta.
   */
  autoplan(root: string | null, apply: boolean): AutoplanSummary {
    const today = this.today();
    const res = this.compute(root);
    const sum = summarize(res);
    if (apply) {
      const nodes = new Map(res.nodes);
      const scope = new Set(root ? subtree(nodes, root) : [...nodes.keys()]);
      this.db.transaction(() => {
        const keep = new Set<string>();
        for (const [day, per] of res.rows)
          for (const [id, kinds] of per)
            for (const kind of ['study', 'review'] as BlockKind[]) {
              const m = kinds[kind] ?? 0;
              if (m > 0) keep.add(planDayUuid(id, day, kind));
            }
        const old = this.db.all<{ uuid: string; p: string; d: string; k: BlockKind; s: string }>(
          'SELECT uuid, project_uuid AS p, day AS d, kind AS k, source AS s FROM plan_days WHERE day >= ?',
          [today],
        );
        for (const r of old)
          if (r.s === 'auto' && scope.has(r.p) && !keep.has(r.uuid)) this.dropBlock(r.p, r.d, r.k);
        for (const [day, per] of res.rows)
          for (const [id, kinds] of per)
            for (const kind of ['study', 'review'] as BlockKind[]) {
              const m = kinds[kind] ?? 0;
              if (m <= 0) continue;
              const cur = old.find((r) => r.p === id && r.d === day && r.k === kind);
              if (cur?.s === 'manual') continue;
              this.putBlock(id, day, kind, Math.min(1440, m), 'auto');
            }
      });
    }
    return { applied: apply, ...sum };
  }

  /* ---------------- il tuo tempo ---------------- */

  saveSettings(s: StoredSettings): void {
    const uuid = perUserUuid('plan_settings', this.userId);
    const now = this.clockIso();
    const ov: Record<string, number> = {};
    for (const [d, m] of Object.entries(s.overrides)) if (DAY_RE.test(d)) ov[d] = clamp(m, 0, 1440);
    const fields = {
      weekday_min: s.weekdayMin === null ? null : clamp(s.weekdayMin, 0, 1440),
      weekend_min: s.weekendMin === null ? null : clamp(s.weekendMin, 0, 1440),
      rest_dow: clamp(s.restDow, 0, 7),
      buffer_days: clamp(s.bufferDays, 0, 14),
      floor_min: clamp(s.floorMin, 5, 120),
      max_subjects: clamp(s.maxSubjects, 1, 8),
      reviews: s.reviews,
      overrides: Object.keys(ov).length ? JSON.stringify(ov) : null,
    };
    const exists = this.db.all('SELECT 1 FROM plan_settings WHERE uuid = ?', [uuid]).length > 0;
    this.db.transaction(() => {
      if (exists) patchRow(this.db, 'plan_settings', uuid, { ...fields, updated_at: now });
      else upsertRow(this.db, 'plan_settings', { uuid, ...fields, updated_at: now });
      enqueue(
        this.db,
        { table: 'plan_settings', uuid, op: 'upsert', isCreate: !exists, patch: fields },
        now,
      );
    });
  }

  /** Le ore libere di UN giorno (o «torna al normale» con null). */
  setDayCapacity(day: string, minutes: number | null): void {
    if (!DAY_RE.test(day)) return;
    const s = this.storedSettings();
    const overrides = { ...s.overrides };
    if (minutes === null) delete overrides[day];
    else overrides[day] = clamp(minutes, 0, 1440);
    this.saveSettings({ ...s, overrides });
  }

  /* ---------------- vecchio piano ---------------- */

  /** Quanti argomenti hanno ancora pomodori stimati del vecchio piano e nessun tempo nel nuovo. */
  oldEstimateCount(): number {
    const g = this.goals();
    return this.db
      .all<{ uuid: string }>(
        "SELECT uuid FROM projects WHERE study_pomodori_stimati > 0 AND status <> 'completed'",
      )
      .filter((r) => !(g.get(r.uuid)?.minutes ?? 0)).length;
  }

  /** I pomodori stimati del vecchio piano diventano minuti (una volta sola per progetto). Ritorna quanti. */
  importOld(pomodoroMinutes: number): number {
    const dur = clamp(pomodoroMinutes, 5, 120);
    const g = this.goals();
    const today = this.today();
    const rows = this.db.all<{
      uuid: string;
      s: number;
      a: string | null;
      b: string | null;
    }>(
      "SELECT uuid, study_pomodori_stimati AS s, study_start AS a, study_end AS b FROM projects WHERE study_pomodori_stimati > 0 AND status <> 'completed'",
    );
    let n = 0;
    this.db.transaction(() => {
      for (const r of rows) {
        if (g.get(r.uuid)?.minutes) continue;
        const old = this.goalRow(r.uuid);
        this.writeGoal(r.uuid, {
          active: true,
          minutes: clamp(r.s * dur, 0, 600000),
          kind: 'plain',
          priority: 'should',
          start_date: r.a,
          deadline: r.b,
          since: old?.since ?? today,
        });
        n++;
      }
    });
    return n;
  }

  /* ---------------- modelli ---------------- */

  templates(): Template[] {
    return this.db.all<Template>(
      'SELECT uuid, name FROM plan_templates ORDER BY created_at DESC, uuid DESC LIMIT 30',
    );
  }

  private pathsOf(projectUuid: string): Map<string, string> {
    const names = new Map(
      this.db
        .all<{ uuid: string; name: string }>('SELECT uuid, name FROM projects')
        .map((r) => [r.uuid, r.name]),
    );
    const nodes = new Map(this.nodes().map((n) => [n.id, n]));
    const out = new Map<string, string>();
    const visit = (id: string, path: string | null, guard: number): void => {
      if (guard > 40) return;
      const pp = path === null ? (names.get(id) ?? '') : `${path} / ${names.get(id) ?? ''}`;
      out.set(id, pp);
      for (const k of nodes.get(id)?.kids ?? []) visit(k, pp, guard + 1);
    };
    visit(projectUuid, null, 0);
    return out;
  }

  /** Salva la forma del piano di un progetto (tempo, tipo, priorità per NOME). Ritorna quante voci. */
  saveTemplate(projectUuid: string, name: string): number {
    const nome = name.trim().slice(0, 80);
    if (!nome) return -1;
    const goals = this.goals();
    const items: TemplateItem[] = [];
    for (const [id, path] of this.pathsOf(projectUuid)) {
      const o = goals.get(id);
      if (o && o.minutes > 0)
        items.push({
          path,
          minutes: o.minutes,
          kind: o.kind,
          priority: o.priority,
          locked: o.locked,
        });
    }
    const uuid = this.newId();
    const now = this.clockIso();
    const body = JSON.stringify(items);
    this.db.transaction(() => {
      upsertRow(this.db, 'plan_templates', {
        uuid,
        name: nome,
        body,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'plan_templates',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { name: nome, body },
        },
        now,
      );
    });
    return items.length;
  }

  /** Applica un modello a un progetto: il primo livello si abbina per posizione, il resto per nome. Ritorna quante voci. */
  applyTemplate(templateUuid: string, projectUuid: string): number {
    const t = this.db.all<{ body: string }>('SELECT body FROM plan_templates WHERE uuid = ?', [
      templateUuid,
    ])[0];
    if (!t) return -1;
    let items: unknown;
    try {
      items = JSON.parse(t.body);
    } catch {
      return -1;
    }
    if (!Array.isArray(items)) return -1;
    const paths = this.pathsOf(projectUuid);
    const byPath = new Map<string, string>();
    for (const [id, p] of paths) byPath.set(p, id);
    const rootName = paths.get(projectUuid) ?? '';
    const today = this.today();
    let n = 0;
    this.db.transaction(() => {
      for (const v of items as Partial<TemplateItem>[]) {
        if (!v || typeof v.path !== 'string') continue;
        const parts = v.path.split(' / ');
        const key = parts.length > 1 ? `${rootName} / ${parts.slice(1).join(' / ')}` : rootName;
        const id = byPath.get(key);
        if (!id) continue;
        const old = this.goalRow(id);
        this.writeGoal(id, {
          active: true,
          minutes: clamp(Number(v.minutes ?? 0), 0, 600000),
          locked: !!v.locked,
          kind: asKind(String(v.kind ?? 'plain')),
          priority: asPriority(String(v.priority ?? 'should')),
          since: old?.since ?? today,
        });
        n++;
      }
    });
    return n;
  }

  removeTemplate(templateUuid: string): void {
    if (!this.db.all('SELECT 1 FROM plan_templates WHERE uuid = ?', [templateUuid]).length) return;
    this.db.transaction(() => {
      deleteRow(this.db, 'plan_templates', templateUuid);
      enqueue(
        this.db,
        { table: 'plan_templates', uuid: templateUuid, op: 'delete' },
        this.clockIso(),
      );
    });
  }

  /* ---------------- ieri e oggi ---------------- */

  /**
   * «L'ho già fatto» per un'attività «ogni giorno»: nasce una sessione a mano di oggi, lunga quanto il suo obiettivo,
   * che da lì vale come ogni altro pomodoro. Ritorna i minuti, o null se non è un'attività «ogni giorno» attiva.
   */
  dailyLog(projectUuid: string, start: string): number | null {
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(start)) return null;
    const g = this.goalRow(projectUuid);
    if (!g || g.kind !== 'daily' || g.active !== 1 || g.minutes <= 0) return null;
    const min = g.minutes;
    const day = this.today();
    const begin = `${day} ${start}:00`;
    const startMs = new Date(
      Number(day.slice(0, 4)),
      Number(day.slice(5, 7)) - 1,
      Number(day.slice(8, 10)),
      Number(start.slice(0, 2)),
      Number(start.slice(3, 5)),
    ).getTime();
    const e = new Date(startMs + min * 60000);
    const end = `${localDay(e)} ${pad(e.getHours())}:${pad(e.getMinutes())}:00`;
    const uuid = this.newId();
    const row = {
      mode: 0,
      start_time: begin,
      end_time: end,
      duration_seconds: min * 60,
      planned_duration_min: Math.min(600, min),
      status: 'archiviato',
      project_uuid: projectUuid,
      is_manual: 1,
    };
    const now = this.clockIso();
    this.db.transaction(() => {
      upsertRow(this.db, 'pomodoro_sessions', { uuid, resume_time: null, updated_at: now, ...row });
      enqueue(
        this.db,
        { table: 'pomodoro_sessions', uuid, op: 'upsert', isCreate: true, patch: row },
        now,
      );
    });
    return min;
  }

  /**
   * Ieri non è andata (skip_fix): ieri si riduce a ciò che è stato fatto davvero; con `move` il resto va nel giorno scelto
   * (da oggi in poi). Un'attività «ogni giorno» non si recupera.
   */
  skipFix(projectUuid: string, mode: 'move' | 'leave', to?: string): void {
    const today = this.today();
    const yesterday = addDays(today, -1);
    const goal = this.goalRow(projectUuid);
    const how = goal?.kind === 'daily' ? 'leave' : mode;
    const uuid = planDayUuid(projectUuid, yesterday, 'study');
    const row = this.db.all<{ minutes: number }>('SELECT minutes FROM plan_days WHERE uuid = ?', [
      uuid,
    ])[0];
    if (!row) return;
    const done = this.done(yesterday).get(projectUuid)?.get(yesterday) ?? 0;
    const missing = Math.max(0, row.minutes - done);
    this.db.transaction(() => {
      if (done > 0) this.putBlock(projectUuid, yesterday, 'study', done, 'manual');
      else this.dropBlock(projectUuid, yesterday, 'study');
      if (how === 'move' && missing > 0) {
        let target = to && DAY_RE.test(to) ? to : today;
        if (target < today) target = today;
        const t = this.db.all<{ minutes: number }>('SELECT minutes FROM plan_days WHERE uuid = ?', [
          planDayUuid(projectUuid, target, 'study'),
        ])[0];
        this.putBlock(
          projectUuid,
          target,
          'study',
          Math.min(1440, (t?.minutes ?? 0) + missing),
          'manual',
        );
      }
    });
  }

  /* ---------------- accessori per le schermate ---------------- */

  /** Minuti fatti da un progetto e da tutto il suo ramo, dalla data `since` in poi. */
  doneInBranch(projectUuid: string, since: string | null, done = this.done()): number {
    const nodes = new Map(this.nodes().map((n) => [n.id, n]));
    let tot = 0;
    for (const id of subtree(nodes, projectUuid))
      for (const [d, m] of done.get(id) ?? []) if (since === null || d >= since) tot += m;
    return tot;
  }

  rootOf(projectUuid: string): string {
    return rootOf(new Map(this.nodes().map((n) => [n.id, n])), projectUuid);
  }
}

export { addDays, diffDays, dow };
