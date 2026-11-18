/**
 * La colorazione del codice di una carta: la stessa del sito (fcdDetectLang / fcdHlLine / fcdHlGroup in
 * public/fc/fc_parser.js). Poche regole di proposito: parole chiave, stringhe, commenti, numeri, nomi di funzione e di tipo.
 */

export type TokenKind = 'k' | 's' | 'c' | 'n' | 'f' | 't';
export type Token = { t: TokenKind | null; s: string };

/** I colori dei pezzi di codice (quelli del sito: .fc-tk-*), sul fondo scuro del riquadro. */
export const TOKEN_COLORS: Record<TokenKind, string> = {
  k: '#ff7ab2',
  s: '#fc6a5d',
  c: '#7f8c98',
  n: '#d9c97c',
  f: '#67b7a4',
  t: '#9ecbff',
};
/** Il riquadro del codice: fondo e colore del testo (come --fc-code-bg / --fc-code-fg del sito). */
export const CODE_BG = '#14161b';
export const CODE_FG = '#e6e6ea';
export const CODE_HEAD_FG = '#9a9aa3';

const words = (x: string): Record<string, 1> => {
  const o: Record<string, 1> = {};
  for (const k of x.split(' ')) o[k] = 1;
  return o;
};

const C_LIKE =
  'if else for while do switch case break continue return goto sizeof typedef struct union enum static const extern void int char float double long short unsigned signed auto register volatile';
const CPP = `${C_LIKE} class public private protected virtual override namespace using template typename new delete this try catch throw bool true false nullptr inline operator friend explicit constexpr include define string vector std cout cin endl`;
const JAVA =
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new package private protected public return short static super switch synchronized this throw throws try void volatile while true false null var String';
const JS =
  'async await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield true false null undefined of from';

const KEYWORDS: Record<string, Record<string, 1>> = {
  python: words(
    'and as assert async await break class continue def del elif else except finally for from global if import in is lambda None nonlocal not or pass raise return try while with yield True False self print',
  ),
  cpp: words(CPP),
  c: words(`${C_LIKE} include define`),
  java: words(JAVA),
  csharp: words(
    `${JAVA} namespace using foreach var string bool object partial readonly override virtual abstract async await`,
  ),
  js: words(JS),
  ts: words(
    `${JS} interface type enum implements readonly private public protected number string boolean any unknown never`,
  ),
  sql: words(
    'select from where and or not in is null insert into values update set delete create table drop alter add join inner left right outer on group by order having limit offset as distinct union all primary key foreign references index view like between exists case when then else end asc desc count sum avg min max',
  ),
  bash: words(
    'if then else elif fi for while do done case esac function in echo cd ls sudo export source return exit pip npm git mkdir rm cp mv cat grep',
  ),
  php: words(
    'function class public private protected static return if else elseif foreach for while echo new use namespace try catch throw null true false array',
  ),
  css: {},
  html: {},
  json: { true: 1, false: 1, null: 1 },
  other: {},
};

