import type { SqlDb } from '@/core/db/sqldb';
import { CHECKPOINT_STEPS, DEFAULT_CHECKPOINT, cleanCheckpoint } from '@/core/settings/localPrefs';
import { getState, setState } from '@/core/sync/engine';

import type { PlayRow } from './game';
import { levelRank, type Level } from './levels';

/**
 * Il ritmo del gioco (fc_game_juice.js del sito), senza disegnare niente: le serie, i checkpoint, il colore della barra,
 * il tratto di partita da riassumere e le tappe dei record. Tutto in funzioni pure, così si prova contro i numeri del sito.
 */

/* ---------------- serie ---------------- */

/** Gli scalini della serie che si festeggiano (le risposte giuste di fila). */
export const STREAK_STEPS = [3, 5, 10, 15, 20, 30, 50, 75, 100];

/** Lo scalino raggiunto da una serie di `n` (0 se ancora nessuno). */
export function stepOf(n: number): number {
  let s = 0;
  for (const x of STREAK_STEPS) if (n >= x) s = x;
  return s;
}

/** La chiave della frase dello scalino: oltre 50 resta quella del 50. */
export const stepKey = (step: number): string => `fcv.gj_t${Math.min(step, 50)}`;

/* ---------------- checkpoint ---------------- */

export { CHECKPOINT_STEPS, DEFAULT_CHECKPOINT, cleanCheckpoint };

export interface Due {
  /** il numero del checkpoint (1, 2, …) */
  k: number;
  /** le posizioni del tratto, da… */
  from: number;
  /** …a */
  to: number;
  /** l'ultimo tratto della partita */
  end: boolean;
}

/**
 * Si è appena superata la soglia di un tratto? `front` è la posizione più avanti con una risposta, `done` i checkpoint
 * già fatti. L'ultimo tratto vale anche se più corto.
 */
export function checkpointDue(
  front: number,
  total: number,
  every: number,
  done: number,
): Due | null {
  if (every <= 0 || total <= 0) return null;
  let k = Math.floor(front / every);
  const end = front >= total;
  if (end && front % every) k += 1;
  if (k <= done) return null;
  return { k, from: done * every + 1, to: Math.min(front, k * every), end };
}

/** Da dove riparte il conto dei checkpoint fatti, quando si cambia il passo o si ricomincia. */
export const checkpointsDone = (front: number, every: number): number =>
  every > 0 ? Math.floor(front / every) : 0;

/** Quanti checkpoint ha la partita. */
export const checkpointCount = (total: number, every: number, k: number): number =>
  Math.max(k, every > 0 ? Math.ceil(total / every) : 1);

/** La frase del titolo del checkpoint, dalla precisione del tratto. */
export function checkpointTitleKey(accuracy: number, end: boolean): string {
  if (end) return accuracy >= 80 ? 'fcv.ck_fine_top' : 'fcv.ck_fine';
  return accuracy === 100
    ? 'fcv.ck_perfetto'
    : accuracy >= 80
      ? 'fcv.ck_ottimo'
      : accuracy >= 60
        ? 'fcv.ck_buono'
        : 'fcv.ck_avanti';
}

export const accuracyOf = (correct: number, wrong: number): number =>
  correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;

/** Il colore dell'anello della precisione: verde da 80, giallo da 60, rosso sotto. */
export const accuracyTone = (acc: number): 'green' | 'yellow' | 'red' =>
  acc >= 80 ? 'green' : acc >= 60 ? 'yellow' : 'red';

/** Le tappe dei «padroneggiate» che si festeggiano. */
export const MASTERED_MILESTONES = [5, 10, 25, 50, 100, 200, 300, 500, 750, 1000];

/** L'ultima tappa superata passando da `before` a `now` (null se nessuna o se non c'era un valore prima). */
export function passedMilestone(before: number | null, now: number): number | null {
  if (before === null) return null;
  const hit = MASTERED_MILESTONES.filter((x) => before < x && now >= x);
  return hit.length ? hit[hit.length - 1]! : null;
}

/* ---------------- i dischi del tracciato ---------------- */

/** Oltre questo numero di dischi, più tratti si fondono in uno (sotto ~22 px fra uno e l'altro non si toccano col dito). */
export const MAX_DISCS = 14;

