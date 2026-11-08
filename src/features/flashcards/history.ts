import type { GameRepo, GameRow } from './game';

/** Una partita dello storico, con quel che serve a mostrarla e a filtrarla. */
export interface HistoryPart {
  game: GameRow;
  correct: number;
  wrong: number;
  score: number;
  seconds: number;
  /** Posizione da cui riprendere, se la partita è rimasta a metà (con almeno una risposta). */
  resume: number | null;
}

/** Una partita «madre» con i suoi ripassi (come sul sito: i ripassi stanno dentro la madre). */
export interface HistoryEntry extends HistoryPart {
  retries: HistoryPart[];
  decks: string[];
}

export type HistoryState = 'all' | 'open' | 'done';
export type HistoryKind = 'any' | 'all' | '0' | '1';
export type HistorySort = 'recent' | 'long' | 'errors' | 'accuracy';

export interface HistoryFilter {
  state: HistoryState;
  kind: HistoryKind;
  sort: HistorySort;
  /** I mazzi della materia scelta (il mazzo e i suoi sotto-mazzi); `null` = tutte. */
  subject: Set<string> | null;
  /** Prima data (AAAA-MM-GG) da mostrare; '' = da sempre. */
  from: string;
  /** Ultima data (AAAA-MM-GG) da mostrare; assente o '' = fino a oggi. */
  to?: string;
}

const part = (games: GameRepo, game: GameRow): HistoryPart => {
  const t = games.tally(game.uuid);
  const pending = games.resumePosition(game.uuid);
  return {
    game,
    correct: t.correct,
    wrong: t.wrong,
    score: t.score,
    seconds: games.playedSeconds(game.uuid),
    resume: pending !== null && t.played > 0 ? pending : null,
  };
};

/** Le partite madri (con i ripassi dentro) senza nessuna risposta né nei ripassi: restano fuori, come sul sito. */
export function historyEntries(games: GameRepo): HistoryEntry[] {
  const all = games.games();
  const children = new Map<string, GameRow[]>();
  for (const g of all) {
    if (g.parent_uuid) children.set(g.parent_uuid, [...(children.get(g.parent_uuid) ?? []), g]);
  }
  const known = new Set(all.map((g) => g.uuid));
  const out: HistoryEntry[] = [];
  for (const g of all) {
    // una madre vera, o un ripasso la cui madre non c'è più
    if (g.parent_uuid && known.has(g.parent_uuid)) continue;
    const retries: HistoryPart[] = [];
    const seen = new Set([g.uuid]);
    const queue = [...(children.get(g.uuid) ?? [])];
    while (queue.length) {
      const c = queue.shift()!;
      if (seen.has(c.uuid)) continue;
      seen.add(c.uuid);
      retries.push(part(games, c));
      queue.push(...(children.get(c.uuid) ?? []));
    }
    retries.sort((a, b) => (a.game.game_date ?? '').localeCompare(b.game.game_date ?? ''));
    const me = part(games, g);
    if (me.correct + me.wrong === 0 && !retries.some((r) => r.correct + r.wrong > 0)) continue;
    const seconds = me.seconds + retries.reduce((n, r) => n + r.seconds, 0);
    out.push({ ...me, seconds, retries, decks: games.gameDecks(g.uuid) });
  }
  return out;
}

const accuracy = (e: HistoryPart): number =>
  e.correct + e.wrong > 0 ? e.correct / (e.correct + e.wrong) : 1;
const day = (e: HistoryPart): string => e.game.game_date ?? '';
const suspended = (e: HistoryEntry): boolean =>
  e.resume !== null || e.retries.some((r) => r.resume !== null);

/** Filtra e ordina come lo storico del sito (stesse regole, stessi spareggi). */
export function filterHistory(entries: HistoryEntry[], f: HistoryFilter): HistoryEntry[] {
  const rows = entries.filter((e) => {
    if (f.from && day(e).slice(0, 10) < f.from) return false;
    if (f.to && day(e).slice(0, 10) > f.to) return false;
    if (f.kind !== 'any' && (e.game.card_status ?? 'all') !== f.kind) return false;
    if (f.subject && !e.decks.some((d) => f.subject!.has(d))) return false;
    if (f.state === 'open' && !suspended(e)) return false;
    if (f.state === 'done' && suspended(e)) return false;
    return true;
  });
  const byDate = (a: HistoryEntry, b: HistoryEntry): number => day(b).localeCompare(day(a));
  rows.sort((a, b) => {
    if (f.sort === 'long') return b.seconds - a.seconds || byDate(a, b);
    if (f.sort === 'errors') return b.wrong - a.wrong || byDate(a, b);
    if (f.sort === 'accuracy') return accuracy(a) - accuracy(b) || byDate(a, b);
    return byDate(a, b);
  });
  return rows;
}

/** Il riepilogo di quel che si vede: partite madri, tempo, giuste e sbagliate (ripassi compresi). */
export function summarize(rows: HistoryEntry[]): {
  games: number;
  seconds: number;
  correct: number;
  wrong: number;
} {
  let seconds = 0;
  let correct = 0;
  let wrong = 0;
  for (const r of rows) {
    seconds += r.seconds;
    correct += r.correct;
    wrong += r.wrong;
    for (const x of r.retries) {
      correct += x.correct;
      wrong += x.wrong;
    }
  }
  return { games: rows.length, seconds, correct, wrong };
}

/** «La strada fino al 100%» di una partita con i suoi ripassi (`sfc_catena` del sito). */
export interface HistoryChain {
  /** 'perfetta' = senza errori al primo colpo; 'conquistata' = un ripasso finito senza errori; 'aperta' = ci sono ancora errori; null = niente di finito */
  state: 'perfetta' | 'conquistata' | 'aperta' | null;
  /** la precisione di ogni passo (la partita, poi i ripassi con risposte), in ordine */
  climb: (number | null)[];
  /** gli errori rimasti nell'ultimo passo finito */
  toFix: number;
  /** la partita da cui parte il prossimo ripasso: l'ultimo passo finito */
  lastUuid: string;
  /** c'è una partita (o un ripasso) lasciata a metà */
  suspended: boolean;
}

export function chainOf(e: HistoryEntry): HistoryChain {
  const members: HistoryPart[] = [e, ...e.retries.filter((r) => r.correct + r.wrong > 0)];
  const pct = (m: HistoryPart): number | null => {
    const n = m.correct + m.wrong;
    return n ? Math.round((m.correct / n) * 100) : null;
  };
  let last: HistoryPart | null = null;
  for (const m of members) if (m.resume === null && m.correct + m.wrong > 0) last = m;
  let state: HistoryChain['state'];
  if (!last) state = null;
  else if (e.resume === null && e.wrong === 0 && e.correct > 0) state = 'perfetta';
  else if (last.wrong === 0 && last.game.uuid !== e.game.uuid) state = 'conquistata';
  else state = 'aperta';
  return {
    state,
    climb: members.map(pct),
    toFix: last ? last.wrong : 0,
    lastUuid: last ? last.game.uuid : e.game.uuid,
    suspended: members.some((m) => m.resume !== null) || e.retries.some((r) => r.resume !== null),
  };
}
