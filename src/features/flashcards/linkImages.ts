import { imageFromLink } from '@/core/media/fetchImage';
import type { MediaTable } from '@/core/media/mediaQueue';
import type { PickedFile } from '@/core/media/pickImage';

/** Un'immagine da prendere da un link e mettere in un campo di una riga già creata. */
export type LinkJob = { table: MediaTable; uuid: string; slot: string; url: string };

/** Quanti link al massimo si scaricano in un'importazione (il resto si salta: meglio che bloccare il telefono). */
export const MAX_LINK_JOBS = 300;

/**
 * Scarica le immagini dei link una dopo l'altra e le mette nella coda dei file (partono verso il sito quando c'è
 * rete e la riga è arrivata). Un link che non dà un'immagine si salta e basta, come sul sito. Ritorna quante ne ha
 * messe e quante erano.
 */
export async function attachLinkImages(
  media: {
    putFile(table: MediaTable, uuid: string, slot: string, uri: string, mime: string): void;
  },
  jobs: LinkJob[],
  onProgress?: (done: number, total: number) => void,
  fetchImage: (url: string) => Promise<PickedFile | null> = imageFromLink,
): Promise<{ added: number; total: number }> {
  const list = jobs.slice(0, MAX_LINK_JOBS);
  let added = 0;
  for (let i = 0; i < list.length; i++) {
    const j = list[i]!;
    const file = await fetchImage(j.url);
    if (file) {
      media.putFile(j.table, j.uuid, j.slot, file.uri, file.mime);
      added += 1;
    }
    onProgress?.(i + 1, list.length);
  }
  return { added, total: list.length };
}
