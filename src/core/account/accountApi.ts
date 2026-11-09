import type { AiBook, AiList, AiReport } from '@/features/diary/aiReading';
import type { Insights } from '@/features/diary/insights';

import { ApiError } from '../api/httpApi';

/**
 * Le chiamate dell'account che non sono sincronizzazione: cambio password, scarica i miei dati, elimina
 * l'account, dispositivi, rinvio della verifica email. Sono le STESSE pagine del sito (`/account/*.php`), che
 * accettano anche il token dell'app: quindi stesse regole, stessi limiti di frequenza, stessa password richiesta.
 */

export interface Device {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
  current: boolean;
}

/** Un errore di controllo con i testi del server per campo (`errori: { nuova: '...' }`). */
export class FieldsError extends ApiError {
  constructor(
    status: number,
    code: string,
    message: string,
    public readonly fields: Record<string, string>,
  ) {
    super(status, code, message);
  }
}

/** Una voce dei consumi dell'IA: usato nel mese e limite del piano (null = illimitato). */
export interface AiMeter {
  used: number;
  limit: number | null;
}

export interface AiUsage {
  name: string;
  /** il primo giorno del mese dopo, `AAAA-MM-GG` */
  resets: string;
  audio: AiMeter;
  images: AiMeter;
  tokens: AiMeter;
}

/** Lo spazio dei file (immagini e audio) sul sito: usato e limite, in byte. */
export interface StorageUsage {
  used: number;
  quota: number;
}

/** La risposta di `/planner/diario_ai.php`: gli errori attesi (crediti finiti, troppo poco scritto…) sono risposte, non guasti. */
export type DiaryAiReply = {
  ok: boolean;
  error?: string;
  /** l'IA ha sbagliato ma non ha addebitato niente: si può riprovare */
  riprovabile?: boolean;
  /** crediti stimati / disponibili */
  stima?: number;
  /** `null` = il piano non ha un limite */
  disponibili?: number | null;
  sufficiente?: boolean;
  id?: number;
  titolo?: string;
  capitoli?: string[];
  pezzi?: number;
  fatto?: boolean;
  fatti?: number;
  totale?: number;
  capitolo?: string;
  crediti?: number;
  libro_possibile?: boolean;
};

/** Un posto proposto dalla ricerca. Le coordinate ci sono già solo con la scorta (OpenStreetMap); con Google arrivano dopo. */
export interface PlaceHit {
  name: string;
  detail: string;
  full: string;
  ref: string;
  lat: number | null;
  lon: number | null;
}

/** Le coordinate del posto scelto. */
export interface PlacePoint {
  lat: number;
  lon: number;
  full: string;
  ref: string;
}

export type TokenSupplier = () => Promise<string>;

