/**
 * Quello che si scrive nel campo della durata, in minuti: «45», «1:30», «1h30», «1h», «90m», «1h 30m».
 * Zero (un testo che non si capisce) = niente da fare, la durata resta com'era. Mai più di un giorno.
 * Stesse regole di `parseDurata` del sito (09_popup_evento.js).
 */
export function parseDuration(txt: string): number {
  const t = txt.trim().toLowerCase().replace(/\s+/g, '');
  let m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return Math.min(1439, Number(m[1]) * 60 + Number(m[2]));
  m = /^(\d+)h(?:(\d{1,2})m?(?:in)?)?$/.exec(t);
  if (m) return Math.min(1439, Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
  m = /^(\d+)m(?:in)?$/.exec(t) ?? /^(\d+)$/.exec(t);
  return m ? Math.min(1439, Number(m[1])) : 0;
}

/** Quanti minuti prima avvisare, per ognuna delle scelte dell'avviso predefinito. */
export const NOTIFY_MINUTES = { none: 0, at_time: 0, m30: 30, h1: 60, d1: 1440 } as const;
