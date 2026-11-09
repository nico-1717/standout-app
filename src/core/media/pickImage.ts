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
  return asset ? shrink(asset) : null;
}

type Asset = { uri: string; width: number; height: number };

/** Riduce una foto scelta a JPEG (lato lungo 1600 px, qualità 80%) e la tiene al sicuro nella cartella dell'app. */
async function shrink(asset: Asset): Promise<PickedFile> {
  const { width, height } = fitSize(asset.width, asset.height);
  const ctx = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (width < asset.width || height < asset.height) ctx.resize({ width, height });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: keepFile(out.uri, 'jpg'), mime: 'image/jpeg' };
}

/** Quante foto si possono scegliere in una volta sola (come la lista ordinata che il sito si aspetta dalle cartelle). */
export const MAX_PICKED = 60;

/**
 * Sceglie parecchie foto dalla libreria in una volta, nell'ordine in cui il telefono le dà (quello della selezione),
 * e le riduce una per una. Lista vuota = annullato.
 */
export async function pickImages(): Promise<PickedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: MAX_PICKED,
    orderedSelection: true,
  });
  if (result.canceled) return [];
  const out: PickedFile[] = [];
  for (const a of (result.assets ?? []).slice(0, MAX_PICKED)) out.push(await shrink(a));
  return out;
}
