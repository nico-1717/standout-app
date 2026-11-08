/**
 * Il pianificatore dei progetti, copia fedele di pn_pianifica() del sito (public/projects/piano_api.php).
 * Funzioni pure: dentro entrano progetti, obiettivi, minuti già fatti, blocchi messi a mano, giorni evidenziati,
 * tempo già occupato e impostazioni; esce il piano giorno per giorno. Un test d'oro (fixtures/golden.json, generato
 * dal sito vero con scripts/gen-plan-golden.php) controlla che il telefono dia gli stessi minuti del sito.
 *
 * Perché i minuti: «100 ore» si spezza fra i figli senza resti strani, e il pomodoro resta solo il modo in cui si
 * misura ciò che è stato fatto. Ogni giorno si dà a ciascuna unità la sua parte di quello che resta diviso i giorni
 * che restano; se la giornata è piena vincono prima le cose «da fare», poi le «dovrebbe», poi le «se avanza».
 * Sotto la soglia minima la parte si accumula e si dà a giorni alterni.
 */

export type GoalKind = 'plain' | 'exam' | 'steady' | 'course' | 'count' | 'daily';
export type Priority = 'must' | 'should' | 'nice';
export type BlockKind = 'study' | 'review';

export const GOAL_KINDS: GoalKind[] = ['plain', 'exam', 'steady', 'course', 'count', 'daily'];
export const PRIORITIES: Priority[] = ['must', 'should', 'nice'];

/** Un progetto come lo vede il pianificatore. `kids` è nell'ordine della lista. */
export interface PlanNode {
  id: string;
  parent: string | null;
  status: string;
  kids: string[];
}

export interface Goal {
  active: boolean;
  minutes: number;
  locked: boolean;
  kind: GoalKind;
  priority: Priority;
  start: string | null;
  deadline: string | null;
  since: string | null;
  items: number | null;
  unitMinutes: number | null;
}

/** Le impostazioni già risolte: `weekdayEff`/`weekendEff` sono il valore scelto oppure il ritmo misurato. */
export interface PlanSettings {
  restDow: number;
  bufferDays: number;
  floorMin: number;
  maxSubjects: number;
  reviews: boolean;
  weekdayEff: number;
  weekendEff: number;
  overrides: Record<string, number>;
}

export interface PlanInput {
  today: string;
  /** progetti nell'ordine della lista (come `pn_progetti`) */
  nodes: PlanNode[];
  goals: Map<string, Goal>;
  /** minuti fatti: progetto → giorno → minuti (tutto lo storico) */
  done: Map<string, Map<string, number>>;
  /** blocchi di studio messi a mano da oggi in poi: giorno → progetto → minuti */
  manual: Map<string, Map<string, number>>;
  /** giorni evidenziati da oggi in poi: progetto → giorni */
  painted: Map<string, Set<string>>;
  /** minuti già presi dal planner per giorno (almeno da oggi a oggi + 400) */
  busy: Map<string, number>;
  settings: PlanSettings;
  /** limita il piano al ramo di questo progetto (null = tutti) */
  root: string | null;
}

export interface UnitInfo {
  resta: number;
  scad: string | null;
  ini: string | null;
  dip: Set<string> | null;
  carry: number;
  tot: number;
  kind: GoalKind;
  prio: Priority;
  root: string;
  fine: string;
  fineStudio: string;
  utili: string[];
  rimasti: number;
  idx: Set<string>;
}

export type DayRows = Map<string, Map<string, Partial<Record<BlockKind, number>>>>;

export interface PlanResult {
  rows: DayRows;
  deficit: Map<string, number>;
  info: Map<string, UnitInfo>;
  days: string[];
  busy: Map<string, number>;
  end: string;
  dailyCount: number;
  nodes: Map<string, PlanNode>;
  goals: Map<string, Goal>;
}

/* ---------------- date: sempre stringhe AAAA-MM-GG, a mezzogiorno (UTC), così un cambio d'ora non sposta mai un giorno ---------------- */

