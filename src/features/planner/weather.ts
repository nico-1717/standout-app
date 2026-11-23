import type { AccountApi, WxDay, WxState } from '@/core/account/accountApi';
import { distanceKm, livePosition, type LivePosition } from './livePosition';

/** Quello che serve a una vista per mettere i tag del meteo accanto ai giorni. */
export interface WxCtx {
  wx: WxState;
  /** quanti gradi ci sono adesso (per il tag di oggi con un giorno solo) */
  nowTemp: number | null;
  onOpen: (date: string) => void;
}

/** Il tipo di tinta di un tag del meteo (planner_griglia.css: .pl-wx-*). */
export type WxTone = 'sun' | 'heat' | 'moon' | 'rain' | 'snow' | 'storm' | 'plain';

/** Da quanti gradi il sole sereno diventa il sole rosso del gran caldo (`WX_CALDO_ICONA` del sito). */
export const WX_HEAT_FROM = 32;
const hot = (icon: string, temp: number | null | undefined) =>
  icon === 'sole' && temp !== null && temp !== undefined && temp >= WX_HEAT_FROM ? 'caldo' : icon;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Fra il tramonto e l'alba il sole diventa luna (come `wxIconaNome` del sito). Su oggi vale l'ora corrente, sugli
 * altri giorni si resta di giorno: il riassunto di un giorno intero non ha un'ora sua.
 */
export function wxIconName(
  icon: string,
  day: WxDay | undefined,
  isToday: boolean,
  now = new Date(),
  temp?: number | null,
): string {
  if (icon !== 'sole' && icon !== 'sole-nubi') return icon;
  if (!isToday) return hot(icon, temp);
  const at = now.getHours() * 60 + now.getMinutes();
  const sunrise = day?.alba ? toMinutes(day.alba) : 6 * 60;
  const sunset = day?.tramonto ? toMinutes(day.tramonto) : 20 * 60;
  if (at >= sunrise && at < sunset) return hot(icon, temp);
  return icon === 'sole' ? 'luna' : 'luna-nubi';
}

/** Come `wxIconName`, ma per un'ora precisa del giorno (i tag accanto agli orari): `minutes` dalla mezzanotte. */
export function wxHourIconName(
  icon: string,
  day: WxDay | undefined,
  minutes: number,
  temp?: number | null,
): string {
  if (icon !== 'sole' && icon !== 'sole-nubi') return icon;
  const sunrise = day?.alba ? toMinutes(day.alba) : 6 * 60;
  const sunset = day?.tramonto ? toMinutes(day.tramonto) : 20 * 60;
  if (minutes >= sunrise && minutes < sunset) return hot(icon, temp);
  return icon === 'sole' ? 'luna' : 'luna-nubi';
}

export function wxTone(icon: string): WxTone {
  if (icon === 'caldo') return 'heat';
  if (icon === 'sole' || icon === 'sole-nubi') return 'sun';
  if (icon === 'luna' || icon === 'luna-nubi') return 'moon';
  if (icon === 'neve') return 'snow';
  if (icon === 'temporale') return 'storm';
  if (icon.startsWith('pioggia')) return 'rain';
  return 'plain';
}

/** I gradi accanto all'icona: con un giorno solo «ora · min/max», con più giorni la massima (wxTagTesto). */
export function wxTagText(
  day: WxDay,
  opts: { single: boolean; today: boolean; now: number | null },
): string {
  const parts: string[] = [];
  if (opts.single && opts.today && opts.now !== null) parts.push(`${opts.now}°`);
  if (opts.single && day.tmin !== null && day.tmax !== null) parts.push(`${day.tmin}/${day.tmax}°`);
  else if (day.tmax !== null) parts.push(`${day.tmax}°`);
  return parts.join(' · ');
}

/** L'indice UV in parole (chiavi planner.uv_*). */
export function wxUvKey(uv: number): string {
  if (uv < 3) return 'planner.uv_basso';
  if (uv < 6) return 'planner.uv_moderato';
  if (uv < 8) return 'planner.uv_alto';
  if (uv < 11) return 'planner.uv_molto_alto';
  return 'planner.uv_estremo';
}

