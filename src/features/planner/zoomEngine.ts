import { useCallback, useEffect, useRef, useState } from 'react';
import { usePinchGesture } from 'react-native-gesture-handler';
import type Animated from 'react-native-reanimated';
import {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { haptic } from '@/ui/motion';

import { STEP_KEYS, naturalPpm, pxPerMinute, type Zoom } from './layout';
import { finiteOr, pinchBegin, pinchMove, type PinchSt } from './pinch';

/** Scrive un valore condiviso (un'assegnazione scritta così non la rifiuta la regola sulle modifiche). */
function put<T>(sv: { value: T }, v: T) {
  'worklet';
  sv.value = v;
}

/** Dentro i gesti gira sul thread dell'interfaccia: ogni funzione chiamata lì deve essere un worklet. */
const clampMin = (m: number) => {
  'worklet';
  return Math.max(0, Math.min(1439, m));
};

/**
 * Lo zoom del planner, costruito come quello del sito (`pinch()` + `--pxm`): la grandezza vera è UNA sola, la densità
 * in pixel per minuto (`ppm`), e vive sul thread dell'interfaccia. Tutto quello che sta sulla griglia si posiziona a
 * partire da lei (righe, blocchi, altezza della giornata: vedi `DayGrid`), e a ogni movimento delle dita il gesto
 * scrive quel numero e riporta lo scorrimento sotto il punto agganciato, senza passare da React.
 * JavaScript viene avvisato solo quando cambia lo scatto (le etichette degli orari sono altre) e quando il gesto
 * comincia e finisce: poche volte per gesto, come il sito.
 */
export function useZoomEngine(a: {
  /** lo scatto salvato nelle impostazioni */
  zoom: Zoom;
  /** lo scatto da salvare, una volta sola, quando le dita si alzano */
  save: (zoom: Zoom) => void;
  /** spento mentre si trascina un evento */
  enabled: boolean;
  /** un errore dentro il gesto (che sul thread dell'interfaccia farebbe chiudere l'app): si dice e il gesto si ferma */
  onError?: (message: string) => void;
}) {
  const [step, setStep] = useState<Zoom>(a.zoom);
  const [pinching, setPinching] = useState(false);
  // il minuto attorno al quale si disegnano le righe (a ore intere), per non disegnarne mille
  const [center, setCenter] = useState(9 * 60);

  const ppm = useSharedValue(pxPerMinute(a.zoom));
  const stepIdx = useSharedValue(STEP_KEYS.indexOf(a.zoom));
  const startIdx = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const viewH = useSharedValue(0);
  const gridTop = useSharedValue(0);
  const st = useSharedValue<PinchSt | null>(null);
  const anchorMin = useSharedValue(540);
  const anchorY = useSharedValue(0);
  const pinchOn = useSharedValue(0);
  const bucket = useSharedValue(-1);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // lo scatto salvato cambia da fuori (un'altra impostazione, la sincronizzazione): si segue, ma mai a metà gesto
  const [seenZoom, setSeenZoom] = useState(a.zoom);
  if (seenZoom !== a.zoom) {
    setSeenZoom(a.zoom);
    if (!pinching && a.zoom !== step) setStep(a.zoom);
  }
  useEffect(() => {
    if (pinchOn.value === 1) return;
    if (STEP_KEYS.indexOf(a.zoom) === stepIdx.value) return;
    put(ppm, pxPerMinute(a.zoom));
    put(stepIdx, STEP_KEYS.indexOf(a.zoom));
  }, [a.zoom, ppm, stepIdx, pinchOn]);

  /** Porta il minuto agganciato all'altezza agganciata (come `scrollToMinuteAt`), senza uscire dalla giornata. */
  const place = () => {
    'worklet';
    const p = ppm.value;
    if (p <= 0) return;
    const top = gridTop.value;
    const y = top + anchorMin.value * p - anchorY.value;
    const max = Math.max(0, top + 1440 * p - viewH.value);
    const to = Math.max(0, Math.min(max, y));
    // mai uno scorrimento a un numero che non è un numero: iOS lo prende come un errore e chiude l'app
    if (Number.isFinite(to)) scrollTo(scrollRef, 0, to, false);
  };

  const stepChanged = useCallback((idx: number, centerMin: number) => {
    setStep(STEP_KEYS[idx] ?? 'm30');
    setCenter(Math.round(centerMin / 60) * 60);
    haptic.select();
  }, []);
  const modeChanged = useCallback((idx: number) => {
    setStep(STEP_KEYS[idx] ?? 'm30');
    haptic.select();
  }, []);
  const started = useCallback(() => setPinching(true), []);
  const saveRef = useRef(a.save);
  useEffect(() => {
    saveRef.current = a.save;
  });
  const finished = useCallback((idx: number, from: number) => {
    setPinching(false);
    if (idx !== from) saveRef.current(STEP_KEYS[idx] ?? 'm30');
  }, []);
  const errorRef = useRef(a.onError);
  useEffect(() => {
    errorRef.current = a.onError;
  });
  /** Un errore nel gesto: il gesto finisce (le dita si riprendono la pagina) e si racconta cosa è successo. */
  const failed = useCallback((message: string) => {
    setPinching(false);
    errorRef.current?.(message);
  }, []);

  const gesture = usePinchGesture({
    enabled: a.enabled,
    onActivate: (e) => {
      'worklet';
      try {
        const idx = stepIdx.value;
        // il punto fra le dita: se manca, il centro della pagina (mai un numero che non c'è)
        const fy = finiteOr(e.focalY, viewH.value / 2);
        put(st, pinchBegin(idx, ppm.value, e.scale));
        put(startIdx, idx);
        put(anchorY, fy);
        // da lista non c'è un orario sotto le dita: si riparte dalle 9, come sul sito
        put(
          anchorMin,
          idx === 0 || ppm.value <= 0
            ? 540
            : clampMin((scrollY.value + fy - gridTop.value) / ppm.value),
        );
        put(pinchOn, 1);
        scheduleOnRN(started);
      } catch (err) {
        put(pinchOn, 0);
        scheduleOnRN(failed, `pinch start: ${String(err)}`);
      }
    },
    onUpdate: (e) => {
      'worklet';
      try {
        const cur = st.value;
        if (!cur) return;
        const m = pinchMove(cur, e.scale);
        put(st, m.st);
        if (m.kind === 'none') return;
        if (!Number.isFinite(m.ppm)) return;
        put(ppm, m.ppm);
        if (m.kind === 'mode') {
          if (m.st.step === 1) put(anchorMin, 540);
          put(stepIdx, m.st.step);
          scheduleOnRN(modeChanged, m.st.step);
          if (m.st.step > 0) place();
          return;
        }
        place();
        if (m.st.step !== stepIdx.value) {
          put(stepIdx, m.st.step);
          scheduleOnRN(stepChanged, m.st.step, anchorMin.value);
        }
      } catch (err) {
        scheduleOnRN(failed, `pinch move: ${String(err)}`);
      }
    },
    onFinalize: () => {
      'worklet';
      try {
        if (pinchOn.value === 0) return;
        put(pinchOn, 0);
        scheduleOnRN(finished, stepIdx.value, startIdx.value);
      } catch (err) {
        scheduleOnRN(failed, `pinch end: ${String(err)}`);
      }
    },
  });

  /** Un gesto spento, per le pagine vicine: stesso albero, nessuna presa. */
  const idle = usePinchGesture({ enabled: false });

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    const p = ppm.value;
    if (p <= 0) return;
    const c = (e.contentOffset.y + viewH.value / 2 - gridTop.value) / p;
    const b = Math.round(c / 60);
    if (b !== bucket.value) {
      bucket.value = b;
      scheduleOnRN(setCenter, Math.max(0, Math.min(1439, b * 60)));
    }
  });

  /** Dalla rotellina: si torna alla densità naturale dello scatto, tenendo fermo quello che si guarda (il centro). */
  const choose = useCallback(
    (z: Zoom) => {
      const idx = STEP_KEYS.indexOf(z);
      const cm =
        ppm.value > 0
          ? clampMin((scrollY.value + viewH.value / 2 - gridTop.value) / ppm.value)
          : 540;
      put(anchorMin, cm);
      put(anchorY, viewH.value / 2);
      put(stepIdx, idx);
      put(ppm, naturalPpm(idx));
      setStep(z);
      setCenter(Math.round(cm / 60) * 60);
      saveRef.current(z);
      // dalla lista la griglia nasce adesso: il punto agganciato si riporta in vista quando ha la sua altezza
      const settle = () =>
        scheduleOnUI(() => {
          'worklet';
          place();
        });
      settle();
      requestAnimationFrame(() => requestAnimationFrame(settle));
      setTimeout(settle, 120);
    },
    // `place` è un worklet creato a ogni giro: conta solo quello che legge
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ppm, scrollY, viewH, gridTop, anchorMin, anchorY, stepIdx],
  );

  /** La densità di adesso, per chi non si ridisegna con lei (un tocco, un trascinamento). */
  const getPpm = () => ppm.value;
  /** Quanto è scesa la pagina adesso. */
  const getScrollY = () => scrollY.value;
  /** Le misure della pagina, per tenere agganciato l'orario. */
  const setLayout = (view: number, grid: number | null) => {
    put(viewH, view);
    if (grid !== null) put(gridTop, grid);
  };
  return {
    ppm,
    step,
    pinching,
    center,
    gesture,
    idle,
    scrollRef,
    onScroll,
    choose,
    getPpm,
    getScrollY,
    setLayout,
    stepIdx,
  };
}

export type ZoomEngine = ReturnType<typeof useZoomEngine>;
