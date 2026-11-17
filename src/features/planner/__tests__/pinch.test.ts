import { PXM_MIN, ZOOMS, majorEvery, pxPerMinute, stepFor } from '../layout';
import { PinchGesture } from '../pinch';

const anchor = { min: 600, y: 300 };

describe('density and steps', () => {
  test('natural density of each step is its own height', () => {
    expect(pxPerMinute('m30')).toBeCloseTo(44 / 30);
    expect(pxPerMinute('h3')).toBeCloseTo(54 / 180);
    expect(pxPerMinute('agenda')).toBe(0);
  });
  test('the step follows the density: each one starts at its natural height', () => {
    for (const z of ['h3', 'h1', 'm30', 'm15', 'm5'] as const) {
      expect(stepFor(pxPerMinute(z))).toBe(z);
    }
    expect(stepFor(PXM_MIN)).toBe('h3');
    expect(stepFor(10)).toBe('m5');
    // un filo sotto la soglia dei 30 minuti resta sull'ora
    expect(stepFor(44 / 30 - 0.001)).toBe('h1');
  });
  test('major labels', () => {
    expect([majorEvery('h1'), majorEvery('m30'), majorEvery('m15'), majorEvery('m5')]).toEqual([
      1, 2, 4, 12,
    ]);
    expect(ZOOMS.h3.slotMin).toBe(180);
  });
});

describe('pinch gesture', () => {
  test('opening the fingers raises the density continuously and flags step changes', () => {
    const g = new PinchGesture(100, 'm30', pxPerMinute('m30'), anchor);
    const a = g.move(120);
    expect(a).toMatchObject({ kind: 'density', step: 'm30', stepChanged: false });
    const b = g.move(200);
    expect(b).toMatchObject({ kind: 'density', step: 'm15', stepChanged: true });
    expect(g.result()).toBe('m15');
  });
  test('the density never goes below the 3 hours floor, and a mid-gesture return to the start step saves nothing', () => {
    const g = new PinchGesture(100, 'm30', pxPerMinute('m30'), anchor);
    g.move(300);
    const c = g.move(10);
    expect(c).toMatchObject({ kind: 'density', step: 'h3', pxm: PXM_MIN });
    g.move(100);
    expect(g.result()).toBeNull();
  });
  test('from 3 hours, squeezing further goes to the list, once per gesture', () => {
    const g = new PinchGesture(100, 'h3', pxPerMinute('h3'), anchor);
    expect(g.move(90)).toMatchObject({ kind: 'density', step: 'h3' });
    expect(g.move(70)).toEqual({ kind: 'mode', step: 'agenda', pxm: 0 });
    expect(g.move(200)).toEqual({ kind: 'none' });
    expect(g.result()).toBe('agenda');
  });
  test('from the list, a small opening re-enters the hours at 3 h and then keeps zooming', () => {
    const g = new PinchGesture(100, 'agenda', 0, anchor);
    expect(g.move(103)).toEqual({ kind: 'none' });
    const back = g.move(110);
    expect(back).toMatchObject({ kind: 'mode', step: 'h3' });
    const more = g.move(220);
    expect(more.kind).toBe('density');
    if (more.kind === 'density') expect(more.pxm).toBeGreaterThan(pxPerMinute('h3'));
    expect(g.result()).not.toBe('agenda');
  });
  test('from a step other than 3 h, squeezing stops at the floor instead of jumping to the list', () => {
    const g = new PinchGesture(100, 'h1', pxPerMinute('h1'), anchor);
    expect(g.move(5)).toMatchObject({ kind: 'density', step: 'h3', pxm: PXM_MIN });
  });
});
