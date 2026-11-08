import type { Services } from '@/core/app/AppProvider';
import { langVoice } from '@/features/languages/langs';

import { directionAt, type Direction, type GameRepo } from './game';
import type { Deck } from './logic';

/** Come si vede una carta in una partita: la domanda, la risposta e (solo in lingua) significato ed esempi. */
export interface PlayView {
  question: string | null;
  answer: string | null;
  questionImage: string | null;
  answerImage: string | null;
  /** significato e esempi come aiuto (solo lingue) */
  meaning: string | null;
  examples: ExampleView[];
  /** la parola della carta: le sue forme sono la parte nascosta degli esempi finché non si rivela */
  word: string;
  /** come si legge ad alta voce (solo lingue): la parola da imparare nella lingua che si studia, il resto in quella che si conosce */
  questionVoice: VoiceSpec | null;
  answerVoice: VoiceSpec | null;
  /** gli esempi sono nella lingua che si studia */
  exampleVoice: string | null;
}

/** Con quale voce leggere un testo: la lingua («en-GB») e se dirlo una volta sola (traduzioni). */
export interface VoiceSpec {
  lang: string;
  once: boolean;
}

/** Una frase d'esempio con la scelta a mano della parte nascosta (`gap_text`, vuota = automatica). */
export interface ExampleView {
  text: string;
  gap: string | null;
}

/**
 * Tutto quello che le schermate di gioco chiedono a "chi gioca": lo studio o un corso di lingua.
 * Le schermate non sanno quale dei due è.
 */
export interface GameKit {
  vocab: boolean;
  course: string | null;
  games: GameRepo;
  decks(): Deck[];
  records(): Record<string, number>;
  isFavorite(target: string): boolean;
  setFavorite(target: string, isChild: boolean, on: boolean): void;
  view(gameUuid: string, position: number, target: string, isChild: boolean): PlayView;
  /** una riga corta che descrive la carta (storico, risultato) */
  label(gameUuid: string, position: number, target: string, isChild: boolean): string;
  hints: { meaning: 'aperto' | 'tocco' | 'dopo'; examples: 'aperto' | 'tocco' | 'dopo' };
}

const none: PlayView = {
  question: null,
  answer: null,
  questionImage: null,
  answerImage: null,
  meaning: null,
  examples: [],
  word: '',
  questionVoice: null,
  answerVoice: null,
  exampleVoice: null,
};

export function studyKit(s: Services): GameKit {
  const view = (target: string, isChild: boolean): PlayView => {
    const row = isChild ? s.flashcards.subcard(target) : s.flashcards.card(target);
    if (!row) return none;
    return {
      ...none,
      question: row.question_desc ?? null,
      answer: row.answer_desc ?? null,
      questionImage: row.question_image ?? null,
      answerImage: row.answer_image ?? null,
    };
  };
  return {
    vocab: false,
    course: null,
    games: s.games,
    decks: () => s.flashcards.decks(),
    records: () => s.study.records(),
    isFavorite: (t) => s.study.isFavorite(t),
    setFavorite: (t, c, on) => void s.study.setFavorite(t, c, on),
    view: (_g, _p, target, isChild) => view(target, isChild),
    label: (_g, _p, target, isChild) => (view(target, isChild).question ?? '').replace(/\s+/g, ' '),
    hints: { meaning: 'dopo', examples: 'dopo' },
  };
}

export function languageKit(s: Services, course: string): GameKit {
  const lang = s.languages;
  const games = lang.games(course);
  const c = lang.course(course);
  const learn = langVoice(c?.learn_lang ?? 'en-GB');
  const known = langVoice(c?.known_lang ?? 'it');
  const voices = (dir: Direction) => {
    const word: VoiceSpec = { lang: learn, once: false };
    const meaning: VoiceSpec = { lang: known, once: true };
    return {
      questionVoice: dir === 'w2t' ? word : meaning,
      answerVoice: dir === 'w2t' ? meaning : word,
      exampleVoice: learn,
    };
  };
  const view = (gameUuid: string, position: number, target: string, isChild: boolean): PlayView => {
    const row = isChild ? lang.child(target) : lang.word(target);
    const game = games.game(gameUuid);
    if (!row || !game) return none;
    const dir = directionAt(game.type, gameUuid, position);
    const [q, a] = dir === 'w2t' ? [row.word, row.translation] : [row.translation ?? '', row.word];
    return {
      question: q,
      answer: a,
      questionImage: null,
      answerImage: row.image ?? null,
      meaning: row.meaning?.trim() ? row.meaning : null,
      examples: lang
        .examples(target)
        .map((e) => ({ text: e.example_text ?? '', gap: e.gap_text }))
        .filter((e) => e.text.trim()),
      word: row.word,
      ...voices(dir),
    };
  };
  const st = s.study.settings();
  return {
    vocab: true,
    course,
    games,
    decks: () => lang.decks(course),
    records: () => lang.records(course),
    isFavorite: (t) => lang.isFavorite(t),
    setFavorite: (t, c, on) => void lang.setFavorite(t, c, on),
    view,
    label: (g, p, target, isChild) => {
      const v = view(g, p, target, isChild);
      return `${v.question ?? ''} → ${v.answer ?? ''}`.replace(/\s+/g, ' ');
    },
    hints: { meaning: st.vocab_meaning, examples: st.vocab_examples },
  };
}

/** Il kit per una partita già esistente: dal suo genere e corso. */
export function kitForGame(s: Services, gameUuid: string): GameKit {
  const course = s.languages ? s.languages.courseOfGame(gameUuid) : null;
  return course ? languageKit(s, course) : studyKit(s);
}

/** Il kit per una schermata di corso (setup, storico): senza corso è lo studio. */
export function kitForCourse(s: Services, course: string | undefined): GameKit {
  return course && s.languages.course(course) ? languageKit(s, course) : studyKit(s);
}
