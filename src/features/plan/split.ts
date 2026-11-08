export interface SplitRow {
  uuid: string;
  minutes: number;
  locked: boolean;
}

/**
 * Il «matematico dei cursori» del sito (piano.js: distribute / rebalance / rescale), copiato passo per passo e provato contro
 * il sito con un test d'oro. Un gruppo di fratelli deve fare sempre il totale: muovendone uno, gli altri (quelli senza
 * lucchetto) danno o prendono in proporzione a quello che hanno già. I resti si arrotondano a 5 minuti e la differenza va sul
 * più grande, così la somma è sempre esatta.
 */
const STEP = 5;

function distribute(v: number[], idxs: number[], restIn: number): void {
  if (!idxs.length) return;
  const rest = Math.max(0, restIn);
  const base = idxs.reduce((a, i) => a + v[i], 0);
  const parts = idxs.map((i) => {
    const f = base > 0 ? (rest * v[i]) / base : rest / idxs.length;
    const r = Math.floor(f / STEP) * STEP;
    return { i, r, frac: f - r };
  });
  const used = parts.reduce((a, p) => a + p.r, 0);
  let left = rest - used;
  // ordine stabile per frazione decrescente (come Array.sort del browser)
  parts.sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (left >= STEP && parts.length) {
    parts[k % parts.length].r += STEP;
    left -= STEP;
    k++;
  }
  if (left > 0) {
    // meno di 5 minuti: sul più grande
    let big = parts[0];
    for (const p of parts) if (p.r > big.r) big = p;
    big.r += left;
  }
  for (const p of parts) v[p.i] = p.r;
}

/**
 * Sposta il cursore di un figlio: gli altri senza lucchetto compensano. Il figlio non può superare ciò che resta dopo i valori
 * bloccati; se non c'è nessuno con cui compensare, prende tutto il libero. Un figlio bloccato non si muove.
 */
export function rebalance(
  rows: SplitRow[],
  uuid: string,
  wanted: number,
  total: number,
): SplitRow[] {
  const i = rows.findIndex((r) => r.uuid === uuid);
  if (i < 0 || rows[i].locked) return rows;
  const v = rows.map((r) => r.minutes);
  let locked = 0;
  const others: number[] = [];
  rows.forEach((r, j) => {
    if (j === i) return;
    if (r.locked) locked += v[j];
    else others.push(j);
  });
  const max = Math.max(0, total - locked);
  let want = Math.max(0, Math.min(wanted, max));
  if (!others.length) want = max;
  v[i] = want;
  distribute(v, others, total - locked - want);
  return rows.map((r, j) => ({ ...r, minutes: v[j] }));
}

/** Riporta la somma al totale cambiando solo i figli senza lucchetto, in proporzione. */
export function rescale(rows: SplitRow[], total: number): SplitRow[] {
  const v = rows.map((r) => r.minutes);
  let locked = 0;
  const free: number[] = [];
  rows.forEach((r, j) => {
    if (r.locked) locked += v[j];
    else free.push(j);
  });
  if (!free.length) return rows;
  distribute(v, free, Math.max(0, total - locked));
  return rows.map((r, j) => ({ ...r, minutes: v[j] }));
}

/** «Dividi in parti uguali»: i figli senza lucchetto valgono tutti uguale, poi si riporta al totale. */
export function evenSplit(rows: SplitRow[], total: number): SplitRow[] {
  return rescale(
    rows.map((r) => (r.locked ? r : { ...r, minutes: 1 })),
    total,
  );
}
