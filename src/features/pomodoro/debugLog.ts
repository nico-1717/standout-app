import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/**
 * Il registro dei passi del Pomodoro, per capire dove si ferma quando l'app si chiude da sola. Ogni riga è scritta subito
 * nel database (sincrono): se l'app muore, alla prossima apertura l'ultima riga dice l'ultima cosa fatta.
 */
const KEY = 'debug_pomodoro_log';
const FLAGS_KEY = 'debug_pomodoro_flags';
const MAX = 80;

let db: SqlDb | null = null;
let lines: string[] = [];
let pending: string[] = [];

const p2 = (n: number, w = 2) => String(n).padStart(w, '0');
const hhmmss = (d: Date) =>
  `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p2(d.getMilliseconds(), 3)}`;

function save() {
  if (!db) return;
  try {
    setState(db, KEY, JSON.stringify(lines));
  } catch {
    /* il registro è un di più */
  }
}

/** Collega il registro al database e recupera quello delle aperture precedenti. */
export function attachLog(d: SqlDb): void {
  if (db === d) return;
  db = d;
  try {
    lines = JSON.parse(getState(d, KEY) ?? '[]') as string[];
    if (!Array.isArray(lines)) lines = [];
  } catch {
    lines = [];
  }
  if (pending.length) {
    lines = [...lines, ...pending].slice(-MAX);
    pending = [];
    save();
  }
}

export function logStep(msg: string): void {
  const line = `${hhmmss(new Date())} ${msg}`;
  if (!db) {
    pending = [...pending, line].slice(-MAX);
    return;
  }
  lines = [...lines, line].slice(-MAX);
  save();
}

let lastChange = '';
/** Scrive solo se il testo è diverso dall'ultima volta (la pagina si ridisegna quattro volte al secondo). */
export function logChange(msg: string): void {
  if (msg === lastChange) return;
  lastChange = msg;
  logStep(msg);
}

export function readLog(): string[] {
  return [...lines, ...pending];
}

export function clearLog(): void {
  lines = [];
  pending = [];
  save();
}

/** Interruttori per provare, sul telefono, cosa fa chiudere la pagina. */
export interface DebugFlags {
  /** non disegna la scena della pausa */
  noScene: boolean;
  /** niente bagliore e scintille attorno al quadrante */
  noFx: boolean;
}
export const NO_FLAGS: DebugFlags = { noScene: false, noFx: false };

export function readFlags(d: SqlDb): DebugFlags {
  try {
    const raw = JSON.parse(getState(d, FLAGS_KEY) ?? '{}') as Partial<DebugFlags>;
    return { noScene: raw.noScene === true, noFx: raw.noFx === true };
  } catch {
    return NO_FLAGS;
  }
}
export function writeFlags(d: SqlDb, f: DebugFlags): void {
  setState(d, FLAGS_KEY, JSON.stringify(f));
}

/** Gli errori JS che nessuno ha preso finiscono nel registro (poi si richiama il gestore di prima). */
let installed = false;
export function installCrashLog(): void {
  if (installed) return;
  installed = true;
  try {
    const eu = (
      globalThis as unknown as {
        ErrorUtils?: {
          getGlobalHandler(): (e: unknown, fatal?: boolean) => void;
          setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void;
        };
      }
    ).ErrorUtils;
    if (!eu) return;
    const prev = eu.getGlobalHandler();
    eu.setGlobalHandler((e, fatal) => {
      const err = e as { message?: string; stack?: string } | undefined;
      logStep(`JS ERROR${fatal ? ' (fatal)' : ''}: ${err?.message ?? String(e)}`);
      logStep(
        String(err?.stack ?? '')
          .split('\n')
          .slice(0, 4)
          .join(' | '),
      );
      prev(e, fatal);
    });
  } catch {
    /* niente */
  }
}

export interface ReportInput {
  now: Date;
  update: Record<string, unknown>;
  settings: unknown;
  active: unknown;
  done: unknown;
  notice: unknown;
  flags: DebugFlags;
  log: string[];
  extra?: Record<string, unknown>;
}

/** Il testo da mandare a Claude: tutto ciò che serve a capire lo stato della pagina. */
export function buildReport(i: ReportInput): string {
  const tz = -i.now.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const j = (v: unknown) => JSON.stringify(v, null, 1);
  return [
    '== STANDOUT POMODORO REPORT ==',
    `now: ${i.now.toISOString()} (UTC${sign}${Math.floor(Math.abs(tz) / 60)}:${p2(Math.abs(tz) % 60)})`,
    `update: ${j(i.update)}`,
    `flags: ${j(i.flags)}`,
    `settings: ${j(i.settings)}`,
    `active session: ${j(i.active)}`,
    `last completed: ${j(i.done)}`,
    `abandoned notice: ${j(i.notice)}`,
    ...(i.extra ? [`extra: ${j(i.extra)}`] : []),
    `-- last steps (oldest first, newest last) --`,
    ...(i.log.length ? i.log : ['(empty)']),
  ].join('\n');
}
