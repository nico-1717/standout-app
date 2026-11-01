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

import { HttpSyncApi } from '../api/httpApi';
import { AuthService, type AuthState } from '../auth/authService';
import { DbNotEncryptedError, destroyDatabase, openEncryptedDb } from '../db/expoDb';
import { migrate } from '../db/migrations';
import type { SqlDb } from '../db/sqldb';
import { getState, SyncEngine, setState } from '../sync/engine';
import { pendingCount } from '../sync/outbox';
import { SyncScheduler, type SyncStatusInfo } from '../sync/scheduler';
import { TasksRepo } from '@/features/tasks/repo';
import { secureStoreAdapter } from './secretStore';

/** L'indirizzo del server. Si cambia solo per provare in locale (EXPO_PUBLIC_API_URL). */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://nisama.altervista.org';

export interface Services {
  db: SqlDb;
  tasks: TasksRepo;
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
        const scheduler = new SyncScheduler({
          syncOnce: async () => {
            const r = await engine.syncOnce();
            setVersion((x) => x + 1); // il server può aver cambiato dati: le schermate rileggono
            return r;
          },
          pendingCount: () => pendingCount(opened.db),
          refreshToken: () => auth.refresh(),
        });
        scheduler.subscribe(setSyncInfo);
        scheduler.start();
        setServices({ db: opened.db, tasks: new TasksRepo(opened.db), scheduler });
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
      return { blocked: 0 };
    },
    [auth, services],
  );

  const value = useMemo<AppContextValue>(
    () => ({ auth, authState, services, fatal, version, syncInfo, changed, signOut }),
    [auth, authState, services, fatal, version, syncInfo, changed, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
