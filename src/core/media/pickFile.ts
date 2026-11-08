import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

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
  const bytes = new Uint8Array(await new File(asset.uri).arrayBuffer());
  return { name: asset.name, bytes };
}
