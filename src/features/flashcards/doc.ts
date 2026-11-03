/**
 * Il documento delle carte (domanda e risposta). Porta di public/fc/fc_parser.js: stesso modello, stesse regole.
 * Un documento è `{ v: 2, blocks }`; un blocco è un paragrafo (`p`, anche citazione o riga di codice), un punto elenco (`li`)
 * o una formula a blocco (`fx`); un paragrafo è fatto di pezzi di testo (`s`) o di formule in linea (`x`), ognuno con le sue
 * etichette (`m`: b i u h, c = colore). Le carte vecchie sono in un formato a tag (`/bold{...}`): si leggono e si convertono.
 * Il test d'oro (`__tests__/doc.test.ts`) confronta questa copia con il codice vero del sito su 41 testi.
 */

export interface Marks {
  [k: string]: string | number | boolean;
}
export interface TextRun {
  s: string;
  m?: Marks;
}
export interface MathRun {
  x: string;
  m?: Marks;
}
export type Run = TextRun | MathRun;
export interface ParagraphBlock {
  t: 'p';
  runs: Run[];
  lvl?: number;
  code?: string;
  hl?: 1;
  q?: 1;
}
export interface ListBlock {
  t: 'li';
  lvl: number;
  runs: Run[];
  c?: string;
  ck?: 0 | 1;
}
export interface MathBlock {
  t: 'fx';
  tex: string;
  lvl?: number;
  c?: string;
  m?: Marks;
}
export type Block = ParagraphBlock | ListBlock | MathBlock;
export interface Doc {
  v: 2;
  blocks: Block[];
}

export const DOC_VERSION = 2;
/** Colori del testo (chiave → colore di riserva; l'app usa quelli del suo tema quando c'è). */
export const TEXT_COLORS: Record<string, string> = {
  red: '#FF3B30',
  blue: '#007AFF',
  green: '#34C759',
  purple: '#AF52DE',
  orange: '#FF9500',
  gray: '#8A8A8E',
  gold: '#D99A00',
  teal: '#1FA9A0',
  indigo: '#5856D6',
  pink: '#E8387A',
  brown: '#A2845E',
};
const LIST_COLORS = ['red', 'orange', 'green', 'blue', 'purple', 'gray'];
const FLAGS = ['b', 'i', 'u', 'h'];
export const BULLETS = ['•', '◦', '▪', '‣', '⁃', '▫'];
export const CODE_LANGS: Record<string, string> = {
  python: 'Python',
  cpp: 'C++',
  c: 'C',
  java: 'Java',
  js: 'JavaScript',
  ts: 'TypeScript',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  bash: 'Bash',
  json: 'JSON',
  csharp: 'C#',
  php: 'PHP',
  other: 'Code',
};

const codeOk = (v: unknown): boolean =>
  v === 'auto' || (typeof v === 'string' && Object.prototype.hasOwnProperty.call(CODE_LANGS, v));
export const bulletFor = (lvl: number): string =>
  BULLETS[(Math.max(1, Math.trunc(lvl) || 1) - 1) % BULLETS.length]!;

export const emptyDoc = (): Doc => ({ v: 2, blocks: [{ t: 'p', runs: [] }] });

function cloneMarks(m: unknown): Marks | null {
  if (!m || typeof m !== 'object') return null;
  let out: Marks | null = null;
  for (const k of Object.keys(m)) {
    const v = (m as Marks)[k];
    if (v === null || v === undefined || v === false || v === '') continue;
    (out ??= {})[k] = v;
  }
  return out;
}

function sameMarks(a: Marks | undefined | null, b: Marks | undefined | null): boolean {
  const x = a ?? {};
  const y = b ?? {};
  const ka = Object.keys(x);
  if (ka.length !== Object.keys(y).length) return false;
  return ka.every((k) => x[k] === y[k]);
}

const int = (v: unknown): number => parseInt(String(v), 10);

