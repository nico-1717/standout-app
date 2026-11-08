/**
 * Il LaTeX delle formule (quello che scrive l'editor del sito, MathQuill) letto in un albero che l'app sa disegnare.
 * Capisce il LaTeX che serve per studiare: frazioni, radici, apici e pedici, somme, integrali, limiti, parentesi che si
 * allargano, matrici, accenti, lettere greche e simboli. Non lancia mai errori: quello che non conosce si mostra com'è.
 */

export type Node =
  | { k: 'ch'; s: string; v: 'it' | 'rm' | 'b' | 'tt' }
  | { k: 'sp'; w: number }
  | { k: 'row'; c: Node[] }
  | { k: 'frac'; n: Node; d: Node; bar: boolean }
  | { k: 'sup'; b: Node; s: Node }
  | { k: 'sub'; b: Node; s: Node }
  | { k: 'subsup'; b: Node; lo: Node; hi: Node }
  | { k: 'sqrt'; c: Node; n?: Node }
  | { k: 'op'; s: string; limits: boolean; lo?: Node; hi?: Node }
  | { k: 'delim'; l: string; r: string; c: Node }
  | { k: 'mat'; rows: Node[][]; l: string; r: string; left: boolean }
  | { k: 'acc'; c: Node; a: 'bar' | 'vec' | 'hat' | 'tilde' | 'dot' | 'ddot' | 'under' };

const GREEK: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ϵ',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  varpi: 'ϖ',
  rho: 'ρ',
  varrho: 'ϱ',
  sigma: 'σ',
  varsigma: 'ς',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'ϕ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
};
const GREEK_UP: Record<string, string> = {
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
};
const SYMBOLS: Record<string, string> = {
  cdot: '·',
  times: '×',
  div: '÷',
  pm: '±',
  mp: '∓',
  ast: '∗',
  star: '⋆',
  circ: '∘',
  bullet: '•',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  simeq: '≃',
  cong: '≅',
  propto: '∝',
  ll: '≪',
  gg: '≫',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  emptyset: '∅',
  varnothing: '∅',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  gets: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  implies: '⟹',
  iff: '⟺',
  mapsto: '↦',
  uparrow: '↑',
  downarrow: '↓',
  in: '∈',
  notin: '∉',
  ni: '∋',
  subset: '⊂',
  subseteq: '⊆',
  supset: '⊃',
  supseteq: '⊇',
  cup: '∪',
  cap: '∩',
  setminus: '∖',
  forall: '∀',
  exists: '∃',
  nexists: '∄',
  neg: '¬',
  lnot: '¬',
  land: '∧',
  wedge: '∧',
  lor: '∨',
  vee: '∨',
  oplus: '⊕',
  otimes: '⊗',
  perp: '⊥',
  parallel: '∥',
  angle: '∠',
  degree: '°',
  prime: '′',
  ldots: '…',
  cdots: '⋯',
  dots: '…',
  vdots: '⋮',
  ddots: '⋱',
  aleph: 'ℵ',
  hbar: 'ħ',
  ell: 'ℓ',
  Re: 'ℜ',
  Im: 'ℑ',
  mid: '∣',
  lbrace: '{',
  rbrace: '}',
  langle: '⟨',
  rangle: '⟩',
  lfloor: '⌊',
  rfloor: '⌋',
  lceil: '⌈',
  rceil: '⌉',
  checkmark: '✓',
  therefore: '∴',
  because: '∵',
  square: '□',
  triangle: '△',
  top: '⊤',
  bot: '⊥',
  backslash: '\\',
  '{': '{',
  '}': '}',
  '%': '%',
  '&': '&',
  '#': '#',
  _: '_',
  $: '$',
};
const FUNCS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'lg',
  'exp',
  'det',
  'dim',
  'ker',
  'deg',
  'gcd',
  'max',
  'min',
  'sup',
  'inf',
  'arg',
  'mod',
  'Pr',
  'hom',
  'lim',
  'limsup',
  'liminf',
]);
const BIG: Record<string, { s: string; limits: boolean }> = {
  sum: { s: '∑', limits: true },
  prod: { s: '∏', limits: true },
  coprod: { s: '∐', limits: true },
  bigcup: { s: '⋃', limits: true },
  bigcap: { s: '⋂', limits: true },
  int: { s: '∫', limits: false },
  iint: { s: '∬', limits: false },
  iiint: { s: '∭', limits: false },
  oint: { s: '∮', limits: false },
};
const SPACES: Record<string, number> = {
  ',': 0.17,
  ':': 0.22,
  ';': 0.28,
  ' ': 0.28,
  quad: 1,
  qquad: 2,
  '!': 0,
  '>': 0.22,
};
const ACCENTS: Record<string, 'bar' | 'vec' | 'hat' | 'tilde' | 'dot' | 'ddot' | 'under'> = {
  overline: 'bar',
  bar: 'bar',
  vec: 'vec',
  overrightarrow: 'vec',
  hat: 'hat',
  widehat: 'hat',
  tilde: 'tilde',
  widetilde: 'tilde',
  dot: 'dot',
  ddot: 'ddot',
  underline: 'under',
};
const ENVS: Record<string, [string, string]> = {
  matrix: ['', ''],
  pmatrix: ['(', ')'],
  bmatrix: ['[', ']'],
  Bmatrix: ['{', '}'],
  vmatrix: ['|', '|'],
  Vmatrix: ['‖', '‖'],
  cases: ['{', ''],
  array: ['', ''],
  aligned: ['', ''],
  align: ['', ''],
  split: ['', ''],
};

