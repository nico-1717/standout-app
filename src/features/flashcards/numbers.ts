import type { Services } from '@/core/app/AppProvider';

import { streaks } from './stats';

/** Un giorno «AAAA-MM-GG» spostato di `n` giorni. */
function shift(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface HomeNumbers {
  /** carte «che sai» su tutte le carte, studio e lingue insieme (0-100) */
  mastery: number;
  streak: number;
  record: number;
  /** giuste su date negli ultimi 30 giorni (0-100) */
  accuracy: number;
  cardsTotal: number;
  /** le risposte degli ultimi 7 giorni, dal più vecchio a oggi */
  week: { day: string; n: number }[];
}

/**
 * «I tuoi numeri» della Home (`ho_flashcard` del sito): l'anello di quante carte sai, serie e record di giorni di
 * studio, precisione dell'ultimo mese, carte in tutto e le risposte degli ultimi 7 giorni. Studio e lingue insieme.
 */
export function homeNumbers(s: Services, today: string): HomeNumbers {
  const since = shift(today, -29);
  const { perDay, ok, total } = s.fcStats.bothKinds(since);
  const run = streaks([...perDay.keys()], today);
  let known = 0;
  let cards = 0;
  const count = (
    decks: { uuid: string; parent_uuid: string | null }[],
    stats: Map<string, { total: number; known: number }>,
  ) => {
    for (const d of decks) {
      if (d.parent_uuid) continue; // il ramo è già nel mazzo principale
      known += stats.get(d.uuid)?.known ?? 0;
      cards += stats.get(d.uuid)?.total ?? 0;
    }
  };
  count(s.flashcards.decks(), s.games.deckStats());
  for (const c of s.languages.courses()) {
    count(s.languages.decks(c.uuid), s.languages.games(c.uuid).deckStats());
  }
  return {
    mastery: cards > 0 ? Math.min(100, Math.round((known / cards) * 100)) : 0,
    streak: run.current,
    record: run.best,
    accuracy: total > 0 ? Math.round((ok / total) * 100) : 0,
    cardsTotal: cards,
    week: Array.from({ length: 7 }, (_, i) => {
      const day = shift(today, i - 6);
      return { day, n: perDay.get(day) ?? 0 };
    }),
  };
}
