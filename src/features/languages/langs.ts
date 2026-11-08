/**
 * L'elenco delle lingue dei corsi: copia di FC_LINGUE (lib/fc/fc_type.php del sito). Se il sito cambia l'elenco, rifai
 * questo file con lo stesso ordine delle colonne.
 * Colonne: codice, bandiera (codice paese del sito), voce per leggere ad alta voce, nome it, variante it, nome en,
 * variante en, nome nella lingua stessa, variante nella lingua stessa.
 */
type Row = [string, string, string, string, string, string, string, string, string];

const ROWS: Row[] = [
  ['af', 'za', 'af-ZA', 'Afrikaans', '', 'Afrikaans', '', 'Afrikaans', ''],
  ['sq', 'al', 'sq-AL', 'Albanese', '', 'Albanian', '', 'Shqip', ''],
  ['ar', 'sa', 'ar-SA', 'Arabo', '', 'Arabic', '', 'العربية', ''],
  ['bn', 'bd', 'bn-BD', 'Bengalese', '', 'Bengali', '', 'বাংলা', ''],
  ['bg', 'bg', 'bg-BG', 'Bulgaro', '', 'Bulgarian', '', 'Български', ''],
  ['ca', 'es-ct', 'ca-ES', 'Catalano', '', 'Catalan', '', 'Català', ''],
  ['zh-CN', 'cn', 'zh-CN', 'Cinese', 'Semplificato', 'Chinese', 'Simplified', '中文', '简体'],
  ['zh-TW', 'tw', 'zh-TW', 'Cinese', 'Tradizionale', 'Chinese', 'Traditional', '中文', '繁體'],
  ['zh-HK', 'hk', 'zh-HK', 'Cantonese', '', 'Cantonese', '', '粵語', ''],
  ['hr', 'hr', 'hr-HR', 'Croato', '', 'Croatian', '', 'Hrvatski', ''],
  ['cs', 'cz', 'cs-CZ', 'Ceco', '', 'Czech', '', 'Čeština', ''],
  ['da', 'dk', 'da-DK', 'Danese', '', 'Danish', '', 'Dansk', ''],
  ['nl', 'nl', 'nl-NL', 'Olandese', '', 'Dutch', '', 'Nederlands', ''],
  [
    'en-GB',
    'gb',
    'en-GB',
    'Inglese',
    'Regno Unito',
    'English',
    'United Kingdom',
    'English',
    'United Kingdom',
  ],
  [
    'en-US',
    'us',
    'en-US',
    'Inglese',
    'Stati Uniti',
    'English',
    'United States',
    'English',
    'United States',
  ],
  ['en-AU', 'au', 'en-AU', 'Inglese', 'Australia', 'English', 'Australia', 'English', 'Australia'],
  ['et', 'ee', 'et-EE', 'Estone', '', 'Estonian', '', 'Eesti', ''],
  ['fil', 'ph', 'fil-PH', 'Filippino', '', 'Filipino', '', 'Filipino', ''],
  ['fi', 'fi', 'fi-FI', 'Finlandese', '', 'Finnish', '', 'Suomi', ''],
  ['fr-FR', 'fr', 'fr-FR', 'Francese', 'Francia', 'French', 'France', 'Français', 'France'],
  ['fr-CA', 'ca', 'fr-CA', 'Francese', 'Canada', 'French', 'Canada', 'Français', 'Canada'],
  ['de', 'de', 'de-DE', 'Tedesco', '', 'German', '', 'Deutsch', ''],
  ['el', 'gr', 'el-GR', 'Greco', '', 'Greek', '', 'Ελληνικά', ''],
  ['he', 'il', 'he-IL', 'Ebraico', '', 'Hebrew', '', 'עברית', ''],
  ['hi', 'in', 'hi-IN', 'Hindi', '', 'Hindi', '', 'हिन्दी', ''],
  ['hu', 'hu', 'hu-HU', 'Ungherese', '', 'Hungarian', '', 'Magyar', ''],
  ['is', 'is', 'is-IS', 'Islandese', '', 'Icelandic', '', 'Íslenska', ''],
  ['id', 'id', 'id-ID', 'Indonesiano', '', 'Indonesian', '', 'Indonesia', ''],
  ['ga', 'ie', 'ga-IE', 'Irlandese', '', 'Irish', '', 'Gaeilge', ''],
  ['it', 'it', 'it-IT', 'Italiano', '', 'Italian', '', 'Italiano', ''],
  ['ja', 'jp', 'ja-JP', 'Giapponese', '', 'Japanese', '', '日本語', ''],
  ['ko', 'kr', 'ko-KR', 'Coreano', '', 'Korean', '', '한국어', ''],
  ['lv', 'lv', 'lv-LV', 'Lettone', '', 'Latvian', '', 'Latviešu', ''],
  ['lt', 'lt', 'lt-LT', 'Lituano', '', 'Lithuanian', '', 'Lietuvių', ''],
  ['ms', 'my', 'ms-MY', 'Malese', '', 'Malay', '', 'Melayu', ''],
  ['nb', 'no', 'nb-NO', 'Norvegese', '', 'Norwegian', '', 'Norsk', ''],
  ['fa', 'ir', 'fa-IR', 'Persiano', '', 'Persian', '', 'فارسی', ''],
  ['pl', 'pl', 'pl-PL', 'Polacco', '', 'Polish', '', 'Polski', ''],
  [
    'pt-PT',
    'pt',
    'pt-PT',
    'Portoghese',
    'Portogallo',
    'Portuguese',
    'Portugal',
    'Português',
    'Portugal',
  ],
  ['pt-BR', 'br', 'pt-BR', 'Portoghese', 'Brasile', 'Portuguese', 'Brazil', 'Português', 'Brasil'],
  ['ro', 'ro', 'ro-RO', 'Rumeno', '', 'Romanian', '', 'Română', ''],
  ['ru', 'ru', 'ru-RU', 'Russo', '', 'Russian', '', 'Русский', ''],
  ['sr', 'rs', 'sr-RS', 'Serbo', '', 'Serbian', '', 'Српски', ''],
  ['sk', 'sk', 'sk-SK', 'Slovacco', '', 'Slovak', '', 'Slovenčina', ''],
  ['sl', 'si', 'sl-SI', 'Sloveno', '', 'Slovenian', '', 'Slovenščina', ''],
  ['es-ES', 'es', 'es-ES', 'Spagnolo', 'Spagna', 'Spanish', 'Spain', 'Español', 'España'],
  ['es-MX', 'mx', 'es-MX', 'Spagnolo', 'Messico', 'Spanish', 'Mexico', 'Español', 'México'],
  ['sw', 'ke', 'sw-KE', 'Swahili', '', 'Swahili', '', 'Kiswahili', ''],
  ['sv', 'se', 'sv-SE', 'Svedese', '', 'Swedish', '', 'Svenska', ''],
  ['ta', 'in', 'ta-IN', 'Tamil', '', 'Tamil', '', 'தமிழ்', ''],
  ['th', 'th', 'th-TH', 'Thailandese', '', 'Thai', '', 'ไทย', ''],
  ['tr', 'tr', 'tr-TR', 'Turco', '', 'Turkish', '', 'Türkçe', ''],
  ['uk', 'ua', 'uk-UA', 'Ucraino', '', 'Ukrainian', '', 'Українська', ''],
  ['ur', 'pk', 'ur-PK', 'Urdu', '', 'Urdu', '', 'اردو', ''],
  ['vi', 'vn', 'vi-VN', 'Vietnamita', '', 'Vietnamese', '', 'Tiếng Việt', ''],
  ['cy', 'gb-wls', 'cy-GB', 'Gallese', '', 'Welsh', '', 'Cymraeg', ''],
  ['gu', 'in', 'gu-IN', 'Gujarati', '', 'Gujarati', '', 'ગુજરાતી', ''],
  ['mr', 'in', 'mr-IN', 'Marathi', '', 'Marathi', '', 'मराठी', ''],
  ['te', 'in', 'te-IN', 'Telugu', '', 'Telugu', '', 'తెలుగు', ''],
  ['kn', 'in', 'kn-IN', 'Kannada', '', 'Kannada', '', 'ಕನ್ನಡ', ''],
  ['ml', 'in', 'ml-IN', 'Malayalam', '', 'Malayalam', '', 'മലയാളം', ''],
  ['eu', 'es-pv', 'eu-ES', 'Basco', '', 'Basque', '', 'Euskara', ''],
  ['gl', 'es-ga', 'gl-ES', 'Galiziano', '', 'Galician', '', 'Galego', ''],
];

