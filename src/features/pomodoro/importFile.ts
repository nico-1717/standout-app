import type { SheetData } from '@/core/files/xlsx';
import { norm } from '@/features/habits/importFile';

/**
 * Lettura dei file di sessioni Pomodoro di altre app (.xlsx / .csv): le stesse regole di `pomodoro_import.php`.
 * Colonne: inizio (data e ora), fine, data a parte, tipo (pomodoro / cronometro), durata, titolo (sotto-progetto), lista (progetto).
 */

export type PCol = 'start' | 'end' | 'date' | 'type' | 'dur' | 'title' | 'list';
export type PCols = Record<PCol, number>;

export type ImportList = { key: string; name: string };
export type ImportTitle = { key: string; listKey: string; name: string };
export type ImportSession = {
  /** «AAAA-MM-GG HH:MM:SS» */
  start: string;
  dur: number;
  mode: 0 | 1;
  listKey: string;
  titleKey: string;
};
export type PomoWarning =
  { kind: 'no_header' } | { kind: 'date_ambiguous' } | { kind: 'rows_skipped'; n: number };
export type PomoParsed = {
  lists: ImportList[];
  titles: ImportTitle[];
  sessions: ImportSession[];
  warnings: PomoWarning[];
  pomodori: number;
  cronometri: number;
};

// L'ordine dentro ogni elenco è una scala di priorità: con «Date» e «StartTime» affiancate vince StartTime, che ha anche l'ora.
const ALIASES: Record<PCol, string[]> = {
  start: [
    'starttime',
    'startdatetime',
    'startdate',
    'start',
    'datetimestart',
    'inizio',
    'datainizio',
    'oradiinizio',
    'begin',
    'datetime',
    'when',
    'createdat',
    'date',
    'data',
  ],
  end: ['endtime', 'enddatetime', 'enddate', 'end', 'fine', 'datafine', 'finish', 'completedat'],
  date: ['data', 'date', 'giorno', 'day', 'datasessione', 'dataseduta'],
  type: ['type', 'tipo', 'kind', 'sessiontype', 'tiposessione', 'modalita', 'mode'],
  dur: [
    'duration',
    'durata',
    'durationmin',
    'durationmins',
    'durationminute',
    'durationminutes',
    'durationsec',
    'durationseconds',
    'minutes',
    'minuti',
    'mins',
    'min',
    'length',
    'lunghezza',
    'elapsed',
    'tempo',
    'time',
  ],
  title: [
    'title',
    'titolo',
    'task',
    'taskname',
    'name',
    'nome',
    'activity',
    'attivita',
    'subject',
    'item',
    'todo',
  ],
  list: [
    'list',
    'lista',
    'project',
    'progetto',
    'folder',
    'cartella',
    'group',
    'gruppo',
    'parent',
    'padre',
    'category',
    'categoria',
  ],
};
const KEYS = Object.keys(ALIASES) as PCol[];
// posizioni standard (0 = prima colonna): 2=StartTime, 3=EndTime, 4=Type, 5=Title, 6=Duration, 8=List
const POSITIONAL: Partial<PCols> = { start: 1, end: 2, type: 3, dur: 5, title: 4, list: 7 };

function detectColumns(row: string[]): { cols: PCols; matched: number } {
  const cols: PCols = { start: -1, end: -1, date: -1, type: -1, dur: -1, title: -1, list: -1 };
  const norms = row.map(norm);
  const taken = (i: number) => Object.values(cols).includes(i);
  let matched = 0;
  for (const k of KEYS) {
    for (const a of ALIASES[k]) {
      const i = norms.findIndex((n, idx) => n !== '' && !taken(idx) && n === a);
      if (i !== -1) {
        cols[k] = i;
        matched++;
        break;
      }
    }
  }
  for (const k of KEYS) {
    if (cols[k] !== -1) continue;
    for (const a of ALIASES[k]) {
      if (a.length < 3) continue;
      const i = norms.findIndex((n, idx) => n !== '' && !taken(idx) && n.startsWith(a));
      if (i !== -1) {
        cols[k] = i;
        matched++;
        break;
      }
    }
  }
  for (const k of KEYS) {
    const pos = POSITIONAL[k];
    if (cols[k] !== -1 || pos === undefined || taken(pos)) continue;
    cols[k] = pos;
  }
  return { cols, matched };
}

