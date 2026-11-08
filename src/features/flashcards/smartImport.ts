/**
 * L'importazione intelligente (fc_smart_import.js, parte dello studio): si incolla quello che si ha e si capisce da soli il
 * formato: celle copiate da Excel o Fogli (tabulazioni), CSV, JSON, righe «domanda - risposta». Se la prima riga è
 * un'intestazione le colonne si assegnano dai nomi, se no dal contenuto. Le immagini (link) si leggono ma per ora non si
 * importano.
 */

export type Field = 'q' | 'a' | 'm' | 'ex' | 'n' | 'img' | '';
/** I campi di una carta di studio. */
export const FIELDS: Field[] = ['q', 'a', 'img', ''];
/** I campi di una parola di lingua: significato, esempio e note in più. */
export const VOCAB_FIELDS: Field[] = ['q', 'a', 'm', 'ex', 'n', 'img', ''];

/** Per le lingue: il nome e il codice della lingua che si impara e di quella che si conosce (sono intestazioni valide). */
export interface VocabOptions {
  learn?: { name: string; code: string };
  known?: { name: string; code: string };
}

export type Format = 'excel' | 'csv' | 'json' | 'righe';

export interface Table {
  colonne: string[];
  righe: string[][];
  intestazione: boolean;
  formato: Format;
  campi: Field[];
}

export interface ImportedCard {
  q: string;
  a: string;
  m: string;
  ex: string;
  n: string;
  imgLink: string;
}

export type Analysis = Table | { errore: string } | null;

const SYNONYMS: Record<'q' | 'a' | 'm' | 'ex' | 'n' | 'img', string[]> = {
  q: [
    'word',
    'words',
    'parola',
    'parole',
    'vocabolo',
    'termine',
    'term',
    'lemma',
    'front',
    'fronte',
    'vocab',
    'vocabulary',
    'expression',
    'espressione',
    'w',
    'q',
    'question',
    'domanda',
    'domande',
    'questions',
    'prompt',
    'concetto',
    'concept',
  ],
  a: [
    'translation',
    'traduzione',
    'traduzioni',
    'translations',
    't',
    'a',
    'answer',
    'risposta',
    'risposte',
    'answers',
    'back',
    'retro',
    'solution',
    'soluzione',
  ],
  m: [
    'meaning',
    'meanings',
    'significato',
    'significati',
    'definition',
    'definizione',
    'def',
    'description',
    'descrizione',
    'spiegazione',
    'explanation',
    'm',
    'gloss',
  ],
  ex: [
    'example',
    'examples',
    'esempio',
    'esempi',
    'sentence',
    'sentences',
    'frase',
    'frasi',
    'usage',
    'uso',
    'context',
    'contesto',
    'e',
    'ex',
  ],
  n: [
    'notes',
    'note',
    'nota',
    'notas',
    'notizen',
    'tip',
    'tips',
    'trick',
    'trucco',
    'trucchi',
    'memo',
    'promemoria',
    'hint',
    'hints',
    'suggerimento',
    'suggerimenti',
    'remark',
    'remarks',
    'comment',
    'comments',
    'commento',
    'commenti',
    'mnemonic',
    'mnemonico',
    'appunti',
    'appunto',
    'n',
  ],
  img: [
    'image',
    'images',
    'immagine',
    'immagini',
    'img',
    'picture',
    'pic',
    'photo',
    'foto',
    'link',
    'url',
    'imageurl',
    'imagelink',
    'linkimmagine',
    'src',
  ],
};
function norm(s: unknown): string {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9Ѐ-ӿͰ-Ͽ぀-ヿ一-鿿]+/g, '');
}

/** I nomi di lingua che nelle lingue valgono come intestazione di «parola» (come sul sito). */
const LANGUAGE_NAMES = [
  'english',
  'inglese',
  'german',
  'tedesco',
  'deutsch',
  'french',
  'francese',
  'francais',
  'spanish',
  'spagnolo',
  'espanol',
  'portuguese',
  'portoghese',
  'japanese',
  'giapponese',
  'chinese',
  'cinese',
  'russian',
  'russo',
];

