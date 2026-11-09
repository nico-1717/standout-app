import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Il microfono che capisce le parole (`expo-speech-recognition`): usa il riconoscimento di iOS e di Android. Qui sta
 * la parte che serve a TUTTE le funzioni a voce (detta del diario, microfono del to buy, modalità vocale del gioco):
 * chiedere il permesso, ascoltare una frase alla volta e RIAPRIRE da soli l'ascolto quando si chiude — il sistema lo
 * chiude dopo pochi secondi di silenzio, e per la modalità a mani libere deve restare sempre acceso.
 *
 * Come sul sito, l'ascolto NON è «continuo»: su iPhone il continuo accumula tutta la sessione in una frase sola e si
 * pianta. Si ascolta una frase, si riapre.
 */

export type FatalReason = 'permission' | 'unsupported';

export interface EngineStart {
  lang: string;
  /** frasi da aspettarsi (i comandi): il riconoscitore le capisce anche dette male */
  hints: string[];
  /** risultati provvisori mentre si parla */
  interim: boolean;
  /** quante trascrizioni alternative chiedere (più occasioni di trovare «wrong» come quinta) */
  alternatives: number;
}

export type EngineError =
  | 'aborted'
  | 'audio-capture'
  | 'interrupted'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'busy'
  | 'client'
  | 'speech-timeout'
  | 'too-many-requests'
  | 'unknown';

export interface EngineResult {
  /** le trascrizioni, la più probabile per prima */
  alternatives: string[];
  isFinal: boolean;
}

/** Quello che serve dal riconoscimento del telefono: separato per poterlo provare senza telefono. */
export interface SpeechEngine {
  requestPermission(): Promise<boolean>;
  available(): boolean;
  start(o: EngineStart): void;
  stop(): void;
  abort(): void;
  onResult(cb: (r: EngineResult) => void): () => void;
  onError(cb: (code: EngineError) => void): () => void;
  onStart(cb: () => void): () => void;
  onEnd(cb: () => void): () => void;
}

/** Il riconoscimento vero del telefono. */
export const phoneEngine: SpeechEngine = {
  async requestPermission() {
    try {
      const r = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return r.granted;
    } catch {
      return false;
    }
  },
  available() {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  },
  start(o) {
    ExpoSpeechRecognitionModule.start({
      lang: o.lang,
      interimResults: o.interim,
      maxAlternatives: o.alternatives,
      contextualStrings: o.hints,
      continuous: false,
      addsPunctuation: false,
      // la voce che esce dalle casse non deve rientrare nel microfono: lo toglie il sistema, il resto lo fa il filtro d'eco
      iosVoiceProcessingEnabled: true,
    });
  },
  stop() {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* già fermo */
    }
  },
  abort() {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* già fermo */
    }
  },
  onResult(cb) {
    const sub = ExpoSpeechRecognitionModule.addListener('result', (e) =>
      cb({ alternatives: e.results.map((r) => r.transcript), isFinal: e.isFinal }),
    );
    return () => sub.remove();
  },
  onError(cb) {
    const sub = ExpoSpeechRecognitionModule.addListener('error', (e) => cb(e.error));
    return () => sub.remove();
  },
  onStart(cb) {
    const sub = ExpoSpeechRecognitionModule.addListener('start', () => cb());
    return () => sub.remove();
  },
  onEnd(cb) {
    const sub = ExpoSpeechRecognitionModule.addListener('end', () => cb());
    return () => sub.remove();
  },
};

export type ListenerState = 'off' | 'starting' | 'listening' | 'hearing';

export interface ListenerHooks {
  onResult: (r: EngineResult) => void;
  onState?: (s: ListenerState) => void;
  /** non si può andare avanti (permesso negato, lingua non supportata): l'ascolto si ferma */
  onFatal?: (why: FatalReason) => void;
  /** con `once`: la sessione è finita da sola (silenzio o fine della frase) e non si riapre */
  onEnded?: () => void;
}

export interface ListenerTiming {
  /** pausa prima di riaprire l'ascolto dopo che si è chiuso */
  restartMs: number;
  /** pausa quando il sistema dice «occupato» o «rete» */
  retryMs: number;
  /** quanti riavvii in `stormWindowMs` sono troppi */
  stormCount: number;
  stormWindowMs: number;
  /** pausa lunga quando i riavvii sono troppi: iOS mette in penitenza chi insiste */
  stormPauseMs: number;
}

