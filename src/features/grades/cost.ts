/**
 * «Costo» (voti.php › study_api.php `esami_fatti`): quanto è costato ogni esame già dato, in pomodori e ore; quanto costa un
 * credito per fascia di CFU; e, da lì, il preventivo di quelli che restano. Solo regole, senza database: i numeri
 * sono quelli del sito (stesse fasce, stessi arrotondamenti).
 */

/** Un esame dato con quello che è costato. `sessions`: i secondi di ogni pomodoro finito, già senza doppioni. */
export interface DoneExamCost {
  name: string;
  cfu: number;
  grade: number | null;
  honors: boolean;
  /** i pomodori finiti dei progetti dell'esame (e dei loro figli) */
  pomodori: number;
  seconds: number;
}

export interface CostExam extends DoneExamCost {
  hours: number;
  perCfu: number | null;
}

export interface CostBand {
  /** il nome della fascia: «≤6», «7-9», «10-12», «13+» */
  cfu: string;
  esami: number;
  perCfu: number;
  avgGrade: number | null;
}

export interface Costs {
  exams: CostExam[];
  bands: CostBand[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** La fascia di crediti di un esame (le soglie del sito). */
export function bandName(cfu: number): string {
  return cfu <= 6 ? '≤6' : cfu <= 9 ? '7-9' : cfu <= 12 ? '10-12' : '13+';
}

const BAND_ORDER = ['≤6', '7-9', '10-12', '13+'];

/** Gli esami dati (dal più recente) → riga per esame e costo medio per credito di ogni fascia. */
export function buildCosts(done: DoneExamCost[]): Costs {
  const exams: CostExam[] = done.map((e) => ({
    ...e,
    hours: round1(e.seconds / 3600),
    perCfu: e.cfu > 0 ? round1(e.pomodori / e.cfu) : null,
  }));
  const acc = new Map<string, { n: number; pom: number; grades: number[] }>();
  for (const e of done) {
    if (!(e.cfu > 0 && e.pomodori > 0)) continue;
    const key = bandName(e.cfu);
    const cur = acc.get(key) ?? { n: 0, pom: 0, grades: [] };
    cur.n += 1;
    cur.pom += e.pomodori / e.cfu;
    if (e.grade !== null) cur.grades.push(e.grade);
    acc.set(key, cur);
  }
  const bands = [...acc.entries()]
    .sort((a, b) => BAND_ORDER.indexOf(a[0]) - BAND_ORDER.indexOf(b[0]))
    .map(([cfu, v]) => ({
      cfu,
      esami: v.n,
      perCfu: round1(v.pom / v.n),
      avgGrade: v.grades.length
        ? round1(v.grades.reduce((s, g) => s + g, 0) / v.grades.length)
        : null,
    }));
  return { exams, bands };
}

/** Pomodori per credito da usare per un esame di `cfu`: la sua fascia, o la media delle altre se non ce n'è nessuna. */
export function perCfuFor(cfu: number, bands: CostBand[]): number | null {
  const own = bands.find((b) => b.cfu === bandName(cfu));
  if (own) return own.perCfu;
  if (!bands.length) return null;
  return bands.reduce((s, b) => s + b.perCfu, 0) / bands.length;
}

export interface Forecast {
  total: number;
  rows: { name: string; cfu: number; pomodori: number }[];
}

/** Il preventivo di quello che resta: ogni esame da dare, per la sua fascia. Senza esami alle spalle non si stima niente. */
export function forecast(
  todo: { name: string; cfu: number }[],
  bands: CostBand[],
): Forecast | null {
  const rows: Forecast['rows'] = [];
  for (const e of todo) {
    if (!(e.cfu > 0)) continue;
    const per = perCfuFor(e.cfu, bands);
    if (per === null) continue;
    rows.push({ name: e.name, cfu: e.cfu, pomodori: Math.round(e.cfu * per) });
  }
  if (!rows.length) return null;
  return { total: rows.reduce((s, r) => s + r.pomodori, 0), rows };
}