const row = (c: Node[]): Node => (c.length === 1 ? c[0]! : { k: 'row', c });
const EMPTY: Node = { k: 'row', c: [] };

class Reader {
  i = 0;
  constructor(readonly s: string) {}
  peek(): string {
    return this.s[this.i] ?? '';
  }
  more(): boolean {
    return this.i < this.s.length;
  }
  skipBlank(): void {
    while (this.more() && /\s/.test(this.peek())) this.i++;
  }
  /** `\nome` (lettere) o `\x` (un solo carattere): il nome senza barra. */
  command(): string {
    this.i++; // la barra
    const m = /^[A-Za-z]+/.exec(this.s.slice(this.i));
    if (m) {
      this.i += m[0].length;
      return m[0];
    }
    const c = this.s[this.i] ?? '';
    this.i += c ? 1 : 0;
    return c;
  }
  /** Il testo dentro `{...}` com'è (per \text, \begin{…}). */
  raw(): string {
    this.skipBlank();
    if (this.peek() !== '{') return '';
    let depth = 0;
    const start = this.i + 1;
    while (this.more()) {
      const c = this.s[this.i]!;
      if (c === '\\') this.i++;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) break;
      this.i++;
    }
    const out = this.s.slice(start, this.i);
    this.i++;
    return out;
  }
}

function delimName(r: Reader): string {
  r.skipBlank();
  if (r.peek() === '\\') {
    const c = r.command();
    return SYMBOLS[c] ?? (c === '|' ? '‖' : c);
  }
  const c = r.peek();
  r.i += c ? 1 : 0;
  return c;
}

/** Un solo «pezzo» dopo ^ _ \frac…: un gruppo `{…}` o un carattere o un comando. */
function arg(r: Reader): Node {
  r.skipBlank();
  if (r.peek() === '{') {
    r.i++;
    const n = parseRow(r, '}');
    r.i++;
    return n;
  }
  return atom(r) ?? EMPTY;
}

function text(s: string, v: 'rm' | 'b' | 'tt' = 'rm'): Node {
  return { k: 'ch', s, v };
}

function atom(r: Reader): Node | null {
  r.skipBlank();
  const c = r.peek();
  if (!c) return null;
  if (c === '{') return arg(r);
  if (c === '\\') return command(r);
  r.i++;
  if (/[A-Za-z]/.test(c)) return { k: 'ch', s: c, v: 'it' };
  if (c === '-') return text('−');
  if (c === '*') return text('∗');
  if (c === "'") return { k: 'sup', b: EMPTY, s: text('′') };
  if (c === '~') return { k: 'sp', w: 0.28 };
  return text(c);
}

