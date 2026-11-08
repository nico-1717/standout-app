/**
 * La parte nascosta di una frase d'esempio (solo lingue). È il gemello di `public/fc/fc_vocab_gap.js` e di
 * `lib/fc/fc_vocab_gap.php` del sito: se cambia uno, va cambiato anche questo.
 *
 * Cosa sparisce, in quest'ordine:
 *  1. 'scelta'   i pezzi scelti a mano (`gap_text`), se nella frase ci sono ancora;
 *  2. 'trattini' le vecchie file di `_` degli esempi importati prima;
 *  3. 'parola'   la parola della carta scritta uguale, come parola intera;
 *  4. 'simile'   una sua forma: un'altra desinenza, una contrazione, o le sue parole con altre in mezzo.
 *
 * `gap_text`: '' = automatica · 'I want' = un pezzo solo · '[[0,"I want"],[11,"to"]]' = più pezzi [posizione, testo].
 * Le posizioni sono in caratteri UTF-16 (come `String.slice`).
 */

export type GapKind = 'scelta' | 'trattini' | 'parola' | 'simile';
export interface GapSpan {
  da: number;
  a: number;
  tipo: GapKind;
}
/** Un pezzo scelto a mano: `da` = posizione (−1 se ignota: si prende la prima volta). */
export interface GapChoice {
  da: number;
  t: string;
}

const norm = (s: string): string => s.replace(/[’‘ʼ]/g, "'");
const isLetter = (ch: string): boolean => ch !== '' && /[\p{L}\p{N}\p{M}]/u.test(ch);

/** Minuscolo, se non cambia la lunghezza (altrimenti le posizioni non tornerebbero). */
function lower(t: string): string {
  const l = t.toLowerCase();
  return l.length === t.length ? l : t;
}

interface Occurrence {
  p: number;
  intera: boolean;
}

/** Tutte le volte che `ago` compare in `testo` (senza badare alle maiuscole), con un segno per quelle intere. */
function occurrences(testo: string, ago: string): Occurrence[] {
  const out: Occurrence[] = [];
  if (!ago) return out;
  let tl = lower(norm(testo));
  const al = lower(norm(ago));
  if (tl.length !== testo.length) tl = norm(testo);
  let from = 0;
  let p: number;
  while ((p = tl.indexOf(al, from)) !== -1) {
    const bordoA = !isLetter(al.charAt(0)) || !isLetter(tl.charAt(p - 1));
    const bordoB = !isLetter(al.charAt(al.length - 1)) || !isLetter(tl.charAt(p + al.length));
    out.push({ p, intera: bordoA && bordoB });
    from = p + 1;
  }
  return out;
}

/** La prima volta intera (o, con `anywhere`, la prima qualunque). −1 se non c'è. */
function find(testo: string, ago: string, anywhere: boolean): number {
  const occ = occurrences(testo, ago);
  for (const o of occ) if (o.intera) return o.p;
  const first = occ[0];
  return anywhere && first ? first.p : -1;
}

/** `gap_text` → null (automatica) o i pezzi scelti. */
export function readChoice(gap: string | null | undefined): GapChoice[] | null {
  const s = (gap ?? '').trim();
  if (!s) return null;
  if (s.startsWith('[')) {
    try {
      const j: unknown = JSON.parse(s);
      if (Array.isArray(j)) {
        const pieces: GapChoice[] = [];
        for (const x of j as unknown[]) {
          if (!Array.isArray(x)) continue;
          const t = String(x[1] ?? '');
          if (t.trim()) pieces.push({ da: parseInt(String(x[0]), 10) || 0, t });
        }
        if (pieces.length) return pieces;
      }
    } catch {
      // formato vecchio: sotto
    }
  }
  return [{ da: -1, t: s }];
}

/** Pezzi `{da, a}` della frase → `gap_text`. Un pezzo solo resta scritto come prima (il testo). */
export function writeChoice(testo: string, pieces: readonly { da: number; a: number }[]): string {
  const first = pieces[0];
  if (!first) return '';
  if (pieces.length === 1) {
    const t1 = testo.slice(first.da, first.a);
    if (find(testo, t1, true) === first.da) return t1;
  }
  return JSON.stringify(pieces.map((p) => [p.da, testo.slice(p.da, p.a)]));
}

/** Ripulisce un `gap_text` arrivato da fuori: massimo 20 pezzi corti, nel formato giusto. */
export function cleanChoice(gap: string): string {
  const g = gap.trim();
  if (!g) return '';
  if (!g.startsWith('[')) return g.slice(0, 255);
  const pz = readChoice(g);
  if (!pz) return '';
  const out = pz.slice(0, 20).map((p) => [Math.max(0, p.da), p.t.slice(0, 200)]);
  const j = JSON.stringify(out);
  return j.length <= 1000 ? j : '';
}