/** Le lingue proposte per prime, prima ancora di scrivere. */
export const POPULAR_LANGS: string[] = [
  'en-GB',
  'es-ES',
  'fr-FR',
  'de',
  'en-US',
  'pt-BR',
  'ja',
  'zh-CN',
  'ko',
  'ru',
  'ar',
  'it',
];

export interface Lang {
  code: string;
  flag: string;
  voice: string;
  nameIt: string;
  variantIt: string;
  nameEn: string;
  variantEn: string;
  native: string;
  nativeVariant: string;
}

export const LANGS: Lang[] = ROWS.map(
  ([code, flag, voice, nameIt, variantIt, nameEn, variantEn, native, nativeVariant]) => ({
    code,
    flag,
    voice,
    nameIt,
    variantIt,
    nameEn,
    variantEn,
    native,
    nativeVariant,
  }),
);

const BY_CODE = new Map(LANGS.map((l) => [l.code, l]));

/** La lingua di base di un codice: en-GB → en. */
export const langBase = (code: string): string => code.split('-')[0]!;

/** Il codice è una lingua che si può imparare? */
export const isLearnLang = (code: string): boolean => BY_CODE.has(code);

/** Quella che si conosce si salva senza variante: basta che la base esista nell'elenco. */
export const isKnownLang = (code: string): boolean => LANGS.some((l) => langBase(l.code) === code);

