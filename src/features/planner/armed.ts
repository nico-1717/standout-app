import type { Category } from './repo';
import type { QuickItem } from './quickAdd';

/**
 * L'attrezzo armato (`S.armato` e `S.defaultCat` del sito): si sceglie dai tastini sul bordo destro COSA si sta per
 * mettere in agenda, poi si tocca la griglia per dire DOVE. Un'abitudine o un progetto si posano al primo tocco e si
 * disarmano da soli (restare armati vorrebbe dire un doppione al primo tocco distratto); una categoria resta scelta
 * e fa partire ogni nuovo evento con quella categoria, così se ne infilano diversi di fila.
 */
export type Armed =
  | {
      kind: 'habit' | 'project';
      uuid: string;
      name: string;
      color: string;
      icon: string | null;
      /** i minuti scritti nell'abitudine; 0 = quelli dello scatto */
      minutes: number;
    }
  | { kind: 'category'; uuid: string; name: string; color: string; icon: null; minutes: 0 };

export const armedFromItem = (it: QuickItem): Armed => ({
  kind: it.kind,
  uuid: it.uuid,
  name: it.name,
  color: it.color,
  icon: it.icon,
  minutes: it.minutes,
});

export const armedFromCategory = (c: Category, color: string): Armed => ({
  kind: 'category',
  uuid: c.uuid,
  name: c.name,
  color,
  icon: null,
  minutes: 0,
});

/** `durataArmato`: l'abitudine ha la sua durata, il progetto prende quella dello scatto (come una categoria). */
export const armedMinutes = (a: Armed, slotMin: number): number =>
  a.kind === 'habit' && a.minutes > 0 ? a.minutes : slotMin || 30;