/** I pezzi scelti, ritrovati nella frase com'è adesso. null se anche uno solo non c'è più. */
function resolve(testo: string, scelta: readonly GapChoice[]): GapSpan[] | null {
  const out: GapSpan[] = [];
  let fine = 0;
  for (const s of scelta) {
    const occ = occurrences(testo, s.t).filter((o) => o.p >= fine);
    if (!occ.length) return null;
    const whole = occ.filter((o) => o.intera);
    const cand = whole.length ? whole : occ;
    let best = cand[0]!;
    if (s.da >= 0) {
      for (const o of cand) if (Math.abs(o.p - s.da) < Math.abs(best.p - s.da)) best = o;
    }
    out.push({ da: best.p, a: best.p + s.t.length, tipo: 'scelta' });
    fine = best.p + s.t.length;
  }
  return out;
}

interface Token {
  t: string;
  da: number;
  a: number;
}

const CONTRACTIONS: Record<string, string> = {
  m: 'am',
  re: 'are',
  s: 'is',
  ve: 'have',
  ll: 'will',
  d: 'would',
};

/** Le parole di un testo per il confronto: minuscole, con la posizione. Le contrazioni si aprono ("I'm" → i + am). */
function compareWords(testo: string): Token[] {
  const out: Token[] = [];
  const re = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) {
    const t = lower(norm(m[0]));
    const c = /^(.+)'(m|re|s|ve|ll|d)$/.exec(t);
    if (c && !/n$/.test(c[1]!)) {
      const cut = m.index + c[1]!.length;
      out.push({ t: c[1]!, da: m.index, a: cut });
      out.push({ t: CONTRACTIONS[c[2]!]!, da: cut, a: m.index + m[0].length });
    } else {
      out.push({ t, da: m.index, a: m.index + m[0].length });
    }
  }
  return out;
}

const SHORT_ENDINGS = ['s', 'es', 'ed', 'd', 'ing', 'n', 'en', 'ne', 'er'];
const SMALL_WORDS = [
  ...[
    'to',
    'a',
    'an',
    'the',
    'il',
    'lo',
    'la',
    'i',
    'gli',
    'le',
    'un',
    'uno',
    'una',
    'el',
    'los',
    'las',
  ],
  ...[
    'der',
    'die',
    'das',
    'les',
    'une',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'io',
    'tu',
    'lui',
    'lei',
  ],
  ...[
    'noi',
    'voi',
    'loro',
    'yo',
    'ich',
    'du',
    'er',
    'sie',
    'wir',
    'je',
    'elle',
    'nous',
    'vous',
    'ils',
    'elles',
  ],
];

/** Quanto una parola della frase (t) somiglia a una della carta (w): 3 uguale, 2 con desinenza, 1 stesso inizio, 0 niente. */
function score(w: string, t: string): number {
  if (w === t) return 3;
  if (/n't$/.test(w) && /n't$/.test(t)) return score(w.slice(0, -3), t.slice(0, -3)) ? 2 : 0;
  if (t.startsWith(w)) {
    const suf = t.slice(w.length);
    if (w.length <= 3) {
      const last = w.charAt(w.length - 1);
      return SHORT_ENDINGS.includes(suf) ||
        suf === `${last}ing` ||
        suf === `${last}ed` ||
        suf === `${last}er`
        ? 2
        : 0;
    }
    return suf.length <= 4 ? 2 : 0;
  }
  if (w.length < 4 || t.length < 3 || Math.abs(t.length - w.length) > 4) return 0;
  let cp = 0;
  while (cp < w.length && cp < t.length && w.charAt(cp) === t.charAt(cp)) cp++;
  return cp >= Math.max(3, Math.ceil(w.length * 0.7)) ? 1 : 0;
}

/** La forma della parola nella frase; fra una parola della carta e l'altra possono stare fino a due parole che restano visibili. */
function similar(testo: string, parola: string): GapSpan[] | null {
  const frase = compareWords(testo);
  if (!frase.length) return null;
  let best: { punti: number; presi: number[] } | null = null;
  for (const alt of parola.split(/[,;/]/)) {
    const pz = compareWords(alt).map((x) => x.t);
    if (!pz.length) continue;
    const variants: string[][] = [pz];
    if (pz.length > 1 && SMALL_WORDS.includes(pz[0]!)) variants.push(pz.slice(1));
    for (const v of variants) {
      for (let i = 0; i < frase.length; i++) {
        const s0 = score(v[0]!, frase[i]!.t);
        if (!s0) continue;
        let tot = s0;
        let j = i;
        const presi = [i];
        let ok = true;
        for (let k = 1; k < v.length && ok; k++) {
          ok = false;
          for (let salto = 1; salto <= 3 && j + salto < frase.length; salto++) {
            const sk = score(v[k]!, frase[j + salto]!.t);
            if (sk) {
              tot += sk - (salto - 1) * 0.5;
              j += salto;
              presi.push(j);
              ok = true;
              break;
            }
          }
        }
        if (!ok) continue;
        const punti = tot / v.length;
        if (!best || punti > best.punti) best = { punti, presi };
      }
    }
  }
  if (!best) return null;
  const out: GapSpan[] = [];
  best.presi.forEach((idx, n) => {
    const w = frase[idx]!;
    const prev = out[out.length - 1];
    if (n > 0 && best!.presi[n - 1] === idx - 1 && prev) prev.a = w.a;
    else out.push({ da: w.da, a: w.a, tipo: 'simile' });
  });
  return out;
}

