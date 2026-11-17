import { useEffect, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type HostInstance,
} from 'react-native';

import { haptic } from '@/ui/motion';

import {
  NEST_HOLD_MS,
  ownerAt,
  planDrop,
  reorderPlan,
  shiftFor,
  type DropPlan,
  type OutsideBox,
  type RowBox,
} from './dragLogic';
import { useScrollBridge, type ScrollBridge } from './ScrollBridge';

/** Cosa serve sapere di ogni riga visibile. */
export interface DragRow {
  id: string;
  parent: string | null;
}

export interface DragConfig {
  rows: DragRow[];
  /** il padre di ogni progetto, anche di quelli non visibili (per sapere a quale fratello appartiene una riga) */
  parentOf: ReadonlyMap<string, string | null>;
  /** il riordino è consentito (ordine «manuale»)? */
  canReorder: boolean;
  onDrop: (id: string, plan: DropPlan) => void;
}

/** Cosa si vede mentre una riga è in mano. */
export interface DragUi {
  /** la riga in mano, o null */
  active: string | null;
  /** dove andrebbe se la si lasciasse adesso */
  plan: DropPlan;
  /** di quanto scivola ogni riga (la sua e quelle che ha dentro) per fare posto */
  shifts: ReadonlyMap<string, number>;
  /** le righe che stanno dentro la riga in mano e la seguono */
  carried: ReadonlySet<string>;
}

const NONE: DropPlan = { kind: 'none' };
const IDLE: DragUi = { active: null, plan: NONE, shifts: new Map(), carried: new Set() };
const EDGE = 90;
const MAX_STEP = 18;

/** Lo spostamento in pixel della riga in mano: lo legge solo chi si muove con lei (useSyncExternalStore). */
export class LiftStore {
  private value = 0;
  private listeners = new Set<() => void>();
  readonly get = () => this.value;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  set(v: number) {
    if (v === this.value) return;
    this.value = v;
    this.listeners.forEach((fn) => fn());
  }
}

interface Zone {
  name: string;
  view: HostInstance | null;
}

const samePlan = (a: DropPlan, b: DropPlan) =>
  a.kind === b.kind &&
  (a.kind === 'slot' ? a.index === (b as typeof a).index : true) &&
  (a.kind === 'nest' ? a.id === (b as typeof a).id : true);

/**
 * Il gesto del trascinamento di una riga. Sta in una classe (come `MoveGesture` del Planner) perché il responder vive
 * fuori dal rendering: legge sempre i dati più recenti con `update()`.
 */
class RowDragGesture {
  private armed: string | null = null;
  private grabbed = false;
  private scroll0 = 0;
  private y0 = 0;
  private fingerY = 0;
  private containerTop = 0;
  private geom = new Map<string, { y: number; h: number }>();
  private zones = new Map<string, Zone>();
  private zoneBoxes: OutsideBox[] = [];
  private blocks: { id: string; top: number; height: number }[] = [];
  private cand: { id: string; since: number } | null = null;
  private plan: DropPlan = NONE;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private scrollTimer: ReturnType<typeof setInterval> | null = null;
  private scrollStep = 0;
  private container: HostInstance | null = null;

  setContainer(view: HostInstance | null) {
    this.container = view;
  }

  readonly responder;

