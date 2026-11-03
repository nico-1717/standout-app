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
import { AccountApi } from '../account/accountApi';
import { askPermission, phoneNotifier } from '@/features/reminders/notifier';
import { DEFAULT_REMINDERS, type ReminderSettings } from '@/features/reminders/plan';
import { rescheduleAll } from '@/features/reminders/scheduler';
import { DiaryRepo } from '@/features/diary/repo';
import {
  PlannerSettingsStore,
  DEFAULT_PLANNER_SETTINGS,
  type PlannerSettings,
} from '@/features/planner/settings';
import { PlannerRepo } from '@/features/planner/repo';
import { PomodoroRepo } from '@/features/pomodoro/repo';
import {
  DEFAULT_POMODORO_SETTINGS,
  PomodoroSettingsStore,
  type PomodoroSettings,
} from '@/features/pomodoro/settings';
import { GradesRepo } from '@/features/grades/repo';
import { GradeSettingsStore } from '@/features/grades/settings';
import { DEFAULT_GRADE_SETTINGS, type GradeSettings } from '@/features/grades/logic';
import { DEFAULT_HOME_LAYOUT, HomeLayoutStore, type HomeWidget } from '@/features/home/layout';
import { ProjectOptionsStore } from '@/features/projects/options';
import { ProjectsRepo } from '@/features/projects/repo';
import {
  DEFAULT_DIARY_SETTINGS,
  DiarySettingsStore,
  type DiarySettings,
} from '@/features/diary/settings';
import { QuickNoteStore } from '@/features/notes/quickNote';
import { RemindersStore } from '@/features/reminders/store';
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
import {
  DEFAULT_HABIT_SETTINGS,
  HabitSettingsStore,
  type HabitSettings,
} from '@/features/habits/habitSettings';
import { HabitCategoriesRepo, HabitsRepo } from '@/features/habits/repo';
import { localToday } from '@/features/tasks/groups';
import { PillsRepo, localStamp } from '@/features/pills/repo';
import { TasksRepo } from '@/features/tasks/repo';
import { secureStoreAdapter } from './secretStore';

/** L'indirizzo del server. Si cambia solo per provare in locale (EXPO_PUBLIC_API_URL). */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://nisama.altervista.org';

export interface Services {
  db: SqlDb;
  tasks: TasksRepo;
  categories: CategoriesRepo;
  habits: HabitsRepo;
  habitCategories: HabitCategoriesRepo;
  pills: PillsRepo;
  notes: QuickNoteStore;
  diary: DiaryRepo;
  planner: PlannerRepo;
  projects: ProjectsRepo;
  projectOptions: ProjectOptionsStore;
  pomodoro: PomodoroRepo;
  grades: GradesRepo;
  scheduler: SyncScheduler;
}

