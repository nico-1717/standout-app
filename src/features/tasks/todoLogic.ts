import { addDaysIso } from './groups';
import type { Task } from './repo';

/** Le parole fisse del sito, passate da fuori così queste funzioni si provano senza i18n. */
export interface DayWords {
  today: string;
  tomorrow: string;
  yesterday: string;
}

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Il giorno detto come lo direbbe una persona (giornoUmano di todo_barra.js): Oggi, Domani, Martedì, 3 nov. */
export function humanDay(iso: string, today: string, locale: string, w: DayWords): string {
  if (!iso) return '';
  const diff = Math.round((toDate(iso).getTime() - toDate(today).getTime()) / 86400000);
  if (diff === 0) return w.today;
  if (diff === 1) return w.tomorrow;
  if (diff === -1) return w.yesterday;
  const d = toDate(iso);
  if (diff > 1 && diff < 7)
    return cap(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
}

/** Il prossimo sabato (se oggi è sabato, quello dopo): la scorciatoia «Weekend» del sito. */
export function nextSaturday(today: string): string {
  const dow = (toDate(today).getDay() + 6) % 7; // 0 = lunedì
  return addDaysIso(today, (5 - dow + 7) % 7 || 7);
}

export interface QuickDate {
  key: 'oggi' | 'domani' | 'weekend' | 'settimana' | 'senza';
  /** la data, o '' per «Senza data» */
  date: string;
}

/** Le cinque scorciatoie per la data, nell'ordine del sito. */
export function quickDates(today: string): QuickDate[] {
  return [
    { key: 'oggi', date: today },
    { key: 'domani', date: addDaysIso(today, 1) },
    { key: 'weekend', date: nextSaturday(today) },
    { key: 'settimana', date: addDaysIso(today, 7) },
    { key: 'senza', date: '' },
  ];
}

/** La frase sola di una riga a riposo: «Domani · 15:00 · 45 min» (la durata solo se non è quella di sempre, 30). */
export function metaLine(
  t: Pick<Task, 'due_date' | 'due_time' | 'duration_minutes'>,
  today: string,
  locale: string,
  w: DayWords,
): string {
  const parts: string[] = [];
  if (t.due_date) parts.push(humanDay(t.due_date, today, locale, w));
  if (t.due_time) {
    const m = t.duration_minutes;
    parts.push(t.due_time.slice(0, 5) + (m && m !== 30 ? ` · ${m} min` : ''));
  }
  return parts.join(' · ');
}

/** I pezzi che la barra ha «capito» mentre si scrive (disegna() di todo_barra.js). */
export interface UnderstoodPiece {
  kind: 'date' | 'time' | 'minutes' | 'nessuno';
  text: string;
}

/** La durata scritta dall'utente: un intero fra 1 e 1440, altrimenti quella di sempre (30). */
export function cleanMinutes(raw: string | number): number {
  const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(1440, Math.round(n));
}

/** «HH:MM» valido (o vuoto) dal testo di un campo ora; altrimenti null. */
export function cleanTime(raw: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = +m[1]!;
  const mi = +m[2]!;
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