/** L'intestazione non è per forza la prima riga (questi export spesso iniziano con un titolo): vince la riga che riconosce più colonne. */
export function findHeader(rows: string[][]): { index: number; cols: PCols } {
  let best = -1;
  let bestScore = 0;
  let bestCols: PCols | null = null;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const { cols, matched } = detectColumns(rows[i] ?? []);
    if (matched > bestScore) {
      bestScore = matched;
      best = i;
      bestCols = cols;
    }
    if (matched >= 5) break;
  }
  if (bestScore >= 2 && bestCols) return { index: best, cols: bestCols };
  return { index: -1, cols: { date: -1, ...POSITIONAL } as PCols };
}

/* ---- date e ore come testo «AAAA-MM-GG HH:MM:SS» (senza fuso: sono ore del muro) ---- */

const pad = (n: number): string => String(n).padStart(2, '0');
const validDay = (y: number, m: number, d: number): boolean => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const stampOf = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};
const msOf = (s: string): number =>
  Date.UTC(
    +s.slice(0, 4),
    +s.slice(5, 7) - 1,
    +s.slice(8, 10),
    +s.slice(11, 13),
    +s.slice(14, 16),
    +s.slice(17, 19),
  );

export function detectDateOrder(samples: string[]): 'dmy' | 'mdy' | 'ymd' | null {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const s of samples) {
    const m = /^\s*(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})/.exec(s);
    if (!m) continue;
    if (m[1]!.length === 4) return 'ymd';
    if (Number(m[1]) > 12) firstOver12 = true;
    if (Number(m[2]) > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return 'dmy';
  if (secondOver12 && !firstOver12) return 'mdy';
  return null;
}

/** Data e ora da una cella: numero di Excel, ISO, GG/MM/AAAA o MM/GG/AAAA con ora (anche am/pm), o testo libero. */
export function parseDateTime(cell: string, order: 'dmy' | 'mdy' | 'ymd' | null): string | null {
  const s = cell.trim();
  if (s === '') return null;
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 90000) {
    return stampOf(Date.UTC(1899, 11, 30) + Math.round(Number(s) * 86400) * 1000);
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ]?(\d{1,2})?:?(\d{2})?:?(\d{2})?/.exec(s);
  if (m) {
    if (!validDay(+m[1]!, +m[2]!, +m[3]!)) return null;
    return `${m[1]}-${pad(+m[2]!)}-${pad(+m[3]!)} ${pad(+(m[4] ?? 0))}:${pad(+(m[5] ?? 0))}:${pad(+(m[6] ?? 0))}`;
  }
  m = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})[T ]*(\d{1,2})?:?(\d{2})?:?(\d{2})?\s*(am|pm)?/i.exec(
    s,
  );
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    let y: number;
    let mo: number;
    let d: number;
    if (m[1]!.length === 4) {
      y = a;
      mo = b;
      d = c;
    } else {
      y = c < 100 ? 2000 + c : c;
      let use = order;
      if (use === null || use === 'ymd') use = a > 12 ? 'dmy' : b > 12 ? 'mdy' : 'dmy';
      if (use === 'mdy') {
        mo = a;
        d = b;
      } else {
        d = a;
        mo = b;
      }
    }
    let h = Number(m[4] ?? 0);
    const ap = (m[7] ?? '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (!validDay(y, mo, d) || h > 23) return null;
    return `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(+(m[5] ?? 0))}:${pad(+(m[6] ?? 0))}`;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return stampOf(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
    ),
  );
}