export class AccountApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: TokenSupplier,
    private readonly appVersion = '0.0.0',
    private readonly platform = 'unknown',
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private async send(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<Response> {
    return this.fetchFn(this.baseUrl.replace(/\/$/, '') + path, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
        'X-App-Version': this.appVersion,
        'X-App-Platform': this.platform,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** La risposta come JSON; un errore diventa ApiError (o FieldsError se il server dice quale campo). */
  private async json<T>(res: Response): Promise<T> {
    const text = await res.text();
    let j: Record<string, unknown> = {};
    try {
      j = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* pagina d'errore del server: resta {} */
    }
    // il sito risponde {success:true} o {ok:true}; gli errori {ok:false,error,message} o {success:false,errori}
    const failed = !res.ok || j.ok === false || j.success === false;
    if (!failed) return j as T;
    const fields = j.errori as Record<string, string> | undefined;
    const msg = String(j.message ?? j.error ?? `HTTP ${res.status}`);
    const code = String(j.code ?? (typeof j.error === 'string' ? j.error : 'http_error'));
    if (fields && typeof fields === 'object') throw new FieldsError(res.status, code, msg, fields);
    throw new ApiError(res.status, code, msg);
  }

  /** Il server chiude TUTTE le sessioni (anche questa): chi chiama deve rifare il login con la password nuova. */
  async changePassword(current: string, next: string, confirm: string): Promise<void> {
    await this.json(
      await this.send('POST', '/account/cambia_password.php', {
        attuale: current,
        nuova: next,
        conferma: confirm,
      }),
    );
  }

  async deleteAccount(password: string): Promise<void> {
    await this.json(
      await this.send('POST', '/account/elimina_account.php', { password, conferma: true }),
    );
  }

  /** Il file ZIP dei dati dell'utente, come byte. */
  async exportData(): Promise<Uint8Array> {
    const res = await this.send('POST', '/account/esporta_dati.php', {});
    if (!res.ok) await this.json(res); // lancia l'errore giusto
    return new Uint8Array(await res.arrayBuffer());
  }

  async devices(): Promise<Device[]> {
    return (await this.json<{ devices: Device[] }>(await this.send('GET', '/api/v1/auth/devices')))
      .devices;
  }

  /** Il piano e i consumi dell'IA del mese; null se l'utente non ha un piano. Serve rete. */
  async aiUsage(): Promise<AiUsage | null> {
    const r = await this.json<{ plan: AiUsage | null }>(
      await this.send('GET', '/api/v1/home/ai_usage'),
    );
    return r.plan ?? null;
  }

  /** Quanto spazio occupano i miei file sul sito e quanto ne posso usare. Serve rete. */
  async storage(): Promise<StorageUsage> {
    const r = await this.json<Partial<StorageUsage>>(await this.send('GET', '/api/v1/storage'));
    return { used: Number(r.used ?? 0), quota: Number(r.quota ?? 0) };
  }

  /** I posti che corrispondono al testo (almeno 3 lettere; meno: nessuna chiamata). Serve rete. */
  async placeSearch(q: string, lang: string): Promise<PlaceHit[]> {
    const text = q.trim().replace(/\s+/g, ' ');
    if (text.length < 3) return [];
    const r = await this.json<{ places?: PlaceHit[] }>(
      await this.send(
        'GET',
        `/api/v1/places/search?q=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`,
      ),
    );
    return (r.places ?? []).map((p) => ({
      name: String(p.name ?? ''),
      detail: String(p.detail ?? ''),
      full: String(p.full ?? p.name ?? ''),
      ref: String(p.ref ?? ''),
      lat: p.lat === null || p.lat === undefined ? null : Number(p.lat),
      lon: p.lon === null || p.lon === undefined ? null : Number(p.lon),
    }));
  }

  /** Le coordinate di un posto scelto dall'elenco; null se il sito non lo trova. */
  async placeDetails(ref: string, lang: string): Promise<PlacePoint | null> {
    try {
      const r = await this.json<{ place?: PlacePoint }>(
        await this.send(
          'GET',
          `/api/v1/places/details?ref=${encodeURIComponent(ref)}&lang=${encodeURIComponent(lang)}`,
        ),
      );
      return r.place ?? null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  /** Esce da TUTTI i dispositivi, anche questo (il server chiude ogni sessione). */
  async logoutEverywhere(): Promise<void> {
    await this.json(await this.send('POST', '/api/v1/auth/logout_all', {}));
  }

  async revokeDevice(id: number): Promise<void> {
    await this.json(await this.send('DELETE', `/api/v1/auth/devices/${id}`));
  }

  /** Il diario in numeri di un anno (lo calcola il server: ha anche i pomodori e le abitudini di tutto l'anno). */
  async diaryInsights(year: number): Promise<Insights> {
    return this.json<Insights>(await this.send('GET', `/api/v1/diary/insights?year=${year}`));
  }

  /** I resoconti trimestrali e i libri scritti dall'IA (solo l'elenco). Serve rete. */
  async diaryAi(): Promise<AiList> {
    return this.json<AiList>(await this.send('GET', '/api/v1/diary/ai'));
  }

  async diaryReport(id: number): Promise<AiReport> {
    return (
      await this.json<{ report: AiReport }>(
        await this.send('GET', `/api/v1/diary/ai/reports/${Math.trunc(id)}`),
      )
    ).report;
  }

  async diaryBook(id: number): Promise<AiBook> {
    return (
      await this.json<{ book: AiBook }>(
        await this.send('GET', `/api/v1/diary/ai/books/${Math.trunc(id)}`),
      )
    ).book;
  }

  /**
   * Il diario e l'IA (resoconto del trimestre, libro): la STESSA pagina del sito, che accetta anche il token dell'app
   * (stesso piano, stessi crediti, stessi limiti). Serve rete. `azione`: stima | resoconto | libro_piano | libro_avanti.
   */
  async diaryAiRun(body: Record<string, unknown>, lang: string): Promise<DiaryAiReply> {
    const res = await this.send(
      'POST',
      `/planner/diario_ai.php?lang=${encodeURIComponent(lang.slice(0, 2))}`,
      body,
    );
    let j: DiaryAiReply | null = null;
    try {
      j = JSON.parse(await res.text()) as DiaryAiReply;
    } catch {
      /* pagina d'errore del server */
    }
    // una risposta del sito con {ok:false,error} è una risposta: chi chiama decide cosa dire
    if (j && typeof j.ok === 'boolean') return j;
    throw new ApiError(res.status, 'http_error', `HTTP ${res.status}`);
  }

  /** Reinvia l'email di verifica. Ritorna lo stato del server: inviata | gia_verificata | attendi | errore. */
  async resendVerification(): Promise<string> {
    const res = await this.send('POST', '/account/invia_verifica.php', {});
    try {
      // «attendi» e «errore» arrivano con ok:false: sono risposte normali, non guasti
      const j = JSON.parse(await res.text()) as { stato?: string };
      return j.stato ?? 'errore';
    } catch {
      return 'errore';
    }
  }
}
