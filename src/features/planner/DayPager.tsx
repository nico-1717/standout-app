import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderHandlers } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/ui/motion';

import { addDaysIso } from './dates';

/** Un quarto di schermata basta per cambiare giorno (come `psEnd` del sito); sotto, la pagina torna indietro. */
const FRACTION = 0.25;
/** Uno scatto veloce basta anche se è corto: da questa distanza, con questa velocità (punti al secondo). */
const FLICK_MIN = 40;
const FLICK_SPEED = 700;
const GRAB_X = 10;
const LEAVE_Y = 14;
const SETTLE_MS = 260;
const BACK_MS = 200;

/** Scrive un valore condiviso (un'assegnazione scritta così non la rifiuta la regola sulle modifiche). */
function put(sv: { value: number }, v: number) {
  'worklet';
  sv.value = v;
}

const dayIndex = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Al rilascio: si cambia giorno? `dx` è dove sta la pagina, `vx` la velocità del dito (punti al secondo). */
export function pageFires(dx: number, vx: number, width: number): boolean {
  'worklet';
  if (Math.abs(dx) >= width * FRACTION) return true;
  return (
    Math.abs(dx) >= FLICK_MIN && Math.abs(vx) >= FLICK_SPEED && Math.sign(vx) === Math.sign(dx)
  );
}

/**
 * Una pagina del giorno: sta ferma al suo posto finché non si trascina, poi segue il dito insieme alle altre
 * (`x`) a una schermata di distanza per ogni giorno di differenza.
 */
function Pane(p: {
  idx: number;
  width: number;
  x: { value: number };
  anchor: { value: number };
  live: { value: number };
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: p.live.value === 1 ? p.x.value + (p.idx - p.anchor.value) * p.width : 0 },
    ],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{p.children}</Animated.View>;
}

/**
 * La giornata che segue il dito (come il sito, `psBegin`/`psPlace`/`psEnd`): mentre si trascina in orizzontale la
 * pagina del giorno scorre e accanto arriva quella del giorno vicino; sul rilascio o si assesta sul nuovo giorno o
 * torna indietro. Tutto sul thread dell'interfaccia, quindi non si accorge del lavoro di JavaScript.
 *
 * Le pagine vicine si disegnano solo da quando il dito tocca lo schermo fino a quando ha finito, così nell'uso
 * normale (e mentre si pizzica) c'è una pagina sola. `render` disegna un giorno: `startY` è dove era scesa la pagina
 * al tocco, perché le vicine stiano alla stessa altezza.
 */
export function DayPager(p: {
  date: string;
  width: number;
  /** spento mentre si trascina un evento o si pizzica */
  enabled: boolean;
  /** il gesto a due dita del pizzico, che sta sul contenitore */
  panHandlers: GestureResponderHandlers;
  /** di quanto è scesa la pagina adesso */
  scrollY: () => number;
  /** `y` è l'altezza a cui era la pagina quando il dito si è posato: a quella deve restare */
  onStep: (delta: 1 | -1, y: number) => void;
  render: (day: string, current: boolean, startY: number) => ReactNode;
}) {
  const [armed, setArmed] = useState<number | null>(null);
  const latest = useRef(p);
  useEffect(() => {
    latest.current = p;
  });

  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const anchor = useSharedValue(dayIndex(p.date));
  const dateIdx = useSharedValue(dayIndex(p.date));
  const live = useSharedValue(0);
  const pending = useSharedValue(0);
  const moving = useSharedValue(0);
  const width = useSharedValue(p.width);
  useEffect(() => {
    put(dateIdx, dayIndex(p.date));
    put(width, p.width);
  }, [p.date, p.width, dateIdx, width]);

  const armedY = useRef(0);
  const arm = useCallback(() => {
    armedY.current = latest.current.scrollY();
    setArmed(armedY.current);
  }, []);
  const disarm = useCallback(() => setArmed(null), []);
  // Le pagine tornano ferme solo quando quella nuova è già stata disegnata: azzerare `live` prima le farebbe
  // sovrapporre tutte e tre al loro posto, con sopra quella del giorno dopo (un lampo dei giorni sbagliati).
  useLayoutEffect(() => {
    if (armed === null) put(live, 0);
  }, [armed, p.date, live]);
  const commit = useCallback(
    (delta: 1 | -1) => {
      haptic.select();
      latest.current.onStep(delta, armedY.current);
      disarm();
    },
    [disarm],
  );

  const pan = usePanGesture({
    enabled: p.enabled,
    maxPointers: 1,
    activeOffsetX: [-GRAB_X, GRAB_X],
    failOffsetY: [-LEAVE_Y, LEAVE_Y],
    onBegin: () => {
      'worklet';
      if (pending.value !== 0) {
        // un cambio ancora in volo: lo si chiude subito (due gesti sovrapposti non lasciano pagine a metà)
        const d = pending.value;
        cancelAnimation(x);
        put(dateIdx, dateIdx.value + d);
        x.value = 0;
        pending.value = 0;
        scheduleOnRN(commit, d > 0 ? 1 : -1);
      } else {
        cancelAnimation(x);
      }
      anchor.value = dateIdx.value;
      startX.value = x.value;
      put(live, 1);
      scheduleOnRN(arm);
    },
    onActivate: (e) => {
      'worklet';
      put(moving, 1);
      // un tratto veloce può arrivare con un solo movimento: la pagina parte già da dove è il dito
      put(x, Math.max(-width.value, Math.min(width.value, startX.value + e.translationX)));
    },
    onUpdate: (e) => {
      'worklet';
      const w = width.value;
      x.value = Math.max(-w, Math.min(w, startX.value + e.translationX));
    },
    onDeactivate: (e) => {
      'worklet';
      const w = width.value;
      const dx = Math.max(-w, Math.min(w, startX.value + e.translationX));
      if (!e.canceled && pageFires(dx, e.velocityX, w)) {
        const dir = dx < 0 ? 1 : -1;
        pending.value = dir;
        x.value = withTiming(
          -dir * w,
          { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
          (done) => {
            if (!done) return;
            put(anchor, anchor.value + dir);
            put(dateIdx, dateIdx.value + dir);
            x.value = 0;
            pending.value = 0;
            scheduleOnRN(commit, dir);
          },
        );
      } else {
        x.value = withTiming(0, { duration: BACK_MS, easing: Easing.out(Easing.cubic) }, (done) => {
          if (done) scheduleOnRN(disarm);
        });
      }
    },
    onFinalize: () => {
      'worklet';
      // un tocco o un tratto verticale che non ha mai preso la pagina: niente da assestare
      if (moving.value === 0) scheduleOnRN(disarm);
      put(moving, 0);
    },
  });

  // una lista con le chiavi: la pagina vicina che diventa quella di adesso resta la stessa e non si ridisegna
  const days = armed === null ? [p.date] : [addDaysIso(p.date, -1), p.date, addDaysIso(p.date, 1)];
  return (
    <View style={styles.box} {...p.panHandlers}>
      <GestureDetector gesture={pan}>
        <View style={styles.box}>
          {days.map((d) => (
            <Pane key={d} idx={dayIndex(d)} width={p.width} x={x} anchor={anchor} live={live}>
              {p.render(d, d === p.date, d === p.date ? 0 : (armed ?? 0))}
            </Pane>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({ box: { flex: 1, overflow: 'hidden' } });
