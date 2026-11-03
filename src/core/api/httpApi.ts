import type { HomeWidget } from '@/features/home/layout';
import type { DiarySettings, DiarySettingsApi } from '@/features/diary/settings';
import type { PlannerSettings, PlannerSettingsApi } from '@/features/planner/settings';
import type { GradeSettings } from '@/features/grades/logic';
import type { GradeSettingsApi } from '@/features/grades/settings';
import type { PomodoroSettings, PomodoroSettingsApi } from '@/features/pomodoro/settings';
import type { HabitSettings, HabitSettingsApi } from '@/features/habits/habitSettings';
import type { PutNoteResult, QuickNoteApi, ServerNote } from '@/features/notes/quickNote';
import type { Settings, SettingsApi } from '../settings/settings';
import type { Mutation, PullResponse, PushResult, SyncApi } from '../sync/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** il resto della risposta d'errore del server (es. la versione del server in un 409) */
    public readonly data: Record<string, unknown> = {},
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
export class HttpSyncApi
  implements
    SyncApi,
    SettingsApi,
    HabitSettingsApi,
    DiarySettingsApi,
    PlannerSettingsApi,
    PomodoroSettingsApi,
    GradeSettingsApi,
    QuickNoteApi
{
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
        json,
      );
    }
    return json as T;
  }

  push(mutations: Mutation[]) {
    return this.call<{ results: PushResult[]; head: number }>('POST', '/sync/push', { mutations });
  }

  async tables(): Promise<string[]> {
    const r = await this.call<{ tables: string[] }>('GET', '/sync/state');
    return r.tables;
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

  async getDiarySettings(): Promise<DiarySettings> {
    return (await this.call<{ settings: DiarySettings }>('GET', '/diary/settings')).settings;
  }

  async patchDiarySettings(patch: Partial<DiarySettings>): Promise<DiarySettings> {
    return (await this.call<{ settings: DiarySettings }>('PATCH', '/diary/settings', patch))
      .settings;
  }

  async getPlannerSettings(): Promise<PlannerSettings> {
    return (await this.call<{ settings: PlannerSettings }>('GET', '/planner/settings')).settings;
  }

  async patchPlannerSettings(patch: Partial<PlannerSettings>): Promise<PlannerSettings> {
    return (await this.call<{ settings: PlannerSettings }>('PATCH', '/planner/settings', patch))
      .settings;
  }

  async getHomeLayout(): Promise<HomeWidget[]> {
    return (await this.call<{ layout: HomeWidget[] }>('GET', '/home/layout')).layout;
  }

  async putHomeLayout(layout: HomeWidget[]): Promise<HomeWidget[]> {
    return (await this.call<{ layout: HomeWidget[] }>('PUT', '/home/layout', { layout })).layout;
  }

  async getPomodoroSettings(): Promise<PomodoroSettings> {
    return (await this.call<{ settings: PomodoroSettings }>('GET', '/pomodoro/settings')).settings;
  }

  async patchPomodoroSettings(patch: Partial<PomodoroSettings>): Promise<PomodoroSettings> {
    return (await this.call<{ settings: PomodoroSettings }>('PATCH', '/pomodoro/settings', patch))
      .settings;
  }

  async getGradeSettings(): Promise<GradeSettings> {
    return (await this.call<{ settings: GradeSettings }>('GET', '/university/settings')).settings;
  }

  async patchGradeSettings(patch: Partial<GradeSettings>): Promise<GradeSettings> {
    return (await this.call<{ settings: GradeSettings }>('PATCH', '/university/settings', patch))
      .settings;
  }

  async getQuickNote(): Promise<ServerNote> {
    return (await this.call<{ note: ServerNote }>('GET', '/notes/quick')).note;
  }

  /** 409 `conflict` non è un guasto: il server dice com'è la nota adesso e chi chiama decide. */
  async putQuickNote(body: string, base: string | null): Promise<PutNoteResult> {
    try {
      const r = await this.call<{ note: ServerNote }>('PUT', '/notes/quick', {
        body,
        base_updated_at: base,
      });
      return { conflict: false, note: r.note };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'conflict' && e.data.note)
        return { conflict: true, note: e.data.note as ServerNote };
      throw e;
    }
  }
}
