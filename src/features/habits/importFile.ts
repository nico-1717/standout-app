import type { SheetData } from '@/core/files/xlsx';

/**
 * Lettura dei file di check-in di altre app (.xlsx e .csv): le stesse regole di `habits_import.php`
 * del sito. Un foglio con la colonna «Habit» può contenere molte abitudini; senza, ogni foglio è una
 * sola abitudine e il suo nome (o «Habit Name: …» nella prima cella) diventa il titolo.
 */

export type ColKey = 'habit' | 'date' | 'time' | 'status' | 'count' | 'mood' | 'note';
export type Cols = Record<ColKey, number>;

export type ImportHabit = { key: string; name: string };
export type ImportLog = {
  habitKey: string;
  /** «AAAA-MM-GG» */
  date: string;
  /** «HH:MM:SS» o null se il file non dice l'ora */
  time: string | null;
  count: number;
  mood: string;
  note: string;
};
export type ImportWarning =
  | { kind: 'no_header'; sheet: string }
  | { kind: 'date_ambiguous'; sheet: string }
  | { kind: 'sheets_skipped'; n: number; names: string }
  | { kind: 'rows_skipped'; n: number };
export type ImportParsed = {
  habits: ImportHabit[];
  logs: ImportLog[];
  warnings: ImportWarning[];
};

const ALIASES: Record<ColKey, string[]> = {
  // «habit» per primo: se una colonna dice a quale abitudine appartiene la riga, il foglio ne contiene molte
  habit: [
    'habit',
    'habitname',
    'abitudine',
    'nome',
    'name',
    'task',
    'attivita',
    'activity',
    'title',
    'titolo',
    'tracker',
  ],
  date: ['date', 'data', 'giorno', 'giornata', 'day'],
  time: ['time', 'ora', 'orario'],
  status: ['status', 'stato'],
  count: [
    'totalcheckins',
    'checkins',
    'checkin',
    'count',
    'completions',
    'completamenti',
    'times',
    'volte',
    'quantity',
    'quantita',
    'amount',
    'valore',
    'reps',
  ],
  mood: ['mood', 'umore'],
  note: ['habitlog', 'note', 'nota', 'notes', 'commento', 'comment', 'log', 'appunti'],
};
const KEYS = Object.keys(ALIASES) as ColKey[];
// Date, Time, Status, Total check-ins, Mood, Habit Log: l'ordine del nostro export e di TickTick
const POSITIONAL: Partial<Cols> = { date: 0, time: 1, status: 2, count: 3, mood: 4, note: 5 };

const ACCENTS: Record<string, string> = {
  à: 'a',
  á: 'a',
  è: 'e',
  é: 'e',
  ì: 'i',
  í: 'i',
  ò: 'o',
  ó: 'o',
  ù: 'u',
  ú: 'u',
};
export const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[àáèéìíòóùú]/g, (c) => ACCENTS[c] ?? c)
    .replace(/[^a-z0-9]+/g, '');

const pad = (n: number): string => String(n).padStart(2, '0');
const isEmptyRow = (r: string[]): boolean => r.every((c) => c.trim() === '');
const cleanName = (v: string): string => {
  const s = v.trim();
  return s === '/' || s === '\\' || s.toLowerCase() === 'null' ? '' : s;
};

/** Le colonne riconosciute in una riga (come `hi_detect_columns`) e quante per nome. */
function detectColumns(row: string[]): { cols: Cols; matched: number } {
  const cols: Cols = { habit: -1, date: -1, time: -1, status: -1, count: -1, mood: -1, note: -1 };
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

/** La riga d'intestazione fra le prime 20 (-1 = nessuna: si usano le posizioni standard). */
export function findHeader(rows: string[][]): { index: number; cols: Cols } {
  let best = -1;
  let bestScore = 0;
  let bestCols: Cols | null = null;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const { cols, matched } = detectColumns(rows[i] ?? []);
    if (matched > bestScore) {
      bestScore = matched;
      best = i;
      bestCols = cols;
    }
    if (matched >= 4) break;
  }
  if (bestScore >= 2 && bestCols) return { index: best, cols: bestCols };
  return { index: -1, cols: { habit: -1, mood: -1, ...POSITIONAL } as Cols };
}

