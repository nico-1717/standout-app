import type { AiBook, AiList, AiReport } from '@/features/diary/aiReading';
import {
  parseGcCalendars,
  parseGcStatus,
  type GcCalendars,
  type GcDedicated,
  type GcPrimary,
  type GcStatus,
} from '@/features/planner/gcal';
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

/** Una tabella costruita dall'IA: colonne, righe e celle («A1» → testo). */
export interface AiTable {
  cols: number;
  rows: number;
  cells: Record<string, string>;
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

/** Un'ora di previsione (`ore` del sito: h ora, i icona, l descrizione, t gradi, ap percepita, p pioggia %, v vento, u umidità). */
export interface WxHour {
  h: string;
  i: string;
  l: string;
  t: number | null;
  ap: number | null;
  p: number | null;
  v: number | null;
  u: number | null;
}

/** Un giorno di previsioni (api/v1 weather: gli stessi campi del sito). */
export interface WxDay {
  date: string;
  code: number;
  label: string;
  /** il nome dell'icona del sito: sole, sole-nubi, nubi, nebbia, pioggia-leggera, pioggia, temporale, neve... */
  icon: string;
  tmax: number | null;
  tmin: number | null;
  /** probabilità di pioggia, % */
  pioggia: number | null;
  vento: number | null;
  percepita_max: number | null;
  percepita_min: number | null;
  pioggia_mm: number | null;
  raffiche: number | null;
  vento_da: string | null;
  uv: number | null;
  alba: string | null;
  tramonto: string | null;
  sole_min: number | null;
  affidabilita: number | null;
  /** per quante ore piove */
  pioggia_ore: number | null;
  /** le ore del giorno, per il grafico (vuoto se il servizio non le manda) */
  ore: WxHour[];
}

export interface WxNow {
  ora: string | null;
  label: string;
  icon: string;
  temp: number | null;
  percepita: number | null;
  umidita: number | null;
  vento: number | null;
  pioggia_mm: number | null;
  giorno: boolean | null;
}

/** Lo stato del meteo come lo dà il sito. */
export interface WxState {
  enabled: boolean;
  place: string | null;
  lat: number | null;
  lon: number | null;
  /** il luogo è stato scelto a mano per una sbirciata (non è salvato) */
  manual: boolean;
  /** true = il luogo segue la posizione viva; false = resta il posto scelto («a mano») */
  auto: boolean;
  fonte: string;
  fonteUrl: string;
  nota: string;
  giorni: Record<string, WxDay>;
  adesso: WxNow | null;
  errore: string | null;
}

export interface WxPlace {
  nome: string;
  dove: string;
  lat: number;
  lon: number;
}

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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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

