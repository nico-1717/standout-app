import en from './trivia.en.json';
import it from './trivia.it.json';

export interface Trivia {
  /** «trivia - geografia» o «quote - …»: chi comincia per «quote» è una citazione, il resto una domanda */
  tipo: string;
  domanda: string;
  risposta: string;
}

const BY_LANG: Record<string, Trivia[]> = { it: it as Trivia[], en: en as Trivia[] };

export const isQuote = (x: Trivia) => x.tipo.toLowerCase().startsWith('quote');

/** Una curiosità a caso nella lingua dell'app (stessi file del sito). `rand` è 0..1, così nei test si sceglie. */
export function pickTrivia(lang: string, rand: number = Math.random()): Trivia {
  const list = BY_LANG[lang.slice(0, 2)] ?? BY_LANG.en!;
  return list[Math.min(list.length - 1, Math.floor(rand * list.length))]!;
}
