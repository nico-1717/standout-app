/**
 * Le formule della griglia (come un foglio Excel). Una cella che comincia con «=» è una formula: numeri, + - * / e
 * parentesi, riferimenti come B3, e SUM, AVG (o AVERAGE), MIN, MAX, COUNT su un intervallo (B2:B9) o su più
 * argomenti. Niente `eval`: un piccolo interprete, così una cella copiata da fuori non può eseguire codice.
 */

export type Cells = Record<string, string>;
export type Value = number | string;

export const ERR = '#ERR';
export const CYCLE = '#CYCLE';
export const DIV0 = '#DIV/0';

/** «A» → 0, «B» → 1, «AA» → 26. */
export const colIndex = (letters: string): number =>
  [...letters.toUpperCase()].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
export const colName = (i: number): string => {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
export const cellKey = (col: number, row: number) => `${colName(col)}${row + 1}`;

const REF = /^([A-Za-z]{1,2})(\d{1,3})$/;
export const parseRef = (ref: string): { col: number; row: number } | null => {
  const m = REF.exec(ref);
  if (!m) return null;
  return { col: colIndex(m[1] as string), row: Number(m[2]) - 1 };
};

class Failure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (ch === ' ') {
      i++;
      continue;
    }
    const num = /^\d+(\.\d+)?|^\.\d+/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z][A-Za-z0-9]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0].toUpperCase() });
      i += id[0].length;
      continue;
    }
    if ('+-*/(),:'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    throw new Failure(ERR);
  }
  return out;
}

const FUNCS = new Set(['SUM', 'AVG', 'AVERAGE', 'MIN', 'MAX', 'COUNT']);

/** Calcola tutte le celle: ogni cella dà un numero o un testo. Le formule sbagliate danno un codice «#…», non un crash. */
export function evaluate(cells: Cells): Record<string, Value> {
  const memo = new Map<string, Value>();
  const busy = new Set<string>();

  const valueOf = (key: string): Value => {
    if (memo.has(key)) return memo.get(key) as Value;
    if (busy.has(key)) throw new Failure(CYCLE);
    const raw = (cells[key] ?? '').trim();
    let v: Value;
    if (raw.startsWith('=')) {
      busy.add(key);
      try {
        v = run(raw.slice(1));
      } catch (e) {
        v = e instanceof Failure ? e.code : ERR;
      } finally {
        busy.delete(key);
      }
    } else if (raw !== '' && Number.isFinite(Number(raw.replace(',', '.')))) {
      v = Number(raw.replace(',', '.'));
    } else v = raw;
    memo.set(key, v);
    return v;
  };

  /** Il numero di una cella dentro una formula: vuota = 0, testo = errore, errore di un'altra cella = si propaga. */
  const numberOf = (key: string): number => {
    const v = valueOf(key);
    if (typeof v === 'number') return v;
    if (v === '') return 0;
    if (v.startsWith('#')) throw new Failure(v);
    throw new Failure(ERR);
  };

  const rangeKeys = (a: string, b: string): string[] => {
    const p = parseRef(a);
    const q = parseRef(b);
    if (!p || !q) throw new Failure(ERR);
    const out: string[] = [];
    for (let r = Math.min(p.row, q.row); r <= Math.max(p.row, q.row); r++)
      for (let c = Math.min(p.col, q.col); c <= Math.max(p.col, q.col); c++)
        out.push(cellKey(c, r));
    if (out.length > 5000) throw new Failure(ERR);
    return out;
  };

  const run = (src: string): number => {
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const eat = (v?: string) => {
      const t = toks[pos++];
      if (!t || (v !== undefined && !(t.t === 'op' && t.v === v))) throw new Failure(ERR);
      return t;
    };
    const isOp = (v: string) => {
      const t = peek();
      return !!t && t.t === 'op' && t.v === v;
    };

    /** Gli argomenti di una funzione: ognuno è un intervallo (A1:B3) o un'espressione; i numeri si raccolgono in fila. */
    const args = (): number[] => {
      const nums: number[] = [];
      eat('(');
      if (isOp(')')) {
        eat(')');
        return nums;
      }
      for (;;) {
        const t = peek();
        const next = toks[pos + 1];
        const after = toks[pos + 2];
        if (t?.t === 'id' && next?.t === 'op' && next.v === ':' && after?.t === 'id') {
          pos += 3;
          // dentro un intervallo le celle di testo si saltano, come in Excel
          for (const k of rangeKeys(t.v, after.v)) {
            const v = valueOf(k);
            if (typeof v === 'number') nums.push(v);
            else if (v.startsWith('#')) throw new Failure(v);
          }
        } else nums.push(expr());
        if (isOp(',')) {
          eat(',');
          continue;
        }
        eat(')');
        return nums;
      }
    };

    const atom = (): number => {
      const t = eat();
      if (t.t === 'num') return t.v;
      if (t.t === 'op') {
        if (t.v === '-') return -atom();
        if (t.v === '+') return atom();
        if (t.v === '(') {
          const v = expr();
          eat(')');
          return v;
        }
        throw new Failure(ERR);
      }
      if (FUNCS.has(t.v) && isOp('(')) {
        const n = args();
        switch (t.v) {
          case 'SUM':
            return n.reduce((a, b) => a + b, 0);
          case 'COUNT':
            return n.length;
          case 'MIN':
            return n.length ? Math.min(...n) : 0;
          case 'MAX':
            return n.length ? Math.max(...n) : 0;
          default:
            return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
        }
      }
      if (!parseRef(t.v)) throw new Failure(ERR);
      return numberOf(t.v);
    };
    const term = (): number => {
      let v = atom();
      while (isOp('*') || isOp('/')) {
        const op = (eat() as { v: string }).v;
        const r = atom();
        if (op === '/' && r === 0) throw new Failure(DIV0);
        v = op === '*' ? v * r : v / r;
      }
      return v;
    };
    const expr = (): number => {
      let v = term();
      while (isOp('+') || isOp('-')) {
        const op = (eat() as { v: string }).v;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    };
    const out = expr();
    if (pos < toks.length) throw new Failure(ERR);
    return out;
  };

  const out: Record<string, Value> = {};
  for (const k of Object.keys(cells)) out[k] = valueOf(k);
  return out;
}

/** Come si mostra un valore: i numeri con al massimo 4 decimali, senza zeri inutili. */
export function show(v: Value | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'string') return v;
  return String(Math.round(v * 1e4) / 1e4);
}

/** La somma dei numeri di una colonna (per i totali sotto la tabella). */
export function columnSum(values: Record<string, Value>, col: number, rows: number): number {
  let s = 0;
  for (let r = 0; r < rows; r++) {
    const v = values[cellKey(col, r)];
    if (typeof v === 'number') s += v;
  }
  return s;
}