/** I tratti mostrati come dischi (`f2Tratti`): un avanzo finale più corto di 6/10 di passo si attacca all'ultimo. */
export function stretches(total: number, every: number): [number, number][] {
  if (total <= 0) return [];
  if (!every || every >= total) return [[1, total]];
  const group = Math.max(1, Math.ceil(Math.ceil(total / every) / MAX_DISCS));
  const step = every * group;
  const ends: number[] = [];
  for (let b = step; b < total; b += step) ends.push(b);
  if (ends.length && total - ends[ends.length - 1]! < step * 0.6) ends.pop();
  ends.push(total);
  const out: [number, number][] = [];
  let a = 1;
  for (const x of ends) {
    out.push([a, x]);
    a = x + 1;
  }
  return out;
}

/** Quanti errori cadono in un tratto. */
export const wrongIn = (wrongPositions: readonly number[], a: number, b: number): number =>
  wrongPositions.filter((p) => p >= a && p <= b).length;

/* ---------------- il colore della barra ---------------- */

const STOPS: [number, [number, number, number]][] = [
  [0, [10, 132, 255]],
  [0.5, [191, 90, 242]],
  [0.82, [255, 159, 10]],
  [1, [255, 214, 10]],
];

/** Blu → viola → arancio → oro, a mano a mano che la partita avanza. */
export function progressColor(p: number): string {
  const x = Math.max(0, Math.min(1, p));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i]!;
    if (x <= t1) {
      const [t0, c0] = STOPS[i - 1]!;
      const f = (x - t0) / (t1 - t0);
      const [r, g, b] = c0.map((v, j) => Math.round(v + (c1[j]! - v) * f));
      return `rgb(${r},${g},${b})`;
    }
  }
  return 'rgb(255,214,10)';
}

/** L'ultimo tratto: per partite da 20 in su, quando mancano al massimo il 10% (almeno 5). */
export function finalStretch(total: number, front: number): { on: boolean; left: number } {
  const left = total - front;
  const threshold = Math.max(5, Math.round(total * 0.1));
  return { on: total >= 20 && left > 0 && left <= threshold, left };
}

/* ---------------- il riassunto di un tratto ---------------- */

export interface Target {
  target: string;
  isChild: boolean;
  position: number;
}

export interface BlockSummary {
  correct: number;
  wrong: number;
  /** i secondi per carta, o null se non si può dire (meno di due risposte) */
  perCard: number | null;
  /** le carte giuste del tratto che non sono mai state sbagliate in questo tratto (al massimo 8) */
  nailed: Target[];
  /** le carte sbagliate nel tratto (al massimo 12), per il boss */
  missed: Target[];
}

/** «2026-11-09 14:03:05» (ora locale) → millisecondi. */
export function stampMs(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!).getTime();
}

/**
 * Il riassunto delle posizioni `from..to` (`action=blocco` del sito): giuste, sbagliate, secondi per carta (gli intervalli
 * fra una risposta e la successiva, ognuno al massimo un minuto, partendo dall'ultima risposta prima del tratto), le carte
 * da rigiocare nel boss (al massimo 12) e quelle «prese al volo» (al massimo 8, senza errori nel tratto).
 */
export function summarizeBlock(plays: readonly PlayRow[], from: number, to: number): BlockSummary {
  const voted = plays.filter((p) => p.user_answer === 'Correct' || p.user_answer === 'Wrong');
  const byTime = (a: PlayRow, b: PlayRow) =>
    (stampMs(a.play_date) ?? 0) - (stampMs(b.play_date) ?? 0);
  const inside = voted.filter((p) => p.position >= from && p.position <= to).sort(byTime);
  const before = voted.filter((p) => p.position < from).sort(byTime);

  let correct = 0;
  let wrong = 0;
  const right = new Map<string, Target>();
  const bad = new Map<string, Target>();
  const stamps: number[] = [];
  for (const p of inside) {
    const isChild = !!p.child_uuid;
    const key = (isChild ? 'c' : 'p') + ((isChild ? p.child_uuid : p.card_uuid) ?? '');
    const t: Target = {
      target: (isChild ? p.child_uuid : p.card_uuid) ?? '',
      isChild,
      position: p.position,
    };
    if (p.user_answer === 'Correct') {
      correct += 1;
      right.set(key, t);
    } else {
      wrong += 1;
      bad.set(key, t);
    }
    const ms = stampMs(p.play_date);
    if (ms !== null) stamps.push(ms);
  }
  const prior = before.length ? stampMs(before[before.length - 1]!.play_date) : null;
  if (prior !== null) stamps.unshift(prior);
  let seconds = 0;
  for (let i = 1; i < stamps.length; i++) {
    seconds += Math.min(60, Math.max(0, (stamps[i]! - stamps[i - 1]!) / 1000));
  }
  const gaps = stamps.length - 1;

  return {
    correct,
    wrong,
    perCard: gaps > 0 ? Math.round((seconds / gaps) * 10) / 10 : null,
    nailed: [...right]
      .filter(([k]) => !bad.has(k))
      .map(([, t]) => t)
      .slice(0, 8),
    missed: [...bad.values()].slice(0, 12),
  };
}

