import {
  FLYERS,
  WALKERS,
  ambientOpacity,
  animalBox,
  buildDrifters,
  buildParticles,
  fitContain,
  monthConfig,
  rng,
} from '../scene';
import { ANIMALS, TREES } from '../shapes';

describe('month scenes', () => {
  test('all twelve months have a scene whose tree and animal drawings exist', () => {
    for (let m = 1; m <= 12; m++) {
      const cfg = monthConfig(m);
      expect(cfg).not.toBeNull();
      expect(TREES[cfg!.tree]?.d.length).toBeGreaterThan(100);
      if (cfg!.animal) expect(ANIMALS[cfg!.animal]?.d.length).toBeGreaterThan(100);
      expect(cfg!.sky).toHaveLength(2);
    }
    expect(monthConfig(13)).toBeNull();
  });

  test('the animals that walk and fly are real animals of some month', () => {
    const names = Array.from({ length: 12 }, (_, i) => monthConfig(i + 1)!.animal);
    for (const a of [...WALKERS, ...FLYERS]) expect(names).toContain(a);
  });

  test('the same month always gives the same scene', () => {
    const cfg = monthConfig(3)!;
    expect(buildParticles(cfg, 99)).toEqual(buildParticles(cfg, 99));
    expect(buildDrifters(cfg, 99)).toEqual(buildDrifters(cfg, 99));
    expect(buildParticles(cfg, 99)).not.toEqual(buildParticles(cfg, 100));
  });

  test('March has the number of petals and insects the file asks for, inside their ranges', () => {
    const cfg = monthConfig(3)!;
    const parts = buildParticles(cfg, 1);
    expect(parts).toHaveLength(22);
    for (const p of parts) {
      expect(p.size).toBeGreaterThanOrEqual(5);
      expect(p.size).toBeLessThanOrEqual(10);
      expect(p.duration).toBeGreaterThanOrEqual(10);
      expect(p.duration).toBeLessThanOrEqual(18);
      expect(Math.abs(p.sway)).toBeLessThanOrEqual(52);
      expect(p.left).toBeGreaterThanOrEqual(-2);
      expect(p.left).toBeLessThanOrEqual(98);
      expect(['#F0B9C8', '#E79BB0', '#FBDEE6']).toContain(p.color);
    }
    const bugs = buildDrifters(cfg, 1);
    expect(bugs.map((d) => d.type).sort()).toEqual(['bee', 'bee', 'butterfly']);
  });

  test('stars stay put and twinkle for 3 to 6 seconds', () => {
    const stars = buildParticles(monthConfig(8)!, 5).filter((p) => p.type === 'star');
    expect(stars).toHaveLength(9);
    for (const s of stars) {
      expect(s.duration).toBeGreaterThanOrEqual(3);
      expect(s.duration).toBeLessThanOrEqual(6);
      expect(s.top).toBeGreaterThanOrEqual(6);
      expect(s.top).toBeLessThanOrEqual(62);
    }
  });

  test('the random numbers are in [0, 1)', () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('animal boxes: defaults, per-animal overrides, and fitting without squashing', () => {
    expect(animalBox('qualcosa')).toEqual({ x: 62, down: 2, w: 38, h: 34 });
    expect(animalBox('cane')).toEqual({ x: 62, down: -5, w: 46, h: 40 });
    const fit = fitContain({ w: 500, h: 159 }, { w: 48, h: 22 });
    expect(fit.w / fit.h).toBeCloseTo(500 / 159, 5);
    expect(fit.w).toBeLessThanOrEqual(48);
    expect(fit.h).toBeLessThanOrEqual(22);
  });

  test('visibility goes from 0 to 1 with 9 as the starting value', () => {
    expect(ambientOpacity(undefined)).toBe(0.9);
    expect(ambientOpacity(0)).toBe(0);
    expect(ambientOpacity(10)).toBe(1);
    expect(ambientOpacity(40)).toBe(1);
    expect(ambientOpacity(-3)).toBe(0);
  });
});
