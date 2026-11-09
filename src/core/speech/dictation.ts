/**
 * Dettatura: la voce diventa testo. La punteggiatura è la stessa del sito (`standoutPunctuate` in
 * `diario_giorno.php` e i segni dettati di `format_toolbar.php`): il riconoscimento consegna le frasi senza chiuderle,
 * qui si indovina il segno guardando come finisce e come comincia la frase. Niente intelligenza artificiale, solo
 * regole; in dubbio si mette il punto, il caso più frequente e il meno fastidioso da correggere.
 */

const CONTINUA_IT = [
  'e', 'ed', 'ma', 'però', 'perché', 'perche', 'quindi', 'allora', 'mentre', 'se', 'che',
  'oppure', 'anche', 'inoltre', 'cioè', 'cioe', 'ovvero', 'dunque', 'infatti', 'comunque',
  'con', 'per', 'di', 'da', 'in', 'su', 'tra', 'fra', 'a', 'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'del', 'dello', 'della', 'dei', 'degli', 'delle', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'come', 'quando', 'dove', 'finché', 'finche',
]; // prettier-ignore
const CONTINUA_EN = [
  'and', 'but', 'because', 'so', 'then', 'while', 'if', 'that', 'or', 'also', 'with', 'for', 'of', 'to',
  'in', 'on', 'at', 'from', 'by', 'about', 'when', 'where', 'until', 'the', 'a', 'an', 'my', 'your',
]; // prettier-ignore
const DOMANDA_EN = [
  'who', 'what', 'how', 'when', 'where', 'why', 'which', 'is', 'are', 'was', 'were', 'can', 'could',
  'should', 'would', 'will', 'did', 'does', 'have', 'has',
]; // prettier-ignore
const DOMANDA_IT = [
  'chi', 'cosa', 'che', 'come', 'quando', 'dove', 'perché', 'perche', 'quale', 'quali',
  'quanto', 'quanta', 'quanti', 'quante', 'sono', 'è', 'è', 'ho', 'hai', 'ha',
]; // prettier-ignore

/** Chiude una frase appena dettata: «?» se comincia come una domanda, «,» se finisce con una parola che regge un seguito. */
export function punctuate(phrase: string, lang: string): string {
  const s = String(phrase || '').trim();
  if (!s) return s;
  // già chiusa da chi parlava («punto», «virgola»…): non si tocca
  if (/[.,;:!?…]$/.test(s)) return s;

  const words = s
    .toLowerCase()
    .replace(/[^a-zàèéìòùü'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return s;
  const last = words[words.length - 1]!;
  const first = words[0]!;
  const english = lang.slice(0, 2).toLowerCase() === 'en';

  if ((english ? DOMANDA_EN : DOMANDA_IT).includes(first) && words.length <= 12) return `${s}?`;
  if ((english ? CONTINUA_EN : CONTINUA_IT).includes(last)) return `${s},`;
  if (words.length <= 2) return `${s},`;
  return `${s}.`;
}

/** I segni che si possono dettare, per lingua (lingue dell'app). Le espressioni più lunghe prima. */
const MARKS: Record<string, [string, string][]> = {
  it: [
    ['punto e virgola', ';'], ['punto interrogativo', '?'], ['punto esclamativo', '!'],
    ['punto di domanda', '?'], ['due punti', ':'], ['puntini di sospensione', '…'],
    ['aperta parentesi', '('], ['apri parentesi', '('], ['chiusa parentesi', ')'], ['chiudi parentesi', ')'],
    ['virgolette', '"'], ['nuova riga', '\n'], ['a capo', '\n'], ['punto', '.'], ['virgola', ','],
  ], // prettier-ignore
  en: [
    ['question mark', '?'], ['exclamation mark', '!'], ['exclamation point', '!'],
    ['full stop', '.'], ['semicolon', ';'], ['ellipsis', '…'],
    ['open bracket', '('], ['close bracket', ')'], ['new line', '\n'], ['new paragraph', '\n'],
    ['colon', ':'], ['period', '.'], ['comma', ','],
  ], // prettier-ignore
};

const bare = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const table = (lang: string): [string, string][] =>
  MARKS[lang.slice(0, 2).toLowerCase()] ?? MARKS.it!;

/** Se TUTTO quello che si è detto è un unico segno («punto», «virgola»), il segno; altrimenti `null`. A capo escluso. */
export function lonelyMark(text: string, lang: string): string | null {
  const t = bare(String(text || '').trim());
  if (!t) return null;
  for (const [word, mark] of table(lang)) {
    if (mark !== '\n' && bare(word) === t) return mark;
  }
  return null;
}

/** Se tutto quello che si è detto è «a capo» / «nuova riga». */
export function isNewLine(text: string, lang: string): boolean {
  const t = bare(String(text || '').trim());
  return !!t && table(lang).some(([word, mark]) => mark === '\n' && bare(word) === t);
}

/**
 * Aggiunge una frase dettata (definitiva) al testo che c'è già: un segno detto da solo si attacca alla parola prima, «a
 * capo» va a capo, il resto si chiude con la punteggiatura indovinata e si separa con uno spazio.
 */
export function appendDictated(base: string, chunk: string, lang: string): string {
  const c = String(chunk || '').trim();
  if (!c) return base;
  if (isNewLine(c, lang)) return `${base.replace(/[ \t]+$/, '')}\n`;
  const mark = lonelyMark(c, lang);
  if (mark !== null) {
    const plain = base.replace(/\s+$/, '');
    // «virgola» detto dopo una frase già chiusa dal punto indovinato: il segno detto vince, non si mettono due segni
    return `${/^[.,;:!?…]$/.test(mark) ? plain.replace(/[.,;:!?…]+$/, '') : plain}${mark}`;
  }
  const closed = punctuate(c, lang);
  if (!base) return closed;
  // dopo un a capo non serve lo spazio
  return base.endsWith('\n') ? `${base}${closed}` : `${base.replace(/[ \t]+$/, '')} ${closed}`;
}

/** La lingua del riconoscimento per la lingua dell'app (come sul sito: inglese → en-US, il resto → it-IT). */
export const dictationLang = (appLang: string): string =>
  appLang.slice(0, 2).toLowerCase() === 'en' ? 'en-US' : 'it-IT';
