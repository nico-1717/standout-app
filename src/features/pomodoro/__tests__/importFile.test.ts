import {
  detectDateOrder,
  findHeader,
  parseDateTime,
  parseDuration,
  parseMode,
  parsePomodoroRows,
  parseTimeOnly,
} from '../importFile';

describe('pomodoro import: single values', () => {
  test('date and time: ISO, serial number, day/month with am/pm', () => {
    expect(parseDateTime('2026-11-03 10:30', null)).toBe('2026-11-03 10:30:00');
    expect(parseDateTime('2026-11-03T10:30:15', null)).toBe('2026-11-03 10:30:15');
    expect(parseDateTime('2026-11-03', null)).toBe('2026-11-03 00:00:00');
    expect(parseDateTime('46325.5', null)).toBe('2026-10-30 12:00:00');
    expect(parseDateTime('03/11/2026 10:30 PM', 'dmy')).toBe('2026-11-03 22:30:00');
    expect(parseDateTime('03/11/2026 10:30', 'mdy')).toBe('2026-03-11 10:30:00');
    expect(parseDateTime('31/02/2026', 'dmy')).toBeNull();
    expect(parseDateTime('', null)).toBeNull();
    expect(parseDateTime('10:38:00', null)).toBeNull();
  });

  test('a cell with only a time', () => {
    expect(parseTimeOnly('10:38')).toBe(38280);
    expect(parseTimeOnly('10:38:30')).toBe(38310);
    expect(parseTimeOnly('12:05 am')).toBe(300);
    expect(parseTimeOnly('2026-11-03 10:38')).toBeNull();
    expect(parseTimeOnly('25')).toBeNull();
  });

  test('durations: minutes by default, seconds or hours by the header, clock and words', () => {
    expect(parseDuration('25', '')).toBe(1500);
    expect(parseDuration('25,5', '')).toBe(1530);
    expect(parseDuration('90', 'durationsec')).toBe(90);
    expect(parseDuration('2', 'durationhours')).toBe(7200);
    expect(parseDuration('1:30:00', '')).toBe(5400);
    expect(parseDuration('50:00', '', 'ms')).toBe(3000);
    expect(parseDuration('1:30', '', 'hm')).toBe(5400);
    expect(parseDuration('1h 30m', '')).toBe(5400);
    expect(parseDuration('90s', '')).toBe(90);
    expect(parseDuration('25 min', '')).toBe(1500);
    expect(parseDuration('', '')).toBe(0);
    expect(parseDuration('abc', '')).toBe(0);
  });

  test('types and date order', () => {
    expect(parseMode('Stopwatch')).toBe(1);
    expect(parseMode('Cronometro')).toBe(1);
    expect(parseMode('Pomodoro')).toBe(0);
    expect(parseMode('')).toBe(0);
    expect(detectDateOrder(['13/01/2026'])).toBe('dmy');
    expect(detectDateOrder(['01/13/2026'])).toBe('mdy');
    expect(detectDateOrder(['01/02/2026'])).toBeNull();
  });

  test('the header can come after a title line; standard positions otherwise', () => {
    const h = findHeader([
      ['Date:2024-02-22 ~ 2026-06-29'],
      [],
      ['StartTime', 'EndTime', 'Type', 'Title', 'Duration', '', 'List'],
    ]);
    expect(h.index).toBe(2);
    expect(h.cols).toMatchObject({ start: 0, end: 1, type: 2, title: 3, dur: 4, list: 6 });
    const none = findHeader([['2026-11-01 10:00', '', 'Pomodoro']]);
    expect(none.index).toBe(-1);
    expect(none.cols).toMatchObject({ start: 1, end: 2, type: 3, dur: 5, title: 4, list: 7 });
  });
});

describe('pomodoro import: whole files', () => {
  test('sessions with lists and titles, sorted; "/" means empty', () => {
    const r = parsePomodoroRows([
      ['Date:2026-11-01 ~ 2026-11-03'],
      [],
      ['StartTime', 'EndTime', 'Type', 'Title', 'Duration', 'List'],
      ['2026-11-03 09:00', '', 'Stopwatch', 'Algebra', '50', 'Maths'],
      ['2026-11-01 10:00', '', 'Pomodoro', 'Algebra', '25', 'Maths'],
      ['2026-11-02 11:00', '', 'Pomodoro', '/', '25', '/'],
      ['2026-11-02 12:00', '', 'Pomodoro', 'Notes', '25', 'Maths'],
      ['2026-11-02 13:00', '', 'Pomodoro', 'Notes', '0', 'Maths'],
    ])!;
    expect(r.sessions.map((s) => [s.start, s.dur, s.mode])).toEqual([
      ['2026-11-01 10:00:00', 1500, 0],
      ['2026-11-02 11:00:00', 1500, 0],
      ['2026-11-02 12:00:00', 1500, 0],
      ['2026-11-03 09:00:00', 3000, 1],
    ]);
    expect(r.lists).toEqual([{ key: 'L0', name: 'Maths' }]);
    expect(r.titles).toEqual([
      { key: 'T0', listKey: 'L0', name: 'Algebra' },
      { key: 'T1', listKey: 'L0', name: 'Notes' },
    ]);
    expect(r.sessions[1]).toMatchObject({ listKey: '', titleKey: '' });
    expect([r.pomodori, r.cronometri]).toEqual([3, 1]);
    expect(r.warnings).toEqual([{ kind: 'rows_skipped', n: 1 }]);
  });

  test('duration from start and end when the duration is empty; the day on its own column', () => {
    const r = parsePomodoroRows([
      ['Date', 'Start', 'End', 'Type', 'Task', 'Duration'],
      ['2026-08-18', '10:38', '11:03', '', 'x', ''],
      ['2026-08-18', '23:30', '00:10', '', 'x', ''], // a cavallo della mezzanotte
    ])!;
    expect(r.sessions.map((s) => [s.start, s.dur])).toEqual([
      ['2026-08-18 10:38:00', 1500],
      ['2026-08-18 23:30:00', 2400],
    ]);
    expect(r.warnings).toEqual([]);
  });

  test('"50:00" is read as hours:minutes when the end time says so', () => {
    const r = parsePomodoroRows([
      ['Start', 'End', 'Duration'],
      ['2026-08-18 10:00', '2026-08-18 10:50', '0:50'],
      ['2026-08-18 12:00', '2026-08-18 13:30', '1:30'],
    ])!;
    expect(r.sessions.map((s) => s.dur)).toEqual([3000, 5400]);
  });

  test('no header → warning; ambiguous dates → warning; nothing valid → null', () => {
    const r = parsePomodoroRows([['', '01/02/2026 10:00', '', 'Pomodoro', '', '25']])!;
    expect(r.sessions[0]!.start).toBe('2026-02-01 10:00:00');
    expect(r.warnings).toEqual([{ kind: 'no_header' }, { kind: 'date_ambiguous' }]);
    expect(
      parsePomodoroRows([
        ['StartTime', 'Duration'],
        ['hello', '5'],
      ]),
    ).toBeNull();
  });
});
