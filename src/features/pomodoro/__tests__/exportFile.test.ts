import { memoryDb } from '@/core/db/__tests__/testDb';
import { upsertRow } from '@/core/sync/rows';

import { buildCsv, buildXlsx, exportRows, exportStem, exportTitle, fmtHms } from '../exportFile';
import { parsePomodoroRows } from '../importFile';

const session = (uuid: string, extra: Record<string, unknown>) => ({
  uuid,
  mode: 0,
  start_time: '2026-03-01 10:00:00',
  end_time: '2026-03-01 10:25:00',
  status: 'completato',
  resume_time: null,
  duration_seconds: 1500,
  planned_duration_min: 25,
  project_uuid: null,
  is_manual: 0,
  updated_at: null,
  ...extra,
});

function seed() {
  const db = memoryDb();
  upsertRow(db, 'projects', {
    uuid: 'p-parent',
    name: 'University',
    parent_uuid: null,
    color: '#336699',
    updated_at: null,
  });
  upsertRow(db, 'projects', {
    uuid: 'p-child',
    name: 'Calculus',
    parent_uuid: 'p-parent',
    color: '#336699',
    updated_at: null,
  });
  upsertRow(
    db,
    'pomodoro_sessions',
    session('b', {
      start_time: '2026-03-02 09:00:00',
      end_time: '2026-03-02 10:41:01',
      duration_seconds: 6061,
      mode: 1,
      project_uuid: 'p-child',
    }),
  );
  upsertRow(db, 'pomodoro_sessions', session('a', {}));
  upsertRow(
    db,
    'pomodoro_sessions',
    session('open', {
      start_time: '2026-03-03 08:00:00',
      end_time: null,
      status: null,
      duration_seconds: 0,
    }),
  );
  return db;
}

describe('Pomodoro export', () => {
  test('one row per finished session, oldest first, like the website', () => {
    const rows = exportRows(seed());
    expect(rows).toEqual([
      [
        '2026-03-01',
        '2026-03-01 10:00',
        '2026-03-01 10:25',
        'Pomo',
        '/',
        '25:00',
        '/',
        '/',
        '/',
        '/',
      ],
      [
        '2026-03-02',
        '2026-03-02 09:00',
        '2026-03-02 10:41',
        'Stopwatch',
        'Calculus',
        '01:41:01',
        'Task',
        'University',
        '/',
        '/',
      ],
    ]);
  });

  test('title, durations and file name', () => {
    expect(exportTitle(exportRows(seed()))).toBe('Date:2026-03-01 ~ 2026-03-02');
    expect(exportTitle([], new Date(2026, 10, 17))).toBe('Date:2026-11-17 ~ 2026-11-17');
    expect(fmtHms(3000)).toBe('50:00');
    expect(fmtHms(6061)).toBe('01:41:01');
    expect(exportStem(new Date(2026, 10, 17))).toBe('Pomodoro_record_20261117');
  });

  test('the csv starts with the UTF-8 mark, the title, a blank line and the headers', () => {
    const rows = exportRows(seed());
    const csv = buildCsv(rows, exportTitle(rows));
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('﻿Date:2026-03-01 ~ 2026-03-02');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(
      'Date,StartTime,EndTime,Type,Title,Duration,Type of Content,List,Tags,Note',
    );
    expect(lines[4]).toContain('Calculus');
  });

  test('what the app exports, the app can import again', () => {
    const rows = exportRows(seed());
    const grid = [
      [exportTitle(rows)],
      [],
      [
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
      ],
      ...rows,
    ];
    const parsed = parsePomodoroRows(grid);
    expect(parsed?.sessions).toHaveLength(2);
  });

  test('the xlsx is a zip with the sheet inside', () => {
    const bytes = buildXlsx(exportRows(seed()), 'Date:2026-03-01 ~ 2026-03-02');
    expect(String.fromCharCode(...bytes.slice(0, 2))).toBe('PK');
    expect(new TextDecoder().decode(bytes)).toContain('xl/worksheets/sheet1.xml');
  });
});