  // --- Google Calendar: lo stesso file del sito (planner/google_calendar.php), che accetta anche il token dell'app ---
  private gc(action: string): string {
    return `/planner/google_calendar.php?ajax=${action}`;
  }
  /** Lo stato del collegamento e le due scelte su cosa mandare a Google. */
  async gcStatus(): Promise<GcStatus> {
    return parseGcStatus(await this.json(await this.send('GET', this.gc('status'))));
  }
  /** I calendari di Google e i miei, con dove va ciascuno. */
  async gcCalendars(): Promise<GcCalendars> {
    return parseGcCalendars(await this.json(await this.send('GET', this.gc('calendars'))));
  }
  /** Sincronizza adesso. */
  async gcSync(): Promise<void> {
    await this.json(await this.send('POST', this.gc('sync'), {}));
  }
  async gcDisconnect(): Promise<void> {
    await this.json(await this.send('POST', this.gc('disconnect'), {}));
  }
  /** Cerca e toglie i doppioni su Google; quante copie ha tolto. */
  async gcRepair(): Promise<number> {
    const r = await this.json<{ removed?: number }>(await this.send('POST', this.gc('repair'), {}));
    return typeof r.removed === 'number' ? r.removed : 0;
  }
  /** Dove far finire gli eventi di un calendario di Google (0 = nessuno: quelli già entrati se ne vanno). */
  async gcMapSet(ref: string, calendarId: number): Promise<void> {
    await this.json(await this.send('POST', this.gc('map_set'), { ref, calendar_id: calendarId }));
  }
  /** Dove finiscono su Google gli eventi di un mio calendario ('' = come impostato sopra). */
  async gcPushSet(calendarId: number, ref: string): Promise<void> {
    await this.json(await this.send('POST', this.gc('push_set'), { calendar_id: calendarId, ref }));
  }
  /** Cosa mandare a Google: nel calendario dedicato e nel principale. */
  async gcSetModes(p: { gc_dedicated?: GcDedicated; gc_primary?: GcPrimary }): Promise<void> {
    await this.json(await this.send('PATCH', '/api/v1/planner/settings', p));
  }
  /** L'indirizzo che porta al consenso di Google: si apre nel browser, dove c'è la sessione del sito. */
  gcConnectUrl(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/planner/google_calendar.php?action=connect`;
  }

  /** Il meteo salvato dell'utente (acceso o no) e le previsioni. Serve rete. */
  async weather(): Promise<WxState> {
    return wxState(await this.json(await this.send('GET', '/api/v1/weather')));
  }

  /** Accende il meteo per un punto. `auto` dice se da ora segue la posizione viva (assente = sì, come il sito). */
  async weatherEnable(lat: number, lon: number, auto?: boolean): Promise<WxState> {
    return wxState(
      await this.json(
        await this.send(
          'POST',
          '/api/v1/weather/enable',
          auto === undefined ? { lat, lon } : { lat, lon, auto },
        ),
      ),
    );
  }

  /** Un luogo scelto a mano che RESTA («a mano»): a differenza dell'anteprima, questo si salva. */
  async weatherPlace(lat: number, lon: number, place: string): Promise<WxState> {
    return wxState(
      await this.json(await this.send('POST', '/api/v1/weather/place', { lat, lon, place })),
    );
  }

  /**
   * «Collegamento con l'IA»: dal testo incollato di una pagina, il server ricava una tabella già controllata e
   * ridimensionata (non salva niente: il telefono crea o aggiorna la tabella da solo). Il server legge solo il
   * testo, non apre nessun sito. Serve rete; un errore porta il testo del server (limite del piano, IA occupata…).
   */
  async trackerAiTable(text: string, request: string): Promise<AiTable> {
    const r = await this.json<{ cols?: unknown; rows?: unknown; cells?: unknown }>(
      await this.send('POST', '/api/v1/tracker/ai-table', { text, request }),
    );
    const cells: Record<string, string> = {};
    if (r.cells && typeof r.cells === 'object')
      for (const [k, v] of Object.entries(r.cells as Record<string, unknown>))
        if (typeof v === 'string' && v !== '') cells[k] = v;
    return { cols: Number(r.cols) || 1, rows: Number(r.rows) || 1, cells };
  }

  /** Solo la modalità: automatico (segue la posizione viva) o a mano. Il posto salvato non cambia. */
  async weatherMode(auto: boolean): Promise<boolean> {
    const r = await this.json<{ auto?: boolean }>(
      await this.send('POST', '/api/v1/weather/mode', { auto }),
    );
    return r.auto === true;
  }

  async weatherDisable(): Promise<void> {
    await this.json(await this.send('POST', '/api/v1/weather/disable', {}));
  }

  /** La previsione di un punto qualsiasi, senza salvare niente (come il popup del sito). */
  async weatherPreview(lat: number, lon: number, place: string): Promise<WxState> {
    return wxState(
      await this.json(await this.send('POST', '/api/v1/weather/preview', { lat, lon, place })),
    );
  }

  /** I luoghi che si chiamano così (almeno 3 lettere). */
  async weatherPlaces(q: string): Promise<WxPlace[]> {
    const text = q.trim().replace(/\s+/g, ' ');
    if (text.length < 3) return [];
    const r = await this.json<{ places?: WxPlace[] }>(
      await this.send('GET', `/api/v1/weather/places?q=${encodeURIComponent(text)}`),
    );
    return (r.places ?? []).map((p) => ({
      nome: String(p.nome ?? ''),
      dove: String(p.dove ?? ''),
      lat: Number(p.lat),
      lon: Number(p.lon),
    }));
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

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** La risposta del sito → lo stato, con i campi sempre dello stesso tipo. */
export function wxState(r: Record<string, unknown>): WxState {
  const raw = (r.giorni && typeof r.giorni === 'object' ? r.giorni : {}) as Record<
    string,
    Record<string, unknown>
  >;
  const hours = (v: unknown): WxHour[] =>
    Array.isArray(v)
      ? v
          .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
          .map((o) => ({
            h: String(o.h ?? '00:00'),
            i: String(o.i ?? 'nubi'),
            l: String(o.l ?? ''),
            t: num(o.t),
            ap: num(o.ap),
            p: num(o.p),
            v: num(o.v),
            u: num(o.u),
          }))
      : [];
  const giorni: Record<string, WxDay> = {};
  for (const [date, d] of Object.entries(raw)) {
    giorni[date] = {
      date,
      code: Number(d.code ?? 3),
      label: String(d.label ?? ''),
      icon: String(d.icon ?? 'nubi'),
      tmax: num(d.tmax),
      tmin: num(d.tmin),
      pioggia: num(d.pioggia),
      vento: num(d.vento),
      percepita_max: num(d.percepita_max),
      percepita_min: num(d.percepita_min),
      pioggia_mm: num(d.pioggia_mm),
      raffiche: num(d.raffiche),
      vento_da: str(d.vento_da),
      uv: num(d.uv),
      alba: str(d.alba),
      tramonto: str(d.tramonto),
      sole_min: num(d.sole_min),
      affidabilita: num(d.affidabilita),
      pioggia_ore: num(d.pioggia_ore),
      ore: hours(d.ore),
    };
  }
  const n = r.adesso as Record<string, unknown> | null | undefined;
  return {
    enabled: r.enabled === true,
    place: str(r.place),
    lat: num(r.lat),
    lon: num(r.lon),
    manual: r.manual === true,
    auto: r.auto === true,
    fonte: String(r.fonte ?? 'Open-Meteo'),
    fonteUrl: String(r.fonte_url ?? 'https://open-meteo.com'),
    nota: String(r.nota_affidabilita ?? ''),
    giorni,
    adesso: n
      ? {
          ora: str(n.ora),
          label: String(n.label ?? ''),
          icon: String(n.icon ?? 'nubi'),
          temp: num(n.temp),
          percepita: num(n.percepita),
          umidita: num(n.umidita),
          vento: num(n.vento),
          pioggia_mm: num(n.pioggia_mm),
          giorno: typeof n.giorno === 'boolean' ? n.giorno : null,
        }
      : null,
    errore: str(r.errore),
  };
}
