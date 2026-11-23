/**
 * Il ripasso a intervalli di NeetCode 150: la logica del tracker di Claude (artifact «NeetCode Tracker») e le regole
 * esatte del documento di Nico. Funzioni pure: la data di «oggi» e il caso arrivano da fuori, così si provano con
 * valori fissi (golden test) e il sito può avere la stessa copia in JavaScript.
 */

/* ---------------- i 150 problemi, nell'ordine della roadmap (l'ordine è congelato: i nuovi si aggiungono in fondo) ---------------- */

const CATS: [string, string][] = [
  [
    'Arrays & Hashing',
    'Contains Duplicate|E;Valid Anagram|E;Two Sum|E;Group Anagrams|M;Top K Frequent Elements|M;Encode and Decode Strings|M;Product of Array Except Self|M;Valid Sudoku|M;Longest Consecutive Sequence|M',
  ],
  [
    'Two Pointers',
    'Valid Palindrome|E;Two Sum II Input Array Is Sorted|M;3Sum|M;Container With Most Water|M;Trapping Rain Water|H',
  ],
  [
    'Sliding Window',
    'Best Time to Buy and Sell Stock|E;Longest Substring Without Repeating Characters|M;Longest Repeating Character Replacement|M;Permutation in String|M;Minimum Window Substring|H;Sliding Window Maximum|H',
  ],
  [
    'Stack',
    'Valid Parentheses|E;Min Stack|M;Evaluate Reverse Polish Notation|M;Generate Parentheses|M;Daily Temperatures|M;Car Fleet|M;Largest Rectangle in Histogram|H',
  ],
  [
    'Binary Search',
    'Binary Search|E;Search a 2D Matrix|M;Koko Eating Bananas|M;Find Minimum in Rotated Sorted Array|M;Search in Rotated Sorted Array|M;Time Based Key-Value Store|M;Median of Two Sorted Arrays|H',
  ],
  [
    'Linked List',
    'Reverse Linked List|E;Merge Two Sorted Lists|E;Linked List Cycle|E;Reorder List|M;Remove Nth Node From End of List|M;Copy List with Random Pointer|M;Add Two Numbers|M;Find the Duplicate Number|M;LRU Cache|M;Merge K Sorted Lists|H;Reverse Nodes in K-Group|H',
  ],
  [
    'Trees',
    'Invert Binary Tree|E;Maximum Depth of Binary Tree|E;Diameter of Binary Tree|E;Balanced Binary Tree|E;Same Tree|E;Subtree of Another Tree|E;Lowest Common Ancestor of a BST|M;Binary Tree Level Order Traversal|M;Binary Tree Right Side View|M;Count Good Nodes in Binary Tree|M;Validate Binary Search Tree|M;Kth Smallest Element in a BST|M;Construct Binary Tree from Preorder and Inorder Traversal|M;Binary Tree Maximum Path Sum|H;Serialize and Deserialize Binary Tree|H',
  ],
  [
    'Heap / Priority Queue',
    'Kth Largest Element in a Stream|E;Last Stone Weight|E;K Closest Points to Origin|M;Kth Largest Element in an Array|M;Task Scheduler|M;Design Twitter|M;Find Median from Data Stream|H',
  ],
  [
    'Backtracking',
    'Subsets|M;Combination Sum|M;Permutations|M;Subsets II|M;Combination Sum II|M;Word Search|M;Palindrome Partitioning|M;Letter Combinations of a Phone Number|M;N-Queens|H',
  ],
  [
    'Tries',
    'Implement Trie (Prefix Tree)|M;Design Add and Search Words Data Structure|M;Word Search II|H',
  ],
  [
    'Graphs',
    'Number of Islands|M;Max Area of Island|M;Clone Graph|M;Walls and Gates|M;Rotting Oranges|M;Pacific Atlantic Water Flow|M;Surrounded Regions|M;Course Schedule|M;Course Schedule II|M;Graph Valid Tree|M;Number of Connected Components in an Undirected Graph|M;Redundant Connection|M;Word Ladder|H',
  ],
  [
    'Advanced Graphs',
    'Reconstruct Itinerary|H;Min Cost to Connect All Points|M;Network Delay Time|M;Swim in Rising Water|H;Alien Dictionary|H;Cheapest Flights Within K Stops|M',
  ],
  [
    '1-D Dynamic Programming',
    'Climbing Stairs|E;Min Cost Climbing Stairs|E;House Robber|M;House Robber II|M;Longest Palindromic Substring|M;Palindromic Substrings|M;Decode Ways|M;Coin Change|M;Maximum Product Subarray|M;Word Break|M;Longest Increasing Subsequence|M;Partition Equal Subset Sum|M',
  ],
  [
    '2-D Dynamic Programming',
    'Unique Paths|M;Longest Common Subsequence|M;Best Time to Buy and Sell Stock with Cooldown|M;Coin Change II|M;Target Sum|M;Interleaving String|M;Longest Increasing Path in a Matrix|H;Distinct Subsequences|H;Edit Distance|M;Burst Balloons|H;Regular Expression Matching|H',
  ],
  [
    'Greedy',
    'Maximum Subarray|M;Jump Game|M;Jump Game II|M;Gas Station|M;Hand of Straights|M;Merge Triplets to Form Target Triplet|M;Partition Labels|M;Valid Parenthesis String|M',
  ],
  [
    'Intervals',
    'Insert Interval|M;Merge Intervals|M;Non-overlapping Intervals|M;Meeting Rooms|E;Meeting Rooms II|M;Minimum Interval to Include Each Query|H',
  ],
  [
    'Math & Geometry',
    'Rotate Image|M;Spiral Matrix|M;Set Matrix Zeroes|M;Happy Number|E;Plus One|E;Pow(x, n)|M;Multiply Strings|M;Detect Squares|M',
  ],
  [
    'Bit Manipulation',
    'Single Number|E;Number of 1 Bits|E;Counting Bits|E;Reverse Bits|E;Missing Number|E;Sum of Two Integers|M;Reverse Integer|M',
  ],
];

