/**
 * Il cervello della modalità vocale (porta di `fc_voice_mode.php`, sezioni «comandi» ed «eco»): dato quello che il
 * microfono ha trascritto, dice QUALE comando è (ripeti, risposta, corretto, errato, continua, boss) o che non è un
 * comando. Niente schermo e niente microfono qui dentro: solo testo, quindi si prova con i casi del sito.
 *
 * Le frasi dei comandi sono quelle del dizionario (`fc.cmd_*`), di TUTTE le lingue: chi ha l'app in inglese ma pensa in
 * italiano dice «corretto» senza accorgersene.
 */

export type Intent = 'ripeti' | 'risposta' | 'corretto' | 'errato' | 'continua' | 'boss';

/** Le voci del dizionario `fc` che servono, per lingua (it, en): sono le stesse stringhe del sito. */
export type CommandDict = Record<string, string>;
export type CommandDicts = Record<string, CommandDict>;

/** Dove si trova il gioco adesso: decide quali comandi ha senso accettare "alla larga". */
export type Phase =
  'idle' | 'question' | 'answer' | 'auto-ok' | 'grading' | 'ck' | 'ck-wait' | 'boss-q' | 'boss-a';

export interface Match {
  intent: Intent;
  /** somiglianza grezza, 0–1 */
  score: number;
  /** punteggio dopo la penalità di lunghezza */
  weighted: number;
  /** trovato con il riconoscimento «largo» (suoni vicini) */
  loose?: boolean;
}

/** Soglie di riconoscimento (tarabili qui in un punto solo, come sul sito). */
export const MATCH_SIM_MIN = 0.72;
export const MATCH_WEIGHTED_MIN = 0.6;

export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const list = (s: string | undefined): string[] =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

export function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const dp = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) dp[j] = j;
  for (let i = 1; i <= al; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= bl; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[bl]!;
}

export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

const scheletro = (s: string): string => s.replace(/[aeiouy\s]/g, '');

/** Il punteggio di una parola contro una frase: 1 = identiche. Le parole cortissime (≤3 lettere) devono essere uguali. */
function punteggioLargo(c: string, p: string): number {
  if (c === p) return 1;
  if (c.length <= 3 || p.length <= 3) return 0;
  let s = similarity(c, p);
  const sc = scheletro(c);
  const sp = scheletro(p);
  if (sc.length >= 3 && sp.length >= 3) s = Math.max(s, similarity(sc, sp) * 0.9);
  return s;
}

/** Come `normalize` ma senza buttare le lettere non latine (giapponese, russo, accentate…): per le risposte. */
export function normAnswer(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Le forme in cui si può dire una risposta: «to give up / give in» → ["to give up", "give up", "give in"]. */
export function answerVariants(raw: string): string[] {
  const out: string[] = [];
  String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s*[/;|]\s*|\s*,\s*|\s+or\s+/i)
    .forEach((piece) => {
      const n = normAnswer(piece);
      if (!n) return;
      out.push(n);
      // l'articolo o il «to» davanti non lo dice nessuno
      const senza = n.replace(/^(to|the|a|an|il|lo|la|i|gli|le|un|uno|una)\s+/, '');
      if (senza && senza !== n) out.push(senza);
    });
  return out.filter((v, i) => v.length >= 2 && out.indexOf(v) === i);
}

/**
 * La frase detta contiene la risposta attesa? Parole corte solo esatte, le altre con un po' di tolleranza (il
 * riconoscitore scrive «gif up» per «give up»); si guardano anche finestre di parole dentro una frase più lunga.
 */
export function saidTheAnswer(transcript: string, expected: readonly string[]): boolean {
  const t = normAnswer(transcript);
  if (!t || !expected.length) return false;
  const words = t.split(' ');
  for (const v of expected) {
    const n = v.split(' ').length;
    const threshold = v.length <= 4 ? 1 : 0.84;
    for (let i = 0; i + n <= words.length; i++) {
      if (similarity(words.slice(i, i + n).join(' '), v) >= threshold) return true;
    }
    if (n === 1 && v.length > 4 && similarity(t, v) >= threshold) return true;
  }
  return false;
}

/**
 * ECO: il microfono sente anche la voce che legge la carta. Quello che coincide con il testo che si sta leggendo (o
 * che si è appena letto) non è l'utente: senza questo, una carta con «right» dentro si votava da sola.
 */
export class EchoFilter {
  private text = '';
  /** 0 = sta leggendo adesso */
  private until = 0;

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Si inizia a leggere questo testo. */
  start(spoken: string): void {
    this.text = normalize(
      String(spoken || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[$\\{}_^]/g, ' '),
    );
    this.until = 0;
  }

  /** La lettura è finita: l'eco dura ancora un attimo. */
  end(): void {
    this.until = this.now() + 1500;
  }

  private live(): boolean {
    return !!this.text && !(this.until && this.now() > this.until);
  }

  /** Quello che ho sentito è un pezzo del testo letto? */
  isEcho(heard: string): boolean {
    if (!this.live()) return false;
    const t = normalize(heard);
    return t.length > 0 && ` ${this.text} `.includes(` ${t} `);
  }

  /** Più larga: tutte le parole sentite sono parole della lettura in corso. */
  isWideEcho(heard: string): boolean {
    if (!this.live()) return false;
    const reading = ` ${this.text} `;
    const words = normalize(heard).split(' ').filter(Boolean);
    return words.length > 0 && words.every((w) => reading.includes(` ${w} `));
  }
}

