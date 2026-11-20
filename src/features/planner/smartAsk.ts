import { addDaysIso } from './dates';
import { smartParse, smartWords, trovaChiave, type Contact, type SmartParsed } from './smart';

/**
 * «19 doccia»: il 19 è un giorno o un'ora? La barra intelligente non lo sa indovinare, quindi lo chiede. Qui si
 * riconosce il numero scritto da solo (senza «alle», «il», un mese, un giorno prima…) e si riscrive la frase in
 * una forma che smartParse() capisce, secondo la risposta.
 */
export type SmartChoice = 'date' | 'time' | 'text';

export interface SmartAsk {
  /** il numero, com'è scritto */
  n: number;
  /** la posizione della parola nella frase */
  index: number;
  /** le risposte che hanno senso: se il giorno (o l'ora) è già scritto, l'altra non si offre */
  options: Exclude<SmartChoice, 'text'>[];
  /** il giorno in cui cadrebbe, se è una data: il prossimo «19» che viene */
  dateIso: string;
}

type Ctx = { today: string; focusDate: string; contacts?: Contact[] };

/** Le parole che, davanti al numero, dicono già cos'è («alle 19», «il 19», «domani 15»). */
const BEFORE = new Set([
  'alle',
  'alla',
  'ore',
  'ora',
  'verso',
  'at',
  'around',
  'il',
  'on',
  'the',
  'del',
  'dal',
  'dalle',
  'from',
  'to',
  'until',
  'fino',
  'by',
  'entro',
  'di',
  'of',
]);

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const validDay = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Il prossimo giorno del mese «n» (oggi compreso): se questo mese è passato, il mese dopo. */
export function nextDayOfMonth(today: string, n: number): string {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < 14; i++) {
    const iso = `${y}-${pad(m)}-${pad(n)}`;
    if (validDay(y, m, n) && iso >= today) return iso;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return addDaysIso(today, n);
}

const without = (words: string[], index: number) => words.filter((_, i) => i !== index).join(' ');

/** La frase ha un numero da chiarire? (null = no: si crea l'evento come prima) */
export function smartAsk(raw: string, ctx: Ctx): SmartAsk | null {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const lower = words.map((w) => w.toLowerCase());
  const { months, days } = smartWords();
  const isMonth = (w: string | undefined) =>
    !!w && w.length >= 3 && !!trovaChiave(` ${w} `, months, 1);
  for (let i = 0; i < words.length; i++) {
    if (!/^\d{1,2}$/.test(lower[i]!)) continue;
    const n = Number(lower[i]);
    if (n < 1 || n > 23) continue;
    const prev = lower[i - 1];
    if (prev && (BEFORE.has(prev) || days.includes(prev) || isMonth(prev))) continue;
    let next = lower[i + 1];
    if (next === 'of' || next === 'di') next = lower[i + 2];
    if (isMonth(next) || next === 'am' || next === 'pm') continue;
    const base = smartParse(without(words, i), ctx);
    const options: SmartAsk['options'] = [];
    if (base.dateGuessed) options.push('date');
    if (base.time === null) options.push('time');
    if (!options.length) continue;
    return { n, index: i, options, dateIso: nextDayOfMonth(ctx.today, n) };
  }
  return null;
}

/** La frase riscritta secondo la risposta («19/12/2026 doccia» o «19:00 doccia»). Per «testo» resta com'era. */
export function smartRewrite(raw: string, ask: SmartAsk, choice: Exclude<SmartChoice, 'text'>) {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  words[ask.index] =
    choice === 'date'
      ? `${ask.dateIso.slice(8)}/${ask.dateIso.slice(5, 7)}/${ask.dateIso.slice(0, 4)}`
      : `${pad(ask.n)}:00`;
  return words.join(' ');
}

/** «Nessuna delle due»: il numero resta nel titolo, e il resto della frase si legge come sempre. */
export function smartKeepNumber(raw: string, ask: SmartAsk, ctx: Ctx): SmartParsed {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const parsed = smartParse(without(words, ask.index), ctx);
  const word = words[ask.index]!;
  // il titolo del resto comincia con la maiuscola messa da smartParse: se il numero va davanti, torna com'era scritto
  const rest =
    ask.index === 0 ? parsed.title.charAt(0).toLowerCase() + parsed.title.slice(1) : parsed.title;
  const title = ask.index === 0 ? `${word} ${rest}` : `${rest} ${word}`;
  return { ...parsed, title: title.trim() };
}
