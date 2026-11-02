/**
 * Le ripetizioni del planner, uguali a quelle del sito (lib/planner/pl_eventi.php: pl_rrule_parse e pl_occurrences).
 * Una serie è un solo evento «master» con una regola; le singole date si calcolano in lettura. Qui si porta lo
 * stesso calcolo, compresi i suoi modi di fare (il 31 di un mese che non ha il 31 si salta; non si parte mai
 * dall'inizio della serie, si salta dentro il periodo). Il test d'oro lo confronta con le date calcolate dal sito.
 */

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

export interface Rule {
  unit: RepeatUnit;
  interval: number;
  until: string | null;
  count: number | null;
}

/** I campi di un evento che servono a sapere come si ripete. */
export interface RepeatSource {
  rrule?: string | null;
  event_date?: string | null;
  repeat_until?: string | null;
  repeat_type?: string | null;
  repeat_unit?: string | null;
  repeat_interval?: number | null;
}

/** Il massimo di date generate in un periodo (lo stesso tetto del sito). */
export const MAX_OCCURRENCES = 400;

const DAY_MS = 86_400_000;
const dayNum = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / DAY_MS);
const dayStr = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** Come (int) di PHP su un testo: le cifre all'inizio, altrimenti 0. */
function phpInt(v: string): number {
  const m = /^\s*([+-]?\d+)/.exec(v);
  return m ? parseInt(m[1]!, 10) : 0;
}

const FREQ: Record<string, RepeatUnit> = {
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
};

/** La regola scritta in RRULE (null se non si capisce o manca la frequenza). */
export function parseRrule(rrule: string | null | undefined): Rule | null {
  if (rrule === null || rrule === undefined || rrule.trim() === '') return null;
  let unit: RepeatUnit | null = null;
  let interval = 1;
  let until: string | null = null;
  let count: number | null = null;
  for (const raw of rrule
    .trim()
    .replace(/RRULE:/gi, '')
    .split(';')) {
    const piece = raw.trim();
    const eq = piece.indexOf('=');
    if (piece === '' || eq < 0) continue;
    const k = piece.slice(0, eq).trim().toUpperCase();
    const v = piece.slice(eq + 1);
    if (k === 'FREQ') unit = FREQ[v.trim().toUpperCase()] ?? null;
    else if (k === 'INTERVAL') interval = Math.max(1, phpInt(v));
    else if (k === 'UNTIL') {
      const only = v.replace(/[^0-9]/g, '').slice(0, 8);
      if (only.length === 8) until = `${only.slice(0, 4)}-${only.slice(4, 6)}-${only.slice(6, 8)}`;
    } else if (k === 'COUNT') count = Math.max(1, phpInt(v));
  }
  return unit === null ? null : { unit, interval, until, count };
}

/** Una data «AAAA-MM-GG» valida, oppure null (vuoto, «0000-00-00», una sciocchezza). */
export function dateOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s === '' || s.startsWith('0000-00-00') || s.toLowerCase() === 'null') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ok = new Date(Date.UTC(y, mo - 1, d));
  if (ok.getUTCFullYear() !== y || ok.getUTCMonth() !== mo - 1 || ok.getUTCDate() !== d)
    return null;
  return m[0];
}

const OLD_UNIT: Record<string, RepeatUnit> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

/** La regola di un evento: la RRULE se c'è, altrimenti si ricostruisce dalle colonne dei vecchi eventi. */
export function ruleOf(r: RepeatSource): Rule | null {
  const parsed = parseRrule(r.rrule);
  if (parsed) return parsed;
  const type = r.repeat_type ?? 'none';
  if (type === 'none' || type === '') return null;
  if (type === 'custom') {
    const u = r.repeat_unit ?? 'week';
    const unit = (['day', 'week', 'month', 'year'] as string[]).includes(u)
      ? (u as RepeatUnit)
      : 'week';
    return {
      unit,
      interval: Math.max(1, Math.trunc(r.repeat_interval ?? 1)),
      until: null,
      count: null,
    };
  }
  const unit = OLD_UNIT[type];
  return unit ? { unit, interval: 1, until: null, count: null } : null;
}

const isRealDate = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Le date generate da un master dentro un periodo («from» e «to» compresi).
 * Non si parte dall'inizio della serie: si calcola quanti passi servono per atterrare nel periodo e si salta lì.
 */
export function occurrences(r: RepeatSource, from: string, to: string): string[] {
  const rule = ruleOf(r);
  if (!rule) return [];
  const start = dateOrNull(r.event_date);
  if (start === null) return [];

  // il limite può stare sulla colonna, dentro la RRULE o in nessuno dei due: vince il più stretto
  let end = dateOrNull(r.repeat_until);
  if (rule.until !== null) end = end === null || rule.until < end ? rule.until : end;
  const limit = end !== null && end < to ? end : to;
  if (limit < start || limit < from) return [];

  const step = Math.max(1, rule.interval);
  const dates: string[] = [];

  if (rule.unit === 'day' || rule.unit === 'week') {
    const days = rule.unit === 'week' ? step * 7 : step;
    const distance = dayNum(from) - dayNum(start);
    const jumps = distance > 0 ? Math.ceil(distance / days) : 0;
    let cur = dayNum(start) + jumps * days;
    for (let n = 0; n < MAX_OCCURRENCES && dayStr(cur) <= limit; n++, cur += days) {
      const g = dayStr(cur);
      if (g >= from && g >= start) dates.push(g);
    }
  } else {
    const months = rule.unit === 'year' ? step * 12 : step;
    const [yS, mS, dS] = [
      Number(start.slice(0, 4)),
      Number(start.slice(5, 7)),
      Number(start.slice(8, 10)),
    ];
    const [yF, mF] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
    const distance = (yF - yS) * 12 + (mF - mS);
    let jumps = distance > 0 ? Math.ceil(distance / months) : 0;
    // un passo indietro di sicurezza: il giorno di partenza può cadere dopo la fine del mese di arrivo
    jumps = Math.max(0, jumps - 1);
    for (let n = 0; n < MAX_OCCURRENCES;) {
      const off = (jumps + n) * months;
      const year = yS + Math.floor((mS - 1 + off) / 12);
      const month = ((mS - 1 + off) % 12) + 1;
      n++;
      // il 31 di un mese che non ce l'ha si salta, non si arrotonda (come Google)
      if (!isRealDate(year, month, dS)) {
        if (`${String(year).padStart(4, '0')}-${pad2(month)}-01` > limit) break;
        continue;
      }
      const g = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(dS)}`;
      if (g > limit) break;
      if (g >= from && g >= start) dates.push(g);
    }
  }
  // come il sito: il tetto «COUNT» taglia le date trovate nel periodo
  return rule.count !== null && dates.length > rule.count ? dates.slice(0, rule.count) : dates;
}
