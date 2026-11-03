/**
 * Le regole dei Voti, senza database: media, CFU, simulatore, voto di laurea. Sono le funzioni della pagina Voti del sito
 * (public/exams/voti.php) portate qui; `scripts/gen-voti-golden.mjs` fa girare il codice vero del sito su 150 casi e il test
 * d'oro (`__tests__/logic.test.ts`) controlla che questa copia dia gli stessi numeri.
 *
 * Gli esami vanno passati già nell'ordine della lista (per sort_key): al posto di `sort_order` vale la posizione.
 */

export interface Exam {
  uuid: string;
  name: string;
  cfu: number;
  status: 'todo' | 'done';
  grade: number | null;
  has_honors: number;
  is_pass_fail: number;
  counts_for_graduation: number;
  exam_date: string | null;
  predicted_grade: number | null;
  predicted_honors: number;
  catalog_code: string | null;
  ssd: string | null;
  study_year: number | null;
  national_avg: number | null;
  group_uuid: string | null;
  sort_key: string;
}

export interface ExamGroup {
  uuid: string;
  name: string;
  /** «choice» = esami a scelta (contano solo `cfu`), «split» = un esame diviso in più parti */
  group_type: 'choice' | 'split';
  cfu: number;
  overall_grade: number | null;
  overall_honors: number;
  overall_predicted_grade: number | null;
  overall_predicted_honors: number;
  sort_key: string;
}

export type BonusType = 'fixed' | 'on_time' | 'honors_each' | 'honors_threshold' | 'custom';
export const BONUS_TYPES: BonusType[] = [
  'fixed',
  'on_time',
  'honors_each',
  'honors_threshold',
  'custom',
];

export interface Bonus {
  uuid: string;
  name: string;
  bonus_type: BonusType;
  points: number;
  threshold_value: number | null;
  cap_points: number;
  is_enabled: number;
  sort_key: string;
}

export interface GradeSettings {
  program_key: string | null;
  program_label: string | null;
  faculty_key: string | null;
  /** #0A84FF = «mai scelto»: la pagina segue il colore dell'app */
  accent_color: string;
  total_cfu: number;
  grade_base: number;
  honors_value: number;
  target_average: number | null;
  target_source: 'manual' | 'simulation';
  thesis_min_points: number;
  thesis_max_points: number;
  round_half_up: boolean;
}

export const DEFAULT_GRADE_SETTINGS: GradeSettings = {
  program_key: null,
  program_label: null,
  faculty_key: null,
  accent_color: '#0A84FF',
  total_cfu: 180,
  grade_base: 110,
  honors_value: 30,
  target_average: null,
  target_source: 'manual',
  thesis_min_points: 0,
  thesis_max_points: 0,
  round_half_up: true,
};

/** Tutto quello che serve ai calcoli. */
export interface GradeData {
  exams: Exam[];
  groups: ExamGroup[];
  bonuses: Bonus[];
  settings: Pick<
    GradeSettings,
    'total_cfu' | 'grade_base' | 'honors_value' | 'thesis_min_points' | 'thesis_max_points'
  > & { round_half_up: boolean | number };
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
};
const bool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';
const clampG = (v: number) => Math.min(30, Math.max(18, Math.round(v)));

export const honorsValue = (d: GradeData): number => {
  const v = parseFloat(String(d.settings.honors_value));
  return Number.isNaN(v) ? 30 : v;
};
export const gradeBase = (d: GradeData): number => {
  const v = parseFloat(String(d.settings.grade_base));
  return Number.isNaN(v) ? 110 : v;
};

/* ---------- gruppi ---------- */

export const findGroup = (d: GradeData, uuid: string | null): ExamGroup | null =>
  uuid == null ? null : (d.groups.find((g) => g.uuid === uuid) ?? null);
export const groupExams = (d: GradeData, uuid: string): Exam[] =>
  d.exams.filter((e) => e.group_uuid != null && e.group_uuid === uuid);
const isSplit = (g: ExamGroup | null) => !!g && g.group_type === 'split';
const isChoice = (g: ExamGroup | null) => !!g && g.group_type !== 'split';

