/**
 * Le pastiglie: la logica del sito (lib/pills_core.php) portata qui parola per parola, così il telefono
 * fa le stesse prese degli stessi giorni anche senza rete. Il test d'oro (pillsGolden.json) confronta questi
 * risultati con quelli del codice vero del sito, in fuso Europe/Rome.
 *
 * Una *terapia* dice cosa prendere e con che ritmo; una *presa* è il singolo appuntamento (quello delle
 * 10:00 di oggi) con la sua spunta. Le prese nascono il giorno in cui servono, non un anno prima: così
 * cambiare il ritmo non riscrive il passato.
 *
 * Questo file non tocca il database né l'orologio: tutto arriva da fuori (oggi, adesso), così si prova.
 */

import { addDaysIso as addDays } from '@/features/tasks/groups';

export type FreqType = 'daily' | 'monthly' | 'interval';
export type DoseStatus = 'pending' | 'taken' | 'skipped';

export interface PillPlan {
  uuid: string;
  name: string;
  dose: string;
  notes: string;
  color: string;
  freq_type: FreqType;
  weekdays: string;
  month_days: string;
  interval_days: number;
  times: string;
  start_date: string;
  end_date: string | null;
  is_active: number;
  schedule_from: string | null;
  created_at: string | null;
}

export interface Dose {
  uuid: string;
  plan_uuid: string;
  due_date: string;
  /** 'HH:MM' */
  due_time: string;
  seq: number;
  status: DoseStatus;
  /** 'AAAA-MM-GG HH:MM:SS' */
  taken_at: string | null;
}

/** Quante volte per orario: da 1 a 9. */
export interface TimeSlot {
  time: string;
  n: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Orario «HH:MM» (o «HH:MM:SS») valido → «HH:MM», altrimenti null (sec_time del sito). */
function secTime(v: string): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(v.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * «10:00x2,20:00x1» → [{time:'10:00', n:2}, ...]. Scritto male, si torna a una presa alle 08:00: meglio una
 * terapia addosso che una sezione vuota. In ordine di orologio (td_pill_times).
 */
export function parseTimes(s: string): TimeSlot[] {
  const out: TimeSlot[] = [];
  for (const raw of s.split(',')) {
    const piece = raw.trim();
    if (piece === '') continue;
    const p = piece.split('x');
    const time = secTime(p[0] ?? '');
    if (time === null) continue;
    const n = p.length > 1 ? parseInt(p[1]!, 10) || 0 : 1;
    out.push({ time, n: Math.max(1, Math.min(9, n)) });
  }
  if (!out.length) out.push({ time: '08:00', n: 1 });
  return out.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

/** Gli orari come li scrive il sito: «08:00x1,20:00x2». */
export function formatTimes(slots: TimeSlot[]): string {
  return slots.map((t) => `${t.time}x${t.n}`).join(',');
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86400000);
};

/** Il giorno della settimana, lunedì = 0 (date('N') - 1 del sito). */
function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(y!, m! - 1, d!).getDay() + 6) % 7;
}

const daysInMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y!, m!, 0).getDate();
};

/** La terapia tocca quel giorno? (td_pill_due) */
export function isDue(
  p: Pick<
    PillPlan,
    'freq_type' | 'weekdays' | 'month_days' | 'interval_days' | 'start_date' | 'end_date'
  >,
  date: string,
): boolean {
  if (date < p.start_date) return false;
  if (p.end_date && date > p.end_date) return false;

  if (p.freq_type === 'monthly') {
    const g = parseInt(date.slice(8, 10), 10);
    const days = p.month_days.split(',').map((d) => parseInt(d.trim(), 10) || 0);
    if (days.includes(g)) return true;
    // il 31 in un mese di 30 giorni non esiste: la presa slitta all'ultimo giorno, invece di saltare il mese
    const last = daysInMonth(date);
    return g === last && days.some((d) => d > last);
  }

  if (p.freq_type === 'interval') {
    const n = Math.max(1, Math.trunc(p.interval_days) || 1);
    // giorni di calendario: niente ore di mezzo, quindi niente scarti con l'ora legale
    const days = dayNumber(date) - dayNumber(p.start_date);
    return days >= 0 && days % n === 0;
  }

  // daily: la maschera dei giorni della settimana, lunedì per primo; se è corta, gli altri giorni valgono
  const w = p.weekdays.padEnd(7, '1');
  return w[weekdayIndex(date)] === '1';
}

export interface DoseSpec {
  plan_uuid: string;
  due_date: string;
  due_time: string;
  seq: number;
}

/**
 * Le prese che nascono nei giorni dati (td_pills_ensure_giorni): solo per le terapie attive, e solo dal giorno
 * in cui vale l'orario corrente (`schedule_from`): prima di quella data le prese appartengono a un ritmo che non
 * c'è più e non si toccano (il bug delle prese che ritornavano).
 */