export const DEFAULT_TIMING: ListenerTiming = {
  restartMs: 150,
  retryMs: 1000,
  stormCount: 6,
  stormWindowMs: 5000,
  stormPauseMs: 2000,
};

/**
 * L'ascolto che resta acceso: `begin()` chiede il permesso e parte; ogni volta che il sistema chiude la sessione, ne
 * apre una nuova (con una pausa, e una pausa più lunga se si riapre troppo spesso). `end()` ferma tutto.
 */
export class Listener {
  private wanted = false;
  private running = false;
  private lang = '';
  private hints: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private starts: number[] = [];
  private unsub: (() => void)[] = [];
  private state: ListenerState = 'off';
  /** non riaprire prima di questo momento (il sistema era occupato, o i riavvii erano troppi) */
  private notBefore = 0;
  private once = false;

  constructor(
    private readonly engine: SpeechEngine,
    private readonly hooks: ListenerHooks,
    private readonly timing: ListenerTiming = DEFAULT_TIMING,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get isOn(): boolean {
    return this.wanted;
  }

  private set(s: ListenerState): void {
    if (s === this.state) return;
    this.state = s;
    this.hooks.onState?.(s);
  }

  /** Chiede il permesso e comincia ad ascoltare. `false` = non si può (e `onFatal` ha già detto perché). */
  async begin(lang: string, hints: string[], once = false): Promise<boolean> {
    if (this.wanted) return true;
    if (!this.engine.available()) {
      this.hooks.onFatal?.('unsupported');
      return false;
    }
    if (!(await this.engine.requestPermission())) {
      this.hooks.onFatal?.('permission');
      return false;
    }
    this.lang = lang;
    this.hints = hints;
    this.once = once;
    this.wanted = true;
    this.unsub = [
      this.engine.onStart(() => {
        this.running = true;
        this.set('listening');
      }),
      this.engine.onResult((r) => {
        if (!this.wanted) return;
        this.set('hearing');
        this.hooks.onResult(r);
      }),
      this.engine.onError((code) => this.handleError(code)),
      this.engine.onEnd(() => {
        this.running = false;
        if (this.wanted && this.once) {
          // una frase sola: finita quella, si smette
          this.end();
          this.hooks.onEnded?.();
        } else if (this.wanted) {
          this.set('starting');
          this.schedule(this.timing.restartMs);
        }
      }),
    ];
    this.set('starting');
    this.open();
    return true;
  }

  /** Cambia la lingua (o le frasi attese): vale dalla prossima sessione, quindi si chiude questa. */
  retune(lang: string, hints: string[]): void {
    const changed = lang !== this.lang;
    this.lang = lang;
    this.hints = hints;
    if (changed && this.running) this.engine.abort();
  }

  end(): void {
    this.wanted = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const u of this.unsub) u();
    this.unsub = [];
    if (this.running) this.engine.abort();
    this.running = false;
    this.set('off');
  }

  private handleError(code: EngineError): void {
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      this.fatal('permission');
    } else if (code === 'language-not-supported') {
      this.fatal('unsupported');
    } else if (code === 'busy' || code === 'network' || code === 'too-many-requests') {
      // il sistema è occupato: 'end' arriva, ma si riprova con più calma
      if (this.wanted) {
        this.notBefore = this.now() + this.timing.retryMs;
        this.schedule(this.timing.retryMs);
      }
    }
    // silenzio, interruzioni, annullamenti: normale; ci pensa 'end' a riaprire
  }

  private fatal(why: FatalReason): void {
    this.end();
    this.hooks.onFatal?.(why);
  }

  private schedule(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    const wait = Math.max(ms, this.notBefore - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.open();
    }, wait);
  }

  private open(): void {
    if (!this.wanted || this.running) return;
    const t = this.now();
    this.starts = this.starts.filter((x) => t - x < this.timing.stormWindowMs);
    if (this.starts.length >= this.timing.stormCount) {
      // troppi riavvii di fila: una pausa lunga, per non finire in penitenza
      this.starts = [];
      this.notBefore = t + this.timing.stormPauseMs;
      this.schedule(this.timing.stormPauseMs);
      return;
    }
    this.starts.push(t);
    try {
      this.engine.start({ lang: this.lang, hints: this.hints, interim: true, alternatives: 5 });
    } catch {
      this.notBefore = t + this.timing.retryMs;
      this.schedule(this.timing.retryMs);
    }
  }
}
