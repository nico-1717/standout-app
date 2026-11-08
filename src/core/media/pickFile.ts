import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/** Un file da importare più grande di così non si apre (un foglio vero di anni di dati è molto sotto). */
export const MAX_IMPORT_BYTES = 30 * 1024 * 1024;

export type PickedDoc = { name: string; bytes: Uint8Array };

/** Un file qualsiasi scelto dall'utente (Files, iCloud, Drive…), letto per intero. null = annullato. */
export async function pickDocument(): Promise<PickedDoc | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return null;
  if (typeof asset.size === 'number' && asset.size > MAX_IMPORT_BYTES)
    throw new Error('troppo_grande');
  const copy = new File(asset.uri);
  try {
    return { name: asset.name, bytes: new Uint8Array(await copy.arrayBuffer()) };
  } finally {
    // la copia nella cache dell'app non serve più: i dati personali non devono restare in giro
    try {
      if (copy.exists) copy.delete();
    } catch {
      /* già sparita */
    }
  }
}
