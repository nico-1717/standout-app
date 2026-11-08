import { Directory, File, Paths } from 'expo-file-system';

import type { MediaFiles } from './mediaQueue';
import type { PrivateFiles } from './privateImages';

const FOLDER = 'media_queue';

/** Tiene al sicuro un file scelto o registrato (la cache di sistema può svuotarsi prima dell'invio): lo copia e dà il nuovo indirizzo. */
export function keepFile(sourceUri: string, ext: string): string {
  const dir = new Directory(Paths.document, FOLDER);
  dir.create({ idempotent: true, intermediates: true });
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
  const target = new File(
    dir,
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${safeExt}`,
  );
  new File(sourceUri).copy(target);
  return target.uri;
}

/** Cancella solo file della nostra cartella: un indirizzo che sta altrove non si tocca mai. */
export const phoneFiles: MediaFiles = {
  delete(uri) {
    if (!uri.includes(`/${FOLDER}/`)) return;
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      /* già sparito: va bene */
    }
  },
};

const PRIVATE_FOLDER = 'private_images';

/** Le immagini private scaricate stanno nella cache dell'app: se il sistema la svuota, si riscaricano. */
export const privateFiles: PrivateFiles = {
  existing(key) {
    const f = new File(new Directory(Paths.cache, PRIVATE_FOLDER), key);
    return f.exists ? f.uri : null;
  },
  async download(url, headers, key) {
    const dir = new Directory(Paths.cache, PRIVATE_FOLDER);
    dir.create({ idempotent: true, intermediates: true });
    const target = new File(dir, key);
    if (target.exists) target.delete();
    const out = await File.downloadFileAsync(url, target, { headers });
    return out.uri;
  },
};