export function groupTotalCfu(d: GradeData, uuid: string): number {
  return groupExams(d, uuid).reduce((s, e) => s + num(e.cfu), 0);
}
export function groupDoneCfu(d: GradeData, uuid: string): number {
  return groupExams(d, uuid).reduce((s, e) => s + (e.status === 'done' ? num(e.cfu) : 0), 0);
}
/** CFU delle parti «da sostenere» con già un voto previsto (senza `exclude`, per sapere se aggiungerne un altro sfora la quota). */
export function groupPredictedCfu(d: GradeData, uuid: string, exclude?: string | null): number {
  let s = 0;
  for (const x of groupExams(d, uuid)) {
    if (exclude != null && x.uuid === exclude) continue;
    if (x.status === 'todo' && x.predicted_grade != null) s += num(x.cfu);
  }
  return s;
}
export function groupQuotaProgress(d: GradeData, uuid: string) {
  const g = findGroup(d, uuid);
  if (!g) return null;
  return {
    quota: num(g.cfu),
    done: groupDoneCfu(d, uuid),
    pred: groupPredictedCfu(d, uuid, null),
  };
}
export function groupIsComplete(d: GradeData, uuid: string): boolean {
  const m = groupExams(d, uuid);
  return m.length > 0 && m.every((e) => e.status === 'done');
}
export function groupAllPredicted(d: GradeData, uuid: string): boolean {
  const m = groupExams(d, uuid);
  if (!m.length) return false;
  for (const e of m) {
    if (bool(e.is_pass_fail)) continue;
    if (e.status !== 'done' && e.predicted_grade == null) return false;
  }
  return true;
}

/** Il numero massimo di esami la cui somma di CFU arriva esattamente a `target` (se non si può, la somma più vicina, meglio se sopra). */
export function maxCountForExactSum(cfus: number[], target: number): number {
  const scale = 10;
  const best = new Map<number, number>([[0, 0]]);
  for (const c of cfus) {
    const v = Math.round(num(c) * scale);
    // come Object.keys() del sito: i numeri interi in ordine crescente (conta, perché best si aggiorna mentre si scorre)
    for (const s of [...best.keys()].sort((a, b) => a - b)) {
      const ns = s + v;
      const nc = best.get(s)! + 1;
      if (!best.has(ns) || best.get(ns)! < nc) best.set(ns, nc);
    }
  }
  const tgt = Math.round(num(target) * scale);
  if (best.has(tgt)) return best.get(tgt)!;
  let bestSum: number | null = null;
  let bestDist = Infinity;
  let above = false;
  for (const s of [...best.keys()].sort((a, b) => a - b)) {
    const dist = Math.abs(s - tgt);
    const isAbove = s >= tgt;
    if (bestSum === null || dist < bestDist || (dist === bestDist && isAbove && !above)) {
      bestSum = s;
      bestDist = dist;
      above = isAbove;
    }
  }
  return bestSum != null ? best.get(bestSum)! : 0;
}

/** Quanti esami «contano davvero» (per l'anello di progresso). */
export function totalExamsCount(d: GradeData): number {
  let total = 0;
  const seen = new Set<string>();
  for (const e of d.exams) {
    const g = e.group_uuid != null ? findGroup(d, e.group_uuid) : null;
    if (!g || isSplit(g)) {
      total++;
      continue;
    }
    if (seen.has(g.uuid)) continue;
    seen.add(g.uuid);
    const members = groupExams(d, g.uuid);
    const quota = num(g.cfu);
    const decided = members.filter(
      (x) => x.status === 'done' || (x.status === 'todo' && x.predicted_grade != null),
    );
    const decidedSum = decided.reduce((s, x) => s + num(x.cfu), 0);
    if (decided.length > 0 && Math.abs(decidedSum - quota) < 0.01) total += decided.length;
    else
      total += maxCountForExactSum(
        members.map((x) => num(x.cfu)),
        quota,
      );
  }
  return total;
}

