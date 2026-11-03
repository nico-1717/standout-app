import type { SqlDb } from '@/core/db/sqldb';

/** Un giorno con le carte giocate e quelle giuste. */
export interface DayCount {
  played: number;
  correct: number;
}

export interface Activity {
  /** «AAAA-MM-GG» → giocate e giuste */
  daily: Map<string, DayCount>;
  /** carte giocate per ora del giorno (0..23) */
  hours: number[];
  /** carte giocate per giorno della settimana (0 = lunedì) */
  weekdays: number[];
  /** secondi di gioco per giorno (la data in cui è iniziata la sessione) */
  time: Map<string, number>;
  totalPlayed: number;
  totalSeconds: number;
}

export interface Streaks {
  best: number;
  current: number;
  /** il prossimo traguardo (3, 7, 14, 30, 60, 100, 200, 365) o null */
  next: number | null;
}

export interface Badge {
  /** chiave del testo: `fc.bdg_<key>` */
  key: string;
  icon: 'target' | 'flame' | 'book' | 'trophy' | 'star';
  done: boolean;
}

export interface DeckBreakdown {
  played: number;
  correct: number;
  seconds: number;
}

export const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
};

/** Il giorno della settimana di una data «AAAA-MM-GG», con 0 = lunedì (come `WEEKDAY` di MySQL). */
export function weekdayOf(iso: string): number {
  return (new Date(dayNumber(iso) * 86_400_000).getUTCDay() + 6) % 7;
}

