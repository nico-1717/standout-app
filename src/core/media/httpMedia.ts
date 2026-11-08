import { ApiError } from '../api/httpApi';
import type { TokenSupplier } from '../api/httpApi';
import { isMediaSlot, type MediaApi, type MediaTable } from './mediaQueue';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** I file delle righe, via la rotta `/api/v1/media/{tabella}/{uuid}/{campo}` (lib/media_api.php del sito). */
export class HttpMediaApi implements MediaApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: TokenSupplier,
    private readonly appVersion = '0.0.0',
    private readonly platform = 'unknown',
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private url(table: string, uuid: string, slot: string): string {
    if (!isMediaSlot(table, slot) || !UUID.test(uuid))
      throw new Error('Indirizzo del file non valido');
    return `${this.baseUrl.replace(/\/$/, '')}/api/v1/media/${table}/${uuid}/${slot}`;
  }

  private async send<T>(method: 'POST' | 'DELETE', url: string, body?: FormData): Promise<T> {
    const res = await this.fetchFn(url, {
      method,
      // niente Content-Type: lo mette fetch, con il confine del multipart
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'X-App-Version': this.appVersion,
        'X-App-Platform': this.platform,
      },
      body,
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* pagina d'errore del server */
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

  async put(
    table: MediaTable,
    uuid: string,
    slot: string,
    file: { uri: string; mime: string },
  ): Promise<{ name: string }> {
    const url = this.url(table, uuid, slot);
    const form = new FormData();
    // in React Native un file si manda come {uri, name, type}
    form.append('file', {
      uri: file.uri,
      name: `upload.${EXT[file.mime] ?? 'bin'}`,
      type: file.mime,
    } as unknown as Blob);
    const r = await this.send<{ name?: unknown }>('POST', url, form);
    if (typeof r.name !== 'string' || !r.name)
      throw new ApiError(500, 'bad_response', 'No file name');
    return { name: r.name };
  }

  async remove(table: MediaTable, uuid: string, slot: string): Promise<void> {
    await this.send('DELETE', this.url(table, uuid, slot));
  }
}