/** Secondi dalla mezzanotte se la cella contiene SOLO un'ora, altrimenti null. */
export function parseTimeOnly(cell: string): number | null {
  const s = cell.trim();
  const m = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\s*(am|pm)?$/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = (m[4] ?? '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23) return null;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
}

/** «2026-08-18 00:00:00» + 38280 secondi → «2026-08-18 10:38:00». */
const joinDayTime = (day: string, secs: number): string =>
  `${day.slice(0, 10)} ${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`;

/**
 * Durata in SECONDI: «25», «25 min», «1:30:00», «1h 30m», «90s». Il numero nudo è in minuti, a meno che l'intestazione
 * dica secondi (o ore). `twoPart`: «50:00» vale minuti:secondi ('ms') oppure ore:minuti ('hm').
 */
export function parseDuration(
  cell: string,
  headerNorm: string,
  twoPart: 'ms' | 'hm' = 'ms',
): number {
  let s = cell.trim();
  if (s === '') return 0;
  s = s.replace(',', '.');
  if (s.includes(':')) {
    const p = s.split(':').map((x) => parseFloat(x) || 0);
    if (p.length === 3) return Math.round(p[0]! * 3600 + p[1]! * 60 + p[2]!);
    if (p.length === 2)
      return twoPart === 'hm'
        ? Math.round(p[0]! * 3600 + p[1]! * 60)
        : Math.round(p[0]! * 60 + p[1]!);
  }
  if (/[hms]/i.test(s) && !Number.isFinite(Number(s))) {
    let sec = 0;
    let found = false;
    let m = /([\d.]+)\s*h/i.exec(s);
    if (m) {
      sec += parseFloat(m[1]!) * 3600;
      found = true;
    }
    m = /([\d.]+)\s*m(?!s)/i.exec(s);
    if (m) {
      sec += parseFloat(m[1]!) * 60;
      found = true;
    }
    m = /([\d.]+)\s*s/i.exec(s);
    if (m) {
      sec += parseFloat(m[1]!);
      found = true;
    }
    if (found) return Math.round(sec);
  }
  const m = /-?[\d.]+/.exec(s);
  if (m) {
    const n = parseFloat(m[0]);
    if (headerNorm.includes('sec')) return Math.round(n);
    if (headerNorm.includes('hour') || headerNorm.includes('ore')) return Math.round(n * 3600);
    return Math.round(n * 60);
  }
  return 0;
}

/** «50:00» sono cinquanta minuti o cinquanta ore? Con l'ora di fine il dubbio si toglie: vince la lettura che combacia con inizio-fine. */
function detectDurUnit(
  rows: string[][],
  cols: PCols,
  order: 'dmy' | 'mdy' | 'ymd' | null,
): 'ms' | 'hm' {
  if (cols.dur < 0 || cols.end < 0 || cols.start < 0) return 'ms';
  let ms = 0;
  let hm = 0;
  let seen = 0;
  for (const r of rows) {
    if (seen >= 300) break;
    const s = (r[cols.dur] ?? '').trim();
    if (s.split(':').length !== 2) continue;
    const [a, b] = s.split(':');
    if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) continue;
    const st = parseDateTime(r[cols.start] ?? '', order);
    const en = parseDateTime(r[cols.end] ?? '', order);
    if (!st || !en) continue;
    const span = (msOf(en) - msOf(st)) / 1000;
    if (span <= 0) continue;
    seen++;
    const tol = Math.max(60, span * 0.1);
    if (Math.abs(Number(a) * 60 + Number(b) - span) <= tol) ms++;
    if (Math.abs(Number(a) * 3600 + Number(b) * 60 - span) <= tol) hm++;
  }
  return hm > 0 && hm > ms * 2 ? 'hm' : 'ms';
}

/** 1 = cronometro, 0 = pomodoro/timer. */
export function parseMode(raw: string): 0 | 1 {
  const n = norm(raw);
  return ['stopwatch', 'cronometro', 'crono', 'chrono', 'countup', 'freetimer', 'manual'].some(
    (k) => n.includes(k),
  )
    ? 1
    : 0;
}

const cleanName = (v: string): string => {
  const s = v.trim();
  return s === '/' || s === '\\' ? '' : s;
};

