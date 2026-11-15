/**
 * La memoria degli acquisti: ciò che hai già comprato torna come «Compra di nuovo» e come
 * suggerimento mentre scrivi. Resta su questo telefono (chiave `buy_history` nello stato locale).
 * Le funzioni qui sono pure, si provano in Node; `BuyHistoryStore` le lega al database.
 */
import type { SqlDb } from '../../core/db/sqldb';
import { getState, setState } from '../../core/sync/engine';
import { norm } from './logic';

export interface HistoryEntry {
  /** il nome come l'hai scritto l'ultima volta */
  title: string;
  /** quante volte è stato comprato */
  uses: number;
  /** ultimo uso, millisecondi */
  last: number;
  /** categoria locale dell'ultima volta (uuid), se c'era */
  cat: string | null;
  /** prezzo dell'ultima volta, in centesimi */
  cents: number | null;
}

/** Chiave = nome normalizzato («Latte  Intero!» e «latte intero» sono lo stesso articolo). */
export type History = Record<string, HistoryEntry>;

export const MAX_ENTRIES = 300;
export const MAX_CHIPS_EMPTY = 8;
export const MAX_CHIPS_TYPED = 6;

export interface Bought {
  title: string;
  cat?: string | null;
  cents?: number | null;
}

/** Aggiunge un acquisto: +1 all'uso, e ricorda categoria e prezzo più recenti. */
export function remember(history: History, item: Bought, now: number): History {
  const key = norm(item.title);
  if (!key) return history;
  const old = history[key];
  const next: History = {
    ...history,
    [key]: {
      title: item.title.trim().slice(0, 120),
      uses: (old?.uses ?? 0) + 1,
      last: now,
      cat: item.cat ?? old?.cat ?? null,
      cents: item.cents ?? old?.cents ?? null,
    },
  };
  return trim(next);
}

/** Toglie un articolo dalla memoria (pressione lunga sul suggerimento). */
export function forget(history: History, title: string): History {
  const key = norm(title);
  if (!(key in history)) return history;
  const { [key]: _gone, ...rest } = history;
  return rest;
}

/** Tiene solo i `MAX_ENTRIES` più recenti. */
function trim(history: History): History {
  const keys = Object.keys(history);
  if (keys.length <= MAX_ENTRIES) return history;
  const keep = keys.sort((a, b) => (history[b]?.last ?? 0) - (history[a]?.last ?? 0));
  const out: History = {};
  for (const k of keep.slice(0, MAX_ENTRIES)) {
    const e = history[k];
    if (e) out[k] = e;
  }
  return out;
}

/**
 * Cosa proporre. Senza testo: i più comprati (a parità, i più recenti), esclusi quelli già in lista.
 * Con testo: quelli che iniziano così o hanno una parola che inizia così; mai ciò che è già in lista,
 * mai la frase identica a quella scritta.
 */
export function suggest(
  history: History,
  query: string,
  inList: readonly string[],
): HistoryEntry[] {
  const q = norm(query);
  const skip = new Set(inList.map(norm));
  const rows = Object.entries(history).filter(([key]) => !skip.has(key));
  const byUse = (a: HistoryEntry, b: HistoryEntry) => b.uses - a.uses || b.last - a.last;
  if (!q) {
    return rows
      .map(([, e]) => e)
      .filter((e) => e.uses > 0)
      .sort(byUse)
      .slice(0, MAX_CHIPS_EMPTY);
  }
  return rows
    .filter(
      ([key]) => key !== q && (key.startsWith(q) || key.split(' ').some((w) => w.startsWith(q))),
    )
    .map(([key, e]) => ({ e, prefix: key.startsWith(q) }))
    .sort((a, b) => Number(b.prefix) - Number(a.prefix) || byUse(a.e, b.e))
    .map((x) => x.e)
    .slice(0, MAX_CHIPS_TYPED);
}

/** Legge il testo salvato; se è rovinato riparte vuoto (la memoria non deve mai far cadere l'app). */
export function parseHistory(raw: string | null): History {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out: History = {};
    for (const [key, v] of Object.entries(data as Record<string, unknown>)) {
      const e = v as Partial<HistoryEntry> | null;
      if (!e || typeof e.title !== 'string' || !norm(e.title)) continue;
      out[norm(e.title)] = {
        title: e.title.slice(0, 120),
        uses: typeof e.uses === 'number' && e.uses > 0 ? Math.floor(e.uses) : 1,
        last: typeof e.last === 'number' ? e.last : 0,
        cat: typeof e.cat === 'string' ? e.cat : null,
        cents: typeof e.cents === 'number' && e.cents >= 0 ? Math.round(e.cents) : null,
      };
      void key;
    }
    return trim(out);
  } catch {
    return {};
  }
}

const KEY = 'buy_history';

export class BuyHistoryStore {
  constructor(private readonly db: SqlDb) {}

  read(): History {
    try {
      return parseHistory(getState(this.db, KEY));
    } catch {
      return {};
    }
  }

  private write(history: History): History {
    setState(this.db, KEY, JSON.stringify(history));
    return history;
  }

  remember(items: readonly Bought[], now = Date.now()): History {
    let h = this.read();
    for (const it of items) h = remember(h, it, now);
    return this.write(h);
  }

  forget(title: string): History {
    return this.write(forget(this.read(), title));
  }
}
