import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

import { cleanReminders, DEFAULT_REMINDERS, type ReminderSettings } from './plan';

const KEY = 'reminders';

/**
 * Le scelte sui promemoria stanno SOLO su questo telefono (non si sincronizzano): le notifiche sono del telefono,
 * e due telefoni dello stesso utente non devono suonare due volte per la stessa pastiglia se uno non lo vuole.
 */
export class RemindersStore {
  constructor(private readonly db: SqlDb) {}

  read(): ReminderSettings {
    const raw = getState(this.db, KEY);
    try {
      return raw ? cleanReminders(JSON.parse(raw)) : DEFAULT_REMINDERS;
    } catch {
      return DEFAULT_REMINDERS;
    }
  }

  update(patch: Partial<ReminderSettings>): ReminderSettings {
    const next = cleanReminders({ ...this.read(), ...patch });
    setState(this.db, KEY, JSON.stringify(next));
    return next;
  }
}