/** Il primo foglio di un file → liste, titoli e sessioni da importare. Torna null se non c'è nessuna sessione valida. */
export function parsePomodoroRows(allRows: string[][], choice?: Partial<PCols>): PomoParsed | null {
  const { index: headerAt, cols: auto } = findHeader(allRows);
  const cols: PCols = { ...auto, ...choice };
  const header = headerAt >= 0 ? (allRows[headerAt] ?? []) : [];
  const durHeader = cols.dur >= 0 && header[cols.dur] !== undefined ? norm(header[cols.dur]!) : '';
  const rows = allRows.slice(headerAt + 1).filter((r) => r.some((c) => c.trim() !== ''));

  // il formato data si decide guardando tutta la colonna (quella della data a parte, se c'è)
  const dateCol = cols.date >= 0 ? cols.date : cols.start;
  const samples = rows.map((r) => r[dateCol] ?? '').filter((s) => s !== '');
  let order = detectDateOrder(samples);
  const ambiguous =
    order === null && samples.some((s) => /^\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(s));
  if (order === null) order = 'dmy';
  const unit = detectDurUnit(rows, cols, order);

  const lists = new Map<string, string>();
  const titles = new Map<string, string>();
  const out: PomoParsed = {
    lists: [],
    titles: [],
    sessions: [],
    warnings: [],
    pomodori: 0,
    cronometri: 0,
  };
  let skipped = 0;
  const get = (r: string[], k: PCol): string => (cols[k] >= 0 ? (r[cols[k]] ?? '') : '');

  for (const r of rows) {
    let start = parseDateTime(get(r, 'start'), order);
    let day: string | null = null;
    if (cols.date >= 0) {
      day = parseDateTime(get(r, 'date'), order);
      const at = parseTimeOnly(get(r, 'start'));
      if (day !== null && at !== null) start = joinDayTime(day, at);
    }
    if (start === null) {
      skipped++;
      continue;
    }
    let dur = parseDuration(get(r, 'dur'), durHeader, unit);
    if (dur <= 0 && cols.end >= 0) {
      let end: string | null = null;
      const endAt = day !== null ? parseTimeOnly(get(r, 'end')) : null;
      if (endAt !== null && day !== null) {
        end = joinDayTime(day, endAt);
        // 23:30 → 00:10 è una sessione a cavallo della mezzanotte: la fine sta sul giorno dopo
        if (msOf(end) <= msOf(start)) end = stampOf(msOf(end) + 86_400_000);
      } else end = parseDateTime(get(r, 'end'), order);
      if (end !== null) dur = Math.max(0, (msOf(end) - msOf(start)) / 1000);
    }
    if (dur <= 0) {
      skipped++;
      continue;
    }
    const mode = parseMode(get(r, 'type'));
    if (mode === 1) out.cronometri++;
    else out.pomodori++;

    const listName = cleanName(get(r, 'list'));
    const titleName = cleanName(get(r, 'title'));
    let listKey = '';
    if (listName !== '') {
      let k = lists.get(listName);
      if (!k) {
        k = `L${lists.size}`;
        lists.set(listName, k);
        out.lists.push({ key: k, name: listName });
      }
      listKey = k;
    }
    let titleKey = '';
    if (titleName !== '') {
      const tk = `${listKey}|${titleName}`;
      let k = titles.get(tk);
      if (!k) {
        k = `T${titles.size}`;
        titles.set(tk, k);
        out.titles.push({ key: k, listKey, name: titleName });
      }
      titleKey = k;
    }
    out.sessions.push({ start, dur, mode, listKey, titleKey });
  }
  if (out.sessions.length === 0) return null;
  out.sessions.sort((a, b) => a.start.localeCompare(b.start));
  if (headerAt < 0) out.warnings.push({ kind: 'no_header' });
  if (ambiguous) out.warnings.push({ kind: 'date_ambiguous' });
  if (skipped > 0) out.warnings.push({ kind: 'rows_skipped', n: skipped });
  return out;
}

/** Un file scelto → le sue sessioni. Come il sito legge solo il primo foglio. Lancia come `readImportFile` degli esercizi. */
export function parsePomodoroSheets(
  sheets: SheetData[],
  choice?: Partial<PCols>,
): PomoParsed | null {
  const first = sheets[0];
  return first ? parsePomodoroRows(first.rows, choice) : null;
}

/** Le colonne del primo foglio come le ha capite l'app, con le scelte dell'utente sopra, e dove sta l'intestazione. */
export function pomodoroColumns(
  sheet: SheetData,
  choice?: Partial<PCols>,
): { headerAt: number; cols: PCols } {
  const { index: headerAt, cols: auto } = findHeader(sheet.rows);
  return { headerAt, cols: { ...auto, ...choice } };
}
