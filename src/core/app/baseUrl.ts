const PRODUCTION_URL = 'https://nisama.altervista.org';

/**
 * Sceglie l'indirizzo del server. L'override (EXPO_PUBLIC_API_URL) serve solo per provare in locale:
 * in una versione vera accetta solo https, così una variabile rimasta per sbaglio non fa viaggiare
 * password e token in chiaro. Se l'override non va bene si usa il sito vero.
 */
export function pickBaseUrl(override: string | undefined, dev: boolean): string {
  const url = override?.trim().replace(/\/+$/, '');
  if (!url) return PRODUCTION_URL;
  if (/^https:\/\//i.test(url)) return url;
  if (dev && /^http:\/\/[^/]+/i.test(url)) return url;
  return PRODUCTION_URL;
}

export const BASE_URL = pickBaseUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);