interface AppContextValue {
  auth: AuthService;
  account: AccountApi;
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
  /** Le preferenze della pagina Abitudini (colore, giorni in barra, gruppi…): uguali a quelle del sito. */
  habitSettings: HabitSettings;
  updateHabitSettings: (patch: Partial<HabitSettings>) => void;
  diarySettings: DiarySettings;
  updateDiarySettings: (patch: Partial<DiarySettings>) => void;
  pomodoroSettings: PomodoroSettings;
  updatePomodoroSettings: (patch: Partial<PomodoroSettings>) => void;
  gradeSettings: GradeSettings;
  updateGradeSettings: (patch: Partial<GradeSettings>) => void;
  homeLayout: HomeWidget[];
  updateHomeLayout: (layout: HomeWidget[]) => void;
  plannerSettings: PlannerSettings;
  updatePlannerSettings: (patch: Partial<Omit<PlannerSettings, 'first_week_start'>>) => void;
  /** I promemoria (pastiglie, abitudini): restano su questo telefono. Ritorna false se il telefono nega il permesso. */
  reminders: ReminderSettings;
  updateReminders: (patch: Partial<ReminderSettings>) => Promise<boolean>;
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
  const account = useMemo(
    () =>
      new AccountApi(
        BASE_URL,
        () => auth.getAccessToken(),
        Constants.expoConfig?.version ?? '0.0.0',
        Platform.OS,
      ),
    [auth],
  );
  const [authState, setAuthState] = useState<AuthState>(auth.getState());
  const [services, setServices] = useState<Services | null>(null);
  const [fatal, setFatal] = useState<'cipher' | null>(null);
  const [version, setVersion] = useState(0);
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>(IDLE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsStore = useRef<SettingsStore | null>(null);
  const [habitSettings, setHabitSettings] = useState<HabitSettings>(DEFAULT_HABIT_SETTINGS);
  const habitSettingsStore = useRef<HabitSettingsStore | null>(null);
  const [diarySettings, setDiarySettings] = useState<DiarySettings>(DEFAULT_DIARY_SETTINGS);
  const diarySettingsStore = useRef<DiarySettingsStore | null>(null);
  const [plannerSettings, setPlannerSettings] = useState<PlannerSettings>(DEFAULT_PLANNER_SETTINGS);
  const plannerSettingsStore = useRef<PlannerSettingsStore | null>(null);
  const [pomodoroSettings, setPomodoroSettings] =
    useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const pomodoroSettingsStore = useRef<PomodoroSettingsStore | null>(null);
  const [gradeSettings, setGradeSettings] = useState<GradeSettings>(DEFAULT_GRADE_SETTINGS);
  const gradeSettingsStore = useRef<GradeSettingsStore | null>(null);
  const [homeLayout, setHomeLayout] = useState<HomeWidget[]>(DEFAULT_HOME_LAYOUT);
  const homeLayoutStore = useRef<HomeLayoutStore | null>(null);
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const remindersStore = useRef<RemindersStore | null>(null);
  /** l'impronta delle notifiche già programmate (null = non si sa: si rifanno) */
  const scheduledSig = useRef<string | null>(null);
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
        const hStore = new HabitSettingsStore(opened.db);
        habitSettingsStore.current = hStore;
        setHabitSettings(hStore.read());
        const dStore = new DiarySettingsStore(opened.db);
        diarySettingsStore.current = dStore;
        setDiarySettings(dStore.read());
        const pStore = new PlannerSettingsStore(opened.db);
        plannerSettingsStore.current = pStore;
        setPlannerSettings(pStore.read());
        const poStore = new PomodoroSettingsStore(opened.db);
        pomodoroSettingsStore.current = poStore;
        setPomodoroSettings(poStore.read());
        const gsStore = new GradeSettingsStore(opened.db);
        gradeSettingsStore.current = gsStore;
        setGradeSettings(gsStore.read());
        const hoStore = new HomeLayoutStore(opened.db);
        homeLayoutStore.current = hoStore;
        setHomeLayout(hoStore.read());
        const rStore = new RemindersStore(opened.db);
        remindersStore.current = rStore;
        scheduledSig.current = null;
        setReminders(rStore.read());
        const notes = new QuickNoteStore(opened.db);
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
            try {
              setHabitSettings(await hStore.sync(api));
            } catch (e) {
              // come sopra: estetica. Un server più vecchio (senza questa rotta) risponde 404 e va bene così.
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            try {
              setDiarySettings(await dStore.sync(api));
            } catch (e) {
              // come sopra: estetica, e un server più vecchio può non avere la rotta
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            try {
              setPlannerSettings(await pStore.sync(api));
            } catch (e) {
              // come sopra: estetica, e un server più vecchio può non avere la rotta
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            try {
              setPomodoroSettings(await poStore.sync(api));
            } catch (e) {
              // come sopra: ultime scelte e pausa in corso; un server più vecchio può non avere la rotta
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            try {
              setGradeSettings(await gsStore.sync(api));
            } catch (e) {
              // come sopra: le impostazioni del corso; un server più vecchio può non avere la rotta
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            try {
              setHomeLayout(await hoStore.sync(api));
            } catch (e) {
              // come sopra: i riquadri della Home; un server più vecchio può non avere la rotta
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            try {
              await notes.sync(api);
            } catch (e) {
              // come sopra; la nota resta sul telefono e riparte al prossimo giro
              if (e instanceof ApiError && (e.status === 401 || e.code === 'upgrade_required'))
                throw e;
              if (e instanceof TypeError) throw e;
            }
            setVersion((x) => x + 1); // il server può aver cambiato dati: le schermate rileggono
            return r;
          },
          pendingCount: () => pendingCount(opened.db) + (notes.hasPending() ? 1 : 0),
          refreshToken: () => auth.refresh(),
        });
        scheduler.subscribe(setSyncInfo);
        scheduler.start();
        setServices({
          db: opened.db,
          tasks: new TasksRepo(opened.db),
          categories: new CategoriesRepo(opened.db),
          habits: new HabitsRepo(opened.db, undefined, undefined, () => localToday()),
          habitCategories: new HabitCategoriesRepo(opened.db),
          pills: new PillsRepo(
            opened.db,
            () => localToday(),
            () => localStamp(),
          ),
          notes,
          diary: new DiaryRepo(opened.db, userId),
          planner: new PlannerRepo(
            opened.db,
            undefined,
            undefined,
            () => i18n.t('planner.tit_senza_titolo'),
            userId,
          ),
          projects: new ProjectsRepo(opened.db),
          projectOptions: new ProjectOptionsStore(opened.db),
          pomodoro: new PomodoroRepo(opened.db, userId),
          grades: new GradesRepo(opened.db),
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

  // Le notifiche seguono i dati: a ogni cambiamento (e quando l'app torna in primo piano) si rifanno,
  // ma solo se la lista è davvero cambiata.
  const redoReminders = useCallback(
    async (force = false) => {
      if (!services) return;
      try {
        const r = await rescheduleAll({
          notifier: phoneNotifier(i18n.t('app.promemoria_t')),
          settings: reminders,
          pills: services.pills,
          habits: services.habits,
          today: localToday(),
          now: new Date(),
          words: {
            pillsTitle: i18n.t('app.notifica_pastiglie'),
            habitsTitle: i18n.t('app.notifica_abitudini'),
          },
          previous: force ? null : scheduledSig.current,
        });
        scheduledSig.current = r.signature;
      } catch {
        scheduledSig.current = null; // non è andata: al prossimo giro si riprova
      }
    },
    [services, reminders],
  );
  useEffect(() => {
    void redoReminders();
  }, [redoReminders, version, settings.lang]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void redoReminders(true);
    });
    return () => sub.remove();
  }, [redoReminders]);

  const updateReminders = useCallback(async (patch: Partial<ReminderSettings>) => {
    const store = remindersStore.current;
    if (!store) return false;
    // Accendere un promemoria chiede il permesso al telefono; se lo nega, la scelta non cambia.
    if ((patch.pills || patch.habits) && !(await askPermission())) return false;
    setReminders(store.update(patch));
    return true;
  }, []);

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
  const updateHabitSettings = useCallback(
    (patch: Partial<HabitSettings>) => {
      const store = habitSettingsStore.current;
      if (!store) return;
      setHabitSettings(store.update(patch));
      services?.scheduler.trigger();
    },
    [services],
  );
  const updateDiarySettings = useCallback(
    (patch: Partial<DiarySettings>) => {
      const store = diarySettingsStore.current;
      if (!store) return;
      setDiarySettings(store.update(patch));
      services?.scheduler.trigger();
    },
    [services],
  );
  const updatePlannerSettings = useCallback(
    (patch: Partial<Omit<PlannerSettings, 'first_week_start'>>) => {
      const store = plannerSettingsStore.current;
      if (!store) return;
      setPlannerSettings(store.update(patch));
      services?.scheduler.trigger();
    },
    [services],
  );
  const updatePomodoroSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      const store = pomodoroSettingsStore.current;
      if (!store) return;
      setPomodoroSettings(store.update(patch));
      services?.scheduler.trigger();
    },
    [services],
  );
  const updateGradeSettings = useCallback(
    (patch: Partial<GradeSettings>) => {
      const store = gradeSettingsStore.current;
      if (!store) return;
      setGradeSettings(store.update(patch));
      services?.scheduler.trigger();
    },
    [services],
  );
  const updateHomeLayout = useCallback(
    (layout: HomeWidget[]) => {
      const store = homeLayoutStore.current;
      if (!store) return;
      setHomeLayout(store.write(layout));
      services?.scheduler.trigger();
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
      const pending = services
        ? pendingCount(services.db) + (services.notes.hasPending() ? 1 : 0)
        : 0;
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
      setHabitSettings(DEFAULT_HABIT_SETTINGS);
      habitSettingsStore.current = null;
      setDiarySettings(DEFAULT_DIARY_SETTINGS);
      diarySettingsStore.current = null;
      plannerSettingsStore.current = null;
      pomodoroSettingsStore.current = null;
      homeLayoutStore.current = null;
      setHomeLayout(DEFAULT_HOME_LAYOUT);
      gradeSettingsStore.current = null;
      setGradeSettings(DEFAULT_GRADE_SETTINGS);
      remindersStore.current = null;
      scheduledSig.current = null;
      setReminders(DEFAULT_REMINDERS);
      // Le notifiche sono dati dell'utente: uscendo non devono restare sul telefono.
      await phoneNotifier('')
        .cancelAll()
        .catch(() => undefined);
      return { blocked: 0 };
    },
    [auth, services],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      auth,
      account,
      authState,
      services,
      fatal,
      version,
      syncInfo,
      uiStyle,
      setUiStyle,
      settings,
      updateSettings,
      habitSettings,
      updateHabitSettings,
      diarySettings,
      updateDiarySettings,
      plannerSettings,
      updatePlannerSettings,
      pomodoroSettings,
      updatePomodoroSettings,
      gradeSettings,
      updateGradeSettings,
      homeLayout,
      updateHomeLayout,
      reminders,
      updateReminders,
      changed,
      signOut,
    }),
    [
      auth,
      account,
      authState,
      services,
      fatal,
      version,
      syncInfo,
      uiStyle,
      setUiStyle,
      settings,
      updateSettings,
      habitSettings,
      updateHabitSettings,
      diarySettings,
      updateDiarySettings,
      plannerSettings,
      updatePlannerSettings,
      pomodoroSettings,
      updatePomodoroSettings,
      gradeSettings,
      updateGradeSettings,
      homeLayout,
      updateHomeLayout,
      reminders,
      updateReminders,
      changed,
      signOut,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