/** «Habit Name: …» nelle prime righe (il nome del foglio è tagliato a 31 caratteri, questo è intero). */
export function habitNameIn(rows: string[][]): string | null {
  for (const row of rows.slice(0, 6))
    for (const text of row) {
      const m = /habit\s*name\s*:\s*([^\r\n]+)/i.exec(text);
      if (m && m[1]!.trim() !== '') return m[1]!.trim().slice(0, 120);
    }
  return null;
}

/** 'dmy' / 'mdy' se un giorno oltre 12 lo rivela, 'ymd' se l'anno è per primo, null se non si capisce. */
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

const validDay = (y: number, m: number, d: number): boolean => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const isoDay = (y: number, m: number, d: number): string =>
  `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;

/** Un giorno da una cella: numero di Excel, AAAA-MM-GG, GG/MM/AAAA o MM/GG/AAAA (secondo `order`). */
export function parseDate(cell: string, order: 'dmy' | 'mdy' | 'ymd' | null): string | null {
  const s = cell.trim();
  if (s === '') return null;
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 90000) {
    const d = new Date(Date.UTC(1899, 11, 30 + Math.floor(Number(s))));
    return isoDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return validDay(+m[1]!, +m[2]!, +m[3]!) ? isoDay(+m[1]!, +m[2]!, +m[3]!) : null;
  m = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
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
    return validDay(y, mo, d) ? isoDay(y, mo, d) : null;
  }
  return null;
}

/** Un'ora da una cella: «HH:MM», «HH:MM:SS», con am/pm, o dopo una data («2026-11-01 09:30»). */
export function parseTime(cell: string): string | null {
  let s = cell.trim();
  if (s === '') return null;
  s = s.replace(/^\d{4}-\d{2}-\d{2}[ T]/, '');
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const se = m[3] ? Number(m[3]) : 0;
  const ap = (m[4] ?? '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59 || se > 59) return null;
  return `${pad(h)}:${pad(mi)}:${pad(se)}`;
}

/** Il foglio dovrebbe avere solo i giorni fatti: si scarta una riga solo se lo stato dice il contrario. */
export function statusExcluded(raw: string): boolean {
  const n = norm(raw);
  return ['skip', 'salt', 'miss', 'fail', 'fallit', 'annullat', 'cancel'].some((k) =>
    n.includes(k),
  );
}

/** Le colonne scelte a mano per ciascun foglio (per numero): -1 = nessuna colonna per quel campo. */
export type ColumnChoice = Record<number, Partial<Cols>>;

/** Le colonne di un foglio come le ha capite l'app, con le scelte dell'utente sopra, e dove sta l'intestazione. */
export function sheetColumns(
  sheet: SheetData,
  choice?: Partial<Cols>,
): { headerAt: number; auto: Cols; cols: Cols } {
  const { index: headerAt, cols: auto } = findHeader(sheet.rows);
  return { headerAt, auto, cols: { ...auto, ...choice } };
}

/** Tutti i fogli di un file → abitudini e check-in da importare. */
export function parseHabitSheets(
  sheets: SheetData[],
  fallbackName = 'Habit',
  choice?: ColumnChoice,
): ImportParsed {
  const habits: ImportHabit[] = [];
  const logs: ImportLog[] = [];
  const warnings: ImportWarning[] = [];
  const byName = new Map<string, string>();
  const skippedSheets: string[] = [];
  let skippedRows = 0;

  for (const [sheetAt, sheet] of sheets.entries()) {
    const { headerAt, cols } = sheetColumns(sheet, choice?.[sheetAt]);
    const dataRows = sheet.rows.slice(headerAt + 1).filter((r) => !isEmptyRow(r));
    if (dataRows.length === 0) {
      skippedSheets.push(sheet.name);
      continue;
    }
    const habitName = habitNameIn(sheet.rows) ?? (sheet.name.trim() || fallbackName);
    const cell = (r: string[], k: ColKey): string => (cols[k] >= 0 ? (r[cols[k]] ?? '') : '');

    const samples = dataRows.map((r) => cell(r, 'date')).filter((s) => s !== '');
    let order = detectDateOrder(samples);
    const ambiguous =
      order === null && samples.some((s) => /^\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(s));
    if (order === null) order = 'dmy';

    const sheetLogs: ImportLog[] = [];
    let skipped = 0;
    for (const r of dataRows) {
      const dateCell = cell(r, 'date');
      const date = parseDate(dateCell, order);
      if (date === null) {
        skipped++;
        continue;
      }
      if (statusExcluded(cell(r, 'status').trim())) {
        skipped++;
        continue;
      }
      let rowName = habitName;
      if (cols.habit >= 0) {
        rowName = cleanName(cell(r, 'habit'));
        if (rowName === '') {
          skipped++;
          continue;
        }
      }
      let key = byName.get(rowName);
      if (!key) {
        key = `H${habits.length}`;
        byName.set(rowName, key);
        habits.push({ key, name: rowName });
      }
      const countRaw = cell(r, 'count').trim();
      const n = countRaw !== '' && Number.isFinite(Number(countRaw)) ? Number(countRaw) : 1;
      sheetLogs.push({
        habitKey: key,
        date,
        time: parseTime(cell(r, 'time')) ?? parseTime(dateCell),
        count: n > 0 ? n : 1,
        mood: cleanName(cell(r, 'mood')),
        note: cleanName(cell(r, 'note')),
      });
    }
    if (sheetLogs.length === 0) {
      skippedSheets.push(habitName);
      continue;
    }
    sheetLogs.sort((a, b) =>
      `${a.date} ${a.time ?? '00:00:00'}`.localeCompare(`${b.date} ${b.time ?? '00:00:00'}`),
    );
    logs.push(...sheetLogs);
    skippedRows += skipped;
    if (headerAt < 0) warnings.push({ kind: 'no_header', sheet: habitName });
    if (ambiguous) warnings.push({ kind: 'date_ambiguous', sheet: habitName });
  }

  if (skippedSheets.length)
    warnings.push({
      kind: 'sheets_skipped',
      n: skippedSheets.length,
      names: skippedSheets.slice(0, 5).join(', ') + (skippedSheets.length > 5 ? '…' : ''),
    });
  if (skippedRows) warnings.push({ kind: 'rows_skipped', n: skippedRows });
  return { habits, logs, warnings };
}

/** Un .csv come un foglio solo: separatore scelto fra «,» «;» tab, virgolette doppie, BOM tolto. */
export function parseCsv(text: string, name: string): SheetData {
  const raw = text.replace(/^﻿/, '');
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let seen = 0;
  for (const line of raw.split(/\r\n|\n|\r/)) {
    if (line.trim() === '') continue;
    for (const d of Object.keys(counts)) counts[d]! += line.split(d).length - 1;
    if (++seen >= 6) break;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const delim = best && best[1] > 0 ? best[0] : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field.trim());
    field = '';
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (quoted) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delim) {
      row.push(field.trim());
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  if (field !== '' || row.length) endRow();
  return { name, rows };
}

/** Il testo di un file .csv: UTF-8, se non lo è Windows-1252 (Excel italiano). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
}

const baseName = (file: string): string =>
  file
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .trim();

/** Un file scelto dall'utente (.xlsx o .csv) → i suoi fogli. Lancia 'xls_vecchio', 'xlsx_non_valido' o 'file_vuoto'. */
export function readImportFile(
  fileName: string,
  bytes: Uint8Array,
  readXlsx: (b: Uint8Array) => SheetData[],
): SheetData[] {
  if (bytes.length === 0) throw new Error('file_vuoto');
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xls')) throw new Error('xls_vecchio');
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || isZip) {
    try {
      return readXlsx(bytes);
    } catch {
      throw new Error('xlsx_non_valido');
    }
  }
  return [parseCsv(decodeText(bytes), baseName(fileName))];
}