const DAY_MS = 86400000;
function ms(d: string): number {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd, 12);
}
export function addDays(d: string, n: number): string {
  const t = new Date(ms(d) + n * DAY_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
/** 1 = lunedì … 7 = domenica */
export function dow(d: string): number {
  const w = new Date(ms(d)).getUTCDay();
  return w === 0 ? 7 : w;
}
export function mondayOf(d: string): string {
  return addDays(d, -(dow(d) - 1));
}
export function diffDays(a: string, b: string): number {
  return Math.round((ms(b) - ms(a)) / DAY_MS);
}

/**
 * Come round() di PHP: mezzo verso l'alto (per i numeri positivi), dopo aver pulito il rumore oltre la
 * quindicesima cifra (PHP lo fa da sempre; senza, 2.4999999999999996 darebbe 2 invece di 3).
 */
export function phpRound(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  return x < 0 ? -Math.round(Number((-x).toPrecision(15))) : Math.round(Number(x.toPrecision(15)));
}

/* ---------------- piccoli accessori sull'albero ---------------- */

/** Il ramo di un progetto (lui e tutti i discendenti), nello stesso ordine del sito (pila: ultimo figlio per primo). */
export function subtree(nodes: Map<string, PlanNode>, root: string): string[] {
  const out = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const id = stack.pop()!;
    const n = nodes.get(id);
    if (!n || out.has(id)) continue;
    out.add(id);
    for (const k of n.kids) stack.push(k);
  }
  return [...out];
}

/** Il progetto di primo livello da cui discende. */
export function rootOf(nodes: Map<string, PlanNode>, id: string): string {
  let cur = id;
  for (let guard = 0; guard < 30; guard++) {
    const p = nodes.get(cur)?.parent;
    if (!p || !nodes.has(p)) break;
    cur = p;
  }
  return cur;
}

/** Una data (scadenza, inizio) non scritta sul figlio si eredita dal primo antenato che la ha. */
export function inherit(
  nodes: Map<string, PlanNode>,
  goals: Map<string, Goal>,
  id: string,
  field: 'deadline' | 'start',
): string | null {
  let cur: string | null = id;
  for (let guard = 0; cur && guard < 30; guard++) {
    const g = goals.get(cur);
    const v = field === 'deadline' ? g?.deadline : g?.start;
    if (v) return v;
    cur = nodes.get(cur)?.parent ?? null;
  }
  return null;
}

/** Minuti fatti nel ramo di un progetto, dal giorno `since` in poi (null = da sempre). */
export function doneInBranch(
  nodes: Map<string, PlanNode>,
  done: Map<string, Map<string, number>>,
  id: string,
  since: string | null,
): number {
  let tot = 0;
  for (const x of subtree(nodes, id)) {
    for (const [day, m] of done.get(x) ?? []) if (since === null || day >= since) tot += m;
  }
  return tot;
}

/** Capienza di un giorno: base (feriale/festivo) o valore messo a mano, zero nel giorno di riposo, meno ciò che è occupato. */
export function capacity(
  day: string,
  s: PlanSettings,
  busy: Map<string, number>,
  painted = false,
): number {
  const ov = s.overrides[day];
  if (ov !== undefined) return ov;
  const base = dow(day) >= 6 ? s.weekendEff : s.weekdayEff;
  if (s.restDow > 0 && dow(day) === s.restDow && !painted) return 0;
  return Math.max(0, base - (busy.get(day) ?? 0));
}

/** Il ritmo misurato dai pomodori degli ultimi 60 giorni (oggi escluso): media nei giorni in cui hai lavorato, feriali e festivi a parte. */
export function measuredPace(
  today: string,
  minutesPerDay: Map<string, number>,
): { weekday: number; weekend: number; days: number; enough: boolean } {
  const from = addDays(today, -60);
  const wd: number[] = [];
  const we: number[] = [];
  for (const [day, m] of minutesPerDay) {
    if (day < from || day >= today || m < 10) continue;
    (dow(day) >= 6 ? we : wd).push(m);
  }
  const avg = (a: number[], def: number) =>
    a.length < 4 ? def : Math.round(a.reduce((x, y) => x + y, 0) / a.length / 5) * 5;
  return {
    weekday: avg(wd, 120),
    weekend: avg(we, 120),
    days: wd.length + we.length,
    enough: wd.length + we.length >= 8,
  };
}

/* ---------------- il pianificatore ---------------- */

const RANK: Record<Priority, number> = { must: 0, should: 1, nice: 2 };
const WEIGHT: Record<Priority, number> = { must: 3, should: 2, nice: 1 };
void RANK;

interface Cand {
  id: string;
  need: number;
  rango: number;
  urg: number;
  score: number;
}

function row(rows: DayRows, day: string, id: string): Partial<Record<BlockKind, number>> {
  let d = rows.get(day);
  if (!d) rows.set(day, (d = new Map()));
  let r = d.get(id);
  if (!r) d.set(id, (r = {}));
  return r;
}

function sumRow(r: Partial<Record<BlockKind, number>>): number {
  return (r.study ?? 0) + (r.review ?? 0);
}

export function plan(input: PlanInput): PlanResult {
  const { today, goals, done, manual, painted, busy: busyIn, settings: imp } = input;
  const nodes = new Map<string, PlanNode>(input.nodes.map((n) => [n.id, n]));
  const scope = input.root ? subtree(nodes, input.root) : input.nodes.map((n) => n.id);

  /* le unità */
  const units = new Map<string, Goal>();
  const daily = new Map<string, Goal>();
  for (const id of scope) {
    const o = goals.get(id);
    if (!o || !o.active || o.minutes <= 0) continue;
    if (nodes.get(id)?.status === 'completed') continue;
    // un antenato spento o completato spegne tutto il ramo
    let ok = true;
    let a = nodes.get(id)?.parent ?? null;
    for (let guard = 0; a !== null && nodes.has(a) && guard < 30; guard++) {
      const ga = goals.get(a);
      if (ga && !ga.active && ga.minutes > 0) {
        ok = false;
        break;
      }
      if (nodes.get(a)?.status === 'completed') {
        ok = false;
        break;
      }
      a = nodes.get(a)?.parent ?? null;
    }
    if (!ok) continue;
    // «ogni giorno»: i minuti sono PER GIORNO e non si dividono né si accumulano
    if (o.kind === 'daily') {
      daily.set(id, o);
      continue;
    }
    // se un figlio ha il suo tempo, è il figlio l'unità
    const hasKid = nodes.get(id)!.kids.some((k) => {
      const g = goals.get(k);
      return !!g && g.active && g.minutes > 0;
    });
    if (hasKid) continue;
    units.set(id, o);
  }

  const paintedFor = (id: string): Set<string> | null => {
    let a: string | null = id;
    for (let guard = 0; a !== null && guard < 30; guard++) {
      const p = painted.get(a);
      if (p && p.size) return p;
      a = nodes.get(a)?.parent ?? null;
    }
    return null;
  };

  const info = new Map<string, UnitInfo>();
  let horizon: string | null = null;
  for (const [id, o] of units) {
    const scad = inherit(nodes, goals, id, 'deadline');
    const ini = inherit(nodes, goals, id, 'start');
    const fattoU = doneInBranch(nodes, done, id, o.since || null);
    let manU = 0;
    for (const pm of manual.values()) manU += pm.get(id) ?? 0;
    const resta = Math.max(0, o.minutes - fattoU - manU);
    info.set(id, {
      resta,
      scad,
      ini,
      dip: paintedFor(id),
      carry: 0,
      tot: resta,
      kind: o.kind,
      prio: o.priority,
      root: rootOf(nodes, id),
      fine: '',
      fineStudio: '',
      utili: [],
      rimasti: 0,
      idx: new Set(),
    });
    if (scad && (horizon === null || scad > horizon)) horizon = scad;
  }
  if (horizon === null || horizon < today) horizon = addDays(today, 84);
  if (diffDays(today, horizon) > 400) horizon = addDays(today, 400);
  const end = horizon;

  const days: string[] = [];
  for (let d = today; d <= end; d = addDays(d, 1)) days.push(d);

  /* capienza di ogni giorno, calcolata una volta: un giorno dipinto da qualcuno vale anche se è il giorno di riposo,
     e i blocchi messi a mano si tolgono subito */
  const capDay = new Map<string, number>();
  for (const d of days) {
    let dip = false;
    for (const u of info.values()) {
      if (u.dip !== null && u.dip.has(d)) {
        dip = true;
        break;
      }
    }
    let c = capacity(d, imp, busyIn, dip);
    for (const m of manual.get(d)?.values() ?? []) c = Math.max(0, c - m);
    capDay.set(d, c);
  }

  /* le attività «ogni giorno» si mettono per prime, ogni giorno con posto, dentro le loro date (e sui giorni dipinti);
     tolgono tempo alla capienza degli altri */
  const rows: DayRows = new Map();
  for (const [id, o] of daily) {
    const ini = inherit(nodes, goals, id, 'start');
    const scad = inherit(nodes, goals, id, 'deadline');
    const dip = paintedFor(id);
    for (const d of days) {
      if (ini && d < ini) continue;
      if (scad && d > scad) continue;
      if (dip !== null && !dip.has(d)) continue;
      const cap = capDay.get(d)!;
      if (cap <= 0) continue;
      const m = Math.min(o.minutes, cap);
      if (m <= 0) continue;
      row(rows, d, id).study = m;
      capDay.set(d, cap - m);
    }
  }

  /* i giorni utili di ogni unità: dentro le sue date, sui giorni dipinti se ce ne sono, e solo dove c'è posto */
  const buffer = imp.bufferDays;
  for (const u of info.values()) {
    const fine = u.scad ? addDays(u.scad, -1) : end; // il giorno dell'esame non si studia
    let fineStudio = fine;
    if (u.scad && u.kind === 'exam' && buffer > 0) {
      const f2 = addDays(u.scad, -1 - buffer);
      if (f2 >= today) fineStudio = f2; // gli ultimi giorni sono solo di ripasso
    }
    u.fine = fine;
    u.fineStudio = fineStudio;
    const inizio = u.ini && u.ini > today ? u.ini : today;
    u.utili = [];
    for (const d of days) {
      if (d < inizio || d > fineStudio || capDay.get(d)! <= 0) continue;
      if (u.dip !== null && !u.dip.has(d)) continue;
      u.utili.push(d);
    }
    // evidenziatore tutto nel passato o fuori scadenza: lo si ignora, altrimenti l'unità sparirebbe
    if (!u.utili.length && u.dip !== null) {
      u.dip = null;
      for (const d of days)
        if (d >= inizio && d <= fineStudio && capDay.get(d)! > 0) u.utili.push(d);
    }
    u.rimasti = u.utili.length;
    u.idx = new Set(u.utili);
  }

  const lastDay = new Map<string, string>();
  const lastStudy = new Map<string, Map<string, number>>();
  /* quanto è piena la strada: bisogno totale diviso tempo totale. Se è comoda, ogni giorno prende solo la sua parte;
     se è stretta, il tempo che avanza si usa per portarsi avanti */
  let totNeed = 0;
  for (const u of info.values()) totNeed += u.resta;
  let totTime = 0;
  for (const c of capDay.values()) totTime += c;
  const tension = totTime > 0 ? totNeed / totTime : 9.0;
  const aim = tension > 0.6 ? Math.min(1.0, tension + 0.12) : 0.0;
  const floor = Math.max(5, imp.floorMin);
  const maxSubj = Math.max(1, imp.maxSubjects);

  for (const d of days) {
    const cap = capDay.get(d)!;
    if (cap <= 0) continue;
    /* chi ha qualcosa da fare oggi */
    let cand: Cand[] = [];
    for (const [id, u] of info) {
      if (!u.idx.has(d) || u.resta <= 0) continue;
      const need = u.resta / Math.max(1, u.rimasti);
      cand.push({ id, need, rango: RANK[u.prio] ?? 1, urg: need / Math.max(1, cap), score: 0 });
      u.rimasti--;
    }
    if (!cand.length) continue;
    /* il bisogno pesato per priorità, più un po' per ogni giorno che la cosa aspetta */
    for (const c of cand) {
      const ult = lastDay.get(c.id);
      const age = ult === undefined ? 7 : Math.min(14, diffDays(ult, d));
      c.score = c.need * WEIGHT[info.get(c.id)!.prio] * (1 + age / 7);
    }
    cand = cand.sort((a, b) => b.score - a.score);
    /* sotto la soglia: la parte si accumula e si dà a giorni alterni */
    let chosen: Cand[] = [];
    for (const c of cand) {
      const u = info.get(c.id)!;
      const nec = c.need + u.carry;
      const last = u.rimasti <= 0; // oggi è l'ultimo giorno utile: si dà tutto
      if (nec < floor && !last) {
        u.carry = nec;
        continue;
      }
      u.carry = 0;
      chosen.push({ ...c, need: last ? u.resta : nec });
    }
    /* «al massimo N cose al giorno» vale quando la giornata è piena */
    const taken: Cand[] = [];
    let sum = 0;
    for (const c of chosen) {
      if (taken.length >= maxSubj && sum >= cap * 0.85) break;
      taken.push(c);
      sum += c.need;
    }
    chosen = taken;
    /* il tempo del giorno si divide in proporzione al bisogno pesato */
    let free = cap;
    const give = new Map<string, number>();
    let active = chosen;
    for (let turn = 0; turn < 8 && active.length; turn++) {
      let sw = 0;
      for (const c of active) sw += c.need * WEIGHT[info.get(c.id)!.prio];
      if (sw <= 0) break;
      const small: Cand[] = [];
      const rest: Cand[] = [];
      for (const c of active) {
        const quota = (free * (c.need * WEIGHT[info.get(c.id)!.prio])) / sw;
        if (quota >= c.need) small.push(c);
        else rest.push(c);
      }
      if (!small.length) {
        for (const c of active)
          give.set(c.id, (free * (c.need * WEIGHT[info.get(c.id)!.prio])) / sw);
        active = [];
        break;
      }
      for (const c of small) {
        give.set(c.id, c.need);
        free -= c.need;
      }
      active = rest;
    }
    free = cap;
    for (const c of chosen) {
      const x = give.get(c.id) ?? 0;
      let m = phpRound(x / 5) * 5;
      if (m <= 0 && x >= 1) m = 5;
      const u = info.get(c.id)!;
      m = Math.min(m, u.resta, free);
      if (u.resta - m > 0 && u.resta - m < 10 && free - m >= u.resta - m) m = u.resta; // niente avanzi da 5 minuti
      if (m > 0) {
        row(rows, d, c.id).study = m;
        u.resta -= m;
        free -= m;
        let per = lastStudy.get(c.id);
        if (!per) lastStudy.set(c.id, (per = new Map()));
        per.set(d, m);
        lastDay.set(c.id, d);
      }
    }
    /* portarsi avanti: solo con la strada stretta, e solo sulle cose già in programma oggi */
    const todayRows = rows.get(d);
    if (aim > 0 && todayRows && todayRows.size) {
      const used = cap - free;
      const room = Math.min(free, phpRound(cap * aim) - used);
      if (room >= 15) {
        const pool = new Map<string, number>();
        let sw = 0;
        for (const [pid, kk] of todayRows) {
          const u = info.get(pid);
          if (kk.study === undefined || !u || u.resta <= 0) continue;
          const w = u.resta * WEIGHT[u.prio];
          pool.set(pid, w);
          sw += w;
        }
        for (const [pid, w] of pool) {
          const u = info.get(pid)!;
          let m = phpRound((room * w) / sw / 5) * 5;
          m = Math.min(m, u.resta, free);
          if (m < 10) continue;
          todayRows.get(pid)!.study = (todayRows.get(pid)!.study ?? 0) + m;
          u.resta -= m;
          free -= m;
        }
      }
    }
    /* ripassi a 1, 3 e 7 giorni: usano il tempo che avanza, non il budget */
    if (imp.reviews && free >= 10) {
      for (const [pid, perDay] of lastStudy) {
        for (const dist of [1, 3, 7]) {
          const before = addDays(d, -dist);
          const r = rows.get(d)?.get(pid);
          if ((perDay.get(before) ?? 0) >= 30 && free >= 10 && !(r && r.review !== undefined)) {
            row(rows, d, pid).review = 10;
            free -= 10;
          }
        }
      }
    }
  }

  /* giorni di buffer prima di un esame: solo ripasso, diviso fra gli esami vicini */
  if (buffer > 0) {
    for (const d of days) {
      const exams: string[] = [];
      for (const [id, u] of info) {
        if (u.kind === 'exam' && u.scad && d > u.fineStudio && d <= u.fine && u.tot > 0)
          exams.push(id);
      }
      if (!exams.length) continue;
      const cap = capacity(d, imp, busyIn, true);
      let used = 0;
      for (const r of rows.get(d)?.values() ?? []) used += sumRow(r);
      const lib = Math.max(0, cap - used);
      if (lib < 10) continue;
      const each = Math.floor(Math.min(45, lib / exams.length) / 5) * 5;
      if (each < 10) continue;
      for (const id of exams) {
        const r = row(rows, d, id);
        r.review = (r.review ?? 0) + each;
      }
    }
  }

  /* cosa non è entrato: il «deficit» di ogni unità */
  const deficit = new Map<string, number>();
  for (const [id, u] of info) if (u.resta > 0) deficit.set(id, u.resta);

  return { rows, deficit, info, days, busy: busyIn, end, dailyCount: daily.size, nodes, goals };
}
