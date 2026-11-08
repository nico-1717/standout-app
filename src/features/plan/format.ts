/** «2 h 30 min», come pn_ore() del sito. */
export function hours(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

/** Un giorno «AAAA-MM-GG» scritto nella lingua dell'app (a mezzogiorno, così il cambio d'ora non sposta il giorno). */
export function dayLabel(
  day: string,
  lang: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
): string {
  const d = new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    12,
  );
  return d.toLocaleDateString(lang, opts);
}

/** Il nome del giorno della settimana (1 = lunedì … 7 = domenica). */
export function weekdayName(dow: number, lang: string, width: 'short' | 'long' = 'long'): string {
  // il 7 gennaio 2030 è un lunedì
  return new Date(2030, 0, 6 + dow, 12).toLocaleDateString(lang, { weekday: width });
}

/** Il nome del mese di un giorno «AAAA-MM-GG». */
export function monthLabel(day: string, lang: string): string {
  return dayLabel(day, lang, { month: 'long', year: 'numeric' });
}

/** Le ore che l'utente scrive («2», «2,5», «1:30») in minuti. Ritorna null se non si capisce. */
export function parseHours(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 60);
}

/** Le ore come testo da mettere in un campo («2,5»). */
export function hoursField(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100).replace('.', ',');
}

/** Per le caselle del calendario: «45'», «2h», «1h30». */
export function shortHours(minutes: number): string {
  const m = Math.round(minutes || 0);
  if (m < 60) return `${m}'`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}
