/** Le schede che possono stare nella barra in basso, nell'ordine di partenza. */
export const BAR_IDS = [
  'home',
  'planner',
  'todo',
  'buy',
  'pills',
  'habits',
  'pomodoro',
  'diary',
  'grades',
  'flashcards',
  'languages',
  'projects',
  'settings',
] as const;
export type BarId = (typeof BAR_IDS)[number];

/** Come l'utente ha disposto la barra: ordine di tutte, quelle fissate a sinistra, quelle nascoste. */
export interface BarPrefs {
  order: BarId[];
  pinned: BarId[];
  hidden: BarId[];
}

/** Di base: Home e Planner fissate, tutte le altre scorrevoli e in vista. */
export const DEFAULT_BAR: BarPrefs = {
  order: [...BAR_IDS],
  pinned: ['home', 'planner'],
  hidden: [],
};

/** «Altro» (le impostazioni) non si nasconde mai: è da lì che si cambia la barra. */
export const NEVER_HIDDEN: BarId = 'settings';

const isId = (v: unknown): v is BarId => (BAR_IDS as readonly unknown[]).includes(v);
const ids = (v: unknown): BarId[] => {
  const out: BarId[] = [];
  if (Array.isArray(v)) for (const x of v) if (isId(x) && !out.includes(x)) out.push(x);
  return out;
};

/** Rimette in ordine quello che si legge dal telefono: sconosciuti via, mancanti in coda, «Altro» sempre visibile. */
export function cleanBar(raw: unknown): BarPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_BAR;
  const r = raw as Record<string, unknown>;
  const order = ids(r.order);
  for (const id of BAR_IDS) if (!order.includes(id)) order.push(id);
  const pinned = ids(r.pinned);
  const hidden = ids(r.hidden).filter((id) => id !== NEVER_HIDDEN);
  return { order, pinned: pinned.filter((id) => !hidden.includes(id)), hidden };
}

/** Le due metà della barra: le fissate (a sinistra, ferme) e le altre (a destra, scorrevoli). */
export function barLayout(bar: BarPrefs): { pinned: BarId[]; scroll: BarId[] } {
  const shown = bar.order.filter((id) => !bar.hidden.includes(id));
  return {
    pinned: shown.filter((id) => bar.pinned.includes(id)),
    scroll: shown.filter((id) => !bar.pinned.includes(id)),
  };
}

/** Le tre liste mostrate nelle impostazioni: fissate, scorrevoli, nascoste (ognuna nell'ordine scelto). */
export function barSections(bar: BarPrefs): Record<'pinned' | 'scroll' | 'hidden', BarId[]> {
  return {
    ...barLayout(bar),
    hidden: bar.order.filter((id) => bar.hidden.includes(id)),
  };
}

export type BarMove =
  | { kind: 'pin'; id: BarId; on: boolean }
  | { kind: 'hide'; id: BarId; on: boolean }
  | { kind: 'shift'; id: BarId; by: -1 | 1 };

/** Applica una modifica dalle impostazioni e rende la barra nuova. */
export function moveBar(bar: BarPrefs, m: BarMove): BarPrefs {
  if (m.kind === 'pin') {
    const pinned = bar.pinned.filter((x) => x !== m.id);
    if (m.on) pinned.push(m.id);
    return cleanBar({ ...bar, pinned });
  }
  if (m.kind === 'hide') {
    if (m.id === NEVER_HIDDEN) return bar;
    const hidden = bar.hidden.filter((x) => x !== m.id);
    if (m.on) hidden.push(m.id);
    return cleanBar({ ...bar, hidden });
  }
  // sposta di un posto dentro la sua sezione (fissate, scorrevoli o nascoste): si scambia col vicino
  const sec = barSections(bar);
  const group = sec.pinned.includes(m.id)
    ? sec.pinned
    : sec.scroll.includes(m.id)
      ? sec.scroll
      : sec.hidden;
  const at = group.indexOf(m.id);
  const to = group[at + m.by];
  if (to === undefined) return bar;
  const order = [...bar.order];
  const a = order.indexOf(m.id);
  const b = order.indexOf(to);
  order[a] = to;
  order[b] = m.id;
  return cleanBar({ ...bar, order });
}
