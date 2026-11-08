import type { SqlDb } from '@/core/db/sqldb';

import type { ImportParsed } from './importFile';
import { norm } from './importFile';
import type { HabitsRepo } from './repo';

/** I colori delle abitudini nuove, uno dopo l'altro (gli stessi del sito). */
const PALETTE = [
  '#7C5CFF',
  '#0A84FF',
  '#00C7BE',
  '#FF2D8F',
  '#FF9500',
  '#34C759',
  '#AF52DE',
  '#FF3B30',
];

export type ImportPlanRow = {
  key: string;
  name: string;
  /** quanti check-in nel file */
  checkins: number;
  /** quanti giorni diversi */
  days: number;
  /** l'abitudine che c'è già (stesso nome), o null se è nuova */
  existing: string | null;
};

/** Ogni abitudine del file con quante righe ha e se esiste già (stesso nome, senza badare a maiuscole e simboli). */
export function planImport(
  parsed: ImportParsed,
  current: { uuid: string; name: string }[],
): ImportPlanRow[] {
  const byName = new Map<string, string>();
  for (const h of current) if (!byName.has(norm(h.name))) byName.set(norm(h.name), h.uuid);
  return parsed.habits.map((h) => {
    const mine = parsed.logs.filter((l) => l.habitKey === h.key);
    return {
      key: h.key,
      name: h.name,
      checkins: mine.length,
      days: new Set(mine.map((l) => l.date)).size,
      existing: byName.get(norm(h.name)) ?? null,
    };
  });
}

export type ImportResult = { habits: number; days: number; checkins: number };

/**
 * Salva: le abitudini «collegate» (`link[key]` = uuid) usano quella che c'è, le altre si creano nuove con impostazioni
 * standard (a completamento, ogni giorno) e partono dal primo giorno del file. Tutto in una transazione: o c'è tutto o niente.
 */
export function saveImport(
  db: SqlDb,
  repo: HabitsRepo,
  parsed: ImportParsed,
  link: Record<string, string | null>,
): ImportResult {
  return db.transaction(() => {
    const ids = new Map<string, string>();
    let created = 0;
    for (const h of parsed.habits) {
      const linked = link[h.key];
      if (linked && repo.get(linked)) {
        ids.set(h.key, linked);
        continue;
      }
      const first = parsed.logs
        .filter((l) => l.habitKey === h.key)
        .reduce<string | null>((a, l) => (a === null || l.date < a ? l.date : a), null);
      const uuid = repo.create({
        name: h.name.slice(0, 120),
        color: PALETTE[created % PALETTE.length]!,
        ...(first ? { start_date: first } : {}),
      });
      ids.set(h.key, uuid);
      created++;
    }
    let days = 0;
    let checkins = 0;
    for (const [key, uuid] of ids) {
      const rows = parsed.logs.filter((l) => l.habitKey === key);
      days += repo.importLogs(uuid, rows);
      checkins += rows.length;
    }
    return { habits: created, days, checkins };
  });
}