/** La forma canonica: via i pezzi vuoti, fusi quelli vicini con le stesse etichette, blocchi sempre validi. */
export function normDoc(doc: unknown): Doc {
  const d = doc as { blocks?: unknown } | null;
  if (!d || !Array.isArray(d.blocks)) return emptyDoc();
  const out: Block[] = [];
  for (const raw of d.blocks) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as Record<string, unknown>;

    if (b.t === 'fx') {
      const fx: MathBlock = { t: 'fx', tex: String(b.tex == null ? '' : b.tex) };
      const lv = int(b.lvl);
      if (lv >= 1) {
        fx.lvl = Math.min(lv, 12);
        if (LIST_COLORS.includes(b.c as string)) fx.c = b.c as string;
      }
      const m = cloneMarks(b.m);
      if (m) fx.m = m;
      out.push(fx);
      continue;
    }

    let runs: Run[] = [];
    for (const rr of Array.isArray(b.runs) ? b.runs : []) {
      if (!rr || typeof rr !== 'object') continue;
      const r = rr as Record<string, unknown>;
      if (typeof r.x === 'string') {
        const mf = cloneMarks(r.m);
        runs.push(mf ? { x: r.x, m: mf } : { x: r.x });
        continue;
      }
      const s = String(r.s == null ? '' : r.s).replace(/​/g, '');
      if (s === '') continue;
      const m = cloneMarks(r.m);
      const last = runs[runs.length - 1] as TextRun | undefined;
      if (last && typeof last.s === 'string' && sameMarks(last.m, m)) last.s += s;
      else runs.push(m ? { s, m } : { s });
    }

    if (b.t === 'li') {
      let lvl = int(b.lvl);
      if (!(lvl >= 1)) lvl = 1;
      if (lvl > 12) lvl = 12;
      const li: ListBlock = { t: 'li', lvl, runs };
      if (LIST_COLORS.includes(b.c as string)) li.c = b.c as string;
      const ck = int(b.ck);
      if (ck === 0 || ck === 1) li.ck = ck;
      out.push(li);
    } else {
      if (runs.length === 1 && (runs[0] as TextRun).s === '\n' && !runs[0]!.m) runs = [];
      const p: ParagraphBlock = { t: 'p', runs };
      const lvp = int(b.lvl);
      if (lvp >= 1) p.lvl = Math.min(lvp, 12);
      if (b.code && codeOk(b.code)) {
        p.code = b.code as string;
        delete p.lvl;
        if (b.hl) p.hl = 1;
      } else if (b.q) p.q = 1;
      out.push(p);
    }
  }
  if (!out.length) out.push({ t: 'p', runs: [] });
  return { v: 2, blocks: out };
}

const runText = (r: Run): string =>
  'x' in r && typeof r.x === 'string' ? r.x : ((r as TextRun).s ?? '');
export function blockText(b: Block | undefined): string {
  if (!b) return '';
  if (b.t === 'fx') return String(b.tex || '');
  return b.runs.map(runText).join('');
}

/** Il testo di tutto il documento, un blocco per riga (per cercare, per leggere ad alta voce, per le anteprime). */
export const docToPlain = (doc: Doc): string => doc.blocks.map(blockText).join('\n');

/* ---------------- il formato vecchio, letto e convertito ---------------- */

const LEG_SIMPLE: Record<string, string> = { bold: 'b', italic: 'i', underline: 'u', yellow: 'h' };
const LEG_COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'gray'];