/** Il voto complessivo proposto per un esame diviso: media pesata, arrotondata, di voti (o previsioni). */
export function proposedOverallGrade(
  d: GradeData,
  members: Exam[],
  useSim: boolean,
): number | null {
  let sum = 0;
  let cfu = 0;
  for (const e of members) {
    const c = num(e.cfu);
    let g: number | null = null;
    if (e.status === 'done' && e.grade != null)
      g = bool(e.has_honors) ? honorsValue(d) : num(e.grade);
    else if (useSim && e.predicted_grade != null)
      g = bool(e.predicted_honors) ? honorsValue(d) : num(e.predicted_grade);
    if (g == null) continue;
    sum += g * c;
    cfu += c;
  }
  return cfu <= 0 ? null : clampG(Math.round(sum / cfu));
}

/** Tutte le somme di CFU che si fanno con sottoinsiemi non vuoti (per la quota di un gruppo «a scelta»). */
export function possibleCfuSums(cfus: number[]): number[] {
  const sums = new Set<number>([0]);
  let list = [0];
  for (let i = 0; i < cfus.length && i < 18; i++) {
    const c = Math.round(num(cfus[i]) * 10) / 10;
    const next = list.slice();
    for (const x of list) {
      const s = Math.round((x + c) * 10) / 10;
      if (!sums.has(s)) {
        sums.add(s);
        next.push(s);
      }
    }
    list = next;
  }
  return [...sums].filter((s) => s > 0).sort((a, b) => a - b);
}

/* ---------- media e CFU ---------- */

export const isGraded = (e: Exam): boolean =>
  e.status === 'done' && !bool(e.is_pass_fail) && e.grade != null;
export const effGrade = (d: GradeData, e: Exam): number =>
  bool(e.has_honors) ? honorsValue(d) : num(e.grade);
const capOf = (b: Bonus): number | null => {
  const c = b.cap_points != null ? num(b.cap_points) : 0;
  return c && c > 0 ? c : null;
};

export function weighted(d: GradeData, list: Exam[] = d.exams) {
  let sum = 0;
  let cfu = 0;
  let n = 0;
  for (const e of list) {
    if (!isGraded(e)) continue;
    const c = num(e.cfu);
    sum += effGrade(d, e) * c;
    cfu += c;
    n++;
  }
  return { avg: cfu > 0 ? sum / cfu : 0, sum, cfu, n };
}

/** CFU sostenuti e da sostenere. I gruppi «a scelta» contano fino alla quota; quelli «divisi» come esami normali. */
export function cfuStats(d: GradeData) {
  let done = 0;
  let plan = 0;
  const choiceDone = new Map<string, number>();
  const seenChoice = new Set<string>();
  for (const e of d.exams) {
    if (!bool(e.counts_for_graduation)) continue;
    const c = num(e.cfu);
    const g = e.group_uuid != null ? findGroup(d, e.group_uuid) : null;
    if (g && isChoice(g)) {
      choiceDone.set(g.uuid, (choiceDone.get(g.uuid) ?? 0) + (e.status === 'done' ? c : 0));
      continue;
    }
    if (e.status === 'done') done += c;
    else plan += c;
  }
  for (const e of d.exams) {
    if (e.group_uuid == null) continue;
    const g = findGroup(d, e.group_uuid);
    if (!g || !isChoice(g) || seenChoice.has(g.uuid)) continue;
    seenChoice.add(g.uuid);
    const quota = num(g.cfu);
    const doneSum = choiceDone.get(g.uuid) ?? 0;
    if (doneSum > 0) {
      done += Math.min(doneSum, quota);
      if (doneSum < quota) plan += quota - doneSum;
    } else plan += quota;
  }
  let total = num(d.settings.total_cfu);
  if (total < done + plan) total = done + plan;
  return { done, plan, total };
}

