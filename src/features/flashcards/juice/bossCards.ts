import type { GameKit } from '../gameKit';
import type { Target } from '../gameJuice';

/** Una carta del boss: la domanda, e quello che si scopre con «Mostra». */
export interface BossCard {
  key: string;
  /** in lingua: il significato da tradurre; in studio: la domanda (testo ricco) */
  prompt: string;
  /** l'esempio con la parola nascosta (solo lingue) */
  example: string | null;
  /** in lingua: la parola; in studio: la risposta (testo ricco) */
  reveal: string;
  /** il significato che accompagna la parola (solo lingue) */
  meaning: string | null;
  promptImage: string | null;
  revealImage: string | null;
  /** la lingua con cui la voce legge `prompt` e `reveal` («en-GB»); `null` = non si legge */
  promptLang: string | null;
  revealLang: string | null;
}

/**
 * Le carte sbagliate del tratto, pronte per il boss. In lingua il boss mostra il significato e chiede la parola; in studio
 * mostra la domanda e poi la risposta.
 */
export function bossCards(kit: GameKit, game: string, missed: readonly Target[]): BossCard[] {
  return missed.map((m) => {
    const v = kit.view(game, m.position, m.target, m.isChild);
    const key = `${m.isChild ? 'c' : 'p'}${m.target}`;
    if (!kit.vocab) {
      return {
        key,
        prompt: v.question ?? '',
        example: null,
        reveal: v.answer ?? '',
        meaning: null,
        promptImage: v.questionImage,
        revealImage: v.answerImage,
        promptLang: v.questionVoice?.lang ?? null,
        revealLang: v.answerVoice?.lang ?? null,
      };
    }
    // la parola è un lato solo della carta: l'altro è la traduzione, qualunque sia il verso di questa posizione
    const word = v.word || (v.answer ?? '');
    const translation = v.question === word ? (v.answer ?? '') : (v.question ?? '');
    return {
      key,
      prompt: translation,
      example: v.examples[0]?.text ?? null,
      reveal: word,
      meaning: v.meaning,
      promptImage: null,
      revealImage: null,
      // la parola si legge nella lingua che si impara, la traduzione nell'altra
      promptLang: (v.question === word ? v.answerVoice : v.questionVoice)?.lang ?? null,
      revealLang: v.exampleVoice,
    };
  });
}
