import { plainText } from './cardList';

/** Una carta (o sottocarta) che contiene il testo cercato (fc_decks.php, ajax=search, filtro «testo delle carte»). */
export interface CardHit {
  /** l'id da aprire: la carta, o la sottocarta */
  uuid: string;
  deck: string;
  child: boolean;
  question: string;
  answer: string;
  /** dove è stato trovato: il pezzo di testo attorno alla parola */
  excerpt: string;
}

export interface SearchRow {
  uuid: string;
  deck: string;
  child: boolean;
  question_desc: string | null;
  answer_desc: string | null;
}

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Il pezzo di testo attorno alla prima parola trovata (con «…» se è tagliato). */
export function excerptAround(text: string, query: string, radius = 36): string {
  const at = fold(text).indexOf(fold(query));
  if (at < 0) return text.slice(0, radius * 2);
  const from = Math.max(0, at - radius);
  const to = Math.min(text.length, at + query.length + radius);
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`;
}

/**
 * Cerca la parola nel TESTO che si legge (non nella struttura del documento). Il sito vuole almeno due lettere e tiene al
 * massimo 200 risultati; qui si ignorano maiuscole e accenti come nel resto delle ricerche.
 */
export function searchCardRows(rows: readonly SearchRow[], query: string, limit = 200): CardHit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const out: CardHit[] = [];
  for (const r of rows) {
    const question = plainText(r.question_desc);
    const answer = plainText(r.answer_desc);
    const inQ = fold(question).includes(q);
    if (!inQ && !fold(answer).includes(q)) continue;
    out.push({
      uuid: r.uuid,
      deck: r.deck,
      child: r.child,
      question,
      answer,
      excerpt: excerptAround(inQ ? question : answer, query.trim()),
    });
    if (out.length >= limit) break;
  }
  return out;
}