function command(r: Reader): Node | null {
  const name = r.command();
  if (name in GREEK) return { k: 'ch', s: GREEK[name]!, v: 'it' };
  if (name in GREEK_UP) return text(GREEK_UP[name]!);
  if (name in BIG) return { k: 'op', s: BIG[name]!.s, limits: BIG[name]!.limits };
  if (FUNCS.has(name)) {
    const limits =
      name === 'lim' ||
      name === 'limsup' ||
      name === 'liminf' ||
      name === 'max' ||
      name === 'min' ||
      name === 'sup' ||
      name === 'inf';
    // il nome di una funzione sta dritto e ha un po' d'aria dopo (sin x)
    return limits
      ? { k: 'op', s: name, limits: true }
      : { k: 'row', c: [text(name), { k: 'sp', w: 0.17 }] };
  }
  if (name in ACCENTS) return { k: 'acc', c: arg(r), a: ACCENTS[name]! };
  if (name in SPACES) return { k: 'sp', w: SPACES[name]! };
  switch (name) {
    case 'frac':
    case 'dfrac':
    case 'tfrac':
      return { k: 'frac', n: arg(r), d: arg(r), bar: true };
    case 'binom':
    case 'dbinom':
      return { k: 'delim', l: '(', r: ')', c: { k: 'frac', n: arg(r), d: arg(r), bar: false } };
    case 'sqrt': {
      r.skipBlank();
      let n: Node | undefined;
      if (r.peek() === '[') {
        r.i++;
        const start = r.i;
        while (r.more() && r.peek() !== ']') r.i++;
        const inner = new Reader(r.s.slice(start, r.i));
        n = parseRow(inner, '');
        r.i++;
      }
      return { k: 'sqrt', c: arg(r), ...(n ? { n } : {}) };
    }
    case 'text':
    case 'mathrm':
    case 'textrm':
    case 'operatorname':
    case 'mbox':
    case 'textnormal': {
      const raw = r.raw();
      return text(raw.replace(/\\ /g, ' ').replace(/\\([{}%&#_$])/g, '$1'));
    }
    case 'textbf':
    case 'mathbf':
    case 'boldsymbol':
    case 'bm': {
      const a = arg(r);
      return a.k === 'ch' ? { ...a, v: 'b' } : a;
    }
    case 'mathit':
    case 'textit':
    case 'mathcal':
    case 'mathbb':
    case 'mathscr':
    case 'mathsf':
      return arg(r);
    case 'mathtt':
    case 'texttt': {
      return text(r.raw(), 'tt');
    }
    case 'left': {
      const l = delimName(r);
      const inner = parseRow(r, '\\right');
      let rr = '';
      if (r.s.startsWith('\\right', r.i)) {
        r.i += 6;
        rr = delimName(r);
      }
      return { k: 'delim', l: l === '.' ? '' : l, r: rr === '.' ? '' : rr, c: inner };
    }
    case 'right':
      return null;
    case 'big':
    case 'Big':
    case 'bigg':
    case 'Bigg':
    case 'bigl':
    case 'bigr':
    case 'Bigl':
    case 'Bigr':
    case 'displaystyle':
    case 'textstyle':
    case 'scriptstyle':
    case 'limits':
    case 'nolimits':
      return { k: 'sp', w: 0 };
    case 'begin': {
      const env = r.raw();
      return environment(r, env);
    }
    case 'end':
      r.raw();
      return null;
    case '\\':
      return { k: 'sp', w: 0 }; // il ritorno a capo fuori da una matrice: si ignora
    case 'lbrace':
    case 'rbrace':
      return text(SYMBOLS[name]!);
    default:
      if (name in SYMBOLS) return text(SYMBOLS[name]!);
      return text('\\' + name, 'tt'); // sconosciuto: si vede com'è
  }
}

function environment(r: Reader, env: string): Node {
  const [l, rr] = ENVS[env] ?? ['', ''];
  if (env === 'array' || env === 'aligned' || env === 'align') {
    r.skipBlank();
    if (r.peek() === '{') r.raw(); // il formato delle colonne di array: non serve
  }
  const rows: Node[][] = [[]];
  const cell: Node[] = [];
  const closeCell = () => {
    rows[rows.length - 1]!.push(row(cell.splice(0)));
  };
  while (r.more()) {
    r.skipBlank();
    if (r.s.startsWith('\\end', r.i)) {
      r.i += 4;
      r.raw();
      break;
    }
    if (r.s.startsWith('\\\\', r.i)) {
      r.i += 2;
      closeCell();
      rows.push([]);
      continue;
    }
    if (r.peek() === '&') {
      r.i++;
      closeCell();
      continue;
    }
    pushWithScripts(r, cell);
  }
  closeCell();
  const last = rows[rows.length - 1]!;
  if (
    rows.length > 1 &&
    last.length === 1 &&
    last[0]!.k === 'row' &&
    (last[0] as { c: Node[] }).c.length === 0
  )
    rows.pop();
  return {
    k: 'mat',
    rows,
    l,
    r: rr,
    left: env === 'cases' || env === 'aligned' || env === 'align' || env === 'split',
  };
}

/** Legge un pezzo e, se dopo ci sono ^ o _, li attacca a quel pezzo. */
function pushWithScripts(r: Reader, out: Node[]): void {
  let a = atom(r);
  if (!a) return;
  for (;;) {
    r.skipBlank();
    const c = r.peek();
    if (c !== '^' && c !== '_') break;
    r.i++;
    const s = arg(r);
    if (a.k === 'op' && !a.lo && !a.hi) {
      a = { ...a, [c === '^' ? 'hi' : 'lo']: s };
    } else if (a.k === 'op') {
      a = { ...a, [c === '^' ? 'hi' : 'lo']: s };
    } else if (a.k === 'sup' && c === '_') {
      a = { k: 'subsup', b: a.b, lo: s, hi: a.s };
    } else if (a.k === 'sub' && c === '^') {
      a = { k: 'subsup', b: a.b, lo: a.s, hi: s };
    } else {
      a = c === '^' ? { k: 'sup', b: a, s } : { k: 'sub', b: a, s };
    }
  }
  out.push(a);
}

function parseRow(r: Reader, stop: string): Node {
  const out: Node[] = [];
  while (r.more()) {
    r.skipBlank();
    if (stop && (stop === '\\right' ? r.s.startsWith('\\right', r.i) : r.peek() === stop)) break;
    if (!stop && r.peek() === '}') {
      r.i++; // una } che non chiude niente: si salta
      continue;
    }
    const before = r.i;
    pushWithScripts(r, out);
    if (r.i === before) r.i++; // mai fermi
  }
  return row(out);
}

/** Il LaTeX letto in un albero. Una stringa vuota dà una riga vuota. */
export function parseTex(tex: string): Node {
  try {
    return parseRow(new Reader(tex), '');
  } catch {
    return text(tex, 'tt');
  }
}

/** Quanto è alto un pezzo, in «righe di testo» (1 = una lettera): serve a scegliere la misura di parentesi e radici. */
export function heightOf(n: Node): number {
  switch (n.k) {
    case 'ch':
    case 'sp':
      return 1;
    case 'row':
      return Math.max(1, ...n.c.map(heightOf));
    case 'frac':
      return Math.max(2.2, heightOf(n.n) + heightOf(n.d) + 0.25);
    case 'sup':
      return heightOf(n.b) + 0.4;
    case 'sub':
      return heightOf(n.b) + 0.3;
    case 'subsup':
      return heightOf(n.b) + 0.7;
    case 'sqrt':
      return heightOf(n.c) + 0.25;
    case 'op':
      return n.limits
        ? 1.4 + (n.hi ? heightOf(n.hi) * 0.7 : 0) + (n.lo ? heightOf(n.lo) * 0.7 : 0)
        : 1.8;
    case 'delim':
      return heightOf(n.c);
    case 'mat':
      return n.rows.reduce((t, r) => t + Math.max(1, ...r.map(heightOf)) + 0.3, 0);
    case 'acc':
      return heightOf(n.c) + 0.3;
  }
}
