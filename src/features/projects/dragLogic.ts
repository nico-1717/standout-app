/**
 * Il riordino a mano dei sotto-progetti (progetti.php, «Trascinare una riga»): dove sta il dito e cosa succede se si lascia.
 * Solo regole, senza schermo: le misure arrivano dalle righe e il risultato dice se la riga cambia posto fra i fratelli
 * o va dentro un altro progetto.
 */

/** Una riga misurata, nelle coordinate del contenuto della pagina. */
export interface RowBox {
  id: string;
  parent: string | null;
  top: number;
  height: number;
}

/** Un posto fuori dall'elenco dove si può lasciare la riga (l'etichetta «Sotto-progetti», le briciole). */
export interface OutsideBox {
  id: string;
  name: string;
  top: number;
  height: number;
}

export type DropPlan =
  /** niente da fare: la riga torna dov'era */
  | { kind: 'none' }
  /** fra i fratelli: `index` è il posto fra gli altri (senza la riga in mano), da 0 a quanti sono */
  | { kind: 'slot'; index: number }
  /** dentro un altro progetto; `held` = la fascia centrale di un fratello va tenuta un attimo prima di valere */
  | { kind: 'nest'; id: string; name: string | null; held: boolean };

/** La fascia centrale di un fratello, dove lasciare la riga vuol dire «dentro» (come sul sito: dal 27% al 73%). */
export const NEST_BAND = { from: 0.27, to: 0.73 };
/** Quanto si tiene il dito nella fascia centrale prima che valga «dentro». */
export const NEST_HOLD_MS = 280;
/** Quanto si tiene premuto prima che la riga si stacchi. */
export const GRAB_MS = 380;

export interface PlanInput {
  /** tutte le righe visibili, in ordine di elenco */
  boxes: RowBox[];
  /** i posti fuori dall'elenco */
  outside: OutsideBox[];
  /** la riga in mano e il suo padre */
  drag: string;
  parent: string | null;
  /** lei e i suoi discendenti: non ci si può entrare dentro */
  blocked: ReadonlySet<string>;
  /** dove sta il dito, nelle coordinate del contenuto */
  y: number;
  /** il riordino è consentito (ordine «manuale»)? */
  canReorder: boolean;
}

/** Cosa succederebbe lasciando la riga con il dito a `y`. */
export function planDrop(p: PlanInput): DropPlan {
  // fuori dall'elenco (etichetta, briciole): dentro, subito, se non ci è già
  for (const o of p.outside) {
    if (p.y >= o.top && p.y <= o.top + o.height) {
      if (o.id === p.parent || p.blocked.has(o.id)) return { kind: 'none' };
      return { kind: 'nest', id: o.id, name: o.name, held: false };
    }
  }

  const hit = p.boxes.find((b) => p.y >= b.top && p.y < b.top + b.height);
  if (!hit) return reorderPlan(p);
  // sopra sé stessa, un suo discendente o il padre che ha già: si riordina e basta
  if (p.blocked.has(hit.id) || hit.id === p.parent) return reorderPlan(p);
  if (hit.parent !== p.parent) return { kind: 'nest', id: hit.id, name: null, held: false };
  const rel = (p.y - hit.top) / Math.max(1, hit.height);
  if (rel > NEST_BAND.from && rel < NEST_BAND.to) {
    return { kind: 'nest', id: hit.id, name: null, held: true };
  }
  return reorderPlan(p);
}

/** Il posto fra i fratelli (senza guardare se il dito è sopra un progetto): davanti al primo che ha la metà sotto il dito. */
export function reorderPlan(p: PlanInput): DropPlan {
  if (!p.canReorder) return { kind: 'none' };
  const sibs = p.boxes.filter((b) => b.parent === p.parent && b.id !== p.drag);
  let index = sibs.length;
  for (let i = 0; i < sibs.length; i++) {
    const s = sibs[i]!;
    if (p.y < s.top + s.height / 2) {
      index = i;
      break;
    }
  }
  return { kind: 'slot', index };
}

/**
 * Di quanto si sposta ogni riga mentre un'altra è in mano: i fratelli fra il posto vecchio e il nuovo scivolano di
 * un'altezza, la riga in mano (e chi sta dentro) segue il dito. `owner` è il fratello da cui discende ogni riga.
 */
export function shiftFor(opts: {
  /** i fratelli (tutti, in ordine) con la parte di elenco che occupano: la riga e i suoi discendenti visibili */
  blocks: { id: string; top: number; height: number }[];
  drag: string;
  index: number;
}): Map<string, number> {
  const out = new Map<string, number>();
  const from = opts.blocks.findIndex((b) => b.id === opts.drag);
  if (from < 0) return out;
  const lifted = opts.blocks[from]!;
  const rest = opts.blocks.filter((b) => b.id !== opts.drag);
  const to = Math.max(0, Math.min(rest.length, opts.index));
  for (let i = 0; i < rest.length; i++) {
    const b = rest[i]!;
    // chi stava prima del posto vecchio ma ora è dopo il nuovo (e viceversa) scivola di un'altezza
    if (i >= from && i < to) out.set(b.id, -lifted.height);
    else if (i < from && i >= to) out.set(b.id, lifted.height);
    else out.set(b.id, 0);
  }
  return out;
}

/** Il padre di ogni riga di cui si dà il percorso: a quale fratello (a livello `parent`) appartiene `uuid`. */
export function ownerAt(
  uuid: string,
  parentOf: ReadonlyMap<string, string | null>,
  parent: string | null,
): string | null {
  let cur: string | null = uuid;
  for (let guard = 0; cur && guard < 60; guard++) {
    const up: string | null | undefined = parentOf.get(cur);
    if (up === undefined) return null;
    if (up === parent) return cur;
    cur = up;
  }
  return null;
}