/** La voce dell'elenco per un codice, anche solo di base ('en' → la prima inglese). */
export function langEntry(code: string): Lang | null {
  return BY_CODE.get(code) ?? LANGS.find((l) => langBase(l.code) === code) ?? null;
}

/** Il nome da mostrare. `withVariant`: «Inglese (Regno Unito)»; la variante si mostra solo dove serve. */
export function langName(code: string, ui: 'it' | 'en', withVariant = true): string {
  const l = langEntry(code);
  if (!l) return code;
  const [name, variant] = ui === 'en' ? [l.nameEn, l.variantEn] : [l.nameIt, l.variantIt];
  if (!withVariant || !code.includes('-') || !variant) return name;
  return `${name} (${variant})`;
}

/** Il nome nella lingua stessa: «Deutsch», «日本語». */
export const langNative = (code: string): string => langEntry(code)?.native ?? code;

/** La voce per leggere e ascoltare: «en-GB», «de-DE». */
export const langVoice = (code: string): string => langEntry(code)?.voice ?? code;

/** La bandiera come emoji (due lettere del paese); le regioni senza codice a due lettere hanno un globo. */
export function langFlag(code: string): string {
  const f = langEntry(code)?.flag ?? '';
  if (!/^[a-z]{2}$/.test(f)) return '🌐';
  return String.fromCodePoint(...[...f.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Le lingue che si possono scegliere come «da imparare», senza quella che già si conosce, in ordine alfabetico. */
export function learnChoices(known: string, ui: 'it' | 'en'): Lang[] {
  return LANGS.filter((l) => langBase(l.code) !== known).sort((a, b) =>
    langName(a.code, ui).localeCompare(langName(b.code, ui), ui),
  );
}