/** Le intestazioni valide per ogni campo: nelle lingue anche il nome (e il codice) delle due lingue del corso. */
function synonymsFor(vocab: VocabOptions | undefined): Record<keyof typeof SYNONYMS, string[]> {
  const syn = { ...SYNONYMS, q: [...SYNONYMS.q], a: [...SYNONYMS.a] };
  if (!vocab) return syn;
  const names = (x?: { name: string; code: string }): string[] =>
    x ? [norm(x.name), norm(x.code), norm(x.code.split('-')[0])] : [];
  syn.q = syn.q.concat(names(vocab.learn));
  syn.a = syn.a.concat(names(vocab.known));
  for (const n of LANGUAGE_NAMES) if (!syn.a.includes(n) && !syn.q.includes(n)) syn.q.push(n);
  return syn;
}

/** Quale campo indica il nome di una colonna (null = nessuno; nello studio solo domanda, risposta e immagine). */
export function fieldFromName(name: string, vocab?: VocabOptions): Field | null {
  const n = norm(name);
  if (!n) return null;
  const syn = synonymsFor(vocab);
  for (const c of Object.keys(syn) as (keyof typeof SYNONYMS)[]) {
    if (!syn[c].includes(n)) continue;
    return vocab || c === 'q' || c === 'a' || c === 'img' ? c : null;
  }
  return null;
}

/** Tabella con un separatore di un carattere, virgolette comprese: una cella di Excel che va a capo non si spezza. */
function readTable(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inside = false;
  let i = 0;
  const t = text.replace(/\r\n?/g, '\n');
  while (i < t.length) {
    const c = t[i]!;
    if (inside) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inside = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field.trim() === '') {
      inside = true;
      field = '';
      i++;
      continue;
    }
    if (c === sep) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  rows.push(row);
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ''));
}

/** Righe semplici con un separatore di più caratteri: si taglia solo alla prima occorrenza per ogni colonna attesa. */
function readLines(text: string, sep: string, columns: number): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts: string[] = [];
      let rest = l;
      for (let k = 0; k < columns - 1; k++) {
        const p = rest.indexOf(sep);
        if (p === -1) break;
        parts.push(rest.slice(0, p).trim());
        rest = rest.slice(p + sep.length);
      }
      parts.push(rest.trim());
      return parts;
    });
}

interface Separator {
  sep: string | null;
  table: boolean;
  columns: number;
}

function chooseSeparator(text: string): Separator | null {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .slice(0, 60);
  if (!lines.length) return null;
  const count = (l: string, s: string): number => l.split(s).length - 1;
  const mode = (arr: number[]): { value: number; share: number } => {
    const f = new Map<number, number>();
    let m = 0;
    let v = 0;
    for (const x of arr) {
      const n = (f.get(x) ?? 0) + 1;
      f.set(x, n);
      if (n > m) {
        m = n;
        v = x;
      }
    }
    return { value: v, share: m / arr.length };
  };
  const candidates: { s: string; tab?: boolean; min: number; reg?: number }[] = [
    { s: '\t', tab: true, min: 0.5 },
    { s: ';', tab: true, min: 0.7, reg: 0.75 },
    { s: '|', tab: true, min: 0.7, reg: 0.75 },
    { s: ',', tab: true, min: 0.8, reg: 0.85 },
    { s: ' - ', min: 0.6 },
    { s: ' – ', min: 0.6 },
    { s: ' — ', min: 0.6 },
    { s: ' = ', min: 0.6 },
    { s: ' : ', min: 0.6 },
    { s: ': ', min: 0.6 },
    { s: ' -> ', min: 0.6 },
    { s: ' → ', min: 0.6 },
  ];
  for (const c of candidates) {
    const counts = lines.map((l) => count(l, c.s));
    const withSep = counts.filter((n) => n > 0).length / lines.length;
    if (withSep < c.min) continue;
    const m = mode(counts);
    if (c.reg && m.share < c.reg) continue;
    return { sep: c.s, table: !!c.tab, columns: Math.max(1, m.value + 1) };
  }
  return { sep: null, table: false, columns: 1 };
}

