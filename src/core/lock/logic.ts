/** Dopo quanto tempo in secondo piano l'app si richiude da sola (uscire un attimo per rispondere a un messaggio non deve chiedere il volto ogni volta). */
export const GRACE_MS = 30_000;

/**
 * Quando si torna nell'app: va richiesto lo sblocco? Sì se il blocco è acceso e l'app è rimasta in secondo piano più della
 * pausa concessa. `leftAt` è null se l'app non è mai uscita (primo avvio gestito a parte).
 */
export function shouldLock(p: {
  enabled: boolean;
  leftAt: number | null;
  now: number;
  graceMs?: number;
}): boolean {
  if (!p.enabled) return false;
  if (p.leftAt === null) return false;
  return p.now - p.leftAt >= (p.graceMs ?? GRACE_MS);
}

/** La schermata va coperta (selettore app, centro di controllo) quando il blocco è acceso e l'app non è in primo piano. */
export function shouldCover(p: { enabled: boolean; appState: string }): boolean {
  return p.enabled && p.appState !== 'active';
}