export type Diff = 'E' | 'M' | 'H';
export interface Problem {
  id: number;
  name: string;
  diff: Diff;
  cat: string;
}

export const PROBLEMS: Problem[] = CATS.flatMap(([cat, list]) =>
  list.split(';').map((e) => ({ cat, e })),
).map(({ cat, e }, id) => {
  const [name, diff] = e.split('|');
  return { id, name: name ?? '', diff: (diff ?? 'M') as Diff, cat };
});

export const CATEGORIES: string[] = CATS.map((c) => c[0]);
/** I 18 nomi ufficiali più «Other»: i 19 schemi che si possono scegliere. */
export const PATTERNS: string[] = [...CATEGORIES, 'Other'];
export const TOTAL = PROBLEMS.length;

/** Giorni al prossimo ripasso, per voto. */
export const INT: Record<Rating, number> = { 1: 30, 2: 14, 3: 5, 4: 2 };
/** Quanto è probabile che un voto venga scelto. */
export const BASEW: Record<Rating, number> = { 1: 0.4, 2: 2, 3: 4, 4: 8 };
/** Risolti in una categoria prima che conti come «iniziata». */
export const STARTED_AT = 3;
export const HIST_MAX = 40;

export type Rating = 1 | 2 | 3 | 4;
export const isRating = (x: unknown): x is Rating => x === 1 || x === 2 || x === 3 || x === 4;

/** Un problema nella lista di chi studia. `solvedOn` e `lastReviewed` sono null per «risolto prima di oggi». */
export interface ReviewRecord {
  n: number;
  rating: Rating;
  pattern: string;
  hist: [string, number][];
  solvedOn: string | null;
  lastReviewed: string | null;
  nextDue: string;
  reviews: number;
}
export type Items = Record<string, ReviewRecord>;

/* ---------------- date (stringhe AAAA-MM-GG, senza fuso) ---------------- */