function fromLegacy(str: string): Doc {
  const blocks: Block[] = [];
  let cur: Block = { t: 'p', runs: [] };

  const pushBlock = () => {
    blocks.push(cur);
    cur = { t: 'p', runs: [] };
  };
  const addText = (s: string, m: Marks | null) => {
    if (s) (cur as ParagraphBlock).runs.push(m ? { s, m: cloneMarks(m)! } : { s });
  };
  const closing = (s: string, from: number): number => {
    let depth = 1;
    let k = from;
    while (k < s.length && depth > 0) {
      if (s[k] === '{') depth++;
      else if (s[k] === '}') {
        depth--;
        if (!depth) break;
      }
      k++;
    }
    return k;
  };

  function walk(s: string, marks: Marks | null, inList: boolean): void {
    let i = 0;
    const n = s.length;
    let buf = '';
    const flush = () => {
      addText(buf, marks);
      buf = '';
    };
    while (i < n) {
      const ch = s[i]!;

      if (ch === '$') {
        const disp = s[i + 1] === '$';
        const d = disp ? '$$' : '$';
        const j = i + d.length;
        const close = s.indexOf(d, j);
        if (close !== -1) {
          const tex = s.substring(j, close);
          flush();
          if (disp && !inList) {
            if (blockText(cur).length) pushBlock();
            else cur = { t: 'p', runs: [] };
            blocks.push({ t: 'fx', tex });
          } else (cur as ParagraphBlock).runs.push({ x: tex });
          i = close + d.length;
          continue;
        }
      }

      if (ch === '/') {
        const rest = s.slice(i);
        const mL = /^\/list(-[a-zA-Z]+)?\{/.exec(rest);
        if (mL) {
          let col = mL[1] ? mL[1].slice(1).toLowerCase() : '';
          if (!LEG_COLORS.includes(col)) col = '';
          const c0 = i + mL[0].length;
          const k = closing(s, c0);
          flush();
          if (blockText(cur).length) pushBlock();
          legacyList(s.substring(c0, k), col, marks);
          i = k + 1;
          continue;
        }
        const mT = /^\/([a-zA-Z]+)\{/.exec(rest);
        if (mT) {
          const name = mT[1]!.toLowerCase();
          const flag = Object.prototype.hasOwnProperty.call(LEG_SIMPLE, name)
            ? LEG_SIMPLE[name]
            : undefined;
          const isCol = LEG_COLORS.includes(name);
          if (flag || isCol) {
            const c1 = i + mT[0].length;
            const k2 = closing(s, c1);
            flush();
            const sotto: Marks = cloneMarks(marks) ?? {};
            if (flag) sotto[flag] = 1;
            else sotto.c = name;
            walk(s.substring(c1, k2), sotto, inList);
            i = k2 + 1;
            continue;
          }
        }
      }

      if (ch === '\n') {
        flush();
        if (inList) (cur as ParagraphBlock).runs.push({ s: '\n' });
        else pushBlock();
        i++;
        continue;
      }

      buf += ch;
      i++;
    }
    flush();
  }

  function legacyList(inner: string, color: string, marks: Marks | null): void {
    String(inner)
      .replace(/^\n/, '')
      .replace(/\n$/, '')
      .split('\n')
      .forEach((line) => {
        const t = line.trim();
        if (t === '') return;
        const m = /^([-•]+)\s*(.*)$/.exec(t);
        if (!m) {
          const last = blocks[blocks.length - 1];
          if (last && last.t === 'li') {
            cur = last;
            cur.runs.push({ s: '\n' });
            walk(t, marks, true);
            cur = { t: 'p', runs: [] };
            return;
          }
        }
        let lvl = 1;
        let testo = t;
        if (m) {
          lvl = m[1]!.replace(/•/g, '-').length;
          testo = m[2]!;
        }
        const li: ListBlock = { t: 'li', lvl, runs: [] };
        if (color) li.c = color;
        cur = li;
        walk(testo, marks, true);
        blocks.push(cur);
        cur = { t: 'p', runs: [] };
      });
  }

  walk(String(str).replace(/\r\n/g, '\n').replace(/\r/g, '\n'), null, false);
  if (blockText(cur).length || !blocks.length) blocks.push(cur);
  return normDoc({ v: 2, blocks });
}

/** Legge quello che c'è nel campo di una carta: il formato nuovo (JSON) o il vecchio a tag (o testo semplice). */
export function parseDoc(text: string | null | undefined): Doc {
  if (text == null) return emptyDoc();
  const s = String(text);
  const t = s.trim();
  if (t.charAt(0) === '{' && t.indexOf('"blocks"') !== -1) {
    try {
      const o = JSON.parse(t) as { blocks?: unknown };
      if (o && Array.isArray(o.blocks)) return normDoc(o);
    } catch {
      /* non era JSON valido: si legge come formato vecchio */
    }
  }
  return fromLegacy(s);
}

export const stringifyDoc = (doc: Doc): string => JSON.stringify(normDoc(doc));

/** Toglie a capo e spazi di troppo ai bordi e le formule vuote (come fcdTrim del sito). */
export function trimDoc(doc: Doc): Doc {
  const d = normDoc(doc);
  const blocks = d.blocks;
  const vuoto = (b: Block) =>
    b.t === 'fx' ? String(b.tex || '').trim() === '' : blockText(b).trim() === '';

  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const bl = blocks[bi]!;
    if (bl.t === 'fx') {
      if (String(bl.tex || '').trim() === '') blocks.splice(bi, 1);
      continue;
    }
    for (let ri = bl.runs.length - 1; ri >= 0; ri--) {
      const r = bl.runs[ri]!;
      if (typeof (r as MathRun).x === 'string' && (r as MathRun).x.trim() === '')
        bl.runs.splice(ri, 1);
    }
  }
  if (blocks.length === 0) blocks.push({ t: 'p', runs: [] });
  while (blocks.length > 1 && vuoto(blocks[0]!)) blocks.shift();
  while (blocks.length > 1 && vuoto(blocks[blocks.length - 1]!)) blocks.pop();

  const primo = blocks[0];
  if (primo && primo.t !== 'fx' && primo.runs.length) {
    const r0 = primo.runs[0]!;
    if (typeof (r0 as TextRun).s === 'string')
      (r0 as TextRun).s = (r0 as TextRun).s.replace(/^[ \t ]+/, '');
    while (
      primo.runs.length > 1 &&
      typeof (primo.runs[0] as TextRun).s === 'string' &&
      (primo.runs[0] as TextRun).s === ''
    )
      primo.runs.shift();
  }
  const ultimo = blocks[blocks.length - 1];
  if (ultimo && ultimo.t !== 'fx' && ultimo.runs.length) {
    const rn = ultimo.runs[ultimo.runs.length - 1]!;
    if (typeof (rn as TextRun).s === 'string')
      (rn as TextRun).s = (rn as TextRun).s.replace(/[ \t ]+$/, '');
    while (
      ultimo.runs.length > 1 &&
      typeof (ultimo.runs[ultimo.runs.length - 1] as TextRun).s === 'string' &&
      (ultimo.runs[ultimo.runs.length - 1] as TextRun).s === ''
    )
      ultimo.runs.pop();
  }
  return d;
}

/** Come `trimDoc` ma da testo a testo: quello che si salva nel campo della carta. Un testo illeggibile resta com'è. */
export function trimDocText(raw: string | null | undefined): string | null | undefined {
  if (!raw) return raw;
  try {
    return stringifyDoc(trimDoc(parseDoc(raw)));
  } catch {
    return raw;
  }
}

/** Da testo semplice a documento: un paragrafo per riga. */
export function plainToDoc(text: string): Doc {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  return normDoc({
    v: 2,
    blocks: lines.map((l) => ({ t: 'p', runs: l ? [{ s: l }] : [] })),
  });
}

/** Il campo di una carta da un testo semplice scritto a mano (per l'editor semplice). */
export const plainToField = (text: string): string | null => {
  const t = text.trim();
  return t ? stringifyDoc(trimDoc(plainToDoc(t))) : null;
};

export const FLAG_KEYS = FLAGS;

/** Il testo è «semplice»: solo paragrafi di testo senza etichette (si può modificare come testo normale senza perdere niente). */
export function isPlainDoc(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined || raw === '') return true;
  const d = parseDoc(raw);
  return d.blocks.every(
    (b) =>
      b.t === 'p' &&
      !b.code &&
      !b.q &&
      !b.lvl &&
      b.runs.every((r) => 's' in r && typeof r.s === 'string' && !r.m),
  );
}
