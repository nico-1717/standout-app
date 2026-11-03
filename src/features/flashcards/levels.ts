/**
 * I livelli di una carta di studio, dalla storia delle sue risposte. Gemella di lib/fc/fc_vocab_gioco.php
 * (fcv_livello e le sue parti) e di livello() in fc_game_juice.js: se cambiano là, cambia anche qui (il test
 * confronta con i valori calcolati dal sito).
 *
 * La storia è una stringa, dalla risposta più vecchia alla più recente: 'C'/'W' = giusta/sbagliata in una partita
 * normale, 'c'/'w' = in un ripasso degli errori (conta meno). Si guardano le ultime 30 risposte.
 */
export const LEVELS = [
  'difficilissima',
  'difficile',
  'insidiosa',
  'da_imparare',
  'nuova',
  'in_ripresa',
  'sembra_facile',
  'facile',
  'quasi',
  'la_sai',
] as const;
export type Level = (typeof LEVELS)[number];

export const HISTORY_LENGTH = 30;

/** Dal peggiore (0) al migliore (9): per ordinare e per dire se si sale o si scende. */
export const levelRank = (l: string): number => {
  const i = (LEVELS as readonly string[]).indexOf(l);
  return i === -1 ? 4 : i;
};

/** Le carte da ripassare: «solo le difficili», il badge «da ripassare». */
export const needsReview = (l: string): boolean =>
  l === 'difficilissima' || l === 'difficile' || l === 'da_imparare';

/** La lettera di una risposta nella storia. */
export const answerLetter = (correct: boolean, review: boolean): string => {
  const l = correct ? 'C' : 'W';
  return review ? l.toLowerCase() : l;
};

const count = (s: string, ch: string): number => s.split(ch).length - 1;

/** Il livello di una storia già tagliata: `s` = risposte, `n` = quante in tutto, `rec` = era difficile, `err` = mai sbagliata? */
export function levelOfPrefix(s: string, n: number, rec: boolean, err?: boolean): Level {
  if (n <= 0 || s === '') return 'nuova';
  const all = s.toUpperCase();
  const wrongEver = err ?? all.includes('W');
  const normal = s.replace(/[a-z]/g, ''); // solo le partite normali
  // mai sbagliata: con una risposta sola «sembra facile», da due in poi «facile»
  if (!wrongEver) return n >= 2 ? 'facile' : 'sembra_facile';
  if (n <= 2 && !all.includes('C')) return 'da_imparare';
  if (n >= 3 && all.slice(-3) === 'CCC') return 'la_sai';
  const window = (): Level => {
    // il ripasso sbagliato conta se è fra le ultime cinque risposte
    if (count(normal.slice(-5), 'W') >= 2)
      return s.slice(-5).includes('w') ? 'difficilissima' : 'difficile';
    return 'insidiosa';
  };
  if (rec) {
    const run = normal.length - normal.replace(/C+$/, '').length;
    if (run === 1) return 'in_ripresa';
    if (run >= 2) return 'quasi'; // tre di fila sono già «la sai», presa sopra
    const f = window();
    return levelRank(f) < levelRank('difficile') ? f : 'difficile';
  }
  return window();
}

interface Step {
  s: string;
  n: number;
  rec: boolean;
  err: boolean;
  liv: Level;
}

/** Un passo: lo stato dopo una risposta in più ('C', 'W', 'c', 'w'). */
function advance(st: Step, r: string): Step {
  const s = (st.s + r).slice(-HISTORY_LENGTH);
  const n = st.n + 1;
  const err = st.err || r.toUpperCase() === 'W';
  const liv = levelOfPrefix(s, n, st.rec, err);
  let rec = st.rec;
  if (liv === 'difficile' || liv === 'difficilissima') rec = true;
  else if (liv === 'la_sai') rec = false;
  return { s, n, rec, err, liv };
}

/** Il livello da una storia (`recent`) e dal numero di risposte di sempre (`total`). */
export function levelFromHistory(recent: string, total: number, wrongBefore = false): Level {
  if (total <= 0 || recent === '') return 'nuova';
  let st: Step = {
    s: '',
    n: Math.max(0, total - recent.length),
    rec: false,
    err: wrongBefore,
    liv: 'nuova',
  };
  for (const ch of recent) st = advance(st, ch);
  return st.liv;
}

/** Come sopra, ma da giuste (`c`), sbagliate (`w`) e storia recente. */
export function levelOf(c: number, w: number, recent: string): Level {
  // se le sbagliate di sempre sono più di quelle visibili nelle ultime risposte, una è più vecchia
  const wrongBefore = w > count(recent.toUpperCase(), 'W');
  return levelFromHistory(recent, c + w, wrongBefore);
}

/** «La sai» per i conteggi (carte che sai, padroneggiate): il livello la_sai, e una carta «facile» dalla terza risposta. */
export const isKnown = (level: string, n: number): boolean =>
  level === 'la_sai' || (level === 'facile' && n >= 3);

/** Il colore di ogni livello (quelli delle etichette della pagina «nuova partita» del sito). */
export const LEVEL_COLORS: Record<Level, string> = {
  nuova: '#32ADE6',
  da_imparare: '#5E5CE6',
  sembra_facile: '#00C7BE',
  facile: '#2FD39B',
  insidiosa: '#FF9500',
  difficile: '#FF3B30',
  difficilissima: '#C9003B',
  in_ripresa: '#AF52DE',
  quasi: '#34C759',
  la_sai: '#E0A800',
};

/** L'ordine in cui si offrono i livelli nella scelta della partita. */
export const LEVEL_CHOICES: Level[] = [
  'nuova',
  'da_imparare',
  'insidiosa',
  'difficile',
  'difficilissima',
  'in_ripresa',
  'quasi',
  'sembra_facile',
  'facile',
  'la_sai',
];
