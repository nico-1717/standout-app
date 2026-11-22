import { placeRange } from '../useGridPlace';

// 1 px = 1 minute: easy to read
const base = { ppm: 1, snap: 15, slot: 30 };

describe('placeRange', () => {
  test('a block of fixed length follows the finger and snaps to the step', () => {
    expect(placeRange({ ...base, y0: 600, dy: 0, fixed: 45 })).toEqual({ start: 600, end: 645 });
    expect(placeRange({ ...base, y0: 600, dy: 100, fixed: 45 })).toEqual({
      start: 700 - 10,
      end: 735,
    });
  });

  test('a fixed block stays inside the day', () => {
    expect(placeRange({ ...base, y0: 1430, dy: 0, fixed: 60 })).toEqual({ start: 1380, end: 1440 });
    expect(placeRange({ ...base, y0: 10, dy: -500, fixed: 60 })).toEqual({ start: 0, end: 60 });
  });

  test('without a fixed length it starts where you pressed and stretches with the finger', () => {
    expect(placeRange({ ...base, y0: 610, dy: 0, fixed: null })).toEqual({ start: 600, end: 630 });
    expect(placeRange({ ...base, y0: 610, dy: 100, fixed: null })).toEqual({
      start: 600,
      end: 720,
    });
  });

  test('stretching never goes shorter than a row, nor past midnight', () => {
    expect(placeRange({ ...base, y0: 610, dy: -300, fixed: null })).toEqual({
      start: 600,
      end: 630,
    });
    expect(placeRange({ ...base, y0: 1400, dy: 500, fixed: null })).toEqual({
      start: 1380,
      end: 1440,
    });
  });

  test('works with zoomed-in pixels per minute', () => {
    expect(placeRange({ ppm: 2, snap: 15, slot: 30, y0: 1200, dy: 120, fixed: null })).toEqual({
      start: 600,
      end: 660,
    });
  });
});