  constructor(
    private cfg: DragConfig,
    private bridge: ScrollBridge,
    private readonly lift: LiftStore,
    private readonly setUi: (ui: DragUi) => void,
  ) {
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // preso il tocco lungo, il movimento è della riga anche se un figlio (il Pressable) tiene già il gesto
      onMoveShouldSetPanResponderCapture: () => this.armed !== null,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_e, g) => {
        this.grabbed = true;
        this.y0 = g.y0 + this.bridge.offset();
      },
      onPanResponderMove: (_e, g) => this.move(g),
      onPanResponderRelease: () => this.finish(true),
      onPanResponderTerminate: () => this.finish(false),
    });
  }

  update(cfg: DragConfig, bridge: ScrollBridge) {
    this.cfg = cfg;
    this.bridge = bridge;
  }

  layout(id: string, e: LayoutChangeEvent) {
    const { y, height } = e.nativeEvent.layout;
    this.geom.set(id, { y, h: height });
  }

  zone(id: string, name: string, view: HostInstance | null) {
    if (view) this.zones.set(id, { name, view });
    else this.zones.delete(id);
  }

  /** Il tocco lungo è scattato su questa riga: si stacca. */
  arm(id: string) {
    this.armed = id;
    this.grabbed = false;
    this.cand = null;
    this.scroll0 = this.bridge.offset();
    this.lift.set(0);
    this.measure();
    this.blocksFor(id);
    this.plan = NONE;
    this.publish(id);
    this.bridge.lock(true);
    haptic.select();
  }

  /** Un tocco lungo lasciato senza muoversi non sposta nulla. */
  release() {
    setTimeout(() => {
      if (this.armed && !this.grabbed) this.finish(false);
    }, 0);
  }

  /** Misura dove sta la pagina; i numeri arrivano entro un fotogramma, prima del primo movimento del dito. */
  private measure() {
    const off = this.scroll0;
    this.zoneBoxes = [];
    this.container?.measureInWindow?.((_x, y) => {
      this.containerTop = y + off;
    });
    for (const [id, z] of this.zones) {
      z.view?.measureInWindow?.((_x, y, _w, h) => {
        this.zoneBoxes.push({ id, name: z.name, top: y + off, height: h });
      });
    }
  }

  /** I fratelli della riga in mano, ognuno con lo spazio che occupa insieme ai suoi discendenti visibili. */
  private blocksFor(id: string) {
    const parent = this.cfg.parentOf.get(id) ?? null;
    const spans = new Map<string, { top: number; bottom: number }>();
    for (const r of this.cfg.rows) {
      const g = this.geom.get(r.id);
      if (!g) continue;
      const owner = ownerAt(r.id, this.cfg.parentOf, parent);
      if (!owner) continue;
      const s = spans.get(owner);
      if (s) s.bottom = Math.max(s.bottom, g.y + g.h);
      else spans.set(owner, { top: g.y, bottom: g.y + g.h });
    }
    this.blocks = [...spans.entries()].map(([bid, s]) => ({
      id: bid,
      top: s.top,
      height: s.bottom - s.top,
    }));
  }

  private move(g: PanResponderGestureState) {
    if (!this.armed) return;
    this.fingerY = g.moveY;
    this.step();
    // vicino al bordo dello schermo la pagina scorre da sola, piano vicino alla soglia e veloce sull'orlo
    const h = Dimensions.get('window').height;
    const top = EDGE + 40;
    const bottom = h - EDGE - 60;
    const y = g.moveY;
    this.scrollStep =
      y < top
        ? Math.max(-MAX_STEP, (y - top) / 5)
        : y > bottom
          ? Math.min(MAX_STEP, (y - bottom) / 5)
          : 0;
    if (this.scrollStep !== 0 && !this.scrollTimer) {
      this.scrollTimer = setInterval(() => {
        if (!this.scrollStep) return;
        this.bridge.scrollTo(Math.max(0, this.bridge.offset() + this.scrollStep));
        this.step();
      }, 16);
    } else if (this.scrollStep === 0) this.stopScroll();
  }

  /** Aggiorna dov'è la riga e dove andrebbe, con la pagina com'è adesso. */
  private step() {
    const id = this.armed;
    if (!id) return;
    const off = this.bridge.offset();
    const fingerContent = this.fingerY + off;
    this.lift.set(fingerContent - this.y0);
    const parent = this.cfg.parentOf.get(id) ?? null;
    const boxes: RowBox[] = this.cfg.rows.flatMap((r) => {
      const g = this.geom.get(r.id);
      return g ? [{ id: r.id, parent: r.parent, top: this.containerTop + g.y, height: g.h }] : [];
    });
    // lei e chi sta dentro (a qualunque profondità) non sono un posto dove lasciarla
    const blocked = new Set<string>([id]);
    for (const r of this.cfg.rows) {
      let cur: string | null | undefined = r.parent;
      for (let guard = 0; cur && guard < 60; guard++) {
        if (cur === id) {
          blocked.add(r.id);
          break;
        }
        cur = this.cfg.parentOf.get(cur);
      }
    }
    const input = {
      boxes,
      outside: this.zoneBoxes,
      drag: id,
      parent,
      blocked,
      y: fingerContent,
      canReorder: this.cfg.canReorder,
    };
    let next = planDrop(input);
    if (next.kind === 'nest' && next.held) {
      // la fascia centrale di un fratello vale «dentro» solo se il dito ci resta un attimo
      const c = this.cand;
      if (!c || c.id !== next.id) {
        this.cand = { id: next.id, since: Date.now() };
        this.later();
        next = reorderPlan(input);
      } else if (Date.now() - c.since < NEST_HOLD_MS) {
        this.later();
        next = reorderPlan(input);
      }
    } else this.cand = null;
    if (samePlan(next, this.plan)) return;
    this.plan = next;
    this.publish(id);
    haptic.tap();
  }

  private later() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.step();
    }, NEST_HOLD_MS + 20);
  }

  private stopScroll() {
    if (this.scrollTimer) clearInterval(this.scrollTimer);
    this.scrollTimer = null;
    this.scrollStep = 0;
  }

  private publish(id: string) {
    const parent = this.cfg.parentOf.get(id) ?? null;
    const byBlock =
      this.plan.kind === 'slot'
        ? shiftFor({ blocks: this.blocks, drag: id, index: this.plan.index })
        : new Map<string, number>();
    const shifts = new Map<string, number>();
    const carried = new Set<string>();
    for (const r of this.cfg.rows) {
      const owner = ownerAt(r.id, this.cfg.parentOf, parent);
      if (owner === id) carried.add(r.id);
      else if (owner) shifts.set(r.id, byBlock.get(owner) ?? 0);
    }
    this.setUi({ active: id, plan: this.plan, shifts, carried });
  }

  private finish(drop: boolean) {
    const id = this.armed;
    const plan = this.plan;
    this.armed = null;
    this.grabbed = false;
    this.cand = null;
    this.stopScroll();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.lift.set(0);
    this.plan = NONE;
    this.setUi(IDLE);
    this.bridge.lock(false);
    if (id && drop && plan.kind !== 'none') this.cfg.onDrop(id, plan);
  }
}

