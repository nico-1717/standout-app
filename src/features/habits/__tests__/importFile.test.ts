import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { readXlsx } from '@/core/files/xlsx';

import { buildCsv, buildXlsx, exportSheets } from '../exportFile';
import {
  detectDateOrder,
  findHeader,
  parseCsv,
  parseDate,
  parseHabitSheets,
  parseTime,
  readImportFile,
  statusExcluded,
} from '../importFile';
import { HabitsRepo } from '../repo';

describe('import: single values', () => {
  test('dates: ISO, serial numbers, day/month or month/day by the order', () => {
    expect(parseDate('2026-11-03', null)).toBe('2026-11-03');
    expect(parseDate('2026-11-03 09:30', null)).toBe('2026-11-03');
    expect(parseDate('46325', null)).toBe('2026-10-30');
    expect(parseDate('03/11/2026', 'dmy')).toBe('2026-11-03');
    expect(parseDate('03/11/2026', 'mdy')).toBe('2026-03-11');
    expect(parseDate('25.12.26', 'dmy')).toBe('2026-12-25');
    expect(parseDate('13/01/2026', 'mdy')).toBeNull(); // come il sito: l'ordine scelto vale per tutto il foglio
    expect(parseDate('31/02/2026', 'dmy')).toBeNull();
    expect(parseDate('hello', 'dmy')).toBeNull();
    expect(parseDate('', 'dmy')).toBeNull();
  });

  test('date order is found from a day above 12', () => {
    expect(detectDateOrder(['25/12/2026', '01/02/2026'])).toBe('dmy');
    expect(detectDateOrder(['12/25/2026'])).toBe('mdy');
    expect(detectDateOrder(['01/02/2026'])).toBeNull();
    expect(detectDateOrder(['2026-01-02'])).toBe('ymd');
  });

  test('times: 24 hours, am/pm, after a date', () => {
    expect(parseTime('9:05')).toBe('09:05:00');
    expect(parseTime('11:30 PM')).toBe('23:30:00');
    expect(parseTime('12:10 am')).toBe('00:10:00');
    expect(parseTime('2026-11-01 07:45')).toBe('07:45:00');
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('soon')).toBeNull();
  });

  test('statuses that say "not done" are left out', () => {
    for (const s of ['Skipped', 'saltato', 'Missed', 'Failed', 'fallito', 'Annullato', 'Cancelled'])
      expect(statusExcluded(s)).toBe(true);
    for (const s of ['', 'Completed', 'Done', 'Fatto']) expect(statusExcluded(s)).toBe(false);
  });

  test('headers are found by name (accents, order) or fall back to the standard positions', () => {
    const h = findHeader([['Title'], ['Giorno', 'Orario', 'Stato', 'Volte', 'Umore', 'Appunti']]);
    expect(h.index).toBe(1);
    expect(h.cols).toMatchObject({ date: 0, time: 1, status: 2, count: 3, mood: 4, note: 5 });
    const none = findHeader([['2026-11-01', '09:00', 'Done']]);
    expect(none.index).toBe(-1);
    expect(none.cols.date).toBe(0);
    expect(none.cols.habit).toBe(-1);
  });
});

describe('import: csv reading', () => {
  test('quotes, doubled quotes, line breaks inside a cell, BOM, ";" separator', () => {
    const s = parseCsv('\uFEFFA;B\r\n"x;1";"he said ""hi"""\r\n"two\nlines";3\r\n\r\n', 'file');
    expect(s.rows).toEqual([
      ['A', 'B'],
      ['x;1', 'he said "hi"'],
      ['two\nlines', '3'],
    ]);
  });

  test('files: old .xls is refused, empty is refused, text goes to csv', () => {
    const csv = new TextEncoder().encode('Date\n2026-11-01\n');
    expect(() => readImportFile('a.xls', csv, readXlsx)).toThrow('xls_vecchio');
    expect(() => readImportFile('a.csv', new Uint8Array(), readXlsx)).toThrow('file_vuoto');
    expect(() => readImportFile('a.xlsx', csv, readXlsx)).toThrow('xlsx_non_valido');
    expect(readImportFile('C:\\x\\Read books.csv', csv, readXlsx)[0]!.name).toBe('Read books');
  });
});

