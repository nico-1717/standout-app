/** Il tempo del Pomodoro, senza database. Stesse regole di pomodoro.php / pomodoro_stato.php / pomodoro_core.js. */

/** Il tetto di una sessione: dieci ore. Oltre è una pagina rimasta aperta, non una sessione di studio. */
export const POMO_LIMIT_SECONDS = 36000;

export type SessionStatus =
  'pausa' | 'completato' | 'interrotto' | 'abbandonato' | 'archiviato' | null;

export interface Session {
  uuid: string;
  /** 0 = pomodoro (a tempo), 1 = cronometro */
  mode: number;
  start_time: string;
  end_time: string | null;
  status: SessionStatus;
  resume_time: string | null;
  duration_seconds: number;
  planned_duration_min: number | null;
  project_uuid: string | null;
  /** 0 = misurata dal timer, 1 = scritta a mano, 2 = chiusa d'ufficio */
  is_manual: number;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** «AAAA-MM-GG HH:MM:SS» ora locale (come la scrive il sito). */
export function stamp(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/** Da «AAAA-MM-GG HH:MM:SS» (ora locale) a millisecondi. */
export function stampMs(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return NaN;
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!).getTime();
}

/** I secondi di lavoro vero di una sessione aperta: quelli già accumulati + il segmento che sta correndo. */
export function elapsedSeconds(s: Session, nowMs: number): number {
  const acc = s.duration_seconds ?? 0;
  if (s.end_time !== null || s.status === 'pausa') return acc;
  const from = stampMs(s.resume_time ?? s.start_time);
  return acc + (Number.isFinite(from) ? Math.max(0, Math.floor((nowMs - from) / 1000)) : 0);
}

/** Quanto manca alla fine (solo per il Pomodoro a tempo). Negativo = scaduto. */
export function remainingSeconds(s: Session, nowMs: number): number | null {
  if (s.mode !== 0 || s.planned_duration_min === null) return null;
  return s.planned_duration_min * 60 - elapsedSeconds(s, nowMs);
}

/** «25:00» o «1:05:00». */
export function clock(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
}

/** «1 h 05 min» / «25 min» / «40 s». */
export function human(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  if (h > 0) return m ? `${h} h ${p2(m)} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${t} s`;
}

/**
 * Come si chiude d'ufficio una sessione rimasta aperta oltre il tetto (pomo_leggi_stato): la durata è la più piccola fra il tempo
 * davvero trascorso e quello previsto («un pomodoro da 50 minuti dimenticato per tre giorni vale 50 minuti»); in pausa il
 * segmento non scorre. Ritorna null se la sessione non è da chiudere.
 */
export function abandonedPatch(
  s: Session,
  nowMs: number,
): {
  duration_seconds: number;
  end_time: string;
  status: 'abbandonato';
  resume_time: null;
  is_manual: 2;
} | null {
  if (s.end_time !== null) return null;
  const start = stampMs(s.start_time);
  if (!Number.isFinite(start) || (nowMs - start) / 1000 <= POMO_LIMIT_SECONDS) return null;
  const acc = s.duration_seconds ?? 0;
  const seg =
    s.status === 'pausa'
      ? 0
      : Math.max(0, Math.floor((nowMs - stampMs(s.resume_time ?? s.start_time)) / 1000));
  const cap = s.planned_duration_min !== null ? s.planned_duration_min * 60 : POMO_LIMIT_SECONDS;
  const duration = Math.min(acc + seg, cap);
  return {
    duration_seconds: duration,
    end_time: stamp(new Date(start + duration * 1000)),
    status: 'abbandonato',
    resume_time: null,
    is_manual: 2,
  };
}

/** Le durate che ci sono sempre; quelle salvate dall'utente si aggiungono (pomodoro.php). */
export const PRESETS_DEFAULT = {
  pomodoro: [25, 50],
  pausa: [5, 10],
} as const;