/** Il JSON delle IA arriva spesso con le barre del LaTeX non raddoppiate e gli a capo dentro le stringhe: si ripara. */
function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const safe = text
      .replace(/\n(?!\s*[}\]\s]*\s*(?:,|\]|"|\{))/g, '\\n')
      .replace(/(^|[^\\])\\(?!n|t|r|"|\\|\/|u[0-9a-fA-F]{4})/g, '$1\\\\');
    return JSON.parse(safe);
  }
}

function cellText(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) {
    return v.map(cellText).filter(Boolean).join(' · ');
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return cellText(o.text || o.testo || o.value || Object.values(o)[0]);
  }
  return String(v).trim().replace(/\\%/g, '%');
}

function fromJson(
  data: unknown,
  columnName: (n: number) => string,
): { colonne: string[]; righe: string[][]; intestazione: boolean } | null {
  let d = data;
  if (d && !Array.isArray(d) && typeof d === 'object') {
    const inner = Object.values(d as Record<string, unknown>).find((x) => Array.isArray(x));
    d = inner ?? [d];
  }
  if (!Array.isArray(d) || !d.length) return null;
  if (Array.isArray(d[0])) {
    return {
      colonne: (d[0] as unknown[]).map((_, i) => columnName(i + 1)),
      righe: d.map((r) => (r as unknown[]).map(cellText)),
      intestazione: false,
    };
  }
  if (typeof d[0] !== 'object') {
    return { colonne: [columnName(1)], righe: d.map((x) => [cellText(x)]), intestazione: false };
  }
  const keys: string[] = [];
  for (const o of d) {
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o as object)) if (!keys.includes(k)) keys.push(k);
    }
  }
  return {
    colonne: keys,
    righe: d
      .filter((o) => o && typeof o === 'object')
      .map((o) => keys.map((k) => cellText((o as Record<string, unknown>)[k]))),
    intestazione: true,
  };
}

export const looksLikeUrl = (s: string): boolean => /^https?:\/\/\S+$/i.test(String(s).trim());

function assign(
  tab: { colonne: string[]; righe: string[][]; intestazione: boolean },
  vocab?: VocabOptions,
): Field[] {
  const n = tab.colonne.length;
  const fields: (Field | null)[] = new Array<Field | null>(n).fill(null);
  const used: Record<string, boolean> = {};
  // 1. dai nomi
  if (tab.intestazione) {
    tab.colonne.forEach((name, i) => {
      const c = fieldFromName(name, vocab);
      if (c && !used[c]) {
        fields[i] = c;
        used[c] = true;
      }
    });
  }
  // 2. dal contenuto: indirizzi = immagine
  for (let i = 0; i < n; i++) {
    if (fields[i] !== null) continue;
    const full = tab.righe.map((r) => r[i] ?? '').filter(Boolean);
    if (full.length && !used.img && full.filter(looksLikeUrl).length / full.length >= 0.6) {
      fields[i] = 'img';
      used.img = true;
    }
  }
  // 3. lingue: la colonna di frasi che contengono la parola è l'esempio
  if (vocab) {
    const colQ = fields.indexOf('q');
    const firstFree = fields.indexOf(null);
    const qIdx = colQ !== -1 ? colQ : firstFree;
    if (qIdx !== -1 && !used.ex) {
      for (let k = 0; k < n; k++) {
        if (k === qIdx || fields[k] !== null) continue;
        let count = 0;
        let total = 0;
        for (const r of tab.righe) {
          const cell = r[k] ?? '';
          const word = r[qIdx] ?? '';
          if (!cell || !word) continue;
          total++;
          if (
            cell.includes('_') ||
            (cell.length > word.length + 8 && cell.toLowerCase().includes(word.toLowerCase()))
          )
            count++;
        }
        if (total && count / total >= 0.5) {
          fields[k] = 'ex';
          used.ex = true;
          break;
        }
      }
    }
  }
  // 4. il resto in ordine
  const order: Field[] = vocab ? ['q', 'a', 'm', 'ex'] : ['q', 'a'];
  for (let z = 0; z < n; z++) {
    if (fields[z] !== null) continue;
    const free = order.find((c) => !used[c]);
    fields[z] = free ?? '';
    if (free) used[free] = true;
  }
  return fields as Field[];
}

