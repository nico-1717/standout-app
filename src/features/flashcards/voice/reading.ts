/**
 * Che cosa legge la voce, e in che ordine (porta di `leggiLettura` / `vociDopoRisposta` di `fc_voice_mode.php`).
 * Solo testo e scelte: niente audio qui dentro, quindi si prova senza telefono.
 */
import type { ExampleView, VoiceSpec } from '../gameKit';

/** Le scelte «cosa legge»: domanda sì/no, risposta 1 o 2 volte, significato sì/no, esempi nessuno/uno/tutti. */
export interface Reading {
  question: boolean;
  answerTimes: 1 | 2;
  meaning: boolean;
  examples: 0 | 1 | 2;
}

/** Come sul sito: quattro cifre, per esempio «1100» = domanda, risposta una volta, niente significato né esempi. */
export const DEFAULT_READING = '1100';

export function parseReading(s: string | null | undefined): Reading {
  const v = /^[01][12][01][012]$/.test(String(s)) ? String(s) : DEFAULT_READING;
  return {
    question: v[0] === '1',
    answerTimes: v[1] === '2' ? 2 : 1,
    meaning: v[2] === '1',
    examples: v[3] === '2' ? 2 : v[3] === '1' ? 1 : 0,
  };
}

export const formatReading = (r: Reading): string =>
  `${r.question ? 1 : 0}${r.answerTimes}${r.meaning ? 1 : 0}${r.examples}`;

/** Una voce da dire: il testo, la lingua, e se dirlo una volta sola (la seconda lettura è più lenta). */
export interface Segment {
  text: string;
  lang: string;
  once: boolean;
}

/** Quello che serve di una carta per leggerla. */
export interface ReadableCard {
  question: string | null;
  answer: string | null;
  meaning: string | null;
  examples: readonly ExampleView[];
  /** la parola (le righe vuote degli esempi si riempiono con questa) */
  word: string;
  questionVoice: VoiceSpec | null;
  answerVoice: VoiceSpec | null;
  exampleVoice: string | null;
}

/** Il testo da dire: senza marcatori, formule e trattini bassi (nessuna voce sa leggerli). */
export function plainSpeech(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[$\\{}^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const seg = (text: string, lang: string, once: boolean): Segment[] => {
  const t = plainSpeech(text);
  return t ? [{ text: t, lang, once }] : [];
};

/** Prima della risposta: la domanda (se si è scelto di leggerla). */
export function questionSegments(card: ReadableCard, r: Reading): Segment[] {
  if (!r.question || !card.questionVoice) return [];
  return seg(card.question ?? '', card.questionVoice.lang, card.questionVoice.once);
}

/** Dopo la risposta: la risposta (1 o 2 volte), il significato, gli esempi. */
export function answerSegments(card: ReadableCard, r: Reading): Segment[] {
  const out: Segment[] = [];
  if (card.answerVoice) {
    out.push(
      ...seg(
        card.answer ?? '',
        card.answerVoice.lang,
        card.answerVoice.once || r.answerTimes !== 2,
      ),
    );
  }
  const lang = card.exampleVoice ?? card.answerVoice?.lang ?? card.questionVoice?.lang ?? null;
  if (!lang) return out;
  if (r.meaning && card.meaning) out.push(...seg(card.meaning, lang, true));
  if (r.examples > 0 && card.exampleVoice) {
    // la riga vuota dell'esempio si legge con la parola dentro
    const shown = card.examples.slice(0, r.examples === 1 ? 1 : card.examples.length);
    for (const e of shown) {
      out.push(...seg(e.text.replace(/_+/g, card.word.trim()), card.exampleVoice, true));
    }
  }
  return out;
}