/** Gli esami ancora da sostenere che pesano su media richiesta e simulazione. */
export function todoForCalc(d: GradeData): Exam[] {
  const doneSum = new Map<string, number>();
  const seen = new Set<string>();
  const out: Exam[] = [];
  const pos = new Map(d.exams.map((e, i) => [e.uuid, i]));
  for (const e of d.exams)
    if (e.group_uuid != null && e.status === 'done')
      doneSum.set(e.group_uuid, (doneSum.get(e.group_uuid) ?? 0) + num(e.cfu));
  const todo = d.exams.filter((x) => x.status === 'todo' && bool(x.counts_for_graduation));
  todo.sort(
    (a, b) =>
      (a.study_year || 99) - (b.study_year || 99) ||
      (pos.get(a.uuid) ?? 0) - (pos.get(b.uuid) ?? 0),
  );
  for (const e of todo) {
    const g = e.group_uuid != null ? findGroup(d, e.group_uuid) : null;
    if (g && isChoice(g)) {
      if (seen.has(g.uuid)) continue;
      seen.add(g.uuid);
      const quota = num(g.cfu);
      const rem = Math.max(0, quota - (doneSum.get(g.uuid) ?? 0));
      if (rem <= 0.0005) continue;
      const members = groupExams(d, g.uuid).filter((x) => x.status === 'todo');
      let predictedCfu = 0;
      for (const m of members)
        if (m.predicted_grade != null) {
          out.push(m);
          predictedCfu += num(m.cfu);
        }
      const leftover = rem - predictedCfu;
      if (leftover > 0.0005) {
        const template = members[0] ?? e;
        out.push({ ...template, cfu: leftover, predicted_grade: null, predicted_honors: 0 });
      }
      continue;
    }
    out.push(e);
  }
  return out;
}

/** Gli esami «da sostenere» che si vedono: quelli di un gruppo a scelta già coperto dalla quota nascono nascosti. */
export function todoVisible(d: GradeData): Exam[] {
  const doneSum = new Map<string, number>();
  for (const e of d.exams)
    if (e.group_uuid != null && e.status === 'done')
      doneSum.set(e.group_uuid, (doneSum.get(e.group_uuid) ?? 0) + num(e.cfu));
  return d.exams.filter((e) => {
    if (e.status !== 'todo') return false;
    const g = e.group_uuid != null ? findGroup(d, e.group_uuid) : null;
    if (g && isChoice(g) && (doneSum.get(g.uuid) ?? 0) >= num(g.cfu) - 0.0005) return false;
    return true;
  });
}

/* ---------- voto di laurea ---------- */

export const base110 = (d: GradeData, avg: number): number => {
  const raw = (avg / 30) * gradeBase(d);
  return bool(d.settings.round_half_up) ? Math.round(raw) : Math.floor(raw);
};

/** Dove cade un voto sulla scala 66 → base → base+lode (0..100). */
export function gradePct(d: GradeData, v: number): number {
  const gb = gradeBase(d);
  const lo = 66;
  if (v <= lo) return 0;
  if (v >= gb + 1) return 100;
  if (v <= gb) return ((v - lo) / (gb - lo)) * 92;
  return 92 + (v - gb) * 8;
}
export const dispFinal = (d: GradeData, v: number): string => {
  const gb = gradeBase(d);
  return v > gb ? `${gb}L` : String(Math.round(v));
};

export function lodiCount(d: GradeData, useSim: boolean): number {
  let n = 0;
  for (const e of d.exams) {
    if (bool(e.is_pass_fail)) continue;
    if (isGraded(e) && bool(e.has_honors)) n++;
    else if (useSim && e.status === 'todo' && e.predicted_grade != null && bool(e.predicted_honors))
      n++;
  }
  return n;
}

export function bonusApplied(b: Bonus, lodi: number): number {
  if (!bool(b.is_enabled)) return 0;
  const pts = num(b.points);
  const cap = capOf(b);
  if (b.bonus_type === 'honors_each') {
    let v = pts * lodi;
    if (cap != null) v = Math.min(v, cap);
    return v;
  }
  if (b.bonus_type === 'honors_threshold') {
    const thr = b.threshold_value != null ? num(b.threshold_value) : 0;
    return lodi >= thr ? pts : 0;
  }
  return pts;
}
export function bonusTotal(d: GradeData, useSim: boolean): number {
  const lodi = lodiCount(d, useSim);
  let total = 0;
  for (const b of d.bonuses) {
    if (!bool(b.is_enabled)) continue;
    total += bonusApplied(b, lodi);
  }
  return total;
}