describe('import: whole files', () => {
  test('one sheet = one habit; name comes from "Habit Name:" first, rows are sorted', () => {
    const r = parseHabitSheets([
      {
        name: 'Sheet1',
        rows: [
          ['Basic Information\nHabit Name: Drink water\nGoal: 2'],
          ['Date', 'Time', 'Status', 'Total check-ins', 'Mood', 'Habit Log'],
          ['2026-11-03', '10:00', 'Completed', '2', '4', 'ok'],
          ['2026-11-01', '', 'Completed', '', '', 'null'],
          ['2026-11-02', '', 'Skipped', '', '', ''],
          ['nope', '', '', '', '', ''],
        ],
      },
    ]);
    expect(r.habits).toEqual([{ key: 'H0', name: 'Drink water' }]);
    expect(r.logs.map((l) => [l.date, l.time, l.count, l.mood, l.note])).toEqual([
      ['2026-11-01', null, 1, '', ''],
      ['2026-11-03', '10:00:00', 2, '4', 'ok'],
    ]);
    expect(r.warnings).toEqual([{ kind: 'rows_skipped', n: 2 }]);
  });

  test('a Habit column makes one sheet hold many habits; empty names are skipped', () => {
    const r = parseHabitSheets([
      {
        name: 'All',
        rows: [
          ['Habit', 'Date'],
          ['Run', '2026-11-01'],
          ['Read', '2026-11-01'],
          ['Run', '2026-11-02'],
          ['', '2026-11-02'],
        ],
      },
    ]);
    expect(r.habits.map((h) => h.name)).toEqual(['Run', 'Read']);
    expect(r.logs).toHaveLength(3);
    expect(r.warnings).toEqual([{ kind: 'rows_skipped', n: 1 }]);
  });

  test('no header → warning; ambiguous dates → warning; empty sheets are listed', () => {
    const r = parseHabitSheets([
      { name: 'Yoga', rows: [['01/02/2026', '07:00', 'Done']] },
      { name: 'Empty', rows: [] },
    ]);
    expect(r.logs[0]!.date).toBe('2026-02-01');
    expect(r.warnings).toEqual([
      { kind: 'no_header', sheet: 'Yoga' },
      { kind: 'date_ambiguous', sheet: 'Yoga' },
      { kind: 'sheets_skipped', n: 1, names: 'Empty' },
    ]);
  });

  test('our own export comes back in full, as .xlsx and as .csv', () => {
    const db = memoryDb();
    migrate(db);
    const habits = new HabitsRepo(db, undefined, undefined, () => '2026-11-08');
    const water = habits.create({
      name: 'Drink <water> & "more"',
      goal_type: 'quantity',
      target_amount: 2,
      step_amount: 1,
    });
    const read = habits.create({ name: 'Read' });
    habits.checkIn(water, '2026-11-01', 'increment');
    habits.checkIn(water, '2026-11-01', 'increment');
    habits.checkIn(read, '2026-11-03', 'toggle');
    habits.setNote(read, '2026-11-03', { note: 'Chapter "1", good', mood: 4 });
    const sheets = exportSheets(db);

    const fromXlsx = parseHabitSheets(readXlsx(buildXlsx(sheets)));
    const fromCsv = parseHabitSheets([parseCsv(buildCsv(sheets), 'Habits_20261108')]);
    for (const r of [fromXlsx, fromCsv]) {
      expect(r.habits.map((h) => h.name).sort()).toEqual(['Drink <water> & "more"', 'Read']);
      const readLog = r.logs.find((l) => l.date === '2026-11-03')!;
      expect(readLog).toMatchObject({ mood: '4', note: 'Chapter "1", good' });
      expect(r.logs.find((l) => l.date === '2026-11-01')!.count).toBe(2);
      expect(r.warnings).toEqual([]);
    }
  });
});
