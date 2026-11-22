import { branchOf, isAncestorOfSel, type DayMark } from './calendarGrid';
import type { PlanBlock } from './repo';
import type { CalendarNode } from './view';

/**
 * Cosa c'è in ogni giorno, per le linee (prima erano i pallini di renderCalendar del sito).
 * - Nessun progetto scelto: tutto quello che c'è, ognuno col suo colore (un colore una volta sola per giorno, massimo 6).
 * - Un progetto scelto: gli ALTRI progetti della fila (non lui né i suoi antenati: il suo colore li contiene già).
 * Evidenziato a mano = linea piena; solo pianificato = linea più chiara (`soft`).
 */
export function dayMarks(a: {
  cells: string[];
  nodes: CalendarNode[];
  current: string | null;
  /** i progetti delle file di pastiglie visibili */
  rowIds: string[];
  paint: ReadonlyMap<string, ReadonlySet<string>>;
  plan: PlanBlock[];
}): DayMark[][] {
  // «giorno|progetto» con ore di studio: una volta sola, invece di rileggere tutto il piano per ogni casella
  const studied = new Set<string>();
  for (const b of a.plan) if (b.kind === 'study' && b.minutes > 0) studied.add(`${b.day}|${b.project}`);
  const byId = new Map(a.nodes.map((n) => [n.project, n]));
  const branches = new Map<string, string[]>();
  const branch = (id: string) => {
    let b = branches.get(id);
    if (!b) {
      b = branchOf(a.nodes, id);
      branches.set(id, b);
    }
    return b;
  };

  return a.cells.map((d) => {
    const out: DayMark[] = [];
    if (!a.current) {
      const seen = new Map<string, { mark: DayMark; state: number }>();
      for (const n of a.nodes) {
        const pa = a.paint.get(n.project)?.has(d) ?? false;
        const pl = studied.has(`${d}|${n.project}`);
        if (!pa && !pl) continue;
        const prev = seen.get(n.color);
        if (prev && (prev.state === 2 || !pa)) continue;
        if (seen.size >= 6 && !prev) continue;
        seen.set(n.color, {
          mark: { id: n.project, color: n.color, soft: !pa },
          state: pa ? 2 : 1,
        });
      }
      for (const v of seen.values()) out.push(v.mark);
      return out;
    }
    for (const id of a.rowIds) {
      if (id === a.current || isAncestorOfSel(a.nodes, a.current, id)) continue;
      const n = byId.get(id);
      if (!n) continue;
      const pa = a.paint.get(id)?.has(d) ?? false;
      const pl = branch(id).some((x) => studied.has(`${d}|${x}`));
      if (pa || pl) out.push({ id, color: n.color, soft: !pa });
    }
    return out;
  });
}
