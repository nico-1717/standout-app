import { elapsedSeconds, remainingSeconds, stampMs, type Session } from './logic';

/** Tutto quello che il Live Activity (schermata di blocco e Dynamic Island) deve mostrare: solo numeri e testi semplici. */
export type ActivityProps = {
  kind: 'focus' | 'break' | 'stopwatch';
  paused: boolean;
  /** L'istante a cui il conteggio è stato fissato (ms). Il tempo poi scorre da solo: lo fa iOS, non l'app. */
  at: number;
  /** Inizio e fine del conto (ms): per il conto alla rovescia `at` → fine, per il cronometro «inizio» → molto più avanti. */
  from: number;
  to: number;
  title: string;
  subtitle: string;
  color: string;
  /** Quello che si legge quando il tempo è finito e l'app non è aperta. */
  doneText: string;
};

export type ActivityTexts = {
  focus: string;
  focusPaused: string;
  stopwatch: string;
  stopwatchPaused: string;
  breakTitle: string;
  focusDone: string;
  breakDone: string;
  fallbackSubtitle: string;
};

export type DesiredActivity = {
  /** Cambia solo quando cambia qualcosa di vero (avvio, pausa, ripresa, fine): lo scorrere del tempo non lo cambia. */
  key: string;
  props: ActivityProps;
  /** Quando il Live Activity diventa «scaduto» da solo (fine del conto alla rovescia), per mostrare «finito». */
  staleAt: number | null;
};

type Break = { start_time: string; planned_duration_min: number };

const STOPWATCH_SPAN_MS = 10 * 3600 * 1000;

/**
 * Cosa mostrare ora fuori dall'app: la sessione aperta (a tempo o cronometro, anche in pausa) oppure la pausa; niente = null.
 * La sessione ha la precedenza sulla pausa, come nella barretta dentro l'app.
 */
export function activityFor(args: {
  active: Session | null;
  brk: Break | null;
  nowMs: number;
  projectName: string | null;
  color: string | null;
  brandColor: string;
  breakColor: string;
  lang: string;
  texts: ActivityTexts;
}): DesiredActivity | null {
  const { active, brk, nowMs, texts } = args;
  const subtitle = args.projectName ?? texts.fallbackSubtitle;
  if (active) {
    const paused = active.status === 'pausa';
    const color = args.color ?? args.brandColor;
    const key = `${args.lang}|${active.uuid}|${paused ? 'p' : 'r'}|${active.resume_time ?? ''}|${active.duration_seconds}`;
    const left = remainingSeconds(active, nowMs);
    if (left === null) {
      const elapsedMs = elapsedSeconds(active, nowMs) * 1000;
      return {
        key,
        staleAt: null,
        props: {
          kind: 'stopwatch',
          paused,
          at: nowMs,
          from: nowMs - elapsedMs,
          to: nowMs + STOPWATCH_SPAN_MS,
          title: paused ? texts.stopwatchPaused : texts.stopwatch,
          subtitle,
          color,
          doneText: texts.stopwatch,
        },
      };
    }
    const over = left <= 0;
    return {
      key,
      staleAt: paused ? null : over ? nowMs : nowMs + left * 1000,
      props: {
        kind: 'focus',
        paused,
        at: nowMs,
        from: over ? nowMs - 1000 : nowMs,
        to: over ? nowMs : nowMs + left * 1000,
        title: paused ? texts.focusPaused : texts.focus,
        subtitle,
        color,
        doneText: texts.focusDone,
      },
    };
  }
  if (brk) {
    const start = stampMs(brk.start_time);
    const endMs = Number.isFinite(start) ? start + brk.planned_duration_min * 60000 : nowMs;
    const over = endMs <= nowMs;
    return {
      key: `${args.lang}|break|${brk.start_time}|${brk.planned_duration_min}`,
      staleAt: over ? nowMs : endMs,
      props: {
        kind: 'break',
        paused: false,
        at: nowMs,
        from: over ? nowMs - 1000 : nowMs,
        to: over ? nowMs : endMs,
        title: texts.breakTitle,
        subtitle: texts.fallbackSubtitle,
        color: args.breakColor,
        doneText: texts.breakDone,
      },
    };
  }
  return null;
}