export function dosesFor(plans: PillPlan[], dates: string[]): DoseSpec[] {
  const out: DoseSpec[] = [];
  for (const p of plans) {
    if (!p.is_active) continue;
    const slots = parseTimes(p.times);
    const validFrom = p.schedule_from || p.start_date;
    for (const date of dates) {
      if (validFrom !== '' && date < validFrom) continue;
      if (!isDue(p, date)) continue;
      for (const s of slots)
        for (let seq = 1; seq <= s.n; seq++)
          out.push({ plan_uuid: p.uuid, due_date: date, due_time: s.time, seq });
    }
  }
  return out;
}

/** Gli `n` giorni prima di oggi, dal più vicino (oggi - 1) in poi. */
export function daysBefore(today: string, n: number): string[] {
  const out: string[] = [];
  const [y, m, d] = today.split('-').map(Number);
  for (let i = 1; i <= n; i++) {
    const x = new Date(y!, m! - 1, d! - i);
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`);
  }
  return out;
}

/** Quanti giorni indietro cercare le prese rimaste in sospeso: oltre non ci si ricorda davvero se la si è presa. */
export const LATE_DAYS = 14;
/** I giorni scorsi di cui si generano le prese mancanti (chi non apre l'app per una settimana ha comunque da recuperare). */
export const CATCH_UP_DAYS = 7;

/**
 * Il ritmo è cambiato? (td_pill_scrivi) Correggere nome o colore non deve buttare via la storia; cambiare gli
 * orari o i giorni sì: da quel momento vale il ritmo nuovo.
 */
export function rhythmChanged(
  before: Pick<PillPlan, 'times' | 'freq_type' | 'weekdays' | 'month_days' | 'interval_days'>,
  after: Pick<PillPlan, 'times' | 'freq_type' | 'weekdays' | 'month_days' | 'interval_days'>,
): boolean {
  return (
    before.times !== after.times ||
    before.freq_type !== after.freq_type ||
    before.weekdays !== after.weekdays ||
    before.month_days !== after.month_days ||
    Number(before.interval_days) !== Number(after.interval_days)
  );
}

/**
 * Da quando vale il ritmo. Una terapia nuova: dal suo inizio. Una modificata: se il ritmo è cambiato, da oggi,
 * ma da DOMANI se oggi una presa è già stata segnata (la giornata è stata vissuta col ritmo vecchio, e
 * l'orario nuovo riguarda la prossima volta: così non nascono due righe per una pastiglia sola).
 */
export function scheduleFromFor(opts: {
  before: Pick<PillPlan, 'schedule_from' | 'start_date'> | null;
  changed: boolean;
  startDate: string;
  today: string;
  signedToday: boolean;
}): string {
  if (!opts.before) return opts.startDate;
  if (opts.changed) return opts.signedToday ? addDays(opts.today, 1) : opts.today;
  return opts.before.schedule_from || opts.before.start_date;
}

/** Cambio di stato di una presa che l'app deve scrivere. */
export interface DoseChange {
  uuid: string;
  status: DoseStatus;
  taken_at: string | null;
}

/**
 * Il calendario (td_pill_giorno_imposta): «quante prese quel giorno». Le prese del giorno si spuntano in
 * ordine di orario: le prime n, le altre tornano indietro. Una già spuntata tiene la sua ora vera; una nuova
 * prende l'ora prevista (mai nel futuro). Una saltata resta saltata, a meno che non serva per arrivare a n.
 * `doses` sono quelle del giorno, in ordine di orario e numero. `now` = 'AAAA-MM-GG HH:MM:SS'.
 */
export function setDayCount(
  doses: Pick<Dose, 'uuid' | 'status' | 'due_time'>[],
  n: number,
  day: string,
  today: string,
  now: string,
): { taken: number; tot: number; changes: DoseChange[] } {
  if (!doses.length) return { taken: 0, tot: 0, changes: [] };
  const count = Math.min(n, doses.length);
  const already = doses.filter((d) => d.status === 'taken');
  const others = doses
    .filter((d) => d.status !== 'taken')
    // le saltate per ultime (sort stabile: l'ordine d'orologio resta)
    .sort((a, b) => Number(a.status === 'skipped') - Number(b.status === 'skipped'));
  const toRemove = already.slice(count);
  const toAdd = others.slice(0, Math.max(0, count - already.length));
  // Su un giorno passato «una su due» vuol dire che l'altra non è stata presa: saltata. Oggi resta in sospeso.
  const rest: DoseStatus = day < today ? 'skipped' : 'pending';
  const changes: DoseChange[] = [];
  for (const d of toRemove) changes.push({ uuid: d.uuid, status: rest, taken_at: null });
  if (rest === 'skipped') {
    for (const d of others.slice(Math.max(0, count - already.length))) {
      if (d.status === 'pending') changes.push({ uuid: d.uuid, status: 'skipped', taken_at: null });
    }
  }
  for (const d of toAdd) {
    let when = `${day} ${d.due_time.slice(0, 5)}:00`;
    if (when > now) when = now;
    changes.push({ uuid: d.uuid, status: 'taken', taken_at: when });
  }
  return { taken: count, tot: doses.length, changes };
}

/**
 * «Prese tutte» (td_pill_segna_tutte): `on_time` = ognuna all'orario previsto, `now` = tutte adesso. Si toccano
 * solo le non ancora spuntate (una già spuntata ha la sua ora vera) e mai nel futuro.
 */
export function markAll(
  doses: Pick<Dose, 'uuid' | 'status' | 'due_date' | 'due_time'>[],
  mode: 'on_time' | 'now',
  now: string,
): DoseChange[] {
  const out: DoseChange[] = [];
  for (const d of doses) {
    if (d.status === 'taken') continue;
    let when = mode === 'on_time' ? `${d.due_date} ${d.due_time.slice(0, 5)}:00` : now;
    if (when > now) when = now;
    out.push({ uuid: d.uuid, status: 'taken', taken_at: when });
  }
  return out;
}

/** Il giorno di storia: quante prese erano previste e come sono finite. */
export interface HistoryDay {
  date: string;
  taken: number;
  skipped: number;
  pending: number;
}

export function historyOf(
  doses: Pick<Dose, 'due_date' | 'status'>[],
  from: string,
  to: string,
): HistoryDay[] {
  const per = new Map<string, HistoryDay>();
  for (const d of doses) {
    if (d.due_date < from || d.due_date > to) continue;
    const row = per.get(d.due_date) ?? { date: d.due_date, taken: 0, skipped: 0, pending: 0 };
    row[d.status] += 1;
    per.set(d.due_date, row);
  }
  return [...per.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* ---------------- controllo dei campi di una terapia (pl_pillole_leggi) ---------------- */

export interface PlanInput {
  name: string;
  dose: string;
  notes: string;
  color: string;
  freq_type: FreqType;
  weekdays: string;
  month_days: string;
  interval_days: number;
  times: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export type PlanError = { field: keyof PlanInput; code: string };

const validDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(+m[1]!, +m[2]! - 1, +m[3]!);
  return d.getFullYear() === +m[1]! && d.getMonth() === +m[2]! - 1 && d.getDate() === +m[3]!;
};

/**
 * Gli stessi controlli del server, prima di salvare: se qualcosa non va si dice quale campo. Ritorna la
 * terapia ripulita (orari rimessi in forma, spazi tolti) oppure l'errore.
 */
export function cleanPlan(
  c: PlanInput,
): { ok: true; plan: PlanInput } | { ok: false; error: PlanError } {
  const err = (field: keyof PlanInput, code: string) => ({
    ok: false as const,
    error: { field, code },
  });
  const name = c.name.trim();
  const dose = c.dose.trim();
  const notes = c.notes.trim();
  if (!name) return err('name', 'empty');
  if (name.length > 120) return err('name', 'too_long');
  if (dose.length > 60) return err('dose', 'too_long');
  if (notes.length > 255) return err('notes', 'too_long');
  if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c.color)) return err('color', 'invalid');
  if (!['daily', 'monthly', 'interval'].includes(c.freq_type)) return err('freq_type', 'invalid');
  if (!/^[01]{7}$/.test(c.weekdays) || !c.weekdays.includes('1')) return err('weekdays', 'invalid');
  if (c.month_days !== '') {
    if (!/^[0-9]{1,2}(,[0-9]{1,2})*$/.test(c.month_days)) return err('month_days', 'invalid');
    if (c.month_days.split(',').some((g) => +g < 1 || +g > 31)) return err('month_days', 'invalid');
  }
  if (c.freq_type === 'monthly' && c.month_days === '') return err('month_days', 'required');
  if (!Number.isInteger(c.interval_days) || c.interval_days < 1 || c.interval_days > 365)
    return err('interval_days', 'invalid');
  if (!c.times || c.times.length > 255) return err('times', 'invalid');
  for (const piece of c.times.split(','))
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9](x[1-9])?$/.test(piece)) return err('times', 'invalid');
  if (!validDate(c.start_date)) return err('start_date', 'invalid');
  if (c.end_date !== null) {
    if (!validDate(c.end_date)) return err('end_date', 'invalid');
    if (c.end_date < c.start_date) return err('end_date', 'before_start');
  }
  return {
    ok: true,
    plan: { ...c, name, dose, notes, times: formatTimes(parseTimes(c.times)) },
  };
}
