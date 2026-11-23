import { subtreeIds, type Project } from './logic';

/**
 * La selezione multipla dei sotto-progetti, come sul sito (prToggleSubSelect): si può scegliere una riga a qualsiasi
 * livello. Scegliere un progetto sceglie anche tutti i suoi figli, che restano «bloccati» (si vedono spuntati ma non si
 * toccano); scegliendo un padre si tolgono i figli già scelti da soli, per non contarli due volte.
 */
export function lockedIds(all: Project[], picked: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of picked) for (const d of subtreeIds(all, id)) if (d !== id) out.add(d);
  return out;
}

/** Il nuovo elenco dopo un tocco su `id`; `null` se la riga è bloccata (il tocco non fa nulla). */
export function toggleSelection(all: Project[], picked: string[], id: string): string[] | null {
  if (lockedIds(all, picked).has(id)) return null;
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  const inside = new Set(subtreeIds(all, id));
  return [...picked.filter((x) => !inside.has(x)), id];
}

/** «Seleziona tutti»: se c'è già qualcosa si svuota, altrimenti si scelgono i figli diretti (i loro figli si bloccano da soli). */
export function toggleAll(picked: string[], topLevel: string[]): string[] {
  return picked.length ? [] : [...topLevel];
}
