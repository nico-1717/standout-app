import { ApiError } from '../api/httpApi';
import type { SyncReport } from './engine';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncAt: number | null;
  /** Quante modifiche aspettano ancora di essere inviate. */
  pending: number;
}

export interface SchedulerDeps {
  syncOnce: () => Promise<SyncReport>;
  pendingCount: () => number;
  /** Rinnova il token d'accesso (serve se il server risponde token_expired per orologi sfasati). */
  refreshToken: () => Promise<unknown>;
  now?: () => number;
  random?: () => number;
}

export const DEBOUNCE_MS = 2_000;
export const POLL_MS = 60_000;
const BACKOFF_START_MS = 5_000;
const BACKOFF_MAX_MS = 300_000;

/**
 * Decide QUANDO sincronizzare (il motore decide COSA). Si sincronizza:
 *  - 2 secondi dopo una modifica (il ritardo raggruppa più modifiche ravvicinate in un solo invio);
 *  - quando l'app torna in primo piano e quando torna la rete (li chiama chi ascolta il sistema);
 *  - ogni 60 secondi finché l'app è aperta.
 * Se fallisce, riprova con attese crescenti (5 s, 10 s, 20 s… fino a 5 min) più un po' di casualità,
 * così migliaia di telefoni non tornano tutti insieme su un server appena ripartito.
 * Se non c'è rete non spreca tentativi: aspetta che qualcuno lo avvisi con `setOnline(true)`.
 */
export class SyncScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private failures = 0;
  private online = true;
  private stopped = true;
  private info: SyncStatusInfo = { status: 'idle', lastSyncAt: null, pending: 0 };
  private listeners = new Set<(i: SyncStatusInfo) => void>();
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly d: SchedulerDeps) {
    this.now = d.now ?? (() => Date.now());
    this.random = d.random ?? Math.random;
    this.info.pending = d.pendingCount();
  }

  getInfo(): SyncStatusInfo {
    return this.info;
  }

  subscribe(fn: (i: SyncStatusInfo) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncStatusInfo>) {
    this.info = { ...this.info, ...patch };
    this.listeners.forEach((l) => l(this.info));
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.poll = setInterval(() => this.trigger(0), POLL_MS);
    this.trigger(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.poll) clearInterval(this.poll);
    this.timer = null;
    this.poll = null;
  }

  /** Il sistema ci dice se c'è rete. Quando torna, si sincronizza subito e si azzera il backoff. */
  setOnline(online: boolean): void {
    const was = this.online;
    this.online = online;
    if (!online) this.set({ status: 'offline' });
    else if (!was) {
      this.failures = 0;
      this.trigger(0);
    }
  }

  /** Dopo una modifica locale (o app in primo piano): sincronizza fra `delay` ms. */
  trigger(delay: number = DEBOUNCE_MS): void {
    if (this.stopped) return;
    this.set({ pending: this.d.pendingCount() });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delay);
  }

  private async run(): Promise<void> {
    this.timer = null;
    if (this.stopped) return;
    if (!this.online) return this.set({ status: 'offline' });
    this.set({ status: 'syncing' });
    try {
      await this.attempt();
      this.failures = 0;
      this.set({ status: 'idle', lastSyncAt: this.now(), pending: this.d.pendingCount() });
    } catch (e) {
      this.failures++;
      const sessionClosed =
        e instanceof ApiError && (e.code === 'token_reused' || e.code === 'invalid_token');
      const offline = e instanceof TypeError; // fetch senza rete lancia TypeError
      this.set({
        status: offline ? 'offline' : 'error',
        pending: this.d.pendingCount(),
      });
      if (sessionClosed) return this.stop(); // l'AuthService porta alla schermata di login
      if (this.stopped) return;
      const base = Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** (this.failures - 1));
      const jitter = base * 0.2 * this.random();
      this.timer = setTimeout(() => void this.run(), base + jitter);
    }
  }

  private async attempt(): Promise<void> {
    try {
      await this.d.syncOnce();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'token_expired') {
        await this.d.refreshToken();
        await this.d.syncOnce();
        return;
      }
      throw e;
    }
  }
}
