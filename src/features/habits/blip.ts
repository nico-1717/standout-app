/**
 * Il suono di conferma delle abitudini (blip di planner/habits.js): un'onda sinusoidale che sale da 660 a 1180 Hz in 0.11 s
 * (o scende da 420 a 300 Hz), con il volume che sale in fretta a 0.09 e si spegne entro 0.22 s. Il sito lo fa con
 * l'oscillatore del browser; qui lo si scrive come file WAV (16 bit, mono) e lo suona il lettore del telefono.
 */

export const SAMPLE_RATE = 22_050;
const DURATION = 0.24;

/** I campioni del suono, da -1 a 1. */
export function blipSamples(up: boolean, rate = SAMPLE_RATE): number[] {
  const f0 = up ? 660 : 420;
  const f1 = up ? 1180 : 300;
  const total = Math.floor(rate * DURATION);
  const out: number[] = [];
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / rate;
    // la frequenza passa da f0 a f1 in 0.11 s in modo esponenziale, poi resta
    const f = t >= 0.11 ? f1 : f0 * Math.pow(f1 / f0, t / 0.11);
    phase += (2 * Math.PI * f) / rate;
    // il volume: 0.0001 → 0.09 in 0.015 s, poi giù verso 0.0001 a 0.22 s (rampe esponenziali)
    const gain =
      t < 0.015
        ? 0.0001 * Math.pow(0.09 / 0.0001, t / 0.015)
        : t < 0.22
          ? 0.09 * Math.pow(0.0001 / 0.09, (t - 0.015) / (0.22 - 0.015))
          : 0;
    out.push(Math.sin(phase) * gain);
  }
  return out;
}

/** Il file WAV (PCM 16 bit, mono) di quei campioni. */
export function wavBytes(samples: readonly number[], rate = SAMPLE_RATE): Uint8Array {
  const data = samples.length * 2;
  const buf = new ArrayBuffer(44 + data);
  const v = new DataView(buf);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, data, true);
  samples.forEach((s, i) =>
    v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true),
  );
  return new Uint8Array(buf);
}
