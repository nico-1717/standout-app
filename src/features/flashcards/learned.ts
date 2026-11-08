import type { SqlDb } from '@/core/db/sqldb';

import { advance, answerLetter, isKnown, START_STEP, type LevelStep } from './levels';

/**
 * Le carte che sai, giorno per giorno (`fcv_conosciute` del sito, per il grafico «Carte che sai» del Hub).
 * Il giorno in cui una carta è stata imparata è il primo fra il giorno del tastino «imparata» e il giorno della risposta che
 * l'ha portata a «la sai». Si contano le carte senza sottocarte (nello studio il padre con sottocarte è il titolo del
 * gruppo) e le sottocarte; nelle lingue tutte le parole e le sottoparole.
 */
export type LearnedKind = 'study' | 'vocab';

const TABLES = {
  study: {
    cards: 'fc_study_cards',
    subs: 'fc_study_subcards',
    plays: 'fc_study_plays',
    learnt: 'fc_study_learnt',
  },
  vocab: {
    cards: 'fc_vocab_cards',
    subs: 'fc_vocab_subcards',
    plays: 'fc_vocab_plays',
    learnt: 'fc_vocab_learnt',
  },
} as const;

/** [AAAA-MM-GG → quante carte imparate quel giorno], in ordine di data. */
export function learnedDays(db: SqlDb, kind: LearnedKind): Map<string, number> {
  const T = TABLES[kind];
  const units = new Set<string>();
  const cardsSql =
    kind === 'study'
      ? `SELECT uuid FROM ${T.cards} WHERE is_father = 0`
      : `SELECT uuid FROM ${T.cards}`;
  for (const r of db.all<{ uuid: string }>(cardsSql)) units.add(`p${r.uuid}`);
  for (const r of db.all<{ uuid: string }>(`SELECT uuid FROM ${T.subs}`)) units.add(`c${r.uuid}`);

  // il tastino: la data più vecchia per ogni carta
  const tap = new Map<string, string>();
  for (const r of db.all<{ t: string; c: number; d: string | null }>(
    `SELECT target_uuid AS t, is_child AS c, MIN(learnt_date) AS d FROM ${T.learnt} GROUP BY target_uuid, is_child`,
  )) {
    if (r.d) tap.set(`${r.c ? 'c' : 'p'}${r.t}`, r.d.slice(0, 10));
  }

  // la storia di ogni carta, un passo alla volta: il primo giorno in cui arriva a «la sai»
  const step = new Map<string, LevelStep>();
  const first = new Map<string, string>();
  for (const r of db.all<{
    card: string | null;
    child: string | null;
    a: string;
    d: string;
    retry: number;
  }>(
    `SELECT p.card_uuid AS card, p.child_uuid AS child, p.user_answer AS a, substr(p.play_date, 1, 10) AS d,
            (g.parent_uuid IS NOT NULL) AS retry
       FROM ${T.plays} p LEFT JOIN fc_games g ON g.uuid = p.game_uuid
      WHERE p.user_answer IN ('Correct', 'Wrong') AND p.play_date IS NOT NULL
      ORDER BY p.play_date ASC, p.rowid ASC`,
  )) {
    const k = r.child ? `c${r.child}` : r.card ? `p${r.card}` : '';
    if (!k || !units.has(k)) continue;
    const st = advance(step.get(k) ?? START_STEP, answerLetter(r.a === 'Correct', !!r.retry));
    step.set(k, st);
    if (isKnown(st.liv, st.n) && !first.has(k)) first.set(k, r.d);
  }

  const days = new Map<string, number>();
  for (const k of units) {
    const a = tap.get(k);
    const b = first.get(k);
    const when = a !== undefined && b !== undefined ? (a < b ? a : b) : (a ?? b);
    if (when !== undefined) days.set(when, (days.get(when) ?? 0) + 1);
  }
  return new Map([...days].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)));
}

/** Un'asse del grafico: il valore, l'etichetta e se è il periodo di adesso. */
export interface LearnedBar {
  v: number;
  label: string;
  now: boolean;
}
export type LearnedStep = 'day' | 'week' | 'month';

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Le barre del grafico: 14 giorni, 8 settimane (da lunedì) o 6 mesi, fino a `today` («AAAA-MM-GG»). */
export function learnedBars(
  days: ReadonlyMap<string, number>,
  step: LearnedStep,
  today: string,
  monthName: (d: Date) => string,
): LearnedBar[] {
  const now = new Date(`${today}T12:00:00`);
  const out: LearnedBar[] = [];
  if (step === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push({ v: days.get(iso(d)) ?? 0, label: String(d.getDate()), now: i === 0 });
    }
  } else if (step === 'week') {
    const mon = new Date(now);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    for (let i = 7; i >= 0; i--) {
      const from = new Date(mon);
      from.setDate(from.getDate() - i * 7);
      let n = 0;
      for (let j = 0; j < 7; j++) {
        const d = new Date(from);
        d.setDate(d.getDate() + j);
        n += days.get(iso(d)) ?? 0;
      }
      out.push({ v: n, label: `${from.getDate()}/${from.getMonth() + 1}`, now: i === 0 });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = iso(d).slice(0, 7);
      let n = 0;
      for (const [day, v] of days) if (day.slice(0, 7) === prefix) n += v;
      out.push({ v: n, label: monthName(d), now: i === 0 });
    }
  }
  return out;
}

/** I «+N» di oggi, questa settimana e questo mese. */
export function learnedChips(
  days: ReadonlyMap<string, number>,
  today: string,
): { today: number; week: number; month: number } {
  const now = new Date(`${today}T12:00:00`);
  const mon = new Date(now);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const monIso = iso(mon);
  const month = today.slice(0, 7);
  const out = { today: 0, week: 0, month: 0 };
  for (const [day, n] of days) {
    if (day === today) out.today += n;
    if (day >= monIso && day <= today) out.week += n;
    if (day.slice(0, 7) === month) out.month += n;
  }
  return out;
}
