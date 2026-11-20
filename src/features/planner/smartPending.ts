import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

const KEY = 'smart_pending';

/** Una frase della barra intelligente che aspetta una risposta («19 doccia»: data o ora?). */
export interface SmartPendingItem {
  id: string;
  text: string;
  /** il giorno che si guardava quando è stata scritta: se è un'ora, l'evento va lì */
  focusDate: string;
}

/**
 * La coda delle frasi senza risposta. Sta sul telefono (non si sincronizza): se l'app si chiude prima di rispondere,
 * la domanda torna alla prossima apertura, e le notifiche ricordano di rispondere.
 */
export class SmartPendingStore {
  constructor(private readonly db: SqlDb) {}

  list(): SmartPendingItem[] {
    try {
      const raw = JSON.parse(getState(this.db, KEY) ?? '[]') as unknown;
      if (!Array.isArray(raw)) return [];
      return raw.filter(
        (r): r is SmartPendingItem =>
          !!r &&
          typeof r.id === 'string' &&
          typeof r.text === 'string' &&
          typeof r.focusDate === 'string',
      );
    } catch {
      return [];
    }
  }

  private save(items: SmartPendingItem[]) {
    setState(this.db, KEY, JSON.stringify(items));
  }

  add(text: string, focusDate: string): SmartPendingItem {
    const item = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      text,
      focusDate,
    };
    this.save([...this.list(), item]);
    return item;
  }

  setText(id: string, text: string) {
    this.save(this.list().map((i) => (i.id === id ? { ...i, text } : i)));
  }

  remove(id: string) {
    this.save(this.list().filter((i) => i.id !== id));
  }
}
