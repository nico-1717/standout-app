import type { HabitSettings, HabitSettingsApi } from '@/features/habits/habitSettings';
import type { Settings, SettingsApi } from '../settings/settings';
import type { Mutation, PullResponse, PushResult, SyncApi } from '../sync/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Dà il token d'accesso valido (rinnovandolo se serve). L'implementazione vera sta in src/core/auth. */
export type TokenSupplier = () => Promise<string>;

/**
 * Il server visto dall'app, via fetch. Ogni chiamata porta la versione dell'app (il server può rispondere
 * 426 upgrade_required). Errori: HTTP non 2xx → ApiError col `code` del server.
 */
export class HttpSyncApi implements SyncApi, SettingsApi, HabitSettingsApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: TokenSupplier,
    private readonly appVersion = '0.0.0',
    private readonly platform = 'unknown',
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private async call<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await this.fetchFn(this.baseUrl.replace(/\/$/, '') + '/api/v1' + path, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
        'X-App-Version': this.appVersion,
        'X-App-Platform': this.platform,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* risposta non JSON (pagina d'errore del server): resta {} */
    }
    if (!res.ok || json.ok === false) {
      throw new ApiError(
        res.status,
        String(json.code ?? 'http_error'),
        String(json.error ?? `HTTP ${res.status}`),
      );
    }
    return json as T;
  }

  push(mutations: Mutation[]) {
    return this.call<{ results: PushResult[]; head: number }>('POST', '/sync/push', { mutations });
  }

  pull(cursor: string, limit: number) {
    return this.call<PullResponse>(
      'GET',
      `/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=${limit}`,
    );
  }

  async getSettings(): Promise<Settings> {
    return (await this.call<{ settings: Settings }>('GET', '/settings')).settings;
  }

  async putSettings(patch: Partial<Settings>): Promise<Settings> {
    return (await this.call<{ settings: Settings }>('PUT', '/settings', patch)).settings;
  }

  async getHabitSettings(): Promise<HabitSettings> {
    return (await this.call<{ settings: HabitSettings }>('GET', '/habits/settings')).settings;
  }

  async patchHabitSettings(patch: Partial<HabitSettings>): Promise<HabitSettings> {
    return (await this.call<{ settings: HabitSettings }>('PATCH', '/habits/settings', patch))
      .settings;
  }
}
