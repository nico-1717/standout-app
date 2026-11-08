import type { Services } from '@/core/app/AppProvider';
import { langFlag, langName } from '@/features/languages/langs';

/** Una partita lasciata a metà, come la mostra la Home. */
export interface OpenGame {
  game: string;
  position: number;
  closed: number;
  total: number;
  label: string;
}

/** Il mazzo che conviene giocare adesso (`ho_mazzo_prossimo` del sito). */
export interface NextDeck {
  uuid: string;
  name: string;
  color: string;
  /** giorni dall'ultima partita; null se non l'hai mai giocato */
  daysAgo: number | null;
  /** giorni all'esame; null se non c'è o è passato */
  examDays: number | null;
}

export interface HomeCards {
  today: number;
  goal: number;
  study: { open: OpenGame | null; next: NextDeck | null };
  vocab: { open: OpenGame | null; course: { uuid: string; name: string; flag: string } | null };
}

const dayNo = (iso: string): number =>
  Math.floor(Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) / 86_400_000);

const asOpen = (u: ReturnType<Services['games']['unfinished']>): OpenGame | null =>
  u
    ? { game: u.game.uuid, position: u.position, closed: u.closed, total: u.total, label: u.label }
    : null;

/**
 * Il mazzo da giocare adesso: quello con l'esame più vicino, poi il meno ripassato. Un mazzo giocato oggi o senza carte
 * non si ripropone. Punteggio: giorni dall'ultima partita (999 se mai) + 3 per ogni giorno sotto i 60 all'esame.
 */
export function nextDeck(s: Services, today: string): NextDeck | null {
  const last = new Map<string, string>();
  for (const r of s.db.all<{ d: string; u: string }>(
    `SELECT d, MAX(pd) AS u FROM (
       SELECT c.category_uuid AS d, p.play_date AS pd FROM fc_study_plays p
         JOIN fc_study_cards c ON c.uuid = p.card_uuid
        WHERE p.user_answer IN ('Correct', 'Wrong') AND p.play_date IS NOT NULL
       UNION ALL
       SELECT c.category_uuid, p.play_date FROM fc_study_plays p
         JOIN fc_study_subcards sc ON sc.uuid = p.child_uuid
         JOIN fc_study_cards c ON c.uuid = sc.parent_uuid
        WHERE p.user_answer IN ('Correct', 'Wrong') AND p.play_date IS NOT NULL
     ) GROUP BY d`,
  )) {
    last.set(r.d, r.u);
  }
  const counts = new Map<string, number>();
  for (const r of s.db.all<{ d: string; n: number }>(
    'SELECT category_uuid AS d, COUNT(*) AS n FROM fc_study_cards WHERE is_father = 0 GROUP BY category_uuid',
  )) {
    counts.set(r.d, Number(r.n));
  }
  let best: NextDeck | null = null;
  let bestScore = -1;
  for (const d of s.flashcards.decks()) {
    if (d.archived || !(counts.get(d.uuid) ?? 0)) continue;
    const l = last.get(d.uuid);
    const daysAgo = l ? dayNo(today) - dayNo(l) : null;
    if (daysAgo !== null && daysAgo < 1) continue;
    const examDays = d.exam_date && d.exam_date >= today ? dayNo(d.exam_date) - dayNo(today) : null;
    const score = (daysAgo ?? 999) + (examDays !== null ? Math.max(0, 60 - examDays) * 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { uuid: d.uuid, name: d.name, color: d.color, daysAgo, examDays };
    }
  }
  return best;
}

/**
 * Il riquadro Flashcard della Home sopra le bozze: l'obiettivo di oggi e, per studio e per lingue, la partita da
 * riprendere o quella da giocare adesso (`ho_flashcard` del sito). Il corso è quello dell'ultima partita di lingue,
 * altrimenti il primo.
 */
export function homeCards(s: Services, today: string, ui: 'it' | 'en'): HomeCards {
  const played = s.fcStats.activity().daily.get(today)?.played ?? 0;
  const vocabToday = s.db.all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM fc_vocab_plays
      WHERE substr(play_date, 1, 10) = ? AND user_answer IN ('Correct', 'Wrong')`,
    [today],
  )[0]?.n;
  const courses = s.languages.courses();
  const lastCourse = s.db.all<{ c: string }>(
    `SELECT course_uuid AS c FROM fc_games WHERE course_uuid IS NOT NULL ORDER BY game_date DESC, rowid DESC LIMIT 1`,
  )[0]?.c;
  const picked = courses.find((c) => c.uuid === lastCourse) ?? courses[0] ?? null;
  let vocabOpen: OpenGame | null = null;
  for (const c of picked ? [picked, ...courses.filter((x) => x.uuid !== picked.uuid)] : []) {
    vocabOpen = asOpen(s.languages.games(c.uuid).unfinished());
    if (vocabOpen) break;
  }
  return {
    today: played + Number(vocabToday ?? 0),
    goal: s.study.goal(),
    study: { open: asOpen(s.games.unfinished()), next: nextDeck(s, today) },
    vocab: {
      open: vocabOpen,
      course: picked
        ? {
            uuid: picked.uuid,
            name: langName(picked.learn_lang, ui, false),
            flag: langFlag(picked.learn_lang),
          }
        : null,
    },
  };
}
