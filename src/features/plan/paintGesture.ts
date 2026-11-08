import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';

import { cellAt } from './calendarGrid';
import type { Tool } from './PlanCalendar';

export interface PaintContext {
  /** il progetto scelto (null = nessuno: non si disegna) */
  project: string | null;
  tool: Tool;
  today: string;
  /** il primo giorno della griglia */
  from: string;
  /** i giorni evidenziati del progetto scelto */
  painted: ReadonlySet<string>;
}

export interface PaintCallbacks {
  /** mentre si trascina: i giorni toccati e se si accende o si spegne (null = fine) */
  onPreview: (drag: { mode: 'add' | 'remove'; days: string[] } | null) => void;
  /** a dito sollevato: i giorni che cambiano davvero */
  onCommit: (project: string, mode: 'add' | 'remove', days: string[]) => void;
}

interface Measurable {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
}

/**
 * L'evidenziatore a trascinamento (bindPaint del sito). Un tocco fermo lo gestisce il giorno stesso; qui si prende solo il
 * trascinamento ORIZZONTALE (uno verticale lascia scorrere la pagina). Il primo giorno toccato decide se si sta accendendo o
 * spegnendo, e vale per tutto il gesto. Sta fuori dal componente e legge sempre i dati più recenti tramite update().
 */
export class PaintGesture {
  private node: Measurable | null = null;
  private geo = { x: 0, y: 0, w: 0 };
  private ctx: PaintContext = {
    project: null,
    tool: 'look',
    today: '',
    from: '',
    painted: new Set(),
  };
  private cb: PaintCallbacks = { onPreview: () => undefined, onCommit: () => undefined };
  private session: { mode: 'add' | 'remove'; seen: Set<string>; changed: string[] } | null = null;
  readonly responder;

  constructor() {
    this.responder = PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        this.measure();
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        this.ctx.tool !== 'look' &&
        !!this.ctx.project &&
        Math.abs(g.dx) > 10 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (_e, g) => this.begin(g),
      onPanResponderMove: (_e, g) => this.step(this.dayAt(g.x0 + g.dx, g.y0 + g.dy)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => this.finish(),
      onPanResponderTerminate: () => this.finish(),
    });
  }

  /** Il campo della griglia, per sapere dove sta nella finestra. */
  attach(node: unknown): void {
    this.node = node as Measurable | null;
  }

  update(ctx: PaintContext, cb: PaintCallbacks): void {
    this.ctx = ctx;
    this.cb = cb;
  }

  setWidth(w: number): void {
    this.geo.w = w;
  }

  measure(): void {
    this.node?.measureInWindow((x, y, w) => {
      this.geo = { x, y, w };
    });
  }

  /** Per i test: dove sta la griglia nella finestra. */
  setGeometry(x: number, y: number, w: number): void {
    this.geo = { x, y, w };
  }

  private dayAt(pageX: number, pageY: number): string | null {
    return cellAt(pageX - this.geo.x, pageY - this.geo.y, this.geo.w, this.ctx.from);
  }

  begin(g: Pick<PanResponderGestureState, 'x0' | 'y0'>): void {
    const start = this.dayAt(g.x0, g.y0);
    const was = start ? this.ctx.painted.has(start) : false;
    this.session = {
      mode: this.ctx.tool === 'erase' ? 'remove' : was ? 'remove' : 'add',
      seen: new Set(),
      changed: [],
    };
    this.step(start);
  }

  step(day: string | null): void {
    const s = this.session;
    if (!s || !day || s.seen.has(day) || day < this.ctx.today || !this.ctx.project) return;
    s.seen.add(day);
    const was = this.ctx.painted.has(day);
    if ((s.mode === 'add' && !was) || (s.mode === 'remove' && was)) s.changed.push(day);
    this.cb.onPreview({ mode: s.mode, days: [...s.seen] });
  }

  finish(): void {
    const s = this.session;
    this.session = null;
    this.cb.onPreview(null);
    if (s && this.ctx.project && s.changed.length)
      this.cb.onCommit(this.ctx.project, s.mode, s.changed);
  }
}

export type { GestureResponderEvent };
