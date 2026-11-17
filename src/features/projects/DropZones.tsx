import { createContext, useContext, useSyncExternalStore } from 'react';
import type { HostInstance } from 'react-native';

/** Un posto dove si può lasciare una riga in mano, fuori dall'elenco: una briciola o una pastiglia in alto. */
export interface DropZone {
  /** il progetto in cui finisce la riga */
  id: string;
  name: string;
  view: HostInstance;
  /** sta fermo mentre la pagina scorre (l'intestazione), quindi si misura sullo schermo e non sul contenuto */
  fixed: boolean;
}

/**
 * I posti di rilascio che la pagina offre alle righe trascinate (come `.pr-crumb[data-drop-id]` e `.hdr-root-pill`
 * del sito) e quale è «acceso» in questo momento. Il trascinamento li misura quando parte e li accende al passaggio.
 */
export class DropZones {
  private readonly zones = new Map<string, DropZone>();
  private lit: string | null = null;
  private readonly listeners = new Set<() => void>();

  /** chiave diversa per ogni posto (lo stesso progetto può essere briciola e pastiglia insieme) */
  put(key: string, zone: Omit<DropZone, 'view'> & { view: HostInstance | null }) {
    if (zone.view) this.zones.set(key, { ...zone, view: zone.view });
    else this.zones.delete(key);
  }

  list(): DropZone[] {
    return [...this.zones.values()];
  }

  /** il progetto su cui la riga in mano finirebbe adesso, o null */
  readonly target = () => this.lit;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  light(id: string | null) {
    if (id === this.lit) return;
    this.lit = id;
    this.listeners.forEach((fn) => fn());
  }
}

const NOBODY = new DropZones();
export const DropZonesContext = createContext<DropZones>(NOBODY);
export const useDropZones = () => useContext(DropZonesContext);

/** Per un pezzo della pagina che è anche un posto di rilascio: il ref da dargli e se è «acceso» ora. */
export function useDropZone(key: string, id: string, name: string, fixed: boolean) {
  const zones = useDropZones();
  const lit = useSyncExternalStore(zones.subscribe, () => zones.target() === id);
  return {
    lit,
    attach: (view: HostInstance | null) => zones.put(key, { id, name, fixed, view }),
  };
}
