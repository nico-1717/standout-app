/**
 * Le piccole regole della schermata Pastiglie (public/planner/todo_widget.php): il ritmo detto a parole, quanti
 * colori ha il calendario, come si dispone un mese. Niente database e niente orologio: tutto arriva da fuori.
 */

import { parseTimes, type PillPlan } from './logic';

/** Le parole che servono per scrivere il ritmo (vengono dalle traduzioni). */
export interface RhythmWords {
  everyDay: string;
  never: string;
  paused: string;
  /** «il {giorni} di ogni mese» */
  monthly: (days: string) => string;
  /** «ogni {n} giorni» */
  everyN: (n: number) => string;
  /** «fino al 31/12» */
  until: (ddmm: string) => string;
  /** le sigle dei giorni, da lunedì */
  weekdays: string[];
}

/** «ogni giorno · 08:00, 20:00 ×2»: si legge, una riga di codici no (pillRitmo del sito). */
export function rhythmText(
  p: Pick<
    PillPlan,
    'freq_type' | 'weekdays' | 'month_days' | 'interval_days' | 'times' | 'end_date' | 'is_active'
  >,
  w: RhythmWords,
): string {
  const out: string[] = [];
  if (p.freq_type === 'monthly') {
    out.push(w.monthly(p.month_days || '?'));
  } else if (p.freq_type === 'interval') {
    out.push(p.interval_days === 1 ? w.everyDay : w.everyN(p.interval_days));
  } else {
    const mask = (p.weekdays || '1111111').padEnd(7, '1');
    if (!mask.includes('0')) out.push(w.everyDay);
    else {
      const days = w.weekdays.filter((_, i) => mask[i] === '1');
      out.push(days.length ? days.join(', ') : w.never);
    }
  }
  const hours = parseTimes(p.times).map((s) => (s.n > 1 ? `${s.time} ×${s.n}` : s.time));
  if (hours.length) out.push(hours.join(', '));
  if (p.end_date) out.push(w.until(`${p.end_date.slice(8, 10)}/${p.end_date.slice(5, 7)}`));
  if (!p.is_active) out.push(w.paused);
  return out.join('  ·  ');
}

/** Quante prese prevede in un giorno: «10:00x2,20:00x1» fa tre. */
export function perDay(p: Pick<PillPlan, 'times'>): number {
  return Math.max(
    1,
    parseTimes(p.times).reduce((n, s) => n + s.n, 0),
  );
}

export type Level = 'ok' | 'low' | 'high' | 'no' | 'wait' | 'none';

/**
 * Che colore prende un giorno. Le vie di mezzo sono due sole — fino a metà e oltre metà — e non una per numero:
 * con cinque prese al giorno quattro sfumature nessuno le distinguerebbe.
 */
export function levelOf(taken: number, tot: number): 'ok' | 'low' | 'high' | 'no' | 'none' {
  if (tot <= 0) return 'none';
  if (taken >= tot) return 'ok';
  if (taken <= 0) return 'no';
  return taken * 2 <= tot ? 'low' : 'high';
}

/** Le voci della legenda, scritte sulla terapia che si guarda (pillLegenda). */
export function legend(tot: number): { level: Level; counts: number[] }[] {
  const out: { level: Level; counts: number[] }[] = [{ level: 'ok', counts: [] }];
  const low: number[] = [];
  const high: number[] = [];
  for (let k = 1; k < tot; k++) (k * 2 <= tot ? low : high).push(k);
  if (low.length) out.push({ level: 'low', counts: low });
  if (high.length) out.push({ level: 'high', counts: high });
  out.push({ level: 'no', counts: [] }, { level: 'wait', counts: [] });
  return out;
}

export interface MonthCell {
  /** null = casella vuota prima del primo del mese */
  date: string | null;
  day: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Un mese «AAAA-MM» disposto a settimane che cominciano di lunedì. */
export function monthCells(month: string): MonthCell[] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1;
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const n = new Date(y, m + 1, 0).getDate();
  const out: MonthCell[] = [];
  for (let i = 0; i < lead; i++) out.push({ date: null, day: 0 });
  for (let d = 1; d <= n; d++) out.push({ date: `${y}-${pad(m + 1)}-${pad(d)}`, day: d });
  return out;
}

/** Il mese prima o dopo: «2026-11» + 1 → «2026-12». */
export function shiftMonth(month: string, n: number): string {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Primo e ultimo giorno di un mese «AAAA-MM». */
export function monthRange(month: string): { from: string; to: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return { from: `${month}-01`, to: `${month}-${pad(new Date(y, m, 0).getDate())}` };
}

/** «08:00»: l'ora di una data «AAAA-MM-GG HH:MM:SS». */
export const hourOf = (stamp: string | null): string => (stamp ?? '').slice(11, 16);
/** «AAAA-MM-GG»: il giorno di una data «AAAA-MM-GG HH:MM:SS». */
export const dayOf = (stamp: string | null): string => (stamp ?? '').slice(0, 10);

/** I campi del modulo di una terapia, come li tocca l'utente (il ritmo a pezzi, non come testo unico). */
export interface PlanDraft {
  name: string;
  dose: string;
  notes: string;
  color: string;
  freq: 'daily' | 'monthly' | 'interval';
  /** sette «0»/«1», da lunedì */
  weekdays: boolean[];
  monthDays: string;
  /** testo, perché si scrive con la tastiera */
  interval: string;
  times: { time: string; n: number }[];
  start: string;
  end: string;
  active: boolean;
}

export const DEFAULT_PILL_COLOR = '#B7A6D6';

export function emptyDraft(today: string): PlanDraft {
  return {
    name: '',
    dose: '',
    notes: '',
    color: DEFAULT_PILL_COLOR,
    freq: 'daily',
    weekdays: Array(7).fill(true) as boolean[],
    monthDays: '',
    interval: '1',
    times: [{ time: '08:00', n: 1 }],
    start: today,
    end: '',
    active: true,
  };
}

export function draftOf(p: PillPlan): PlanDraft {
  const mask = (p.weekdays || '1111111').padEnd(7, '1');
  return {
    name: p.name,
    dose: p.dose,
    notes: p.notes,
    color: p.color,
    freq: p.freq_type,
    weekdays: Array.from({ length: 7 }, (_, i) => mask[i] === '1'),
    monthDays: p.month_days,
    interval: String(p.interval_days || 1),
    times: parseTimes(p.times).map((s) => ({ time: s.time, n: s.n })),
    start: p.start_date,
    end: p.end_date ?? '',
    active: !!p.is_active,
  };
}

/** Dal modulo a ciò che il repo salva (i controlli veri li fa `cleanPlan`). */
export function planOf(d: PlanDraft) {
  return {
    name: d.name,
    dose: d.dose,
    notes: d.notes,
    color: d.color,
    freq_type: d.freq,
    weekdays: d.weekdays.map((x) => (x ? '1' : '0')).join(''),
    month_days: d.monthDays,
    interval_days: Math.max(1, Math.min(365, parseInt(d.interval, 10) || 1)),
    times: d.times.map((t) => `${t.time}x${t.n}`).join(','),
    start_date: d.start,
    end_date: d.end || null,
    is_active: d.active,
  };
}

/** «#abc» → «#aabbcc»: i colori che mescola l'app vogliono sei cifre, il server ne accetta anche tre. */
export function hex6(c: string): string {
  return /^#[0-9a-fA-F]{3}$/.test(c) ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c;
}
