import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildXlsx } from '@/features/habits/exportFile';

import { excelDateText, readXlsx } from '../xlsx';

const fx = (n: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, 'fixtures', n)));

describe('readXlsx', () => {
  test('inline strings, numbers, dates and times (file written by openpyxl)', () => {
    const sheets = readXlsx(fx('sample.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual(['Read', 'Run-Walk']);
    const [read, run] = sheets as [(typeof sheets)[0], (typeof sheets)[0]];
    expect(read.rows[0]![0]).toContain('Habit Name: Read every day');
    expect(read.rows[0]![0]).toContain('\nFrequency: every day');
    expect(read.rows[2]).toEqual([
      'Date',
      'Time',
      'Status',
      'Total check-ins',
      'Mood',
      'Habit Log',
    ]);
    expect(read.rows[3]).toEqual(['2026-11-01', '07:30', 'Completed', '1', '3', 'ok']);
    // una data e un'ora scritte da Excel come numeri con il loro formato
    expect(read.rows[4]).toEqual(['2026-11-02', '08:05', 'Completed', '2', '', 'Line "1" & <2>']);
    // un numero senza formato resta un numero
    expect(read.rows[5]).toEqual(['46325', '', 'Skipped', '1']);
    expect(run.rows[1]).toEqual(['2026-10-31 06:45', '12.5']);
  });

  test('shared strings, rich text, custom date format, gaps and booleans (file written by xlsxwriter)', () => {
    const [s] = readXlsx(fx('shared.xlsx'));
    expect(s!.name).toBe('Dati & più');
    expect(s!.rows[0]).toEqual(['Rich', 'Bold plain']);
    expect(s!.rows[1]).toEqual(['Name', '2026-11-08', '3.5', '', 'sparse']);
    expect(s!.rows[2]).toEqual([]); // una riga saltata
    expect(s!.rows[3]).toEqual(['after a gap', 'TRUE']);
  });

  test('what the habit export writes can be read back', () => {
    const bytes = buildXlsx([
      {
        name: 'Read',
        title: 'Basic Information\nHabit Name: Read',
        range: 'Date:2026-11-01~2026-11-01',
        rows: [['2026-11-01', '07:30', 'Completed', '1', '', 'a & b']],
      },
    ]);
    const [s] = readXlsx(bytes);
    expect(s!.rows[3]).toEqual(['2026-11-01', '07:30', 'Completed', '1', '', 'a & b']);
  });

  test('not a spreadsheet gives an error', () => {
    expect(() => readXlsx(new Uint8Array([80, 75, 3, 4]))).toThrow();
  });
});

describe('excelDateText', () => {
  test('whole numbers are dates, fractions are times', () => {
    expect(excelDateText(46328)).toBe('2026-11-02');
    expect(excelDateText(0.5)).toBe('12:00');
    expect(excelDateText(46325.75)).toBe('2026-10-30 18:00');
    expect(excelDateText(1)).toBe('1899-12-31');
  });
});