const PATTERNS: Record<string, RegExp[]> = {
  python: [
    /^\s*def\s+\w+\s*\(.*\)\s*(->\s*[\w[\], .]+)?\s*:/m,
    /^\s*(from\s+[\w.]+\s+import|import\s+\w+)/m,
    /\bprint\s*\(/,
    /\belif\b|\bself\b|\bNone\b|\bTrue\b|\bFalse\b/,
    /^\s*(if|for|while|class|else|try|with)\b.*:\s*$/m,
    /\brange\(|\blen\(/,
  ],
  cpp: [
    /#include\s*[<"]/,
    /\bstd::/,
    /\b(cout|cin|endl)\b/,
    /\bint\s+main\s*\(/,
    /\busing\s+namespace\b/,
    /\b(vector|unique_ptr|nullptr)\b/,
  ],
  c: [/#include\s*<std(io|lib)\.h>/, /\bprintf\s*\(/, /\bint\s+main\s*\(/],
  java: [
    /\bpublic\s+(static\s+)?(class|void|int)\b/,
    /System\.out\.print/,
    /\bString\[\]\s+args\b/,
    /\bimport\s+java\./,
  ],
  csharp: [/\busing\s+System/, /Console\.Write/, /\bnamespace\s+\w+/, /\bstatic\s+void\s+Main/],
  js: [
    /\b(const|let)\s+\w+\s*=/,
    /=>/,
    /console\.log/,
    /\bfunction\s*\w*\s*\(/,
    /\brequire\(|\bmodule\.exports|\bdocument\./,
  ],
  ts: [/:\s*(string|number|boolean|any)\b/, /\binterface\s+\w+/, /\btype\s+\w+\s*=/, /<[A-Z]\w*>/],
  sql: [
    /\bselect\b[\s\S]*\bfrom\b/i,
    /\binsert\s+into\b/i,
    /\bcreate\s+table\b/i,
    /\bwhere\b[\s\S]*=/i,
    /\bgroup\s+by\b|\border\s+by\b/i,
  ],
  html: [/<\/?(div|html|body|span|head|script|ul|li|p|a|h[1-6])[\s>]/i, /<!doctype/i],
  css: [/[.#]?[\w-]+\s*\{[^}]*:[^}]*;/],
  bash: [/^#!\/bin\/(ba)?sh/m, /^\s*\$\s+\w+/m, /^\s*(sudo|pip|npm|git|cd|ls|echo|mkdir)\s+/m],
  json: [/^\s*[{[]\s*$/m, /"[\w-]+"\s*:\s*("|\d|\{|\[|true|false|null)/],
  php: [/<\?php/, /\$\w+\s*=/],
};

/** Riconosce la lingua dal testo: ogni lingua guadagna un punto per ogni indizio; senza indizi resta «other». */
export function detectLang(text: string): string {
  let best = 'other';
  let bestN = 0;
  for (const lang of Object.keys(PATTERNS)) {
    let n = 0;
    for (const re of PATTERNS[lang]!) if (re.test(text)) n++;
    if (n > bestN || (n === bestN && n > 0 && lang === 'cpp' && best === 'c')) {
      best = lang;
      bestN = n;
    }
  }
  return bestN ? best : 'other';
}

type State = { m: 'bc' | 'tq' | null; q: string };

function lineComments(lang: string): string[] {
  if (lang === 'php') return ['//', '#'];
  if (lang === 'python' || lang === 'bash') return ['#'];
  if (lang === 'sql') return ['--'];
  if (lang === 'html' || lang === 'json') return [];
  return ['//'];
}

function blockComment(lang: string): [string, string] | null {
  if (lang === 'python' || lang === 'bash' || lang === 'json') return null;
  if (lang === 'html') return ['<!--', '-->'];
  return ['/*', '*/'];
}

/** Colora una riga, portandosi dietro lo stato dei commenti e delle stringhe che continuano sulla riga dopo. */
function highlightLine(line: string, lang: string, st: State): Token[] {
  const kw = KEYWORDS[lang] ?? {};
  const lineC = lineComments(lang);
  const blockC = blockComment(lang);
  const out: Token[] = [];
  const push = (t: TokenKind | null, s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev && prev.t === t) prev.s += s;
    else out.push({ t, s });
  };
  const n = line.length;
  let i = 0;
  while (i < n) {
    if (st.m) {
      const end = st.m === 'tq' ? st.q : blockC![1];
      const k = line.indexOf(end, i);
      const cls: TokenKind = st.m === 'tq' ? 's' : 'c';
      if (k === -1) {
        push(cls, line.slice(i));
        i = n;
      } else {
        push(cls, line.slice(i, k + end.length));
        i = k + end.length;
        st.m = null;
      }
      continue;
    }
    const rest = line.slice(i);
    if (lineC.some((c) => rest.startsWith(c))) {
      push('c', rest);
      break;
    }
    if (blockC && rest.startsWith(blockC[0])) {
      const k = line.indexOf(blockC[1], i + blockC[0].length);
      if (k === -1) {
        push('c', rest);
        st.m = 'bc';
        i = n;
      } else {
        push('c', line.slice(i, k + blockC[1].length));
        i = k + blockC[1].length;
      }
      continue;
    }
    if (lang === 'python' && (rest.startsWith('"""') || rest.startsWith("'''"))) {
      const q3 = rest.slice(0, 3);
      const k3 = line.indexOf(q3, i + 3);
      if (k3 === -1) {
        push('s', rest);
        st.m = 'tq';
        st.q = q3;
        i = n;
      } else {
        push('s', line.slice(i, k3 + 3));
        i = k3 + 3;
      }
      continue;
    }
    const ch = line.charAt(i);
    if (ch === '"' || ch === "'" || (ch === '`' && lang !== 'python' && lang !== 'sql')) {
      let j = i + 1;
      while (j < n && line.charAt(j) !== ch) {
        if (line.charAt(j) === '\\') j++;
        j++;
      }
      const to = Math.min(j + 1, n);
      push('s', line.slice(i, to));
      i = to;
      continue;
    }
    const num = /^(0[xX][0-9a-fA-F_]+|\d[\d_]*\.?\d*([eE][+-]?\d+)?)/.exec(rest);
    if (num && !/[\w$]/.test(i ? line.charAt(i - 1) : ' ')) {
      push('n', num[0]);
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (id) {
      const w = id[0];
      const key = lang === 'sql' ? w.toLowerCase() : w;
      const next = line.charAt(i + w.length);
      if (kw[key]) push('k', w);
      else if (next === '(' && lang !== 'json') push('f', w);
      else if (/^[A-Z][a-z]/.test(w) && lang !== 'sql' && lang !== 'css' && lang !== 'html')
        push('t', w);
      else push(null, w);
      i += w.length;
      continue;
    }
    push(null, ch);
    i++;
  }
  return out;
}

/** Colora un gruppo di righe di codice: per ognuna i suoi pezzi (il testo rimesso insieme dà la riga). */
export function highlightGroup(lines: string[], lang: string): Token[][] {
  const st: State = { m: null, q: '' };
  return lines.map((l) => highlightLine(l, lang, st));
}
