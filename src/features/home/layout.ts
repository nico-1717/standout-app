import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/** I riquadri della Home nell'ordine di partenza (HO_RIQUADRI di lib/home_layout.php). */
export const HOME_WIDGETS = [
  'shortcuts',
  'agenda',
  'note',
  'cards',
  'projects',
  'grades',
  'trivia',
  'stats',
] as const;
export type HomeWidgetId = (typeof HOME_WIDGETS)[number];

export interface HomeWidget {
  id: HomeWidgetId;
  on: boolean;
  /** solo per «shortcuts»: l'ordine dei tasti (gli href del sito) */
  order?: string[];
}

export const DEFAULT_HOME_LAYOUT: HomeWidget[] = HOME_WIDGETS.map((id) => ({ id, on: true }));

/** Stessa pulizia del server (ho_layout): id sconosciuti e doppioni via, quelli che mancano in fondo, accesi. */
export function cleanHomeLayout(raw: unknown): HomeWidget[] {
  const out: HomeWidget[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const r = (v ?? {}) as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id : '';
      if (!(HOME_WIDGETS as readonly string[]).includes(id) || seen.has(id)) continue;
      seen.add(id);
      const w: HomeWidget = { id: id as HomeWidgetId, on: !!r.on };
      if (id === 'shortcuts' && Array.isArray(r.order)) {
        const order = [
          ...new Set(
            r.order.filter(
              (h): h is string => typeof h === 'string' && /^[A-Za-z0-9_/.-]{1,60}$/.test(h),
            ),
          ),
        ].slice(0, 20);
        if (order.length) w.order = order;
      }
      out.push(w);
    }
  }
  for (const id of HOME_WIDGETS) if (!seen.has(id)) out.push({ id, on: true });
  return out;
}

export interface HomeLayoutApi {
  getHomeLayout(): Promise<HomeWidget[]>;
  putHomeLayout(layout: HomeWidget[]): Promise<HomeWidget[]>;
}

const KEY = 'home_layout';
const DIRTY = 'home_layout_dirty';

/** La Home sul telefono: si cambia subito, anche senza rete; l'elenco intero va al server quando c'è rete (l'ultimo che scrive vince). */
export class HomeLayoutStore {
  constructor(private readonly db: SqlDb) {}

  read(): HomeWidget[] {
    try {
      const raw = getState(this.db, KEY);
      return raw ? cleanHomeLayout(JSON.parse(raw)) : DEFAULT_HOME_LAYOUT;
    } catch {
      return DEFAULT_HOME_LAYOUT;
    }
  }

  write(layout: HomeWidget[]): HomeWidget[] {
    const next = cleanHomeLayout(layout);
    setState(this.db, KEY, JSON.stringify(next));
    setState(this.db, DIRTY, '1');
    return next;
  }

  hasPending(): boolean {
    return getState(this.db, DIRTY) === '1';
  }

  async sync(api: HomeLayoutApi): Promise<HomeWidget[]> {
    if (this.hasPending()) {
      const sent = JSON.stringify(this.read());
      const server = cleanHomeLayout(await api.putHomeLayout(this.read()));
      // se nel frattempo è cambiato ancora, resta «da inviare» e vale quello nuovo
      if (JSON.stringify(this.read()) === sent) {
        setState(this.db, KEY, JSON.stringify(server));
        setState(this.db, DIRTY, '0');
        return server;
      }
      return this.read();
    }
    const server = cleanHomeLayout(await api.getHomeLayout());
    setState(this.db, KEY, JSON.stringify(server));
    return server;
  }
}
