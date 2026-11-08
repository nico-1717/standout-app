import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { keepFile } from './phoneFiles';

/** Il lato lungo massimo di un'immagine che parte dal telefono (ARCHITETTURA_APP.md §3.7). */
export const MAX_SIDE = 1600;

/** Le misure con il lato lungo al massimo `max`, senza ingrandire mai e senza deformare. */
export function fitSize(w: number, h: number, max = MAX_SIDE): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: max, height: max };
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export type PickedFile = { uri: string; mime: 'image/jpeg' };

/**
 * Sceglie una foto dalla libreria o la scatta, la riduce a JPEG (lato lungo 1600 px, qualità 80%) e la tiene al sicuro
 * nella cartella dell'app, pronta per la coda dei file. null = annullato, o permesso negato per la fotocamera.
 */
export async function pickImage(source: 'library' | 'camera'): Promise<PickedFile | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  const { width, height } = fitSize(asset.width, asset.height);
  const ctx = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (width < asset.width || height < asset.height) ctx.resize({ width, height });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: keepFile(out.uri, 'jpg'), mime: 'image/jpeg' };
}