/** Serie di giorni di fila: la migliore e quella in corso (vale se l'ultimo giorno giocato è oggi o ieri). */
export function streaks(playedDays: string[], today: string): Streaks {
  const days = [...new Set(playedDays)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    const n = dayNumber(d);
    run = prev !== null && n - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  let current = 0;
  if (prev !== null) {
    const diff = prev - dayNumber(today);
    if (diff === 0 || diff === -1) current = run;
  }
  return { best, current, next: MILESTONES.find((m) => m > current) ?? null };
}

/** I traguardi della pagina statistiche. */
export function badges(
  totalPlayed: number,
  bestStreak: number,
  known: number,
  anyDeckComplete: boolean,
): Badge[] {
  return [
    { key: '10_giocate', icon: 'target', done: totalPlayed >= 10 },
    { key: 'streak3', icon: 'flame', done: bestStreak >= 3 },
    { key: 'streak7', icon: 'flame', done: bestStreak >= 7 },
    { key: 'streak30', icon: 'flame', done: bestStreak >= 30 },
    { key: '50_imparate', icon: 'book', done: known >= 50 },
    { key: '100_imparate', icon: 'book', done: known >= 100 },
    { key: 'categoria', icon: 'trophy', done: anyDeckComplete },
    { key: '500_giocate', icon: 'target', done: totalPlayed >= 500 },
    { key: '1000_giocate', icon: 'star', done: totalPlayed >= 1000 },
  ];
}

/** Le statistiche delle flashcard calcolate dal registro delle risposte (fc_stats.php). */
export class StatsRepo {
  constructor(private readonly db: SqlDb) {}

  /** Giocate per giorno, ora e giorno della settimana, e tempo di gioco per giorno. */
  activity(): Activity {
    const daily = new Map<string, DayCount>();
    const hours = new Array<number>(24).fill(0);
    const weekdays = new Array<number>(7).fill(0);
    let totalPlayed = 0;
    for (const r of this.db.all<{ d: string; a: string }>(
      `SELECT play_date AS d, user_answer AS a FROM fc_study_plays
        WHERE play_date IS NOT NULL AND user_answer IN ('Correct', 'Wrong')`,
    )) {
      const day = r.d.slice(0, 10);
      const e = daily.get(day) ?? { played: 0, correct: 0 };
      e.played += 1;
      if (r.a === 'Correct') e.correct += 1;
      daily.set(day, e);
      const h = Number(r.d.slice(11, 13));
      if (h >= 0 && h < 24) hours[h]! += 1;
      weekdays[weekdayOf(day)]! += 1;
      totalPlayed += 1;
    }
    const time = new Map<string, number>();
    let totalSeconds = 0;
    for (const r of this.db.all<{ d: string; s: number }>(
      `SELECT substr(start_time, 1, 10) AS d, SUM(duration_seconds) AS s FROM fc_game_durations
        WHERE start_time IS NOT NULL GROUP BY substr(start_time, 1, 10)`,
    )) {
      time.set(r.d, Number(r.s));
      totalSeconds += Number(r.s);
    }
    return { daily, hours, weekdays, time, totalPlayed, totalSeconds };
  }

  /**
   * Per ogni mazzo (col suo ramo): giocate, giuste e secondi nel periodo [from, to] (date «AAAA-MM-GG», vuote = senza limite).
   * Il mazzo di una risposta è quello della carta (la sottocarta ha quello del padre); se la carta non c'è più, quello della
   * partita se ne ha uno solo. Il tempo va al mazzo della partita: quello delle sue carte se è uno solo, altrimenti il mazzo
   * unico della partita.
   */
  byDeck(from = '', to = ''): Map<string, DeckBreakdown> {
    const decks = this.db.all<{ uuid: string; parent_uuid: string | null }>(
      'SELECT uuid, parent_uuid FROM fc_study_decks',
    );
    const own = new Map<string, DeckBreakdown>();
    for (const d of decks) own.set(d.uuid, { played: 0, correct: 0, seconds: 0 });

    const single = new Map<string, string>();
    const perGame = new Map<string, Set<string>>();
    for (const r of this.db.all<{ game_uuid: string; deck_uuid: string }>(
      'SELECT game_uuid, deck_uuid FROM fc_study_game_decks',
    )) {
      const s = perGame.get(r.game_uuid) ?? new Set<string>();
      s.add(r.deck_uuid);
      perGame.set(r.game_uuid, s);
    }
    for (const [g, s] of perGame) if (s.size === 1) single.set(g, [...s][0]!);

    const cardDeck = new Map<string, string>();
    for (const r of this.db.all<{ uuid: string; d: string }>(
      'SELECT uuid, category_uuid AS d FROM fc_study_cards',
    )) {
      cardDeck.set(`p${r.uuid}`, r.d);
    }
    for (const r of this.db.all<{ uuid: string; d: string }>(
      `SELECT s.uuid, c.category_uuid AS d FROM fc_study_subcards s JOIN fc_study_cards c ON c.uuid = s.parent_uuid`,
    )) {
      cardDeck.set(`c${r.uuid}`, r.d);
    }

    const inRange = (day: string): boolean => (!from || day >= from) && (!to || day <= to);
    // i mazzi diretti delle carte giocate in ogni partita
    const gameDecks = new Map<string, Set<string>>();
    for (const r of this.db.all<{
      g: string;
      card: string | null;
      child: string | null;
      d: string | null;
      a: string;
    }>(
      `SELECT game_uuid AS g, card_uuid AS card, child_uuid AS child, play_date AS d, user_answer AS a
         FROM fc_study_plays`,
    )) {
      const key = r.child ? `c${r.child}` : r.card ? `p${r.card}` : '';
      const direct = key ? cardDeck.get(key) : undefined;
      if (direct) {
        const s = gameDecks.get(r.g) ?? new Set<string>();
        s.add(direct);
        gameDecks.set(r.g, s);
      }
      if (!r.d || (r.a !== 'Correct' && r.a !== 'Wrong') || !inRange(r.d.slice(0, 10))) continue;
      const deck = direct ?? single.get(r.g);
      const o = deck ? own.get(deck) : undefined;
      if (!o) continue;
      o.played += 1;
      if (r.a === 'Correct') o.correct += 1;
    }
    for (const r of this.db.all<{ g: string; d: string; s: number }>(
      `SELECT game_uuid AS g, substr(start_time, 1, 10) AS d, SUM(duration_seconds) AS s
         FROM fc_game_durations WHERE start_time IS NOT NULL GROUP BY game_uuid, substr(start_time, 1, 10)`,
    )) {
      if (!inRange(r.d)) continue;
      const direct = gameDecks.get(r.g);
      const deck = direct && direct.size === 1 ? [...direct][0] : single.get(r.g);
      const o = deck ? own.get(deck) : undefined;
      if (o) o.seconds += Number(r.s);
    }

    const parentOf = new Map(decks.map((d) => [d.uuid, d.parent_uuid]));
    const out = new Map<string, DeckBreakdown>();
    for (const d of decks) out.set(d.uuid, { played: 0, correct: 0, seconds: 0 });
    for (const d of decks) {
      const o = own.get(d.uuid)!;
      let up: string | null = d.uuid;
      let guard = 0;
      while (up && guard++ < 40) {
        const t = out.get(up);
        if (!t) break;
        t.played += o.played;
        t.correct += o.correct;
        t.seconds += o.seconds;
        up = parentOf.get(up) ?? null;
      }
    }
    return out;
  }
}
