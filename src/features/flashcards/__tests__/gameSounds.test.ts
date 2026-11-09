import { SAMPLE_RATE } from '@/features/habits/blip';

import { notesOf, renderNotes, soundBytes, soundFile } from '../gameSounds';

describe('game sounds, from the site', () => {
  test('a right answer is two notes and climbs a semitone a step with the streak, up to 12', () => {
    const at0 = notesOf('right', 0);
    const at12 = notesOf('right', 12);
    expect(at0[0]!.f).toBeCloseTo(587, 5);
    expect(at0[1]!.f).toBeCloseTo(587 * 1.5, 5);
    expect(at12[0]!.f).toBeCloseTo(1174, 5);
    expect(notesOf('right', 40)[0]!.f).toBeCloseTo(1174, 5);
    expect(notesOf('right', 1)[0]!.f / notesOf('right', 0)[0]!.f).toBeCloseTo(2 ** (1 / 12), 6);
  });

  test('the wrong answer slides down from 240 to 150 Hz', () => {
    expect(notesOf('wrong')).toEqual([
      { f: 240, at: 0, dur: 0.22, wave: 'triangle', vol: 0.06, fEnd: 150 },
    ]);
  });

  test.each([
    ['step', [659, 831, 988, 1319], 0.06],
    ['level', [1047, 1319, 1568], 0.05],
    ['checkpoint', [523, 659, 784, 1047, 1319], 0.08],
    ['boss', [392, 523, 659, 784, 1047, 784, 1047, 1319], 0.085],
  ] as const)('%s is an arpeggio of the site notes', (name, freqs, gap) => {
    const notes = notesOf(name);
    expect(notes.map((n) => n.f)).toEqual(freqs);
    notes.forEach((n, i) => expect(n.at).toBeCloseTo(i * gap, 6));
  });

  test('every sound is quiet (never above 0.07 per note) and short (under 1.2 s)', () => {
    for (const name of ['right', 'wrong', 'step', 'level', 'checkpoint', 'boss', 'tap'] as const) {
      const notes = notesOf(name, 5);
      for (const n of notes) expect(n.vol).toBeLessThanOrEqual(0.07);
      const samples = renderNotes(notes);
      expect(samples.length / SAMPLE_RATE).toBeLessThan(1.2);
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.14);
      expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(0.01);
    }
  });

  test('the sound is silent at the start and ends at zero', () => {
    const s = renderNotes(notesOf('checkpoint'));
    expect(Math.abs(s[0]!)).toBeLessThan(0.001);
    expect(Math.abs(s[s.length - 1]!)).toBeLessThan(0.001);
  });

  test('the file is a valid 16-bit mono WAV', () => {
    const b = soundBytes('tap');
    expect(String.fromCharCode(...b.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...b.slice(8, 12))).toBe('WAVE');
    const v = new DataView(b.buffer);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(b.length - 44);
  });

  test('cache file names: one per sound, one per streak height for the right answer', () => {
    expect(soundFile('boss')).toBe('fcg-boss.wav');
    expect(soundFile('right', 3)).toBe('fcg-right-3.wav');
    expect(soundFile('right', 99)).toBe('fcg-right-12.wav');
  });
});
