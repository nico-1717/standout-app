import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { ApiError, HttpSyncApi } from '../api/httpApi';
import { AuthService, type AuthState } from '../auth/authService';
import { DbNotEncryptedError, destroyDatabase, openEncryptedDb } from '../db/expoDb';
import { migrate } from '../db/migrations';
import type { SqlDb } from '../db/sqldb';
import { getState, SyncEngine, setState } from '../sync/engine';
import { pendingCount } from '../sync/outbox';
import { SyncScheduler, type SyncStatusInfo } from '../sync/scheduler';
import i18n, { pickLanguage } from '../i18n';
import { getLocales } from 'expo-localization';
import { DEFAULT_SETTINGS, SettingsStore, type Settings } from '../settings/settings';
import type { UiStyle } from '@/features/buy/buyTheme';
import { CategoriesRepo } from '@/features/buy/categoriesRepo';
import { TasksRepo } from '@/features/tasks/repo';
import { secureStoreAdapter } from './secretStore';

/** L'indirizzo del server. Si cambia solo per provare in locale (EXPO_PUBLIC_API_URL). */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://nisama.altervista.org';

export interface Services {
  db: SqlDb;
  tasks: TasksRepo;
  categories: CategoriesRepo;
  scheduler: SyncScheduler;
}

interface AppContextValue {
  auth: AuthService;
  authState: AuthState;
  services: Services | null;
  /** 'cipher' = il telefono/la build non ha il database cifrato: l'app non parte (sicurezza). */
  fatal: 'cipher' | null;
  /** Cresce a ogni cambiamento dei dati (locale o dal server): le schermate rileggono. */
  version: number;
  syncInfo: SyncStatusInfo;
  /** L'aspetto scelto per il to buy: «Corsie» (standard) o «Scontrino» (paper). */
  uiStyle: UiStyle;
  setUiStyle: (s: UiStyle) => void;
  /** Stile, colore del sito e lingua: uguali a quelli del sito, cambiati qui o là. */
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Da chiamare dopo una modifica locale: aggiorna le schermate e avvia la sincronizzazione. */
  changed: () => void;
  signOut: (opts?: { discardPending?: boolean }) => Promise<{ blocked: number } | { blocked: 0 }>;
}

const Ctx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp: manca AppProvider');
  return v;
}

