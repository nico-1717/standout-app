import {
  PXM_MIN,
  STEP_KEYS,
  ZOOMS,
  majorEvery,
  naturalPpm,
  pxPerMinute,
  stepFor,
  stepIndexFor,
  windowHalfSpan,
} from '../layout';
import { pinchBegin, pinchMove } from '../pinch';

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

describe('step indexes for the UI thread', () => {
  test('stepIndexFor agrees with stepFor on a dense sweep', () => {
    for (let p = PXM_MIN; p <= 7; p += 0.01) {
      expect(STEP_KEYS[stepIndexFor(p)]).toBe(stepFor(p));
    }
  });
  test('natural density by index', () => {
    STEP_KEYS.forEach((k, i) => expect(naturalPpm(i)).toBeCloseTo(pxPerMinute(k)));
  });
  test('the row window is the whole day on wide steps and a few hours on the fine ones', () => {
    expect(windowHalfSpan('h3', 700)).toBe(1440);
    expect(windowHalfSpan('m5', 700)).toBeLessThan(400);
    expect(windowHalfSpan('m15', 700)).toBeLessThan(700);
  });
});

/** Un gesto intero: le dita partono a scala 1 e si allargano o stringono; ogni tratto riparte da dove era. */
const run = (step: number, scales: number[]) => {
  let st = pinchBegin(step, pxPerMinute(STEP_KEYS[step]!), 1);
  return scales.map((sc) => {
    const m = pinchMove(st, sc);
    st = m.st;
    return m;
  });
};

describe('pinch maths (runs on the UI thread)', () => {
  test('opening the fingers raises the density continuously and changes step on the way', () => {
    const [a, b] = run(3, [1.2, 2]);
    expect(a).toMatchObject({ kind: 'density' });
    expect(STEP_KEYS[a!.st.step]).toBe('m30');
    expect(STEP_KEYS[b!.st.step]).toBe('m15');
    expect(b!.ppm).toBeCloseTo(pxPerMinute('m30') * 2);
  });

  test('the density never goes below the 3 hours floor', () => {
    const out = run(3, [3, 0.1]);
    expect(out[1]).toMatchObject({ kind: 'density', ppm: PXM_MIN });
    expect(STEP_KEYS[out[1]!.st.step]).toBe('h3');
  });

  test('from 3 hours, squeezing further goes to the list, once per gesture', () => {
    const out = run(1, [0.9, 0.7, 2]);
    expect(out[0]).toMatchObject({ kind: 'density' });
    expect(out[1]).toMatchObject({ kind: 'mode', ppm: 0 });
    expect(out[1]!.st.step).toBe(0);
    // già passato alla lista: nello stesso gesto non si torna indietro (per riaprire bisogna mollare e ristringere)
    expect(out[2]!.kind).toBe('none');
  });

  test('a squeeze that starts on 30 minutes never jumps to the list', () => {
    const out = run(3, [0.05]);
    expect(out[0]).toMatchObject({ kind: 'density', ppm: PXM_MIN });
  });

  test('from the list, a hint of opening goes back to 3 hours and the gesture restarts from there', () => {
    let st = pinchBegin(0, 0, 1);
    expect(pinchMove(st, 1.03).kind).toBe('none');
    const m = pinchMove(st, 1.1);
    expect(m).toMatchObject({ kind: 'mode', ppm: pxPerMinute('h3') });
    st = m.st;
    // il tratto riparte dalla scala di quel momento: aprire ancora sale di scatto
    const next = pinchMove(st, 1.1 * 2);
    expect(next.kind).toBe('density');
    expect(next.ppm).toBeCloseTo(pxPerMinute('h3') * 2);
  });
});
