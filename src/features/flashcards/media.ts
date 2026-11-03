import { BASE_URL } from '@/core/app/baseUrl';

/** I nomi che sceglie il server sono lettere, cifre, `_`, `-` e un punto: niente altro entra in un indirizzo. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9]{2,5}$/;

const url = (folder: string, name: string | null | undefined): string | null => {
  const n = (name ?? '').trim();
  return SAFE_NAME.test(n) ? `${BASE_URL.replace(/\/$/, '')}/media/${folder}/${n}` : null;
};

/** L'indirizzo dell'immagine di una carta (cartella `flashcard_images` del sito), o null se il nome non va bene. */
export const cardImageUrl = (name: string | null | undefined): string | null =>
  url('flashcard_images', name);

/** L'indirizzo dell'audio di una carta (cartella `flashcard_audio`). */
export const cardAudioUrl = (name: string | null | undefined): string | null =>
  url('flashcard_audio', name);

/** L'immagine di un esempio (cartella `example_images`). */
export const exampleImageUrl = (name: string | null | undefined): string | null =>
  url('example_images', name);
