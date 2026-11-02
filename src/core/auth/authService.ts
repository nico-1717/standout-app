import { FieldsError } from '../account/accountApi';
import { ApiError } from '../api/httpApi';

/** Dove stanno i token. Nell'app: SecureStore (Keychain/Keystore). Nei test: una mappa. */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string | null;
  email_verified: boolean;
  lang: string | null;
}

interface Session {
  accessToken: string;
  /** Millisecondi dal 1970 in cui il token d'accesso scade. */
  accessExpiresAt: number;
  refreshToken: string;
  user: PublicUser;
  termsRequired: boolean;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason?: 'session_closed' }
  | { status: 'signedIn'; user: PublicUser; termsRequired: boolean };

const KEY = 'standout.auth.session.v1';
/** Si rinnova un po' prima della scadenza, per non mandare al server un token che muore in volo. */
const REFRESH_MARGIN_MS = 30_000;

type AccessPacket = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  user: PublicUser;
  terms_required: boolean;
};

/**
 * Accesso dell'app al server: login, token d'accesso (breve) + token di rinnovo (lungo).
 *
 * Regole di sicurezza (in parole semplici):
 *  - i token stanno solo nel posto sicuro del telefono, mai in file normali né nei log;
 *  - il rinnovo è «a una sola corsa»: se dieci richieste scoprono insieme che il token è scaduto,
 *    parte UN solo rinnovo (il token di rinnovo si può usare una volta sola: due rinnovi
 *    insieme farebbero chiudere la sessione dal server come «token riusato»);
 *  - se il server dice che la sessione è chiusa (token riusato, non valido), l'app esce subito
 *    e pulita, senza riprovare all'infinito.
 */
export class AuthService {
  private session: Session | null = null;
  private refreshing: Promise<string> | null = null;
  private listeners = new Set<(s: AuthState) => void>();
  private state: AuthState = { status: 'loading' };

  constructor(
    private readonly baseUrl: string,
    private readonly store: SecretStore,
    private readonly deviceName: string,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
    private readonly now: () => number = () => Date.now(),
    private readonly appVersion = '0.0.0',
    private readonly platform = 'unknown',
  ) {}

  getState(): AuthState {
    return this.state;
  }

  subscribe(fn: (s: AuthState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(s: AuthState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }

  /** All'avvio: rilegge la sessione salvata. Senza rete funziona lo stesso (il token si rinnova più tardi). */
  async restore(): Promise<void> {
    const raw = await this.store.get(KEY);
    if (!raw) return this.setState({ status: 'signedOut' });
    try {
      this.session = JSON.parse(raw) as Session;
      this.setState({
        status: 'signedIn',
        user: this.session.user,
        termsRequired: this.session.termsRequired,
      });
    } catch {
      await this.store.remove(KEY);
      this.setState({ status: 'signedOut' });
    }
  }

  private async post<T>(path: string, body: unknown, bearer?: string): Promise<T> {
    const res = await this.fetchFn(this.baseUrl.replace(/\/$/, '') + '/api/v1' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Version': this.appVersion,
        'X-App-Platform': this.platform,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* non JSON */
    }
    if (!res.ok || json.ok === false) {
      const fields = json.fields as Record<string, string> | undefined;
      if (fields && typeof fields === 'object')
        throw new FieldsError(
          res.status,
          String(json.code ?? 'validation'),
          String(json.error ?? ''),
          fields,
        );
      throw new ApiError(
        res.status,
        String(json.code ?? 'http_error'),
        String(json.error ?? `HTTP ${res.status}`),
      );
    }
    return json as T;
  }

  private async saveSession(p: AccessPacket): Promise<void> {
    this.session = {
      accessToken: p.access_token,
      accessExpiresAt: this.now() + p.expires_in * 1000,
      refreshToken: p.refresh_token,
      user: p.user,
      termsRequired: p.terms_required,
    };
    await this.store.set(KEY, JSON.stringify(this.session));
    this.setState({ status: 'signedIn', user: p.user, termsRequired: p.terms_required });
  }

  async login(identifier: string, password: string): Promise<void> {
    const p = await this.post<AccessPacket>('/auth/login', {
      identifier,
      password,
      device_name: this.deviceName,
    });
    await this.saveSession(p);
  }

  /**
   * Crea l'account e lo collega a questo telefono. Il server dice QUALI campi non vanno (`FieldsError`):
   * stesso controllo del sito (consenso, nome, email, password, doppioni).
   */
  async register(f: {
    username: string;
    email: string;
    password: string;
    passwordConfirm: string;
    accept: boolean;
  }): Promise<void> {
    const p = await this.post<AccessPacket>('/auth/register', {
      username: f.username,
      email: f.email,
      password: f.password,
      password_confirm: f.passwordConfirm,
      accetto: f.accept,
      device_name: this.deviceName,
    });
    await this.saveSession(p);
  }

  /** «Password dimenticata»: il server risponde sempre ok, esista l'account o no. */
  async forgot(identifier: string): Promise<void> {
    await this.post('/auth/forgot', { identifier });
  }

  /** Dà un token d'accesso valido, rinnovandolo (una sola volta, anche con richieste in parallelo) se serve. */
  async getAccessToken(): Promise<string> {
    const s = this.session;
    if (!s) throw new ApiError(401, 'unauthenticated', 'Not signed in');
    if (s.accessExpiresAt - this.now() > REFRESH_MARGIN_MS) return s.accessToken;
    return this.refresh();
  }

  /** Forza il rinnovo (usato anche quando il server risponde `token_expired`). */
  refresh(): Promise<string> {
    if (this.refreshing) return this.refreshing;
    const s = this.session;
    if (!s) return Promise.reject(new ApiError(401, 'unauthenticated', 'Not signed in'));
    this.refreshing = (async () => {
      try {
        const p = await this.post<AccessPacket>('/auth/refresh', { refresh_token: s.refreshToken });
        await this.saveSession(p);
        return p.access_token;
      } catch (e) {
        // Il server ha chiuso la sessione (token riusato/non valido): si esce, non si riprova.
        if (e instanceof ApiError && (e.code === 'token_reused' || e.code === 'invalid_token')) {
          await this.clear('session_closed');
        }
        throw e;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async acceptTerms(): Promise<void> {
    const token = await this.getAccessToken();
    await this.post('/auth/accept_terms', { accept: true }, token);
    if (this.session) {
      this.session.termsRequired = false;
      await this.store.set(KEY, JSON.stringify(this.session));
      this.setState({ status: 'signedIn', user: this.session.user, termsRequired: false });
    }
  }

  /** Esce da questo dispositivo. Se il server non risponde si esce lo stesso (la sessione scade da sola). */
  async logout(): Promise<void> {
    try {
      const token = await this.getAccessToken();
      await this.post('/auth/logout', {}, token);
    } catch {
      /* offline o già chiusa: si esce comunque in locale */
    }
    await this.clear();
  }

  private async clear(reason?: 'session_closed'): Promise<void> {
    this.session = null;
    await this.store.remove(KEY);
    this.setState({ status: 'signedOut', reason });
  }
}
