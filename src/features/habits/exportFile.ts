import type { SqlDb } from '@/core/db/sqldb';
import { zipStore, type ZipEntry } from '@/core/files/zipStore';

import type { Habit } from './logic';

/** Il file che l'app scrive per «Esporta»: lo stesso del sito (habits_import.php): un foglio per abitudine, solo i giorni fatti. */
const HEADERS = ['Date', 'Time', 'Status', 'Total check-ins', 'Mood', 'Habit Log'];

export type Sheet = {
  name: string;
  title: string;
  range: string;
  rows: string[][];
};

const num = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

function goalText(h: Habit): string {
  if (h.goal_type === 'quantity') return `${num(h.target_amount)} ${h.unit.trim() || 'Units'}/day`;
  return '1 Count/day';
}

function freqText(h: Habit): string {
  switch (h.frequency_type) {
    case 'weekly':
      return `every week ${h.times_per_week} days`;
    case 'monthly':
      return `every month ${h.times_per_month} days`;
    case 'interval':
      return `every ${h.interval_days} days`;
    default: {
      if (h.weekdays === '1111111') return 'every day';
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const on = names.filter((_, i) => h.weekdays[i] === '1');
      return on.length ? `every week on ${on.join(', ')}` : 'every day';
    }
  }
}

/** La prima cella del foglio (anche il sito la legge per il nome intero dell'abitudine). */
export function basicInfo(h: Habit, section: string): string {
  return [
    'Basic Information',
    `Habit Name: ${h.name}`,
    `Quote: ${h.motivation?.trim() ? h.motivation.trim() : 'null'}`,
    `Habit Status: ${h.is_archived ? 'ARCHIVED' : 'NORMAL'}`,
    `Goal: ${goalText(h)}`,
    `Section: ${section || 'Others'}`,
    'Reminder: ',
    `Frequency: ${freqText(h)}`,
  ].join('\n');
}

/** «HH:mm» dell'ora del primo check-in di quel giorno (l'ora del telefono), o vuoto. */
function timeOf(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Row = {
  habit_uuid: string;
  log_date: string;
  completions: number;
  mood: number | null;
  note: string | null;
  first_logged_at: string | null;
};

/** I fogli da scrivere: una abitudine con almeno un giorno fatto = un foglio. */
export function exportSheets(db: SqlDb): Sheet[] {
  const habits = db.all<Habit & { category_name: string | null }>(
    `SELECT h.*, c.name AS category_name FROM habits h LEFT JOIN habit_categories c ON c.uuid = h.category_uuid
      ORDER BY h.is_archived, h.sort_key`,
  );
  const logs = db.all<Row>(
    `SELECT habit_uuid, log_date, completions, mood, note, first_logged_at FROM habit_logs
      WHERE status = 'done' ORDER BY log_date`,
  );
  const by = new Map<string, Row[]>();
  for (const l of logs) by.set(l.habit_uuid, [...(by.get(l.habit_uuid) ?? []), l]);
  const out: Sheet[] = [];
  for (const h of habits) {
    const mine = by.get(h.uuid);
    if (!mine?.length) continue;
    out.push({
      name: h.name,
      title: basicInfo(h, h.category_name ?? ''),
      range: `Date:${mine[0]!.log_date}~${mine[mine.length - 1]!.log_date}`,
      rows: mine.map((r) => [
        r.log_date,
        timeOf(r.first_logged_at),
        'Completed',
        String(Math.max(1, r.completions)),
        r.mood != null ? String(r.mood) : '',
        r.note ?? '',
      ]),
    });
  }
  return out;
}

const xml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // i caratteri di controllo non possono stare in un XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const col = (i: number): string => {
  let s = '';
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
};

/** Il nome del foglio: niente \ / ? * [ ] :, al massimo 31 caratteri, mai due uguali. */
export function sheetNames(names: readonly string[], fallback = 'Habit'): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    let name =
      (raw.trim() || fallback)
        .replace(/[\\/?*[\]:]/g, '-')
        .slice(0, 31)
        .trim() || fallback;
    const base = name;
    for (let i = 2; used.has(name); i++) {
      const suffix = ` (${i})`;
      name = base.slice(0, Math.max(1, 31 - suffix.length)) + suffix;
    }
    used.add(name);
    return name;
  });
}

const cell = (ref: string, v: string, bold = false): string =>
  v === ''
    ? `<c r="${ref}"/>`
    : `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;

function sheetXml(s: Sheet): string {
  let rows =
    `<row r="1">${cell('A1', s.title, true)}</row>` + `<row r="2">${cell('A2', s.range)}</row>`;
  rows += `<row r="3">${HEADERS.map((h, i) => cell(`${col(i)}3`, h, true)).join('')}</row>`;
  s.rows.forEach((r, k) => {
    rows += `<row r="${4 + k}">${r.map((v, i) => cell(`${col(i)}${4 + k}`, v)).join('')}</row>`;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:F${3 + Math.max(1, s.rows.length)}"/>` +
    '<cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="2" width="9" customWidth="1"/>' +
    '<col min="3" max="3" width="13" customWidth="1"/><col min="4" max="4" width="17" customWidth="1"/>' +
    '<col min="5" max="5" width="9" customWidth="1"/><col min="6" max="6" width="36" customWidth="1"/></cols>' +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Il file .xlsx, come lo scrive il sito (un foglio per abitudine). */
export function buildXlsx(sheets: readonly Sheet[], fallbackName = 'Habit'): Uint8Array {
  const names = sheetNames(
    sheets.map((s) => s.name),
    fallbackName,
  );
  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data:
        `${DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data:
        `${DECL}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><sheets>` +
        names
          .map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('') +
        '</sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data:
        `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rIdStyles" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      data:
        `${DECL}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ];
  return zipStore(files);
}

const csvCell = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Lo stesso storico come CSV (una riga per giorno fatto, col nome dell'abitudine in prima colonna), con il segno di UTF-8. */
export function buildCsv(sheets: readonly Sheet[]): string {
  const lines = [['Habit', ...HEADERS].map(csvCell).join(',')];
  for (const s of sheets) for (const r of s.rows) lines.push([s.name, ...r].map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** «Habits_20261108» (il nome che usa il sito). */
export const exportStem = (d: Date = new Date()): string =>
  `Habits_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
