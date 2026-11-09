/**
 * Il «cervello» della partita a voce: riceve quello che il microfono ha sentito e decide COSA fare (rivela, vota,
 * continua…). Non parla, non ascolta, non tocca lo schermo: la schermata esegue l'azione. Così si prova con frasi finte.
 * Porta di `fc_voice_mode.php` (gestione dei risultati, eco, doppioni).
 */
import type { EngineResult } from '@/core/speech/recognizer';

import {
  EchoFilter,
  normalize,
  saidTheAnswer,
  type CommandSet,
  type Intent,
  type Match,
  type Phase,
} from './commands';

export type VoiceAction =
  | { kind: 'repeat' }
  | { kind: 'reveal' }
  | { kind: 'grade'; correct: boolean }
  | { kind: 'continue' }
  | { kind: 'boss' }
  /** parole: «corretto/errato» detto prima di vedere la risposta → solo mostrarla e leggerla */
  | { kind: 'reveal-read' }
  /** parole: ha detto la risposta giusta → mostrarla, leggerla, poi dare «corretto» */
  | { kind: 'said-answer' };

export interface VoiceView {
  phase: Phase;
  /** carta di parole: cambia come si interpreta quello che si dice */
  vocab: boolean;
  /** le forme accettate della risposta (parole, domanda in corso) */
  expected: readonly string[];
}

/** Lo stesso comando due volte di fila entro questo tempo è lo stesso comando (interim + final). */
export const DEDUPE_MS = 1800;
/** Un comando ancora «a metà» (interim) parte subito solo se è netto e corto. */
export const INTERIM_SCORE = 0.97;
export const INTERIM_LOOSE_SCORE = 0.99;
export const INTERIM_MAX_WORDS = 3;

/** Quali comandi hanno senso in ogni fase. */
export function allowedIntents(phase: Phase, vocab: boolean): readonly Intent[] {
  switch (phase) {
    case 'question':
      // nelle parole «corretto/errato» a carta chiusa non danno il voto: rivelano (vedi `toAction`)
      return ['ripeti', 'risposta', 'corretto', 'errato'];
    case 'answer':
    case 'auto-ok':
      return ['ripeti', 'corretto', 'errato'];
    case 'ck':
      return ['ripeti', 'continua', 'boss'];
    case 'boss-q':
      return vocab ? ['ripeti', 'risposta'] : ['ripeti', 'risposta', 'corretto', 'errato'];
    case 'boss-a':
      return ['ripeti', 'corretto', 'errato'];
    default:
      // idle, grading, ck-wait: si sta già facendo qualcosa
      return [];
  }
}

function toAction(intent: Intent, view: VoiceView): VoiceAction | null {
  switch (intent) {
    case 'ripeti':
      return { kind: 'repeat' };
    case 'risposta':
      return { kind: 'reveal' };
    case 'continua':
      return { kind: 'continue' };
    case 'boss':
      return { kind: 'boss' };
    case 'corretto':
    case 'errato':
      if (view.vocab && view.phase === 'question') return { kind: 'reveal-read' };
      return { kind: 'grade', correct: intent === 'corretto' };
  }
}

const keyOf = (a: VoiceAction): string => (a.kind === 'grade' ? `grade:${a.correct}` : a.kind);

export class VoiceBrain {
  private lastKey = '';
  private lastAt = 0;

  constructor(
    private readonly commands: CommandSet,
    private readonly echo: EchoFilter,
    private readonly view: () => VoiceView,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Cosa fare con quello che ho sentito. `null` = niente (non era un comando, era l'eco, era un doppione). */
  hear(r: EngineResult): VoiceAction | null {
    const view = this.view();
    const allowed = allowedIntents(view.phase, view.vocab);
    if (!allowed.length) return null;
    const action = r.isFinal ? this.final(r, view, allowed) : this.interim(r, view, allowed);
    return action && this.fresh(action) ? action : null;
  }

  /** Dopo un comando, lo stesso per un attimo non vale: la schermata cambia fase e il riconoscitore ripete. */
  private fresh(a: VoiceAction): boolean {
    const t = this.now();
    const key = keyOf(a);
    if (key === this.lastKey && t - this.lastAt < DEDUPE_MS) return false;
    this.lastKey = key;
    this.lastAt = t;
    return true;
  }

  private commandOf(m: Match | null, allowed: readonly Intent[], view: VoiceView) {
    return m && allowed.includes(m.intent) ? toAction(m.intent, view) : null;
  }

  private said(alts: readonly string[], view: VoiceView): VoiceAction | null {
    if (!view.vocab || view.phase !== 'question' || !view.expected.length) return null;
    return alts.some((a) => saidTheAnswer(a, view.expected)) ? { kind: 'said-answer' } : null;
  }

  private final(r: EngineResult, view: VoiceView, allowed: readonly Intent[]): VoiceAction | null {
    const heard = r.alternatives.filter((a) => a.trim() && !this.echo.isEcho(a));
    if (!heard.length) return null;
    let best: Match | null = null;
    for (const a of heard) {
      const m = this.commands.match(a, view.phase);
      if (m && allowed.includes(m.intent) && (!best || m.weighted > best.weighted)) best = m;
    }
    const command = this.commandOf(best, allowed, view);
    if (command) return command;
    const said = this.said(heard, view);
    if (said) return said;
    // niente di netto: l'ascolto «largo» (suoni vicini), ma mai su quello che è solo la voce che legge
    const loose = this.commands.looseIntents(view.phase).filter((i) => allowed.includes(i));
    if (!loose.length) return null;
    for (const a of heard) {
      if (this.echo.isWideEcho(a)) continue;
      const m = this.commands.matchLoose(a, loose);
      const action = this.commandOf(m, allowed, view);
      if (action) return action;
    }
    return null;
  }

  private interim(
    r: EngineResult,
    view: VoiceView,
    allowed: readonly Intent[],
  ): VoiceAction | null {
    const first = r.alternatives[0];
    if (!first || !first.trim() || this.echo.isEcho(first)) return null;
    const words = normalize(first).split(' ').filter(Boolean).length;
    if (words <= INTERIM_MAX_WORDS) {
      const m = this.commands.match(first, view.phase);
      if (m && m.score >= INTERIM_SCORE) {
        const action = this.commandOf(m, allowed, view);
        if (action) return action;
      }
    }
    const said = this.said([first], view);
    if (said) return said;
    const loose = this.commands.looseIntents(view.phase).filter((i) => allowed.includes(i));
    if (loose.length && !this.echo.isWideEcho(first)) {
      const m = this.commands.matchLoose(first, loose);
      if (m && m.score >= INTERIM_LOOSE_SCORE) return this.commandOf(m, allowed, view);
    }
    return null;
  }
}
