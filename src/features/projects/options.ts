import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/** Le scelte della pagina «Progetti» (progetti_opzioni del sito). Stesse chiavi e stessi valori di partenza. */
export interface ProjectOptions {
  completati: boolean;
  ordine: 'manuale' | 'alfabetico' | 'recenti' | 'scadenza';
  ricorda_rami: boolean;
  mostra_tag: boolean;
  solo_attivi: boolean;
}

export const DEFAULT_PROJECT_OPTIONS: ProjectOptions = {
  completati: true,
  ordine: 'manuale',
  ricorda_rami: false,
  mostra_tag: true,
  solo_attivi: false,
};

const ORDERS = ['manuale', 'alfabetico', 'recenti', 'scadenza'] as const;
const bool = (v: unknown, d: boolean) =>
  typeof v === 'boolean' ? v : v === 0 || v === 1 ? !!v : d;

export function cleanProjectOptions(raw: unknown): ProjectOptions {
  const r = (raw ?? {}) as Record<string, unknown>;
  const D = DEFAULT_PROJECT_OPTIONS;
  return {
    completati: bool(r.completati, D.completati),
    ordine: ORDERS.includes(r.ordine as (typeof ORDERS)[number])
      ? (r.ordine as ProjectOptions['ordine'])
      : D.ordine,
    ricorda_rami: bool(r.ricorda_rami, D.ricorda_rami),
    mostra_tag: bool(r.mostra_tag, D.mostra_tag),
    solo_attivi: bool(r.solo_attivi, D.solo_attivi),
  };
}

const OPTIONS = 'projects_options';
const BRANCHES = 'projects_collapsed';

/**
 * Le scelte della pagina e i rami chiusi, tenuti sul telefono. (Sul sito stanno in `planner_settings`; l'API delle
 * impostazioni non le porta ancora: finché non lo fa, ogni apparecchio ha le sue.)
 */
export class ProjectOptionsStore {
  constructor(private readonly db: SqlDb) {}

  read(): ProjectOptions {
    try {
      const raw = getState(this.db, OPTIONS);
      return raw ? cleanProjectOptions(JSON.parse(raw)) : DEFAULT_PROJECT_OPTIONS;
    } catch {
      return DEFAULT_PROJECT_OPTIONS;
    }
  }

  write(patch: Partial<ProjectOptions>): ProjectOptions {
    const next = cleanProjectOptions({ ...this.read(), ...patch });
    setState(this.db, OPTIONS, JSON.stringify(next));
    return next;
  }

  /** I rami chiusi. Se «ricorda i rami» è spento, si parte sempre con tutti chiusi (come il sito). */
  collapsed(): Set<string> | null {
    try {
      const raw = getState(this.db, BRANCHES);
      return raw ? new Set<string>(JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  }

  saveCollapsed(ids: Iterable<string>): void {
    setState(this.db, BRANCHES, JSON.stringify([...ids]));
  }
}
