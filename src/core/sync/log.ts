/**
 * Il registro di sincronizzazione: le ultime righe di ciò che l'app ha chiesto al server e di ciò che è tornato
 * (indirizzo, durata, esito, dimensione). Resta in memoria e si vede nella pagina «Sincronizzazione», dove si può
 * copiare o condividere: serve a capire un guasto senza dover leggere i log del server.
 */
const MAX_LINES = 150;
const lines: string[] = [];
/** la copia che si legge: se ne fa una nuova solo quando il registro cambia (serve a useSyncExternalStore) */
let snapshot: string[] = [];
const listeners = new Set<() => void>();

const two = (n: number) => String(n).padStart(2, '0');

export function logSync(text: string, now: Date = new Date()): void {
  const stamp = `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
  lines.push(`${stamp} ${text.replace(/\s+/g, ' ').slice(0, 400)}`);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  snapshot = lines.slice();
  listeners.forEach((l) => l());
}

export function getSyncLog(): string[] {
  return snapshot;
}

export function clearSyncLog(): void {
  lines.length = 0;
  snapshot = [];
  listeners.forEach((l) => l());
}

export function subscribeSyncLog(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