export interface CommandSet {
  /** il miglior comando per una trascrizione; `null` se non è un comando netto */
  match: (transcript: string, phase: Phase) => Match | null;
  /** riconoscimento largo: solo tra i comandi `allowed`, con le «quasi giuste» */
  matchLoose: (transcript: string, allowed: readonly Intent[]) => Match | null;
  /** quali comandi si accettano "alla larga" in questa fase */
  looseIntents: (phase: Phase) => Intent[];
  /** le frasi corte della lingua, da suggerire al microfono */
  hints: (lang: string) => string[];
  fillers: string[];
}

const CHECKPOINT_ONLY: readonly Intent[] = ['continua', 'boss'];
const inSheet = (p: Phase): boolean => p.startsWith('ck') || p.startsWith('boss');

/**
 * Costruisce i comandi dai dizionari. `siteLang` dice quale lingua passa per prima; `vocab` toglie i comandi che nelle
 * parole non fanno niente (comandi che non possono fare niente sono solo occasioni per capire male una frase).
 */
export function buildCommands(dicts: CommandDicts, siteLang: string, vocab: boolean): CommandSet {
  const langs = Object.keys(dicts).sort(
    (a, b) => (a === siteLang ? -1 : 0) - (b === siteLang ? -1 : 0),
  );
  const intents: Intent[] = ['ripeti', 'risposta', 'corretto', 'errato', 'continua', 'boss'];

  let fillers: string[] = [];
  for (const l of langs) fillers = fillers.concat(list(dicts[l]?.vg_fillers));
  fillers = fillers.map(normalize).filter(Boolean);
  // le frasi più lunghe per prime: «thanks a lot» va tolto prima di «thanks»
  fillers.sort((a, b) => b.length - a.length);
  const stripFillers = (s: string): string => {
    let out = ` ${s} `;
    for (const f of fillers) out = out.split(` ${f} `).join(' ');
    return out.replace(/\s+/g, ' ').trim();
  };

  const index = intents.map((intent) => {
    let phrases: string[] = [];
    for (const l of langs) phrases = phrases.concat(list(dicts[l]?.[`cmd_${intent}`]));
    phrases = phrases.filter((f, i) => phrases.indexOf(f) === i);
    return {
      intent,
      phrases: phrases.map((p) => {
        const n = normalize(p);
        return { text: n, words: n.split(' ').length };
      }),
    };
  });

  const near: Partial<Record<Intent, string[]>> = {};
  for (const intent of ['risposta', 'corretto', 'errato'] as const) {
    let l = index.find((e) => e.intent === intent)!.phrases.map((p) => p.text);
    for (const lang of langs) l = l.concat(list(dicts[lang]?.[`cmd_vicini_${intent}`]));
    near[intent] = l.map(normalize).filter((f, i, a) => f && a.indexOf(f) === i);
  }

  const match: CommandSet['match'] = (transcript, phase) => {
    const cleaned = stripFillers(normalize(transcript));
    if (!cleaned) return null;
    const uCount = cleaned.split(' ').filter(Boolean).length;
    let best: Match | null = null;
    for (const entry of index) {
      // «continua» e «boss» esistono solo davanti al checkpoint: fuori di lì «continue» potrebbe essere la risposta
      if (CHECKPOINT_ONLY.includes(entry.intent) && !inSheet(phase)) continue;
      for (const ph of entry.phrases) {
        let score = similarity(cleaned, ph.text);
        if (uCount >= ph.words) {
          const escaped = ph.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(cleaned)) score = Math.max(score, 0.97);
        }
        const lenRatio = Math.min(1, (ph.words + 2) / Math.max(uCount, 1));
        const weighted = score * (0.55 + 0.45 * lenRatio);
        if (!best || weighted > best.weighted) best = { intent: entry.intent, score, weighted };
      }
    }
    return best && best.score >= MATCH_SIM_MIN && best.weighted >= MATCH_WEIGHTED_MIN ? best : null;
  };

  const matchLoose: CommandSet['matchLoose'] = (transcript, allowed) => {
    const clean = stripFillers(normalize(transcript));
    if (!clean || !allowed.length) return null;
    const words = clean.split(' ').filter(Boolean);
    if (words.length > 4) return null; // una frase lunga non è un comando
    const cand = [clean];
    for (const w of words) if (w.length >= 2 && !cand.includes(w)) cand.push(w);
    if (words.length > 1) cand.push(words.join('')); // «core ect» → «coreect»
    const scored = allowed.map((intent) => {
      let m = 0;
      for (const c of cand)
        for (const p of near[intent] ?? []) m = Math.max(m, punteggioLargo(c, p));
      return { intent, score: m };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (!top || top.score < MATCH_SIM_MIN) return null;
    // due comandi opposti (giusto / sbagliato) con quasi lo stesso punteggio: meglio non votare che votare al contrario
    if (scored[1] && top.score - scored[1].score < 0.05) return null;
    return { intent: top.intent, score: top.score, weighted: top.score, loose: true };
  };

  const looseIntents: CommandSet['looseIntents'] = (phase) => {
    switch (phase) {
      case 'question':
        // nelle parole quello che si dice è la parola da indovinare, non «risposta»
        return vocab ? [] : ['risposta'];
      case 'boss-q':
        return vocab ? [] : ['risposta'];
      case 'boss-a':
      case 'answer':
      case 'auto-ok':
        return ['corretto', 'errato'];
      default:
        return [];
    }
  };

  const hints: CommandSet['hints'] = (lang) => {
    const l = lang.slice(0, 2);
    const out: string[] = [];
    for (const i of intents) {
      for (const f of list(dicts[l]?.[`cmd_${i}`])) {
        if (f.split(' ').length <= 3 && out.length < 80) out.push(f);
      }
    }
    return out;
  };

  return { match, matchLoose, looseIntents, hints, fillers };
}
