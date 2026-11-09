/**
 * I numeri del tracciato di gioco (`f2Calcola` e `f2Tratti` di fc_game.php): dove sta la linea, quanto è pieno
 * l'anello verso il prossimo checkpoint e lo stato di ogni disco. Solo funzioni pure.
 */

export interface RoadModel {
  /** posizioni in tutto */
  tot: number;
  /** la posizione che si sta giocando (da 1) */
  pos: number;
  /** la posizione più avanti con una risposta */
  front: number;
  /** le carte (righe) già risposte in tutta la partita */
  done: number;
  /** le carte (righe) di ogni posizione, dalla 1: manca = 1 */
  cp: readonly number[];
}

export interface RingNumbers {
  /** la linea piena, 0–100 */
  fill: number;
  /** la linea «oltre»: fin dove si è arrivati col fronte, 0–100 */
  beyond: number;
  /** l'anello c'è (checkpoint attivi e più di un tratto) */
  ring: boolean;
  /** l'anello interno (le carte) è diverso da quello esterno (le posizioni) */
  r2: boolean;
  /** anello esterno: posizioni del tratto fatte, 0–1 */
  o1: number;
  /** anello interno: carte del tratto fatte, 0–1 */
  o2: number;
  /** posizioni e carte che mancano al checkpoint */
  leftPositions: number;
  leftCards: number;
}

export function ringNumbers(m: RoadModel, every: number): RingNumbers {
  const v: RingNumbers = {
    fill: Math.min(100, (m.pos / m.tot) * 100),
    beyond: 0,
    ring: false,
    r2: false,
    o1: 0,
    o2: 0,
    leftPositions: 0,
    leftCards: 0,
  };
  v.beyond = Math.max(v.fill, Math.min(100, (m.front / m.tot) * 100));
  if (!every || every >= m.tot) return v;
  const a = Math.floor((m.pos - 1) / every) * every + 1;
  const b = Math.min(m.tot, a + every - 1);
  const rows = (i: number) => m.cp[i - 1] || 1;
  let before = 0;
  let inside = 0;
  for (let i = 1; i < a; i++) before += rows(i);
  for (let i = a; i <= b; i++) inside += rows(i);
  const made = Math.max(0, Math.min(inside, m.done - before));
  v.ring = true;
  v.o1 = (m.pos - a + 1) / (b - a + 1);
  v.r2 = inside !== b - a + 1;
  v.o2 = inside ? made / inside : 0;
  v.leftPositions = b - m.pos;
  v.leftCards = Math.max(0, inside - made);
  return v;
}

export type DiscState = 'ok' | 'cur' | 'fut';

export const discState = (pos: number, a: number, b: number): DiscState =>
  pos > b ? 'ok' : pos >= a ? 'cur' : 'fut';

/** Dove sta un disco sulla linea, 0–100 (la fine del suo tratto). */
export const discPercent = (b: number, tot: number): number => (b / tot) * 100;
