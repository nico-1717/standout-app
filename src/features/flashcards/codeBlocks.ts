import { CODE_LANGS, type Block, type Marks, type Run, type TextRun } from './doc';
import { detectLang, highlightGroup, type Token, type TokenKind } from './highlight';

/** Un gruppo di righe di codice di fila (come sul sito: un riquadro solo, con la lingua della prima riga). */
export type CodeGroup = {
  start: number;
  end: number;
  lang: string;
  /** il nome da mostrare sulla testata del riquadro */
  label: string;
  /** per ogni riga, i suoi pezzi colorati */
  lines: Token[][];
};

/** Un tratto di codice: il testo, il colore del suo pezzo di linguaggio e i marchi (grassetto, evidenziatore…) */
export type CodeSeg = { s: string; tk: TokenKind | null; m?: Marks };

const isCode = (b: Block | undefined): boolean => !!b && b.t === 'p' && !!b.code;

/** Il testo semplice di una riga (le formule in linea contano per il loro testo). */
export const runsText = (runs: Run[]): string =>
  runs.map((r) => ('x' in r && typeof r.x === 'string' ? r.x : (r as TextRun).s)).join('');

/** Trova i gruppi di righe di codice e li colora. La chiave è il numero del primo blocco; `at` dà il gruppo di ogni riga. */
export function codeGroups(blocks: Block[]): {
  byStart: Map<number, CodeGroup>;
  at: (i: number) => { group: CodeGroup; line: number } | null;
} {
  const byStart = new Map<number, CodeGroup>();
  for (let i = 0; i < blocks.length; i++) {
    if (!isCode(blocks[i])) continue;
    let z = i;
    while (isCode(blocks[z + 1])) z++;
    const texts: string[] = [];
    for (let k = i; k <= z; k++) {
      const b = blocks[k]!;
      texts.push(b.t === 'p' ? runsText(b.runs) : '');
    }
    const first = blocks[i]!;
    const chosen = first.t === 'p' ? (first.code ?? 'auto') : 'auto';
    const lang = chosen === 'auto' ? detectLang(texts.join('\n')) : chosen;
    byStart.set(i, {
      start: i,
      end: z,
      lang,
      label: CODE_LANGS[lang] ?? 'Code',
      lines: highlightGroup(texts, lang),
    });
    i = z;
  }
  return {
    byStart,
    at: (i) => {
      for (const g of byStart.values())
        if (i >= g.start && i <= g.end) return { group: g, line: i - g.start };
      return null;
    },
  };
}

/**
 * Una riga di codice a tratti: ogni carattere ha il colore del suo pezzo di linguaggio e i marchi del testo da cui viene;
 * si raggruppano i caratteri vicini che hanno gli stessi due (la somma dei tratti dà il testo della riga).
 */
export function codeSegments(runs: Run[], tokens: Token[]): CodeSeg[] {
  const kinds: (TokenKind | null)[] = [];
  for (const t of tokens) for (let i = 0; i < t.s.length; i++) kinds.push(t.t);
  const marks: (Marks | undefined)[] = [];
  const text = runsText(runs);
  for (const r of runs) {
    const m = 'x' in r && typeof r.x === 'string' ? r.m : (r as TextRun).m;
    const len = ('x' in r && typeof r.x === 'string' ? r.x : (r as TextRun).s).length;
    for (let i = 0; i < len; i++) marks.push(m);
  }
  const out: CodeSeg[] = [];
  // se i conti non tornano si lascia la riga com'è (meglio senza colori che con il testo sbagliato)
  if (kinds.length !== text.length) return text ? [{ s: text, tk: null }] : [];
  for (let i = 0; i < text.length; i++) {
    const prev = out[out.length - 1];
    if (prev && prev.tk === kinds[i] && prev.m === marks[i]) prev.s += text[i];
    else out.push({ s: text[i]!, tk: kinds[i] ?? null, m: marks[i] });
  }
  return out;
}
