/** Le regole dei progetti, senza database: l'albero, il colore ereditato, i cicli. Stesse regole di progetti.php. */

export const PROJECT_STATUSES = ['in_progress', 'completed', 'planned'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Il colore di un progetto che non ne ha scelto uno. */
export const DEFAULT_PROJECT_COLOR = '#8E8E93';

export interface Project {
  uuid: string;
  parent_uuid: string | null;
  name: string;
  notes: string;
  status: ProjectStatus;
  color: string;
  color_edited: number;
  target_date: string | null;
  due_date: string | null;
  todo_enabled: number;
  is_favorite: number;
  sort_key: string;
  study_event_uuid: string | null;
  study_start: string | null;
  study_end: string | null;
  study_pomodori_stimati: number | null;
  study_ripasso_di_uuid: string | null;
  study_ripasso_n: number | null;
  created_at: string | null;
}

export type ProjectMap = Map<string, Project>;

export const byId = (all: Project[]): ProjectMap => new Map(all.map((p) => [p.uuid, p]));

/** Il colore che un progetto eredita da questo padre (prog_resolve_color): il primo antenato col colore scelto a mano. */
export function inheritedColor(all: ProjectMap, parentUuid: string | null): string {
  let cur = parentUuid;
  for (let guard = 0; cur && guard < 50; guard++) {
    const p = all.get(cur);
    if (!p) break;
    if (p.color_edited && p.color) return p.color;
    cur = p.parent_uuid;
  }
  return DEFAULT_PROJECT_COLOR;
}

/** I figli diretti, nell'ordine scelto. */
export function childrenOf(all: Project[], parentUuid: string | null): Project[] {
  return all
    .filter((p) => p.parent_uuid === parentUuid)
    .sort((a, b) => (a.sort_key < b.sort_key ? -1 : a.sort_key > b.sort_key ? 1 : 0));
}

/** Il progetto e tutti i suoi discendenti (prog_subtree_ids). */
export function subtreeIds(all: Project[], rootUuid: string): string[] {
  const kids = new Map<string | null, string[]>();
  for (const p of all) kids.set(p.parent_uuid, [...(kids.get(p.parent_uuid) ?? []), p.uuid]);
  const out: string[] = [];
  const stack = [rootUuid];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.includes(cur)) continue; // una sicurezza contro i cicli
    out.push(cur);
    for (const k of kids.get(cur) ?? []) stack.push(k);
  }
  return out;
}

/** Spostare `uuid` sotto `target` farebbe un ciclo? (target è lui stesso o un suo discendente) */
export function wouldCycle(all: Project[], uuid: string, target: string | null): boolean {
  if (!target) return false;
  return subtreeIds(all, uuid).includes(target);
}

/** La catena dei padri, dalla radice al padre diretto. */
export function ancestors(all: ProjectMap, uuid: string): Project[] {
  const out: Project[] = [];
  let cur = all.get(uuid)?.parent_uuid ?? null;
  for (let guard = 0; cur && guard < 60; guard++) {
    const p = all.get(cur);
    if (!p) break;
    out.unshift(p);
    cur = p.parent_uuid;
  }
  return out;
}

/** Il prossimo stato nel giro del sito: in corso → completato → pianificato → in corso. */
export function nextStatus(s: ProjectStatus): ProjectStatus {
  const i = PROJECT_STATUSES.indexOf(s);
  return PROJECT_STATUSES[(i < 0 ? 0 : i + 1) % PROJECT_STATUSES.length]!;
}

export interface TreeRow {
  project: Project;
  depth: number;
  hasChildren: boolean;
  done: number;
  total: number;
}

export interface TreeOptions {
  /** i progetti completati si vedono? */
  showCompleted: boolean;
  /** «solo quelli con pomodori»: i progetti che vi compaiono (da `withSessions`); null = tutti */
  onlyWorked: ReadonlySet<string> | null;
  order: 'manuale' | 'alfabetico' | 'recenti' | 'scadenza';
  /** i rami chiusi: i loro figli non si elencano */
  collapsed: ReadonlySet<string>;
}

/** L'albero come righe in fila, secondo le opzioni della pagina «Progetti». */
export function flatten(all: Project[], o: TreeOptions): TreeRow[] {
  const sorter = (a: Project, b: Project) => {
    if (o.order === 'alfabetico')
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    if (o.order === 'recenti') return (b.created_at ?? '') < (a.created_at ?? '') ? -1 : 1;
    if (o.order === 'scadenza') {
      // come sul sito: la scadenza, se manca la data obiettivo; chi non ha date va in fondo
      const da = a.due_date ?? a.target_date ?? '9999-99-99';
      const db = b.due_date ?? b.target_date ?? '9999-99-99';
      return da === db ? (a.sort_key < b.sort_key ? -1 : 1) : da < db ? -1 : 1;
    }
    return a.sort_key < b.sort_key ? -1 : a.sort_key > b.sort_key ? 1 : 0;
  };
  const kids = new Map<string | null, Project[]>();
  for (const p of all) kids.set(p.parent_uuid, [...(kids.get(p.parent_uuid) ?? []), p]);
  const visible = (p: Project) =>
    !(o.onlyWorked && !o.onlyWorked.has(p.uuid)) && !(!o.showCompleted && p.status === 'completed');
  const out: TreeRow[] = [];
  const walk = (parent: string | null, depth: number) => {
    const list = (kids.get(parent) ?? []).sort(sorter);
    for (const p of list) {
      if (!visible(p)) continue;
      const all2 = kids.get(p.uuid) ?? [];
      out.push({
        project: p,
        depth,
        hasChildren: all2.length > 0,
        total: all2.length,
        done: all2.filter((c) => c.status === 'completed').length,
      });
      if (!o.collapsed.has(p.uuid)) walk(p.uuid, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** I progetti che hanno almeno un Pomodoro loro o in un sotto-progetto: quelli che «solo quelli con pomodori» lascia vedere. */
export function withSessions(all: Project[], sessionProjects: Iterable<string>): Set<string> {
  const map = byId(all);
  const out = new Set<string>();
  for (const id of sessionProjects) {
    let cur: string | null = id;
    for (let guard = 0; cur && guard < 60 && !out.has(cur); guard++) {
      if (!map.has(cur)) break;
      out.add(cur);
      cur = map.get(cur)!.parent_uuid;
    }
  }
  return out;
}