/** Minuti → «6 h 20 min». */
export function wxDuration(min: number, minLabel: (n: number) => string): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return minLabel(m);
  return `${h} h${m ? ` ${m} min` : ''}`;
}

/**
 * Il meteo come lo tiene il sito: acceso o no, il luogo e le previsioni. Vive in memoria (un solo esemplare per
 * app): lo leggono la pagina del planner e le impostazioni, e si ricarica quando serve.
 */
/** Sotto questa distanza il posto salvato resta com'è (come sul sito). */
const FOLLOW_KM = 3;

export class WeatherStore {
  /** Chi dice dove siamo: sul telefono è il GPS, nei test si sostituisce. */
  locate: () => Promise<LivePosition | null> = livePosition;
  private followedAt = 0;
  state: WxState | null = null;
  loading = false;
  failed = false;
  private listeners = new Set<() => void>();
  private loadedAt = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.version;
  private version = 0;
  private bump() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  /** Scarica lo stato; per non martellare il sito si rifà al massimo ogni 10 minuti, salvo `force`. */
  async load(api: AccountApi, force = false): Promise<void> {
    if (this.loading) return;
    if (!force && this.state && Date.now() - this.loadedAt < 10 * 60_000) return;
    this.loading = true;
    this.bump();
    try {
      this.state = await api.weather();
      this.failed = false;
      this.loadedAt = Date.now();
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
      this.bump();
    }
  }

  /** Accende il meteo per un punto: lo stato nuovo arriva con le previsioni. */
  async enable(api: AccountApi, lat: number, lon: number, auto?: boolean): Promise<void> {
    this.state = await api.weatherEnable(lat, lon, auto);
    this.loadedAt = Date.now();
    this.bump();
  }

  /** Un luogo scelto a mano che resta (modalità «a mano»). */
  async setPlace(api: AccountApi, lat: number, lon: number, place: string): Promise<void> {
    this.state = await api.weatherPlace(lat, lon, place);
    this.loadedAt = Date.now();
    this.bump();
  }

  /**
   * In modalità automatica porta il luogo salvato dove si trova il telefono, se ci si è spostati di più di 3 km.
   * Silenzioso: senza permesso o senza segnale il posto resta quello di prima. Al massimo una volta ogni 10 minuti.
   */
  async follow(api: AccountApi, force = false): Promise<void> {
    const s = this.state;
    if (!s || !s.enabled || !s.auto || s.lat === null || s.lon === null) return;
    if (!force && Date.now() - this.followedAt < 10 * 60_000) return;
    this.followedAt = Date.now();
    const here = await this.locate();
    if (!here || distanceKm(s.lat, s.lon, here.lat, here.lon) < FOLLOW_KM) return;
    try {
      await this.enable(api, here.lat, here.lon, true);
    } catch {
      /* senza rete il posto resta quello di prima */
    }
  }

  /** Automatico (segue la posizione viva) o a mano: cambia la modalità, il posto resta com'è. */
  async setAuto(api: AccountApi, auto: boolean): Promise<void> {
    const saved = await api.weatherMode(auto);
    if (this.state) this.state = { ...this.state, auto: saved };
    this.bump();
  }

  /** Si spegne subito e si avvisa il sito dopo (spegnere deve sembrare immediato). */
  async disable(api: AccountApi): Promise<void> {
    if (this.state)
      this.state = { ...this.state, enabled: false, giorni: {}, adesso: null, manual: false };
    this.bump();
    try {
      await api.weatherDisable();
    } catch {
      /* al prossimo caricamento lo stato vero torna */
      this.loadedAt = 0;
    }
  }

  /** Sbircia un altro posto senza salvarlo (come il popup del sito). */
  async preview(api: AccountApi, lat: number, lon: number, place: string): Promise<void> {
    this.state = await api.weatherPreview(lat, lon, place);
    this.bump();
  }

  clear() {
    this.state = null;
    this.loadedAt = 0;
    this.bump();
  }
}

export const weatherStore = new WeatherStore();