/** La serie di giuste più lunga dentro un tratto (`serieMax` di `blocco`): le risposte in ordine di tempo. */
export function blockBestStreak(plays: readonly PlayRow[], from: number, to: number): number {
  const inside = plays
    .filter(
      (p) =>
        p.position >= from &&
        p.position <= to &&
        (p.user_answer === 'Correct' || p.user_answer === 'Wrong'),
    )
    .sort((a, b) => (stampMs(a.play_date) ?? 0) - (stampMs(b.play_date) ?? 0));
  let run = 0;
  let best = 0;
  for (const p of inside) {
    run = p.user_answer === 'Correct' ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Il «più veloce» è un record solo con almeno 5 risposte e l'80% di giuste (come sul sito). */
export const countsForFastest = (s: BlockSummary): boolean =>
  s.correct + s.wrong >= 5 && s.perCard !== null && s.correct / (s.correct + s.wrong) >= 0.8;

/* ---------------- il richiamo del livello ---------------- */

export interface LevelToast {
  /** la frase (`fcv.gj_liv_*`) */
  key: string;
  up: boolean;
}

/**
 * Dopo un voto, il livello della carta è cambiato in un modo che merita un richiamo? Si dice solo quello che conta:
 * arrivare a «la sai» o «ci sei quasi», riprendersi da «difficile», finirci dentro (`livelloDopoVoto` del sito).
 */
export function levelToast(before: Level, after: Level): LevelToast | null {
  if (before === after) return null;
  const hard = after === 'difficile' || after === 'difficilissima';
  const up = !hard && levelRank(after) > levelRank(before);
  const counts =
    (up && (after === 'la_sai' || after === 'quasi' || after === 'in_ripresa')) || hard;
  if (!counts) return null;
  const key =
    after === 'la_sai'
      ? 'fcv.gj_liv_la_sai'
      : after === 'in_ripresa'
        ? 'fcv.gj_liv_ripresa'
        : up
          ? 'fcv.gj_liv_su'
          : hard
            ? 'fcv.gj_liv_difficile'
            : 'fcv.gj_liv_giu';
  return { key, up };
}

/* ---------------- lo stato della partita su questo telefono ---------------- */

export interface JuiceState {
  /** i checkpoint già festeggiati */
  ckDone: number;
  /** il passo dei checkpoint con cui è stato contato `ckDone` */
  ckEvery: number;
  /** il record della serie è già stato festeggiato in questa partita */
  recordHit: boolean;
  /** l'avviso dell'ultimo tratto è già stato dato */
  finalShown: boolean;
  /** una serie da salvare come record sul server */
  comboToSave: number;
}

export const NEW_STATE: JuiceState = {
  ckDone: 0,
  ckEvery: DEFAULT_CHECKPOINT,
  recordHit: false,
  finalShown: false,
  comboToSave: 0,
};

const keyOf = (game: string) => `fcg_${game}`;

export function readJuice(db: SqlDb, game: string): JuiceState | null {
  try {
    const raw = getState(db, keyOf(game));
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<JuiceState>;
    return {
      ckDone: Number.isFinite(r.ckDone) ? Math.max(0, Number(r.ckDone)) : 0,
      ckEvery: cleanCheckpoint(r.ckEvery),
      recordHit: r.recordHit === true,
      finalShown: r.finalShown === true,
      comboToSave: Number.isFinite(r.comboToSave) ? Math.max(0, Number(r.comboToSave)) : 0,
    };
  } catch {
    return null;
  }
}

export function writeJuice(db: SqlDb, game: string, s: JuiceState): void {
  setState(db, keyOf(game), JSON.stringify(s));
}
