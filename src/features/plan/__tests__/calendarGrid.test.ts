import {
  cellAt,
  chipRows,
  gridRange,
  inkOn,
  isAncestorOfSel,
  legendDays,
  lineSegments,
  shiftMonth,
  ROW_H,
} from '../calendarGrid';
import { addDays } from '../engine';
import type { CalendarNode } from '../view';

const node = (
  project: string,
  parent: string | null,
  kids: string[] = [],
  status = 'in_progress',
): CalendarNode => ({
  project,
  name: project,
  color: '#007AFF',
  status,
  parent,
  kids,
  minutes: 0,
  doneMin: 0,
  kind: null,
  priority: null,
  deadline: null,
  deadlineEff: null,
  since: null,
});

describe('calendar grid', () => {
  test('the grid starts on the Monday before the first of the month and has 42 days', () => {
    expect(gridRange('2030-03-15')).toEqual({ from: '2030-02-25', to: '2030-04-07' });
    expect(gridRange('2030-04-01').from).toBe('2030-04-01'); // il primo è già un lunedì
  });

  test('cellAt maps a point to a day, outside is null', () => {
    const from = '2030-02-25';
    expect(cellAt(1, 1, 700, from)).toBe('2030-02-25');
    expect(cellAt(699, 1, 700, from)).toBe('2030-03-03');
    expect(cellAt(350, ROW_H + 1, 700, from)).toBe('2030-03-07');
    expect(cellAt(-1, 5, 700, from)).toBeNull();
    expect(cellAt(10, ROW_H * 6 + 1, 700, from)).toBeNull();
  });

  test('shiftMonth', () => {
    expect(shiftMonth('2030-01-01', -1)).toBe('2029-12-01');
    expect(shiftMonth('2030-12-01', 1)).toBe('2031-01-01');
  });

  test('chip rows open under the selected path', () => {
    const nodes = [
      node('a', null, ['a1', 'a2']),
      node('b', null),
      node('a1', 'a', ['x']),
      node('a2', 'a', [], 'completed'),
      node('x', 'a1'),
    ];
    expect(chipRows(nodes, null)).toEqual([{ parent: null, ids: ['a', 'b'] }]);
    expect(chipRows(nodes, 'a1')).toEqual([
      { parent: null, ids: ['a', 'b'] },
      { parent: 'a', ids: ['a1'] },
      { parent: 'a1', ids: ['x'] },
    ]);
    expect(isAncestorOfSel(nodes, 'x', 'a')).toBe(true);
    expect(isAncestorOfSel(nodes, 'x', 'b')).toBe(false);
  });

  test('ink', () => {
    expect(inkOn('#FFFFFF')).toBe('#1C1C1E');
    expect(inkOn('#000000')).toBe('#FFFFFF');
    expect(inkOn('boh')).toBe('#1C1C1E');
  });
});

describe('lineSegments', () => {
  const mark = (id: string, soft = false) => ({ id, color: `#${id}`, soft });
  const empty = () => Array.from({ length: 42 }, () => [] as ReturnType<typeof mark>[]);

  it('cinque giorni di fila di un progetto sono UNA linea con gli estremi arrotondati', () => {
    const d = empty();
    for (let i = 8; i <= 12; i++) d[i].push(mark('a'));
    const s = lineSegments(d);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ row: 1, from: 1, to: 5, capL: true, capR: true, lane: 0 });
  });

  it('va a capo con la settimana: due tratti, senza estremo dove continua', () => {
    const d = empty();
    for (let i = 5; i <= 9; i++) d[i].push(mark('a'));
    const s = lineSegments(d).sort((x, y) => x.row - y.row);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ row: 0, from: 5, to: 6, capL: true, capR: false });
    expect(s[1]).toMatchObject({ row: 1, from: 0, to: 2, capL: false, capR: true });
  });

  it('due progetti nello stesso giorno stanno su corsie diverse', () => {
    const d = empty();
    for (let i = 7; i <= 10; i++) d[i].push(mark('a'));
    for (let i = 9; i <= 12; i++) d[i].push(mark('b'));
    const s = lineSegments(d);
    expect(new Set(s.map((x) => x.lane)).size).toBe(2);
  });

  it('un giorno vuoto spezza la linea e la legenda conta i giorni del mese', () => {
    const d = empty();
    d[8].push(mark('a'));
    d[10].push(mark('a'));
    expect(lineSegments(d)).toHaveLength(2);
    const cells = Array.from({ length: 42 }, (_, i) => addDays('2026-10-26', i));
    expect(legendDays(d, cells, '2026-11-01').get('a')?.days).toBe(2);
  });
});
