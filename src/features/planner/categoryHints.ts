/**
 * Le categorie suggerite dal titolo di un evento, e l'ultima usata. Nessuna memoria a parte: si impara dagli eventi che ci
 * sono già (titolo → categoria), così il risultato è lo stesso sul telefono e sul sito, anche dopo una modifica o una
 * cancellazione, e funziona subito con lo storico che c'è. Il sito fa lo stesso conto in `lib/planner/pl_suggerite.php`.
 *
 *  - ogni parola del titolo (almeno 3 lettere, senza le parole vuote) pesa quanto è «pura»: se compare quasi sempre in una
 *    sola categoria vale tanto, se compare dappertutto («the», «con») vale quasi zero;
 *  - il titolo identico a uno già visto dà un bonus (fino a 3 eventi);
 *  - le categorie usate negli ultimi 7 giorni hanno un piccolo bonus, ma solo se il titolo dà già un indizio;
 *  - si mostrano al massimo 3 categorie, e solo se il punteggio è chiaramente sopra lo zero.
 */
export interface HintRow {
  title: string;
  category_uuid: string | null;
  is_cancelled?: number;
  /** quando l'evento è stato creato, e poi cambiato (testo ISO, o «AAAA-MM-GG hh:mm:ss» come dal sito) */
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Hints {
  /** la categoria dell'ultimo evento salvato */
  last: string | null;
  /** fino a 3 categorie, la migliore per prima */
  suggested: string[];
}

export const MAX_SUGGESTED = 3;
export const MIN_SCORE = 1.5;
const EXACT_BONUS = 3;
const RECENT_BONUS = 0.5;
const RECENT_DAYS = 7;

const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'about',
  'this',
  'that',
  'del',
  'della',
  'dei',
  'degli',
  'delle',
  'con',
  'per',
  'una',
  'uno',
  'gli',
  'che',
  'nel',
  'nella',
  'alla',
  'allo',
  'agli',
  'alle',
  'dal',
  'dalla',
  'sul',
  'sulla',
]);

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Le parole utili di un titolo. */
export function wordsOf(title: string): string[] {
  const out: string[] = [];
  for (const w of fold(title).split(/[^a-z0-9]+/))
    if (w.length >= 3 && !STOP.has(w) && !out.includes(w)) out.push(w);
  return out;
}

const stamp = (s: string | null | undefined) => {
  if (!s) return 0;
  const t = Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isNaN(t) ? 0 : t;
};

export function categoryHints(
  rows: readonly HintRow[],
  title: string,
  valid: ReadonlySet<string>,
  now: number = Date.now(),
): Hints {
  const used = rows.filter((r) => r.category_uuid && valid.has(r.category_uuid) && !r.is_cancelled);

  let last: string | null = null;
  let lastAt = -1;
  for (const r of used) {
    const at = stamp(r.created_at ?? r.updated_at);
    if (at >= lastAt) {
      lastAt = at;
      last = r.category_uuid;
    }
  }

  const words = wordsOf(title);
  const whole = fold(title).trim();
  if (!words.length && !whole) return { last, suggested: [] };

  // parola → categoria → quante volte; parola → quante volte in tutto
  const per = new Map<string, Map<string, number>>();
  const total = new Map<string, number>();
  const exact = new Map<string, number>();
  const recent = new Set<string>();
  const wanted = new Set(words);
  for (const r of used) {
    const cat = r.category_uuid as string;
    if (fold(r.title).trim() === whole && whole) exact.set(cat, (exact.get(cat) ?? 0) + 1);
    if (now - stamp(r.updated_at) < RECENT_DAYS * 864e5) recent.add(cat);
    for (const w of wordsOf(r.title)) {
      if (!wanted.has(w)) continue;
      const m = per.get(w) ?? new Map<string, number>();
      m.set(cat, (m.get(cat) ?? 0) + 1);
      per.set(w, m);
      total.set(w, (total.get(w) ?? 0) + 1);
    }
  }

  const score = new Map<string, number>();
  for (const [w, m] of per) {
    const all = total.get(w) ?? 1;
    for (const [cat, n] of m) score.set(cat, (score.get(cat) ?? 0) + n * (n / all));
  }
  for (const [cat, n] of exact)
    score.set(cat, (score.get(cat) ?? 0) + (EXACT_BONUS * Math.min(n, 3)) / 3);
  for (const cat of recent)
    if (score.has(cat)) score.set(cat, (score.get(cat) ?? 0) + RECENT_BONUS);

  const suggested = [...score.entries()]
    .filter(([, s]) => s >= MIN_SCORE)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_SUGGESTED)
    .map(([c]) => c);
  return { last, suggested };
}
