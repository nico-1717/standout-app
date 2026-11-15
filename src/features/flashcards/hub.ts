import type { Services } from '@/core/app/AppProvider';
import { langFlag, langName } from '@/features/languages/langs';

import { homeCards, type OpenGame } from './homeCards';
import { homeNumbers, type HomeNumbers } from './numbers';

export interface HubCourse {
  uuid: string;
  flag: string;
  name: string;
  words: number;
  pct: number;
  open: OpenGame | null;
}

/** I numeri della pagina principale delle flashcard (`fc_home.php` del sito): studio, lingue e la giornata. */
export interface Hub {
  today: number;
  goal: number;
  numbers: HomeNumbers;
  study: { decks: number; cards: number; known: number; pct: number; open: OpenGame | null };
  courses: HubCourse[];
  vocab: { words: number; known: number };
  /** la frase sotto il titolo, come la sceglie il sito */
  phrase: { key: string; n?: number };
}

const pct = (known: number, total: number): number =>
  total > 0 ? Math.min(100, Math.round((known / total) * 100)) : 0;

export function hubSummary(s: Services, today: string, ui: 'it' | 'en'): Hub {
  const cards = homeCards(s, today, ui);
  const numbers = homeNumbers(s, today);

  const studyDecks = s.flashcards.decks().filter((d) => !d.archived && !d.parent_uuid);
  const studyStats = s.games.deckStats();
  let cardsN = 0;
  let known = 0;
  for (const d of studyDecks) {
    cardsN += studyStats.get(d.uuid)?.total ?? 0;
    known += studyStats.get(d.uuid)?.known ?? 0;
  }

  let words = 0;
  let wordsKnown = 0;
  const courses: HubCourse[] = s.languages.courses().map((c) => {
    const games = s.languages.games(c.uuid);
    const unfinished = games.unfinished();
    const stats = games.deckStats();
    let w = 0;
    let k = 0;
    for (const d of s.languages.decks(c.uuid)) {
      if (d.parent_uuid) continue;
      w += stats.get(d.uuid)?.total ?? 0;
      k += stats.get(d.uuid)?.known ?? 0;
    }
    words += w;
    wordsKnown += k;
    return {
      uuid: c.uuid,
      flag: langFlag(c.learn_lang),
      name: langName(c.learn_lang, ui, false),
      words: w,
      pct: pct(k, w),
      open: unfinished
        ? {
            game: unfinished.game.uuid,
            position: unfinished.position,
            closed: unfinished.closed,
            total: unfinished.total,
            label: unfinished.label,
          }
        : null,
    };
  });

  const phrase =
    cards.today >= cards.goal
      ? { key: 'fchub.obiettivo_raggiunto' }
      : cards.today > 0
        ? { key: 'fchub.ancora_n', n: cards.goal - cards.today }
        : numbers.streak > 0
          ? { key: 'fchub.salva_serie' }
          : { key: 'fchub.inizia_oggi' };

  return {
    today: cards.today,
    goal: cards.goal,
    numbers,
    study: {
      decks: studyDecks.length,
      cards: cardsN,
      known,
      pct: pct(known, cardsN),
      open: cards.study.open,
    },
    courses,
    vocab: { words, known: wordsKnown },
    phrase,
  };
}
