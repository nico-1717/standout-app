import type { EventView } from '../events';
import { isBand, layoutDay } from '../layout';

const ev = (start: string, end: string, extra: Partial<EventView> = {}): EventView =>
  ({ uuid: start + end, start, end, allDay: false, multiday: false, ...extra }) as EventView;

describe('day layout', () => {
  test('events that do not touch stay full width', () => {
    const b = layoutDay([ev('09:00', '10:00'), ev('10:00', '11:00')]);
    expect(b.map((x) => [x.col, x.cols])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });
  test('two overlapping events share the width', () => {
    const b = layoutDay([ev('09:00', '11:00'), ev('10:00', '12:00')]);
    expect(b.map((x) => [x.col, x.cols])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });
  test('a later free slot reuses the first column, three at once need three', () => {
    const b = layoutDay([
      ev('09:00', '12:00'),
      ev('09:30', '10:00'),
      ev('09:45', '10:30'),
      ev('11:00', '11:30'),
    ]);
    expect(b.map((x) => [x.col, x.cols])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [1, 3],
    ]);
  });
  test('a very short event still gets a tappable height; bands are left out', () => {
    const b = layoutDay([
      ev('09:00', '09:00'),
      ev('00:00', '00:00', { allDay: true }),
      ev('08:00', '09:00', { multiday: true }),
    ]);
    expect(b).toHaveLength(1);
    expect(b[0]!.height).toBe(15);
    expect(isBand(ev('00:00', '00:00', { allDay: true }))).toBe(true);
  });
});
