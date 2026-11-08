import { blipSamples, SAMPLE_RATE, wavBytes } from '../blip';
import { FRAMES, makeBurst, particleAt, type Particle } from '../confetti';

/** La fisica del sito, un passo alla volta (planner/habits.js). */
function simulate(p: Particle, steps: number) {
  let { x, y, vx, vy } = p;
  let life = 1;
  for (let i = 0; i < steps; i++) {
    vy += 0.28;
    vx *= 0.99;
    x += vx;
    y += vy;
    life -= 0.016;
  }
  return { x, y, life };
}

describe('confetti', () => {
  const seq = [0.1, 0.9, 0.4, 0.7, 0.2, 0.6, 0.3, 0.8];
  let k = 0;
  const rng = () => seq[k++ % seq.length]!;

  it('makes the asked number of pieces from the touch point', () => {
    const burst = makeBurst(40, 90, '#ff0000', 24, rng);
    expect(burst).toHaveLength(24);
    expect(burst.every((p) => p.x === 40 && p.y === 90)).toBe(true);
  });

  it('closed-form position matches the step-by-step physics', () => {
    const burst = makeBurst(10, 20, '#00ff00', 12, rng);
    for (const p of burst) {
      for (const n of [0, 1, 7, 30, FRAMES]) {
        const pose = particleAt(p, n);
        const sim = simulate(p, n);
        expect(pose.x).toBeCloseTo(sim.x, 6);
        expect(pose.y).toBeCloseTo(sim.y, 6);
        expect(pose.opacity).toBeCloseTo(Math.max(0, sim.life), 6);
      }
    }
  });

  it('is invisible at the end and stays put past the end', () => {
    const [p] = makeBurst(0, 0, '#000', 1, rng);
    expect(particleAt(p!, FRAMES).opacity).toBe(0);
    expect(particleAt(p!, FRAMES + 50).x).toBeCloseTo(particleAt(p!, FRAMES).x, 9);
  });
});

describe('blip sound', () => {
  it('lasts about a quarter of a second and stays quiet', () => {
    const s = blipSamples(true);
    expect(s.length).toBe(Math.floor(SAMPLE_RATE * 0.24));
    expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(0.09);
    expect(Math.max(...s.map(Math.abs))).toBeGreaterThan(0.05);
  });

  it('writes a valid 16-bit mono WAV', () => {
    const s = blipSamples(false);
    const bytes = wavBytes(s);
    const v = new DataView(bytes.buffer);
    const tag = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(bytes.length).toBe(44 + s.length * 2);
    expect(v.getUint32(4, true)).toBe(bytes.length - 8);
    expect(v.getUint32(40, true)).toBe(s.length * 2);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(34, true)).toBe(16);
  });
});
