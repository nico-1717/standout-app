import type { SqlDb } from '@/core/db/sqldb';
import { zipStore, type ZipEntry } from '@/core/files/zipStore';

/** Il file che l'app scrive per «Esporta»: lo stesso del sito (pomodoro_import.php, `ie_export`) e lo stesso che l'import legge. */
export const EXPORT_HEADERS = [
  'Date',
  'StartTime',
  'EndTime',
  'Type',
  'Title',
  'Duration',
  'Type of Content',
  'List',
  'Tags',
  'Note',
] as const;

export type ExportRow = string[];

const p2 = (n: number) => String(n).padStart(2, '0');

/** 3000 → «50:00», 6061 → «01:41:01» (come il file di import). */
export function fmtHms(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${p2(h)}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`;
}

const parse = (stamp: string | null): number | null => {
  if (!stamp) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(stamp);
  if (!m) return null;
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0)).getTime();
};
const minute = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

interface Raw {
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  mode: number;
  proj_name: string | null;
  parent_name: string | null;
}

/** Tutte le sessioni finite, dalla più vecchia: una riga ciascuna (quelle ancora aperte non hanno niente da esportare). */
export function exportRows(db: SqlDb): ExportRow[] {
  const raw = db.all<Raw>(
    `SELECT s.start_time, s.end_time, s.duration_seconds, s.mode,
            p.name AS proj_name, pp.name AS parent_name
       FROM pomodoro_sessions s
       LEFT JOIN projects p ON p.uuid = s.project_uuid
       LEFT JOIN projects pp ON pp.uuid = p.parent_uuid
      ORDER BY s.start_time ASC`,
  );
  const out: ExportRow[] = [];
  for (const r of raw) {
    const start = parse(r.start_time);
    if (start === null) continue;
    let sec = Math.max(0, r.duration_seconds ?? 0);
    const endParsed = parse(r.end_time);
    if (sec <= 0 && endParsed !== null) sec = Math.max(0, Math.round((endParsed - start) / 1000));
    if (sec <= 0) continue;
    const end = endParsed === null || endParsed < start ? start + sec * 1000 : endParsed;
    const name = r.proj_name?.trim() ? r.proj_name : '/';
    out.push([
      r.start_time.slice(0, 10),
      minute(start),
      minute(end),
      r.mode === 1 ? 'Stopwatch' : 'Pomo',
      name,
      fmtHms(sec),
      r.proj_name === null ? '/' : 'Task',
      r.parent_name?.trim() ? r.parent_name : '/',
      '/',
      '/',
    ]);
  }
  return out;
}

/** La prima riga del formato: «Date:2024-02-22 ~ 2026-06-29». */
export function exportTitle(rows: readonly ExportRow[], today = new Date()): string {
  const t = `${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`;
  if (!rows.length) return `Date:${t} ~ ${t}`;
  return `Date:${rows[0]![0]} ~ ${rows[rows.length - 1]![0]}`;
}

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = (i: number): string => String.fromCharCode(65 + i);
const cell = (ref: string, v: string, bold = false): string =>
  v === ''
    ? `<c r="${ref}"/>`
    : `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;

/** Il file .xlsx: riga 1 titolo, riga 2 vuota, riga 3 intestazioni, dati dalla 4 (tutto testo, come il sito). */
export function buildXlsx(rows: readonly ExportRow[], title: string): Uint8Array {
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  let sheet = `<row r="1">${cell('A1', title, true)}</row><row r="2"/>`;
  sheet += `<row r="3">${EXPORT_HEADERS.map((h, i) => cell(`${col(i)}3`, h, true)).join('')}</row>`;
  rows.forEach((r, k) => {
    sheet += `<row r="${4 + k}">${r.map((v, i) => cell(`${col(i)}${4 + k}`, v)).join('')}</row>`;
  });
  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data:
        `${DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
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
        `${DECL}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">` +
        '<sheets><sheet name="Pomodori" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data:
        `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
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
    {
      name: 'xl/worksheets/sheet1.xml',
      data:
        `${DECL}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<dimension ref="A1:J${3 + Math.max(1, rows.length)}"/>` +
        '<cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="3" width="32" customWidth="1"/>' +
        '<col min="4" max="4" width="14" customWidth="1"/><col min="5" max="5" width="42" customWidth="1"/>' +
        '<col min="6" max="6" width="14" customWidth="1"/><col min="7" max="7" width="18" customWidth="1"/>' +
        '<col min="8" max="8" width="28" customWidth="1"/><col min="9" max="9" width="14" customWidth="1"/>' +
        `<col min="10" max="10" width="28" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>`,
    },
  ];
  return zipStore(files);
}

const csvCell = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Lo stesso come CSV: titolo, riga vuota, intestazioni, dati; con il segno di UTF-8 (senza, Excel rovina gli accenti). */
export function buildCsv(rows: readonly ExportRow[], title: string): string {
  const lines = [csvCell(title), '', EXPORT_HEADERS.join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** «Pomodoro_record_20261117» (il nome che usa il sito). */
export const exportStem = (d: Date = new Date()): string =>
  `Pomodoro_record_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