const IDLE: SyncStatusInfo = { status: 'idle', lastSyncAt: null, pending: 0 };

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useMemo(
    () =>
      new AuthService(
        BASE_URL,
        secureStoreAdapter,
        Device.deviceName ?? Device.modelName ?? 'Phone',
        undefined,
        undefined,
        Constants.expoConfig?.version ?? '0.0.0',
        Platform.OS,
      ),
    [],
  );
  const [authState, setAuthState] = useState<AuthState>(auth.getState());
  const [services, setServices] = useState<Services | null>(null);
  const [fatal, setFatal] = useState<'cipher' | null>(null);
  const [version, setVersion] = useState(0);
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>(IDLE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsStore = useRef<SettingsStore | null>(null);
  const closeDb = useRef<(() => void) | null>(null);
  const opening = useRef(false);

  useEffect(() => {
    const off = auth.subscribe(setAuthState);
    void auth.restore();
    return off;
  }, [auth]);

  const userId = authState.status === 'signedIn' ? authState.user.id : null;
  const termsOk = authState.status === 'signedIn' && !authState.termsRequired;

  // Con una sessione valida e i testi accettati si apre il database e parte la sincronizzazione.
  useEffect(() => {
    if (!termsOk || userId === null || services || opening.current) return;
    opening.current = true;
    void (async () => {
      try {
        let opened = await openEncryptedDb();
        migrate(opened.db);
        // Un altro utente sullo stesso telefono: i dati del primo non devono mai vedersi (né uscire) col secondo.
        const owner = getState(opened.db, 'user_id');
        if (owner !== null && owner !== String(userId)) {
          opened.close();
          await destroyDatabase();
          opened = await openEncryptedDb();
          migrate(opened.db);
        }
        setState(opened.db, 'user_id', String(userId));
        closeDb.current = opened.close;

        const api = new HttpSyncApi(
          BASE_URL,
          () => auth.getAccessToken(),
          Constants.expoConfig?.version ?? '0.0.0',
          Platform.OS,
        );
        const engine = new SyncEngine(opened.db, api);
        const store = new SettingsStore(opened.db);
        settingsStore.current = store;
        setSettings(store.read());
        const scheduler = new SyncScheduler({
          syncOnce: async () => {
            const r = await engine.syncOnce();
            try {
              setSettings(await store.sync(api));
            } catch (e) {
              // Le impostazioni sono estetica: se il server non le dà, si riprova al prossimo giro.
              // Una sessione chiusa o la rete assente invece interessano tutta la sincronizzazione.
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            setVersion((x) => x + 1); // il server può aver cambiato dati: le schermate rileggono
            return r;
          },
          pendingCount: () => pendingCount(opened.db),
          refreshToken: () => auth.refresh(),
        });
        scheduler.subscribe(setSyncInfo);
        scheduler.start();
        setServices({
          db: opened.db,
          tasks: new TasksRepo(opened.db),
          categories: new CategoriesRepo(opened.db),
          scheduler,
        });
      } catch (e) {
        if (e instanceof DbNotEncryptedError) setFatal('cipher');
        else throw e;
      } finally {
        opening.current = false;
      }
    })();
  }, [termsOk, userId, services, auth]);

  // Rete e primo piano: avvisano il pianificatore.
  useEffect(() => {
    if (!services) return;
    const net = NetInfo.addEventListener((s) =>
      services.scheduler.setOnline(s.isConnected !== false && s.isInternetReachable !== false),
    );
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') services.scheduler.trigger(0);
    });
    return () => {
      net();
      app.remove();
    };
  }, [services]);

  // Dopo un nuovo accesso (es. sessione chiusa dal server e poi rientrato) la sincronizzazione riparte.
  useEffect(() => {
    if (termsOk && services) services.scheduler.start();
  }, [termsOk, services]);

  // Sessione chiusa dal server: si ferma tutto (i dati restano finché l'utente non esce da sé).
  useEffect(() => {
    if (authState.status === 'signedOut' && services) {
      services.scheduler.stop();
    }
  }, [authState, services]);

  const changed = useCallback(() => {
    setVersion((x) => x + 1);
    services?.scheduler.trigger();
  }, [services]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const store = settingsStore.current;
      if (!store) return;
      setSettings(store.update(patch));
      services?.scheduler.trigger(); // il cambio parte verso il sito entro un paio di secondi
    },
    [services],
  );
  const setUiStyle = useCallback(
    (st: UiStyle) => updateSettings({ ui_style: st }),
    [updateSettings],
  );
  const uiStyle: UiStyle = settings.ui_style;

  // La lingua scelta (o quella del telefono) vale per tutti i testi dell'app.
  useEffect(() => {
    void i18n.changeLanguage(settings.lang ?? pickLanguage(getLocales()[0]?.languageCode));
  }, [settings.lang]);

  const signOut = useCallback<AppContextValue['signOut']>(
    async (opts) => {
      const pending = services ? pendingCount(services.db) : 0;
      if (pending > 0 && !opts?.discardPending) return { blocked: pending };
      services?.scheduler.stop();
      await auth.logout();
      closeDb.current?.();
      closeDb.current = null;
      await destroyDatabase();
      setServices(null);
      setSyncInfo(IDLE);
      setSettings(DEFAULT_SETTINGS);
      settingsStore.current = null;
      return { blocked: 0 };
    },
    [auth, services],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      auth,
      authState,
      services,
      fatal,
      version,
      syncInfo,
      uiStyle,
      setUiStyle,
      settings,
      updateSettings,
      changed,
      signOut,
    }),
    [
      auth,
      authState,
      services,
      fatal,
      version,
      syncInfo,
      uiStyle,
      setUiStyle,
      settings,
      updateSettings,
      changed,
      signOut,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
