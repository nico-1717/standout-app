import * as ImageManipulator from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

import { fitSize, type PickedFile } from './pickImage';
import { keepFile } from './phoneFiles';

/** Un'immagine da un link più grande di così non si prende (come sul sito: 5 MB). */
export const MAX_LINK_BYTES = 5 * 1024 * 1024;
/** Quanto si aspetta il sito del link (come sul sito: 12 secondi). */
export const LINK_TIMEOUT_MS = 12000;

export type ImageKind = 'jpg' | 'png' | 'gif' | 'webp';

/** Il tipo vero di un'immagine dai suoi primi byte (non ci si fida del nome né di quello che dice il sito). */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return 'png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return 'gif';
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 && // RIFF
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50 // WEBP
  )
    return 'webp';
  return null;
}

/** Il link va bene solo se è http(s), senza nome e password dentro, e non troppo lungo. */
export function usableLink(raw: string): string | null {
  const url = raw.trim();
  if (!url || url.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password || !u.hostname) return null;
  return url;
}

type FetchLike = (
  url: string,
  init: { signal: AbortSignal; redirect: 'follow' },
) => Promise<{
  ok: boolean;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

/** Scarica i byte di un'immagine da un link: null se il link non va, è lento, è troppo grande o non è un'immagine. */
export async function downloadImage(
  raw: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<{ bytes: Uint8Array; kind: ImageKind } | null> {
  const url = usableLink(raw);
  if (!url) return null;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), LINK_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: stop.signal, redirect: 'follow' });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length'));
    if (declared > MAX_LINK_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_LINK_BYTES) return null;
    const kind = sniffImage(bytes);
    return kind ? { bytes, kind } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prende un'immagine da un link e la prepara come ogni foto dell'app: JPEG, lato lungo al massimo 1600 px, al sicuro
 * nella cartella dell'app, pronta per la coda dei file. null = il link non ha dato un'immagine.
 */
export async function imageFromLink(raw: string, fetchFn?: FetchLike): Promise<PickedFile | null> {
  const got = await downloadImage(raw, fetchFn);
  if (!got) return null;
  const temp = new File(
    Paths.cache,
    `link_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${got.kind}`,
  );
  try {
    temp.create({ overwrite: true });
    temp.write(got.bytes);
    const base = await ImageManipulator.ImageManipulator.manipulate(temp.uri).renderAsync();
    const { width, height } = fitSize(base.width, base.height);
    const shrink =
      base.width > 0 && base.height > 0 && (width < base.width || height < base.height);
    const ctx = ImageManipulator.ImageManipulator.manipulate(temp.uri);
    if (shrink) ctx.resize({ width, height });
    const ref = shrink ? await ctx.renderAsync() : base;
    const out = await ref.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: keepFile(out.uri, 'jpg'), mime: 'image/jpeg' };
  } catch {
    return null;
  } finally {
    try {
      if (temp.exists) temp.delete();
    } catch {
      /* già sparito */
    }
  }
}