/**
 * Legge un testo incollato. `columnName(n)` dà il nome «Colonna n» quando non c'è un'intestazione. Ritorna null se non c'è
 * niente da leggere, `{ errore }` se sembra un JSON rotto.
 */
export function analyze(
  input: string,
  columnName: (n: number) => string,
  vocab?: VocabOptions,
): Analysis {
  const text = String(input || '').trim();
  if (!text) return null;
  let tab: { colonne: string[]; righe: string[][]; intestazione: boolean } | null = null;
  let format: Format = 'righe';
  let jsonError: string | null = null;

  if (/^[[{]/.test(text)) {
    try {
      tab = fromJson(readJson(text), columnName);
      format = 'json';
    } catch (e) {
      jsonError = (e as Error).message;
    }
    // comincia come un JSON: se non si legge è un JSON rotto, non una tabella con le parentesi dentro
    if (!tab && /^\[\s*[[{"]|^\{\s*"/.test(text)) return { errore: jsonError ?? '?' };
  }
  if (!tab) {
    const s = chooseSeparator(text);
    if (!s) return null;
    let rows: string[][];
    if (s.sep === null) {
      rows = text
        .split(/\r?\n/)
        .map((l) => [l.trim()])
        .filter((r) => r[0]);
    } else if (s.table) rows = readTable(text, s.sep);
    else rows = readLines(text, s.sep, s.columns);
    if (!rows.length) return jsonError ? { errore: jsonError } : null;
    format =
      s.sep === '\t' ? 'excel' : s.sep === ',' || s.sep === ';' || s.sep === '|' ? 'csv' : 'righe';
    const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
    rows = rows.map((r) => {
      const c = r.slice();
      while (c.length < width) c.push('');
      return c;
    });
    // intestazione: la prima riga è fatta di nomi di campo che si riconoscono, e nessuna sua cella è una frase lunga
    const first = rows[0]!;
    let recognised = 0;
    for (const c of first) if (fieldFromName(c, vocab)) recognised++;
    const short = first.every((c) => c.length <= 40);
    const header =
      rows.length > 1 &&
      short &&
      recognised >= Math.max(1, Math.ceil(first.filter(Boolean).length / 2));
    tab = {
      colonne: header
        ? first.map((c, i) => c || columnName(i + 1))
        : first.map((_, i) => columnName(i + 1)),
      righe: header ? rows.slice(1) : rows,
      intestazione: header,
    };
    if (jsonError && format === 'righe' && tab.colonne.length < 2) return { errore: jsonError };
  }
  return { ...tab, formato: format, campi: assign(tab, vocab) };
}

/** Dalle colonne alle carte (le righe senza domanda, risposta né immagine si scartano). */
export function toCards(tab: Table | null): ImportedCard[] {
  if (!tab) return [];
  return tab.righe
    .map((r) => {
      const c: ImportedCard = { q: '', a: '', m: '', ex: '', n: '', imgLink: '' };
      tab.campi.forEach((field, i) => {
        const v = r[i] ?? '';
        if (!field || !v) return;
        if (field === 'img') {
          if (looksLikeUrl(v) && !c.imgLink) c.imgLink = v;
          return;
        }
        c[field] = c[field] ? `${c[field]} · ${v}` : v;
      });
      return c;
    })
    .filter((c) => c.q !== '' || c.a !== '' || c.imgLink);
}
