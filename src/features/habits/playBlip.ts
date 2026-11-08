import { createAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { blipSamples, wavBytes } from './blip';

/** Suona il blip di conferma (sale = fatto, scende = tolto). Il file si scrive una volta sola nella cache; mai un errore. */
export function playBlip(up = true): void {
  try {
    const file = new File(Paths.cache, up ? 'habit-blip-up.wav' : 'habit-blip-down.wav');
    if (!file.exists) {
      file.create({ overwrite: true });
      file.write(wavBytes(blipSamples(up)));
    }
    const player = createAudioPlayer({ uri: file.uri });
    player.volume = 1;
    player.play();
    // il lettore si libera dopo la fine del suono
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        /* già libero */
      }
    }, 1200);
  } catch {
    /* niente suono: pazienza */
  }
}