export interface RowDrag {
  ui: DragUi;
  /** di quanto il dito ha spostato la riga in mano (cambia a ogni movimento, senza rifare tutto l'elenco) */
  lift: LiftStore;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  /** va sul Pressable della riga: onLongPress */
  grab: (id: string) => void;
  /** va sul Pressable della riga: onPressOut */
  release: () => void;
  onRowLayout: (id: string, e: LayoutChangeEvent) => void;
  /** il contenitore delle righe, per misurare dove sta (callback del ref) */
  attach: (view: HostInstance | null) => void;
  /** un posto fuori dall'elenco dove si può lasciare una riga (callback del ref) */
  attachZone: (id: string, name: string) => (view: HostInstance | null) => void;
}

/** Trascinare una riga dell'elenco dei progetti (come sul sito: tocco lungo, poi la riga segue il dito). */
export function useRowDrag(cfg: DragConfig): RowDrag {
  const bridge = useScrollBridge();
  const [ui, setUi] = useState<DragUi>(IDLE);
  const [lift] = useState(() => new LiftStore());
  const [g] = useState(() => new RowDragGesture(cfg, bridge, lift, setUi));
  useEffect(() => {
    g.update(cfg, bridge);
  });
  return {
    ui,
    lift,
    panHandlers: g.responder.panHandlers,
    grab: (id) => g.arm(id),
    release: () => g.release(),
    onRowLayout: (id, e) => g.layout(id, e),
    attach: (view) => g.setContainer(view),
    attachZone: (id, name) => (view) => g.zone(id, name, view),
  };
}