export function finalRange(d: GradeData, avg: number, useSim: boolean) {
  const base = avg > 0 ? base110(d, avg) : 0;
  const bonus = bonusTotal(d, useSim);
  const tmin = num(d.settings.thesis_min_points);
  const tmax = num(d.settings.thesis_max_points);
  return { base, bonus, min: base + bonus + tmin, max: base + bonus + tmax };
}

/** Che media serve negli esami che restano per arrivare a `target`. */
export function requiredFuture(d: GradeData, target: number) {
  const w = weighted(d);
  let r = 0;
  for (const e of todoForCalc(d)) if (!bool(e.is_pass_fail)) r += num(e.cfu);
  if (r <= 0) return null;
  const req = (target * (w.cfu + r) - w.sum) / r;
  return { req, remainingCfu: r, feasible: req <= 30.0001 };
}

/** La media se gli esami con un voto previsto andassero come previsto. */
export function simulated(d: GradeData) {
  let sum = 0;
  let cfu = 0;
  let used = 0;
  for (const e of d.exams) {
    if (bool(e.is_pass_fail)) continue;
    if (isGraded(e)) {
      const c = num(e.cfu);
      sum += effGrade(d, e) * c;
      cfu += c;
    }
  }
  for (const e of todoForCalc(d)) {
    if (bool(e.is_pass_fail) || e.predicted_grade == null) continue;
    const c = num(e.cfu);
    const g = bool(e.predicted_honors) ? honorsValue(d) : num(e.predicted_grade);
    sum += g * c;
    cfu += c;
    used++;
  }
  return { avg: cfu > 0 ? sum / cfu : 0, cfu, used };
}

export interface TrendPoint {
  i: number;
  avg: number;
  grade?: number;
  name?: string;
  date?: string | null;
  lode?: boolean;
  predicted?: boolean;
}

/** L'andamento della media esame dopo esame, e (se `withProjection`) la proiezione con i voti previsti. */
export function trendData(d: GradeData, withProjection: boolean) {
  const pos = new Map(d.exams.map((e, i) => [e.uuid, i]));
  const graded = d.exams.filter(isGraded);
  graded.sort((a, b) => {
    const da = a.exam_date || '';
    const db = b.exam_date || '';
    if (da && db) {
      if (da < db) return -1;
      if (da > db) return 1;
    } else if (da && !db) return -1;
    else if (!da && db) return 1;
    return (pos.get(a.uuid) ?? 0) - (pos.get(b.uuid) ?? 0);
  });
  const real: TrendPoint[] = [];
  let sum = 0;
  let cfu = 0;
  graded.forEach((e, i) => {
    const c = num(e.cfu);
    sum += effGrade(d, e) * c;
    cfu += c;
    real.push({
      i: i + 1,
      avg: cfu > 0 ? sum / cfu : 0,
      grade: effGrade(d, e),
      name: e.name,
      date: e.exam_date,
      lode: bool(e.has_honors),
    });
  });
  const proj: TrendPoint[] = [];
  if (withProjection && real.length) {
    const todo = todoForCalc(d).filter((e) => !bool(e.is_pass_fail) && e.predicted_grade != null);
    let psum = sum;
    let pcfu = cfu;
    let idx = real.length;
    proj.push({ i: real[real.length - 1]!.i, avg: real[real.length - 1]!.avg });
    for (const e of todo) {
      const c = num(e.cfu);
      const g = bool(e.predicted_honors) ? honorsValue(d) : num(e.predicted_grade);
      psum += g * c;
      pcfu += c;
      idx++;
      proj.push({
        i: idx,
        avg: pcfu > 0 ? psum / pcfu : 0,
        grade: g,
        name: e.name,
        predicted: true,
      });
    }
  }
  return { real, proj };
}
