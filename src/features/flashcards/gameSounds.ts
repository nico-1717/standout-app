import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { SAMPLE_RATE, wavBytes } from '@/features/habits/blip';

/**
 * I suoni del gioco (sezione «Audio» di fc_game_juice.js): piccoli, sintetizzati sul momento, a volume basso. Il sito li fa
 * con l'oscillatore del browser; qui si scrivono come file WAV nella cache (una volta sola) e li suona il lettore del
 * telefono, che rispetta l'interruttore del silenzioso.
 */

export type Wave = 'sine' | 'triangle';

export interface Note {
  /** hertz */
  f: number;
  /** quando parte, in secondi */
  at: number;
  /** quanto dura, in secondi */
  dur: number;
  wave: Wave;
  vol: number;
  /** se c'è, la frequenza scivola (esponenziale) fino a qui */
  fEnd?: number;
}

const note = (
  f: number,
  at: number,
  dur: number,
  wave: Wave,
  vol: number,
  fEnd?: number,
): Note => ({ f, at, dur, wave, vol, ...(fEnd ? { fEnd } : {}) });

const arpeggio = (freqs: number[], step: number, dur: number, vol: number, wave: Wave): Note[] =>
  freqs.map((f, i) => note(f, i * step, dur, wave, vol));

export type SoundName = 'right' | 'wrong' | 'step' | 'level' | 'checkpoint' | 'boss' | 'tap';

/** Le note di ogni suono. `giusta` sale con la serie: dopo un po' si «sente» di essere lanciati. */
export function notesOf(name: SoundName, streak = 0): Note[] {
  switch (name) {
    case 'right': {
      const base = 587 * Math.pow(2, Math.min(streak, 12) / 12);
      return [note(base, 0, 0.09, 'sine', 0.06), note(base * 1.5, 0.07, 0.14, 'sine', 0.05)];
    }
    case 'wrong':
      return [note(240, 0, 0.22, 'triangle', 0.06, 150)];
    case 'step':
      return arpeggio([659, 831, 988, 1319], 0.06, 0.16, 0.06, 'triangle');
    case 'level':
      return arpeggio([1047, 1319, 1568], 0.05, 0.12, 0.045, 'sine');
    case 'checkpoint':
      return arpeggio([523, 659, 784, 1047, 1319], 0.08, 0.22, 0.06, 'triangle');
    case 'boss':
      return arpeggio([392, 523, 659, 784, 1047, 784, 1047, 1319], 0.085, 0.24, 0.065, 'triangle');
    case 'tap':
      return [note(880, 0, 0.04, 'sine', 0.03)];
  }
}

/** Il volume della nota a un istante: sale in fretta (12 ms) e si spegne piano, con rampe esponenziali. */
function gainAt(t: number, dur: number, vol: number): number {
  const floor = 0.0001;
  if (t < 0 || t >= dur) return 0;
  const attack = 0.012;
  if (t < attack) return floor * Math.pow(vol / floor, t / attack);
  return vol * Math.pow(floor / vol, (t - attack) / (dur - attack));
}

const wave = (kind: Wave, phase: number): number =>
  kind === 'sine' ? Math.sin(phase) : (2 / Math.PI) * Math.asin(Math.sin(phase)); // triangolare, da -1 a 1

/** I campioni di tutte le note, sommate (da -1 a 1). */
export function renderNotes(notes: readonly Note[], rate = SAMPLE_RATE): number[] {
  const end = Math.max(...notes.map((n) => n.at + n.dur)) + 0.02;
  const out = new Array<number>(Math.ceil(end * rate)).fill(0);
  for (const n of notes) {
    const from = Math.floor(n.at * rate);
    const count = Math.floor(n.dur * rate);
    let phase = 0;
    for (let i = 0; i < count; i++) {
      const t = i / rate;
      const f = n.fEnd ? n.f * Math.pow(n.fEnd / n.f, t / n.dur) : n.f;
      phase += (2 * Math.PI * f) / rate;
      const idx = from + i;
      if (idx < out.length) out[idx] = out[idx]! + wave(n.wave, phase) * gainAt(t, n.dur, n.vol);
    }
  }
  return out.map((s) => Math.max(-1, Math.min(1, s)));
}

/** Il file WAV di un suono. */
export const soundBytes = (name: SoundName, streak = 0): Uint8Array =>
  wavBytes(renderNotes(notesOf(name, streak)));

/** Il nome del file in cache: la serie conta solo per `right` (e fino a 12). */
export const soundFile = (name: SoundName, streak = 0): string =>
  name === 'right' ? `fcg-right-${Math.min(Math.max(streak, 0), 12)}.wav` : `fcg-${name}.wav`;

/** Suona un suono del gioco. Mai un errore: se non parte, si gioca lo stesso. */
export function playSound(name: SoundName, streak = 0): void {
  try {
    const file = new File(Paths.cache, soundFile(name, streak));
    if (!file.exists) {
      file.create({ overwrite: true });
      file.write(soundBytes(name, streak));
    }
    // un suono di gioco rispetta il tasto silenzioso (a differenza di una registrazione)
    void setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined);
    const player = createAudioPlayer({ uri: file.uri });
    player.volume = 1;
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        /* già libero */
      }
    }, 1600);
  } catch {
    /* niente suono: pazienza */
  }
}