const pad = (n: number) => String(n).padStart(2, '0');
const toUTC = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
export const addDays = (s: string, n: number) => {
  const d = new Date(toUTC(s) + n * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const diffDays = (a: string, b: string) => Math.round((toUTC(a) - toUTC(b)) / 864e5);
export const isDay = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return addDays(s, 0) === s;
};

/* ---------------- ripasso ---------------- */

/** Il peso di un problema nell'estrazione del ripasso: in ritardo pesa di più, in anticipo quasi niente. */
export const weightOf = (it: ReviewRecord, today: string) => {
  const over = diffDays(today, it.nextDue);
  const base = BASEW[it.rating];
  return over >= 0 ? base * (1 + over / INT[it.rating]) : base * 0.1;
};

/** Estrazione pesata senza reinserimento. `rnd` dà un numero in [0, 1). */
export function pickWeighted<T>(arr: T[], wf: (x: T) => number, k: number, rnd: () => number): T[] {
  const pool = arr.slice();
  const out: T[] = [];
  while (out.length < k && pool.length) {
    const ws = pool.map(wf);
    const tot = ws.reduce((a, b) => a + b, 0);
    let r = rnd() * tot;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= ws[i] ?? 0;
      if (r < 0) break;
    }
    out.push(pool.splice(i, 1)[0] as T);
  }
  return out;
}

export interface LogChoice {
  rating: Rating;
  pattern: string;
  when: 'today' | 'earlier';
}

/** Il record dopo un voto. Un problema nuovo «risolto prima» non conta come ripasso di oggi: è dovuto oggi. */
export function nextRecord(
  prev: ReviewRecord | null,
  n: number,
  { rating, pattern, when }: LogChoice,
  today: string,
): ReviewRecord {
  const earlier = !prev && when === 'earlier';
  const hist = [
    ...(prev ? prev.hist : []),
    [earlier ? 'earlier' : today, rating] as [string, number],
  ].slice(-HIST_MAX);
  return {
    n,
    rating,
    pattern,
    hist,
    solvedOn: prev ? prev.solvedOn : earlier ? null : today,
    lastReviewed: earlier ? null : today,
    nextDue: earlier ? today : addDays(today, INT[rating]),
    reviews: prev ? prev.reviews + 1 : 0,
  };
}

/** «Aggiungi N come risolti prima»: voto 3, schema ufficiale, data vuota e dovuti oggi. */
export const bulkRecord = (n: number, today: string): ReviewRecord =>
  nextRecord(null, n, { rating: 3, pattern: PROBLEMS[n]?.cat ?? 'Other', when: 'earlier' }, today);

/** Estrae `k` problemi da ripassare (quelli già ripassati oggi non ci sono). */
export function pickReview(items: Items, today: string, rnd: () => number, k = 3): number[] {
  const cand = Object.values(items).filter((it) => it.lastReviewed !== today);
  return pickWeighted(cand, (it) => weightOf(it, today), k, rnd).map((it) => it.n);
}

/* ---------------- problemi nuovi ---------------- */

export const solvedCountByCat = (items: Items): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const it of Object.values(items)) {
    const c = PROBLEMS[it.n]?.cat;
    if (c) m[c] = (m[c] ?? 0) + 1;
  }
  return m;
};
export const startedCats = (items: Items): Set<string> => {
  const m = solvedCountByCat(items);
  return new Set(Object.keys(m).filter((c) => (m[c] ?? 0) >= STARTED_AT));
};

export type PoolNote = '' | 'none_started' | 'finished_started';

/** Il gruppo da cui si estrae: difficoltà scelta, solo schemi iniziati (se acceso), con la nota quando si allarga. */
export function newCandidates(
  items: Items,
  diff: Diff,
  onlyStarted: boolean,
): { list: Problem[]; note: PoolNote } {
  const unsolved = PROBLEMS.filter((p) => !items[p.id] && p.diff === diff);
  if (!onlyStarted) return { list: unsolved, note: '' };
  const started = startedCats(items);
  if (!started.size) return { list: unsolved, note: 'none_started' };
  const inStarted = unsolved.filter((p) => started.has(p.cat));
  if (!inStarted.length) return { list: unsolved, note: 'finished_started' };
  return { list: inStarted, note: '' };
}

