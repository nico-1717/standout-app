/**
 * Google Calendar nelle impostazioni del planner (planner/google_calendar.php e 11_google_calendar.js del sito).
 * Il server è lo stesso del sito e accetta il token dell'app: qui solo i tipi e il modo di leggere le risposte.
 */

export type GcDedicated = 'all' | 'high' | 'highest' | 'none';
export type GcPrimary = 'none' | 'high' | 'highest';

export type GcStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  /** «2026-11-18 14:03:00», come lo scrive il server */
  lastSync: string | null;
  /** il nome del calendario dedicato, se c'è */
  calendar: string | null;
  modes: { dedicated: GcDedicated; primary: GcPrimary };
  window: { back: number; forward: number };
  build: string | null;
};

export type GcGoogleCalendar = {
  ref: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
  canWrite: boolean;
  isOurs: boolean;
  /** il mio calendario dove finiscono i suoi eventi (null = nessuno) */
  calendarId: number | null;
  /** quanti eventi sono già entrati da lì */
  entered: number;
};

export type GcMyCalendar = { id: number; name: string; color: string | null; pushRef: string };

export type GcCalendars = { google: GcGoogleCalendar[]; mine: GcMyCalendar[] };

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const oneOf = <T extends string>(v: unknown, all: readonly T[], dflt: T): T =>
  all.includes(v as T) ? (v as T) : dflt;

export function parseGcStatus(raw: unknown): GcStatus {
  const r = rec(raw);
  const modes = rec(r.modes);
  const win = rec(r.window);
  return {
    configured: r.configured === true,
    connected: r.connected === true,
    email: str(r.email),
    lastSync: str(r.last_sync),
    calendar: str(r.calendar),
    modes: {
      dedicated: oneOf(modes.dedicated, ['all', 'high', 'highest', 'none'], 'all'),
      primary: oneOf(modes.primary, ['none', 'high', 'highest'], 'none'),
    },
    window: {
      back: typeof win.back === 'number' ? win.back : 30,
      forward: typeof win.forward === 'number' ? win.forward : 180,
    },
    build: str(r.build),
  };
}

export function parseGcCalendars(raw: unknown): GcCalendars {
  const r = rec(raw);
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(rec) : []);
  return {
    google: list(r.google).map((g) => ({
      ref: String(g.ref ?? ''),
      name: str(g.name) ?? String(g.ref ?? ''),
      color: str(g.color),
      isPrimary: g.is_primary === true,
      canWrite: g.can_write === true,
      isOurs: g.is_ours === true,
      calendarId: typeof g.calendar_id === 'number' ? g.calendar_id : null,
      entered: typeof g.entrati === 'number' ? g.entrati : 0,
    })),
    mine: list(r.mine).map((m) => ({
      id: Number(m.id ?? 0),
      name: String(m.name ?? ''),
      color: str(m.color),
      pushRef: str(m.push_ref) ?? '',
    })),
  };
}
