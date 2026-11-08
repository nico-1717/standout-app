import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Pressable, Text, View, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';

import { authenticate } from './biometrics';
import { shouldCover, shouldLock } from './logic';
import { readLockEnabled, writeLockEnabled } from './store';

interface LockApi {
  enabled: boolean;
  /** Accende (chiede prima Face ID) o spegne il blocco. Ritorna 'ok' | 'failed' | 'unavailable'. */
  setEnabled: (on: boolean, reason: string) => Promise<'ok' | 'failed' | 'unavailable'>;
}

const LockContext = createContext<LockApi>({ enabled: false, setEnabled: async () => 'failed' });
export const useAppLock = () => useContext(LockContext);

/**
 * Il blocco dell'app (A19) e la copertura nel selettore delle app (D9). All'avvio, se il blocco è acceso, si vede solo la
 * copertura finché non sblocchi. Quando l'app passa in secondo piano la schermata si copre; se ci resta più di 30 secondi, al
 * ritorno chiede di nuovo lo sblocco. Spento di default: nel sito non c'è, è una scelta di chi vuole più riservatezza.
 */
export function AppLock({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState === 'background' || AppState.currentState === 'inactive'
      ? AppState.currentState
      : 'active',
  );
  const [failed, setFailed] = useState(false);
  const leftAt = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    void readLockEnabled().then((on) => {
      if (!alive) return;
      setEnabledState(on);
      setLocked(on);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await authenticate(t('app.blocco_motivo'));
      if (r === 'ok') {
        setLocked(false);
        setFailed(false);
      } else setFailed(true);
    } finally {
      busy.current = false;
    }
  }, [t]);

  // Primo piano / secondo piano.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setAppState(s);
      if (s === 'background') leftAt.current = Date.now();
      if (s === 'active') {
        if (shouldLock({ enabled, leftAt: leftAt.current, now: Date.now() })) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // Appena serve, chiede il volto da solo.
  useEffect(() => {
    if (enabled && locked && appState === 'active' && loaded) void unlock();
  }, [enabled, locked, appState, loaded, unlock]);

  const setEnabled = useCallback(async (on: boolean, reason: string) => {
    const r = await authenticate(reason);
    if (r !== 'ok') return r;
    await writeLockEnabled(on);
    setEnabledState(on);
    setLocked(false);
    return 'ok' as const;
  }, []);

  const api = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  const showCover = !loaded || (enabled && locked) || shouldCover({ enabled, appState });

  return (
    <LockContext.Provider value={api}>
      {loaded ? (
        <View
          style={{ flex: 1 }}
          accessibilityElementsHidden={showCover}
          importantForAccessibility={showCover ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
      ) : null}
      {showCover ? (
        <View
          testID="app-lock-cover"
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#101114',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            padding: 24,
          }}
        >
          {loaded && enabled && locked ? (
            <>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
                {t('app.blocco_bloccata')}
              </Text>
              {failed ? (
                <Text testID="app-lock-failed" style={{ color: '#FF8A80', textAlign: 'center' }}>
                  {t('app.blocco_non_riuscito')}
                </Text>
              ) : null}
              <Pressable
                testID="app-lock-unlock"
                accessibilityRole="button"
                onPress={() => void unlock()}
                style={{
                  backgroundColor: '#0A84FF',
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 28,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {t('app.blocco_sblocca')}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </LockContext.Provider>
  );
}