/** Voto medio dei risolti di una categoria (2,5 se non ce ne sono): chi fa fatica su uno schema lo rivede più spesso. */
export function avgRating(items: Items, cat: string): number {
  const rs = Object.values(items).filter((it) => PROBLEMS[it.n]?.cat === cat);
  return rs.length ? rs.reduce((a, it) => a + it.rating, 0) / rs.length : 2.5;
}

const oneOf = <T>(arr: T[], rnd: () => number): T =>
  arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))] as T;

/**
 * Sceglie `k` problemi nuovi: categorie DIVERSE per estrazione pesata (peso = 1 + voto medio), poi un problema a caso
 * dentro ognuna. Se le categorie sono meno dei problemi richiesti, il resto si riempie in modo uniforme da ciò che resta.
 */
export function pickNew(
  items: Items,
  pool: Problem[],
  rnd: () => number,
  k = 2,
  avoidCats: string[] = [],
): Problem[] {
  const byCat = new Map<string, Problem[]>();
  for (const p of pool) byCat.set(p.cat, [...(byCat.get(p.cat) ?? []), p]);
  const fresh = [...byCat.keys()].filter((c) => !avoidCats.includes(c));
  const cats = fresh.length >= k ? fresh : [...byCat.keys()];
  const chosen = pickWeighted(cats, (c) => 1 + avgRating(items, c), k, rnd);
  const out = chosen.map((c) => oneOf(byCat.get(c) ?? [], rnd));
  if (out.length < k) {
    const left = pool.filter((p) => !out.includes(p));
    out.push(...pickWeighted(left, () => 1, k - out.length, rnd));
  }
  return out;
}

/** Cambia una sola proposta: stessa regola, senza le proposte di adesso (e, se si può, in un'altra categoria). */
export function swapNew(
  items: Items,
  pool: Problem[],
  current: number[],
  index: number,
  rnd: () => number,
): number | null {
  const left = pool.filter((p) => !current.includes(p.id));
  if (!left.length) return null;
  const others = current.filter((_, i) => i !== index).map((id) => PROBLEMS[id]?.cat ?? '');
  return pickNew(items, left, rnd, 1, others)[0]?.id ?? null;
}

/**
 * «Impara un nuovo schema»: la prima categoria (nell'ordine della roadmap) con meno di 3 risolti e ancora un problema
 * da fare; il suo primo Medium da fare, o il primo da fare se Medium non ce ne sono più.
 * `skip` = categorie da saltare (quella già proposta), così il pulsante passa allo schema successivo.
 */
export function learnPattern(
  items: Items,
  skip: readonly string[] = [],
): { id: number; cat: string } | null {
  const m = solvedCountByCat(items);
  for (const cat of CATEGORIES) {
    if ((m[cat] ?? 0) >= STARTED_AT || skip.includes(cat)) continue;
    const todo = PROBLEMS.filter((p) => p.cat === cat && !items[p.id]);
    const first = todo.find((p) => p.diff === 'M') ?? todo[0];
    if (first) return { id: first.id, cat };
  }
  return null;
}

/* ---------------- etichette (il testo lo mette l'interfaccia) ---------------- */

export type DueLabel = { kind: 'overdue' | 'today' | 'in'; n: number };
export function dueLabel(it: ReviewRecord, today: string): DueLabel {
  const o = diffDays(today, it.nextDue);
  return o > 0
    ? { kind: 'overdue', n: o }
    : o === 0
      ? { kind: 'today', n: 0 }
      : { kind: 'in', n: -o };
}
export type SeenLabel = { kind: 'earlier' | 'today' | 'ago'; n: number };
export function seenLabel(it: ReviewRecord, today: string): SeenLabel {
  if (!it.lastReviewed) return { kind: 'earlier', n: 0 };
  const d = diffDays(today, it.lastReviewed);
  return d === 0 ? { kind: 'today', n: 0 } : { kind: 'ago', n: d };
}

