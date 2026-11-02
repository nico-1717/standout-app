import { addDaysIso } from './model';

/** 1 = lunedì … 7 = domenica (come gg_1…gg_7 dei testi). */
export function weekdayOf(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export const mondayOf = (iso: string) => addDaysIso(iso, 1 - weekdayOf(iso));
export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
export const monthOf = (iso: string) => Number(iso.slice(5, 7));
export const yearOf = (iso: string) => Number(iso.slice(0, 4));

/** Primo giorno del mese e quanti giorni ha. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
export function daysInMonth(iso: string): number {
  return new Date(Date.UTC(yearOf(iso), monthOf(iso), 0)).getUTCDate();
}
export function addMonths(iso: string, n: number): string {
  const total = yearOf(iso) * 12 + (monthOf(iso) - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const day = Math.min(dayOfMonth(iso), new Date(Date.UTC(y, m, 0)).getUTCDate());
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export { addDaysIso };