/** Cosa sparisce dalla frase: i pezzi in ordine, oppure []. */
export function gapSpans(testo: string, parola: string, gap?: string | null): GapSpan[] {
  if (!testo.trim()) return [];
  const scelta = readChoice(gap);
  if (scelta) {
    const r = resolve(testo, scelta);
    if (r) return r;
  }
  const dashes: GapSpan[] = [];
  const re = /_+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) {
    dashes.push({ da: m.index, a: m.index + m[0].length, tipo: 'trattini' });
  }
  if (dashes.length) return dashes;
  const w = parola.trim();
  if (w) {
    const p = find(testo, w, false);
    if (p !== -1) return [{ da: p, a: p + w.length, tipo: 'parola' }];
    const sim = similar(testo, w);
    if (sim) return sim;
  }
  return [];
}

/** Un pezzo della frase: testo visibile o parte nascosta (con la parola che ci sta sotto per le file di `_`). */
export interface GapPart {
  text: string;
  hidden: boolean;
}

/** La frase divisa in pezzi visibili e nascosti. Una fila di `_` si riempie con la parola della carta. */
export function gapParts(testo: string, parola: string, gap?: string | null): GapPart[] {
  const w = parola.trim();
  const out: GapPart[] = [];
  let from = 0;
  for (const x of gapSpans(testo, parola, gap)) {
    if (x.da > from) out.push({ text: testo.slice(from, x.da), hidden: false });
    out.push({ text: x.tipo === 'trattini' ? w || '…' : testo.slice(x.da, x.a), hidden: true });
    from = x.a;
  }
  if (from < testo.length) out.push({ text: testo.slice(from), hidden: false });
  return out;
}

/** La frase da far sentire: senza trattini. */
export const speakable = (testo: string, parola: string): string =>
  testo.replace(/_+/g, parola.trim());

/** `true` se la parte nascosta è stata trovata da sola (non scelta a mano e non a trattini). */
export const isAutomatic = (spans: readonly GapSpan[]): boolean => {
  const t = spans[0]?.tipo;
  return t === 'parola' || t === 'simile';
};

export interface GapKey {
  t: string;
  tasto: boolean;
  k?: number;
  da?: number;
  a?: number;
  apostrofo?: boolean;
}

/** Un tasto per ogni parola e per ogni apostrofo ("I'm" → I ' m); una fila di `_` è un tasto anche lei. */
export function gapKeys(testo: string): GapKey[] {
  const out: GapKey[] = [];
  const re = /[\p{L}\p{N}\p{M}]+|['’‘ʼ]|_+/gu;
  let m: RegExpExecArray | null;
  let last = 0;
  let k = 0;
  while ((m = re.exec(testo)) !== null) {
    if (m.index > last) out.push({ t: testo.slice(last, m.index), tasto: false });
    out.push({
      t: m[0],
      tasto: true,
      k: k++,
      da: m.index,
      a: m.index + m[0].length,
      apostrofo: /^['’‘ʼ]$/.test(m[0]),
    });
    last = m.index + m[0].length;
  }
  if (last < testo.length) out.push({ t: testo.slice(last), tasto: false });
  return out;
}

/** I tasti che stanno dentro le parti nascoste attuali. */
export function keysFromSpans(testo: string, spans: readonly GapSpan[]): Set<number> {
  const on = new Set<number>();
  for (const x of gapKeys(testo)) {
    if (!x.tasto || x.k === undefined) continue;
    if (spans.some((s) => x.da! < s.a && x.a! > s.da)) on.add(x.k);
  }
  return on;
}

/** I tasti scelti diventano pezzi: due tasti uno dopo l'altro stanno nello stesso pezzo. */
export function piecesFromKeys(
  testo: string,
  on: ReadonlySet<number>,
): { da: number; a: number }[] {
  const out: { da: number; a: number; last: number }[] = [];
  for (const x of gapKeys(testo)) {
    if (!x.tasto || x.k === undefined || !on.has(x.k)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.last === x.k - 1) {
      prev.a = x.a!;
      prev.last = x.k;
    } else {
      out.push({ da: x.da!, a: x.a!, last: x.k });
    }
  }
  return out.map((p) => ({ da: p.da, a: p.a }));
}