/** La lista di «Risolti»: per scadenza, poi voto dal più alto. */
export function solvedList(items: Items, query: string): ReviewRecord[] {
  const q = query.trim().toLowerCase();
  return Object.values(items)
    .filter(
      (it) =>
        !q ||
        (PROBLEMS[it.n]?.name.toLowerCase().includes(q) ?? false) ||
        it.pattern.toLowerCase().includes(q),
    )
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : b.rating - a.rating));
}

/* ---------------- esporta / importa ---------------- */

export interface Backup {
  app: 'neetcode-tracker';
  version: 1;
  exportedOn: string;
  items: (ReviewRecord & { name: string })[];
}

export function exportBackup(items: Items, today: string): string {
  const list = Object.values(items)
    .sort((a, b) => a.n - b.n)
    .map((it) => ({ ...it, name: PROBLEMS[it.n]?.name ?? '' }));
  const b: Backup = { app: 'neetcode-tracker', version: 1, exportedOn: today, items: list };
  return JSON.stringify(b);
}

/** Una riga importata, ripulita; null se non è valida (n fuori da 0..149, voto non 1..4, date sbagliate). */
export function cleanImported(raw: unknown): ReviewRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  let n = typeof x.n === 'number' && Number.isInteger(x.n) ? x.n : -1;
  // se c'è un nome e corrisponde a un problema, ci si fida del nome
  if (typeof x.name === 'string') {
    const byName = PROBLEMS.find((p) => p.name === x.name);
    if (byName) n = byName.id;
  }
  if (n < 0 || n >= TOTAL) return null;
  if (!isRating(x.rating)) return null;
  const pattern = typeof x.pattern === 'string' && PATTERNS.includes(x.pattern) ? x.pattern : null;
  if (!pattern) return null;
  if (!isDay(x.nextDue)) return null;
  const solvedOn = x.solvedOn == null ? null : isDay(x.solvedOn) ? x.solvedOn : undefined;
  const lastReviewed =
    x.lastReviewed == null ? null : isDay(x.lastReviewed) ? x.lastReviewed : undefined;
  if (solvedOn === undefined || lastReviewed === undefined) return null;
  const reviews =
    typeof x.reviews === 'number' && Number.isInteger(x.reviews) && x.reviews >= 0 ? x.reviews : 0;
  const hist: [string, number][] = [];
  if (Array.isArray(x.hist)) {
    for (const h of x.hist) {
      if (Array.isArray(h) && (h[0] === 'earlier' || isDay(h[0])) && isRating(h[1]))
        hist.push([h[0] as string, h[1]]);
    }
  }
  return {
    n,
    rating: x.rating,
    pattern,
    hist: hist.slice(-HIST_MAX),
    solvedOn,
    lastReviewed,
    nextDue: x.nextDue,
    reviews,
  };
}

export interface ImportResult {
  items: Items;
  added: number;
  updated: number;
  skipped: number;
  error: boolean;
}

/**
 * Unisce un backup: mai cancella. Uno nuovo si aggiunge; uno che c'è si sostituisce solo se la storia importata è più
 * lunga, o uguale con un `lastReviewed` più recente. Importare lo stesso file due volte non cambia niente.
 */
export function importBackup(current: Items, text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { items: current, added: 0, updated: 0, skipped: 0, error: true };
  }
  const list = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(list))
    return { items: current, added: 0, updated: 0, skipped: 0, error: true };
  const items: Items = { ...current };
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const raw of list.slice(0, TOTAL)) {
    const rec = cleanImported(raw);
    if (!rec) {
      skipped++;
      continue;
    }
    const old = items[rec.n];
    if (!old) {
      items[rec.n] = rec;
      added++;
      continue;
    }
    const longer = rec.hist.length > old.hist.length;
    const same = rec.hist.length === old.hist.length;
    const later = (rec.lastReviewed ?? '') > (old.lastReviewed ?? '');
    if (longer || (same && later)) {
      items[rec.n] = rec;
      updated++;
    } else skipped++;
  }
  return { items, added, updated, skipped, error: false };
}
