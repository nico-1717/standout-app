import { discState, ringNumbers, type RoadModel } from '../roadModel';

/* I valori attesi sono quelli di f2Calcola in fc_game.php, eseguita in node sugli stessi ingressi. */
const base = (o: Partial<RoadModel>): RoadModel => ({
  tot: 30,
  pos: 1,
  front: 0,
  done: 0,
  cp: [],
  ...o,
});

describe('ringNumbers (same as the site)', () => {
  test('inside a stretch with sub-cards', () => {
    const r = ringNumbers(
      base({ pos: 4, front: 4, done: 6, cp: [1, 3, 1, 2, 1, 1, 1, 1, 1, 1] }),
      10,
    );
    expect(r.fill).toBeCloseTo(13.3333, 3);
    expect(r.beyond).toBeCloseTo(13.3333, 3);
    expect(r.o1).toBeCloseTo(0.4, 6);
    expect(r.o2).toBeCloseTo(0.461538, 5);
    expect([r.ring, r.r2, r.leftPositions, r.leftCards]).toEqual([true, true, 6, 7]);
  });

  test('front ahead of the position', () => {
    const cp = [1, 3, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1];
    const r = ringNumbers(base({ pos: 12, front: 15, done: 25, cp }), 10);
    expect(r.fill).toBe(40);
    expect(r.beyond).toBe(50);
    expect(r.o1).toBeCloseTo(0.2, 6);
    expect(r.o2).toBeCloseTo(0.923077, 5);
    expect([r.leftPositions, r.leftCards]).toEqual([8, 1]);
  });

  test('no ring when the stretch covers the whole game, or checkpoints are off', () => {
    const a = ringNumbers(base({ tot: 8, pos: 3, front: 5, done: 3 }), 10);
    expect(a.ring).toBe(false);
    expect(a.beyond).toBe(62.5);
    expect(ringNumbers(base({ tot: 25, pos: 1 }), 0).ring).toBe(false);
  });

  test('last stretch: finished game', () => {
    const r = ringNumbers(
      base({ tot: 25, pos: 25, front: 25, done: 40, cp: Array(25).fill(2) }),
      5,
    );
    expect([r.o1, r.o2, r.leftPositions, r.leftCards]).toEqual([1, 0, 0, 10]);
  });

  test('one ring only when each position is a single row', () => {
    expect(ringNumbers(base({ pos: 3, front: 3, done: 3 }), 10).r2).toBe(false);
  });
});

test('discState', () => {
  expect(discState(5, 1, 3)).toBe('ok');
  expect(discState(2, 1, 3)).toBe('cur');
  expect(discState(1, 4, 6)).toBe('fut');
});
