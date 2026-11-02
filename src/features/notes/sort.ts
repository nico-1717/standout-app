import { parseQuickAdd, toCents, type BuyCategory } from '@/features/buy/logic';
import { destinazione, readPhrase, type SmartNow } from '@/features/tasks/smart';

/**
 * Smistare la nota a mano (todo_nota.js › voceDaRiga, Conferma): ogni riga è letta dalle regole della barra del
 * To do e proposta nel posto che sembra giusto — To do o To buy. Non si salva niente finché l'utente non conferma;
 * le righe che non vengono salvate restano nella nota.
 * Eventi e progetti non esistono ancora nell'app: una riga che il sito manderebbe lì diventa un'attività (con la
 * data, se c'è) e il suo posto si cambia a mano. Quando arriveranno il Planner e i Progetti, qui si riaggiungono.
 */

export type SortDest = 'todo' | 'buy';

export interface SortItem {
  /** la riga della nota da cui nasce (posizione nel testo, per toglierla dopo) */
  orig: number;
  /** la riga com'era scritta, per ricordare da dove viene */
  from: string;
  dest: SortDest;
  title: string;
  /** AAAA-MM-GG o '' */
  date: string;
  /** HH:MM o '' */
  time: string;
  minutes: number;
  /** il prezzo come lo scrive l'utente («12,90») */
  price: string;
  catUuid: string | null;
  /** una categoria che non esiste ancora (#nome): si crea al salvataggio */
  newCategory: string | null;
  keep: boolean;
}

const RE_VERB =
  /^(compra(?:re)?|acquista(?:re)?|ordina(?:re)?|prendere|buy|purchase|order|get)\s+/i;
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function centsText(c: number | null): string {
  return c === null ? '' : (c / 100).toFixed(2).replace('.', ',');
}

/** Una riga della nota → una voce da confermare. */
export function itemFromLine(
  line: { orig: number; text: string },
  now: SmartNow,
  cats: BuyCategory[],
): SortItem {
  const read = readPhrase(line.text, [], now);
  const dest: SortDest = destinazione(line.text, read) === 'buy' ? 'buy' : 'todo';
  const base = {
    orig: line.orig,
    from: line.text,
    keep: true,
    catUuid: null,
    newCategory: null,
  };
  if (dest === 'buy') {
    const q = parseQuickAdd(line.text.replace(RE_VERB, ''), cats);
    return {
      ...base,
      dest,
      title: cap(q.title || line.text),
      date: '',
      time: '',
      minutes: 0,
      price: centsText(q.cents),
      catUuid: q.catUuid,
      newCategory: q.newCategory,
    };
  }
  return {
    ...base,
    dest,
    title: read.title || line.text,
    date: read.date ?? '',
    time: read.date ? (read.time ?? '') : '',
    minutes: read.minutes || 0,
    price: '',
  };
}

export type ItemError = 'title' | 'date' | 'time' | 'price' | null;

const validDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return d.getMonth() === +s.slice(5, 7) - 1 && d.getDate() === +s.slice(8, 10);
};

/** Che cosa non va in una voce (null = si può salvare). */
export function itemError(it: SortItem): ItemError {
  if (!it.title.trim()) return 'title';
  if (it.dest === 'todo') {
    if (it.date && !validDate(it.date)) return 'date';
    if (it.time && (!it.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(it.time))) return 'time';
  } else if (it.price.trim() && toCents(it.price) === null) {
    return 'price';
  }
  return null;
}

/** Le voci da salvare: tenute e senza errori. */
export const toSave = (items: SortItem[]) =>
  items.filter((i) => i.keep && i.title.trim() && !itemError(i));

/** Cosa scrivere nel repo per una voce. */
export function inputOf(it: SortItem) {
  if (it.dest === 'buy') {
    return {
      listType: 'buy' as const,
      input: {
        title: it.title.trim(),
        buy_price_cents: it.price.trim() ? toCents(it.price) : null,
      },
    };
  }
  return {
    listType: 'todo' as const,
    input: {
      title: it.title.trim(),
      due_date: it.date || null,
      due_time: it.date && it.time ? it.time : null,
      duration_minutes: it.minutes > 0 ? Math.min(1440, it.minutes) : 30,
    },
  };
}

/**
 * La nota dopo il salvataggio. Una riga esce solo se la sua voce è stata tenuta E salvata; le altre restano.
 * Le righe vuote lasciate dai tagli non si accumulano.
 */
export function noteAfter(text: string, items: SortItem[], saved: Set<SortItem>): string {
  const gone = new Set(items.filter((i) => i.keep && saved.has(i)).map((i) => i.orig));
  return text
    .split(/\r?\n/)
    .filter((_, i) => !gone.has(i))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
}
