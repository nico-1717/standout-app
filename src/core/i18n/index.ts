import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './lang/en.json';
import it from './lang/it.json';

/**
 * Le traduzioni sono quelle del SITO (lang/it.json, lang/en.json), copiate con
 * `npm run i18n:sync`: una sola fonte, nessuna doppia traduzione.
 * Stesse regole di t() del sito: chiavi a punti ("comune.salva"), segnaposto {nome},
 * se manca la lingua scelta si ripiega sull'italiano, se manca anche quella si
 * mostra <<chiave>> (volutamente brutto: si nota subito).
 */
export const SUPPORTED_LANGUAGES = ['it', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function pickLanguage(code: string | null | undefined): AppLanguage {
  return code === 'en' ? 'en' : 'it';
}

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: pickLanguage(getLocales()[0]?.languageCode),
  fallbackLng: 'it',
  keySeparator: '.',
  nsSeparator: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  parseMissingKeyHandler: (key: string) => `<<${key}>>`,
  returnNull: false,
});

export default i18n;
