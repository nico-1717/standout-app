import { docToPlain, parseDoc } from './doc';
import type { Level } from './levels';
import { levelRank } from './levels';
import type { Card } from './logic';

/** L'elenco delle carte di un mazzo (fc_view.php): ricerca nel testo, livello e ordine. */
export type CardSort = 'position' | 'newest' | 'oldest' | 'question' | 'hardest';
export const CARD_SORTS: CardSort[] = ['position', 'newest', 'oldest', 'question', 'hardest'];

export interface CardListFilter {
  text: string;
  /** '' = tutti i livelli */
  level: Level | '';
  sort: CardSort;
}

export const plainText = (raw: string | null): string =>
  docToPlain(parseDoc(raw)).replace(/\s+/g, ' ').trim();

const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Il testo su cui si cerca: domanda e risposta (senza formato). */
export const cardHaystack = (c: Card): string =>
  fold(`${plainText(c.question_desc)} ${plainText(c.answer_desc)}`);

/** Quante carte ha ogni livello (i livelli senza carte non compaiono). */
export function levelCounts(
  cards: readonly Card[],
  levels: ReadonlyMap<string, Level>,
): Map<Level, number> {
  const out = new Map<Level, number>();
  for (const c of cards) {
    const l = levels.get(c.uuid);
    if (l) out.set(l, (out.get(l) ?? 0) + 1);
  }
  return out;
}

export function filterCards(
  cards: readonly Card[],
  levels: ReadonlyMap<string, Level>,
  f: CardListFilter,
): Card[] {
  const words = fold(f.text).split(/\s+/).filter(Boolean);
  const out = cards.filter((c) => {
    if (f.level && levels.get(c.uuid) !== f.level) return false;
    if (!words.length) return true;
    const h = cardHaystack(c);
    return words.every((w) => h.includes(w));
  });
  const q = (c: Card) => fold(plainText(c.question_desc));
  const order: Record<CardSort, (a: Card, b: Card) => number> = {
    position: () => 0, // già nell'ordine del mazzo (sort stabile)
    newest: (a, b) => (b.rid ?? 0) - (a.rid ?? 0),
    oldest: (a, b) => (a.rid ?? 0) - (b.rid ?? 0),
    question: (a, b) => q(a).localeCompare(q(b)),
    hardest: (a, b) =>
      levelRank(levels.get(a.uuid) ?? 'nuova') - levelRank(levels.get(b.uuid) ?? 'nuova'),
  };
  return [...out].sort(order[f.sort]);
}
