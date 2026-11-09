/**
 * Una sessione di partita a voce: tiene acceso il microfono (`Listener`), manda quello che sente al cervello
 * (`VoiceBrain`), legge le carte con la voce del telefono e segna come «eco» tutto quello che legge. Non conosce lo
 * schermo: gli dice cosa fare con `onAction` e riceve la fase di gioco con `getView`. Porta di `fc_voice_mode.php`.
 */
import {
  Listener,
  type FatalReason,
  type ListenerState,
  type SpeechEngine,
} from '@/core/speech/recognizer';

import { VoiceBrain, type VoiceAction, type VoiceView } from './brain';
import { EchoFilter, type CommandSet } from './commands';
import type { Segment } from './reading';

/** Nelle parole, dopo che si è sentita la risposta giusta: almeno questo tempo prima di segnarla corretta. */
export const AUTO_GRADE_MS = 3000;

export interface SessionView extends VoiceView {
  /** la carta in gioco: se cambia, la risposta «in arrivo» non vale più */
  card: string;
}

export interface SessionDeps {
  engine: SpeechEngine;
  speak: (
    text: string,
    lang: string,
    opts: { once?: boolean; done?: () => void },
  ) => Promise<void> | void;
  stopSpeaking: () => void;
  commands: CommandSet;
  /** lingua dei comandi («it-IT», «en-US», «en-GB») */
  lang: string;
  getView: () => SessionView;
  onAction: (a: VoiceAction) => void;
  onState?: (s: ListenerState) => void;
  /** l'ultima frase sentita (per mostrarla) */
  onHeard?: (text: string) => void;
  onSpeaking?: (on: boolean) => void;
  onFatal?: (why: FatalReason) => void;
  now?: () => number;
}

export class VoiceSession {
  private readonly echo: EchoFilter;
  private readonly brain: VoiceBrain;
  private readonly listener: Listener;
  private readonly now: () => number;
  /** cambia a ogni lettura nuova: quelle vecchie si fermano */
  private token = 0;
  private last: Segment[] = [];
  /** c'è una risposta giusta sentita e un «corretto» in arrivo */
  private auto: { card: string; since: number } | null = null;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly d: SessionDeps) {
    this.now = d.now ?? (() => Date.now());
    this.echo = new EchoFilter(this.now);
    this.brain = new VoiceBrain(
      d.commands,
      this.echo,
      () => {
        const v = d.getView();
        // la risposta è stata sentita: si aspetta il «corretto» automatico
        return this.auto && v.phase === 'answer' ? { ...v, phase: 'auto-ok' } : v;
      },
      this.now,
    );
    this.listener = new Listener(
      d.engine,
      {
        onResult: (r) => {
          const first = r.alternatives[0];
          if (first && r.isFinal) d.onHeard?.(first);
          const action = this.brain.hear(r);
          if (action) this.run(action);
        },
        onState: (s) => d.onState?.(s),
        onFatal: (why) => {
          this.halt();
          d.onFatal?.(why);
        },
      },
      undefined,
      this.now,
    );
  }

  /** Chiede il permesso e accende il microfono. `false` = non si può (`onFatal` ha già detto perché). */
  start(): Promise<boolean> {
    return this.listener.begin(this.d.lang, this.d.commands.hints(this.d.lang));
  }

  stop(): void {
    if (this.stopped) return;
    this.halt();
    this.listener.end();
  }

  private halt(): void {
    this.stopped = true;
    this.token++;
    this.cancelAuto();
    this.d.stopSpeaking();
    this.d.onSpeaking?.(false);
  }

  /** Legge queste voci una dopo l'altra (una lettura nuova ferma quella in corso). */
  read(segments: readonly Segment[]): void {
    if (this.stopped) return;
    this.last = [...segments];
    const mine = ++this.token;
    const voci = this.last.filter((s) => s.text.trim());
    this.d.stopSpeaking();
    if (!voci.length) {
      this.d.onSpeaking?.(false);
      this.echo.start('');
      this.echo.end();
      // niente da dire: per la risposta in arrivo vale come «letto»
      queueMicrotask(() => this.finished(mine));
      return;
    }
    this.echo.start(voci.map((v) => v.text).join(' '));
    this.d.onSpeaking?.(true);
    let i = 0;
    const next = (): void => {
      if (mine !== this.token) return;
      const v = voci[i++];
      if (!v) {
        this.echo.end();
        this.d.onSpeaking?.(false);
        this.finished(mine);
        return;
      }
      void this.d.speak(v.text, v.lang, { once: v.once, done: next });
    };
    next();
  }

  /** «Ripeti»: rilegge dall'inizio quello che si stava leggendo. */
  repeat(): void {
    this.read(this.last);
  }

  /** La carta è cambiata (o si è votato a mano): la risposta giusta sentita prima non vale più. */
  cancelAuto(): void {
    this.auto = null;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
  }

  private run(a: VoiceAction): void {
    if (a.kind === 'repeat') {
      this.repeat();
      return;
    }
    if (a.kind === 'said-answer') {
      const v = this.d.getView();
      this.auto = { card: v.card, since: this.now() };
      // la lettura della domanda non conta più: quella che interessa è la risposta, che arriva col cambio di fase
      this.token++;
      this.d.stopSpeaking();
      this.d.onAction({ kind: 'reveal' });
      return;
    }
    if (a.kind === 'grade') this.cancelAuto();
    this.d.onAction(a);
  }

  /** Una lettura è arrivata in fondo. */
  private finished(mine: number): void {
    if (mine !== this.token || !this.auto || this.autoTimer) return;
    const auto = this.auto;
    const wait = Math.max(0, AUTO_GRADE_MS - (this.now() - auto.since));
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      const stillThere = this.auto === auto && this.d.getView().card === auto.card;
      this.auto = null;
      if (stillThere && !this.stopped) this.d.onAction({ kind: 'grade', correct: true });
    }, wait);
  }
}
