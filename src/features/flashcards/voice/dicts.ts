import en from '@/core/i18n/lang/en.json';
import it from '@/core/i18n/lang/it.json';

import type { CommandDicts } from './commands';

/** Le frasi dei comandi di tutte le lingue (le stesse stringhe del sito). */
export const voiceDicts: CommandDicts = {
  it: it.fc as Record<string, string>,
  en: en.fc as Record<string, string>,
};

/** La lingua dei comandi: la scelta («» = come l'app) oppure, se è vuota, quella dell'app. */
export function resolveVoiceLang(pref: string, appLang: string): string {
  if (pref) return pref;
  return appLang.startsWith('it') ? 'it-IT' : 'en-US';
}
