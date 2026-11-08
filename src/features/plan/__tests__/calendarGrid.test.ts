import {
  cellAt,
  chipRows,
  gridRange,
  inkOn,
  isAncestorOfSel,
  shiftMonth,
  ROW_H,
} from '../calendarGrid';
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
