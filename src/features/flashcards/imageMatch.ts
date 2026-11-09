/**
 * L'abbinamento delle immagini (fc_ai_match.js del sito): da una parte le immagini delle domande, dall'altra quelle
 * delle risposte. Si parte già abbinati nell'ordine in cui sono state scelte, che di solito è quello giusto: il tocco serve
 * a correggere due o tre coppie, non a farle tutte. Una immagine senza compagna non è un errore: diventa una carta con
 * quella sola immagine.
 */

/** `pairs[iDomanda] = iRisposta`. Una risposta sta in una coppia sola. */
export type Pairs = Record<number, number>;

/** All'apertura: la prima domanda con la prima risposta, e così via fino alla più corta delle due liste. */
export function initialPairs(nq: number, na: number): Pairs {
  const p: Pairs = {};
  for (let i = 0; i < Math.min(nq, na); i++) p[i] = i;
  return p;
}

/** Collega una domanda a una risposta: se uno dei due era già impegnato, il vecchio legame si scioglie. */
export function link(pairs: Pairs, q: number, a: number): Pairs {
  const out: Pairs = {};
  for (const [k, v] of Object.entries(pairs)) if (v !== a) out[Number(k)] = v;
  out[q] = a;
  return out;
}

export function unlink(pairs: Pairs, q: number): Pairs {
  const { [q]: _gone, ...rest } = pairs;
  void _gone;
  return rest;
}

/** La domanda legata a questa risposta, se c'è. */
export function questionOf(pairs: Pairs, a: number): number | null {
  for (const [k, v] of Object.entries(pairs)) if (v === a) return Number(k);
  return null;
}

export interface ImageCard {
  q: string | null;
  a: string | null;
}

/**
 * Le carte da creare, nell'ordine del sito: prima le coppie (nell'ordine delle domande), poi le domande sole, poi le
 * risposte sole.
 */
export function cardsFrom(qs: readonly string[], as: readonly string[], pairs: Pairs): ImageCard[] {
  const used = new Set<number>();
  const out = qs.map((q, i): ImageCard => {
    const a = pairs[i];
    if (a === undefined || as[a] === undefined) return { q, a: null };
    used.add(a);
    return { q, a: as[a] };
  });
  as.forEach((a, i) => {
    if (!used.has(i)) out.push({ q: null, a });
  });
  return out;
}

/** Quante coppie e quante immagini senza compagna. */
export function counts(nq: number, na: number, pairs: Pairs): { pairs: number; alone: number } {
  const p = Object.keys(pairs).length;
  return { pairs: p, alone: nq - p + (na - p) };
}

/** Senza una delle due liste non c'è niente da decidere: ogni immagine è già una carta. */
export function needsMatching(nq: number, na: number): boolean {
  return nq > 0 && na > 0;
}

/** Le carte quando c'è un gruppo solo: una per immagine, nell'ordine. */
export function singleCards(qs: readonly string[], as: readonly string[]): ImageCard[] {
  const n = Math.max(qs.length, as.length);
  return Array.from({ length: n }, (_, i) => ({ q: qs[i] ?? null, a: as[i] ?? null }));
}
