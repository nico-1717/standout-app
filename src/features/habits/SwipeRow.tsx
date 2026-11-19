import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import type { HabitsTheme } from './habitsTheme';

/** Quanto si deve trascinare perché scatti. */
const THRESHOLD = 46;
/** Uno scatto veloce basta anche se è corto: dalla metà della soglia, con una certa velocità (punti per ms). */
const FLICK_MIN = 24;
const FLICK_SPEED = 0.3;
/** Quanto dito si muove di lato prima che il gesto prenda la riga; e quanto in verticale prima che lo lasci alla pagina. */
const GRAB_X = 7;
const LEAVE_Y = 12;
const SPRING_BACK = { damping: 22, stiffness: 320, mass: 0.7 } as const;
const TRASH_PATH = 'M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3';

/** Al rilascio: scatta l'azione? Serve la distanza intera, oppure uno scatto veloce nella stessa direzione. */
export function swipeFires(dx: number, vx: number): boolean {
  'worklet';
  if (Math.abs(dx) >= THRESHOLD) return true;
  return (
    Math.abs(dx) >= FLICK_MIN && Math.abs(vx) >= FLICK_SPEED && Math.sign(vx) === Math.sign(dx)
  );
}

/** Dove sta la riga per un dito mosso di `dx`: oltre la soglia c'è resistenza, si sente che il gesto è «arrivato». */
export function easedOffset(dx: number): number {
  'worklet';
  const a = Math.abs(dx);
  return a > THRESHOLD ? Math.sign(dx) * (THRESHOLD + (a - THRESHOLD) * 0.34) : dx;
}

type Live = {
  allowRight: boolean;
  allowLeft: boolean;
  onSwipe: (dir: 1 | -1) => void;
  onBuzz?: () => void;
};

/**
 * Il gesto della riga. Gira tutto sul thread dell'interfaccia (Gesture Handler + Reanimated): la riga segue il dito
 * senza passare dal JavaScript, e un tratto orizzontale prende il tocco prima dello scorrimento della pagina
 * (che lo perde appena il dito sale o scende di più di LEAVE_Y senza muoversi di lato).
 */
function useRowSwipe(live: Live) {
  const x = useSharedValue(0);
  const latest = useRef(live);
  useEffect(() => {
    latest.current = live;
  });
  const buzzed = useSharedValue(false);
  const buzz = useCallback(() => latest.current.onBuzz?.(), []);
  const fire = useCallback((dir: 1 | -1) => latest.current.onSwipe(dir), []);

  const { allowRight, allowLeft } = live;
  const activeOffsetX: number | [number, number] = allowRight
    ? allowLeft
      ? [-GRAB_X, GRAB_X]
      : GRAB_X
    : -GRAB_X;

  const pan = usePanGesture({
    enabled: allowRight || allowLeft,
    activeOffsetX,
    failOffsetY: [-LEAVE_Y, LEAVE_Y],
    onUpdate: (e) => {
      'worklet';
      const dx = e.translationX;
      const ok = dx > 0 ? allowRight : allowLeft;
      x.value = ok ? easedOffset(dx) : 0;
      const past = ok && Math.abs(dx) >= THRESHOLD;
      if (past && !buzzed.value) {
        buzzed.value = true;
        scheduleOnRN(buzz);
      } else if (!past && buzzed.value) {
        buzzed.value = false;
      }
    },
    onDeactivate: (e) => {
      'worklet';
      const dx = e.translationX;
      const ok = dx > 0 ? allowRight : allowLeft;
      if (!e.canceled && ok && swipeFires(dx, e.velocityX / 1000))
        scheduleOnRN(fire, dx > 0 ? 1 : -1);
    },
    onFinalize: () => {
      'worklet';
      buzzed.value = false;
      x.value = withSpring(0, SPRING_BACK);
    },
  });
  return { x, pan };
}

/**
 * Lo scorrimento laterale di una riga (come .hb-row-behind del sito): verso destra «Fatto» (o «Ci sono cascato»),
 * verso sinistra «Annulla». Oltre 46 punti (o con uno scatto veloce, già da 24), al rilascio, scatta l'azione; se in quella direzione non c'è nulla
 * da fare la riga resta ferma. Un movimento verticale è lo scorrimento della pagina e non prende mai il tocco.
 */
export function SwipeRow(p: {
  th: Pick<HabitsTheme, 'red'>;
  color: string;
  doneLabel: string;
  undoLabel: string;
  allowRight: boolean;
  allowLeft: boolean;
  onSwipe: (dir: 1 | -1) => void;
  onBuzz?: () => void;
  children: ReactNode;
  testID?: string;
  /** il disegno sul lato «destra»: la spunta (abitudini) o il cestino (to do) */
  icon?: 'check' | 'trash';
  /** gli angoli: 22 nelle abitudini, meno nelle righe del to do */
  radius?: number;
}) {
  const { th } = p;
  const { x, pan } = useRowSwipe(p);
  // fermo non si vede (niente bordino colorato attorno alla riga); appena si muove, appare
  const behindStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(x.value) / 6) }));
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[styles.wrap, p.radius !== undefined && { borderRadius: p.radius }]}
      testID={p.testID}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.behind,
          p.radius !== undefined && { borderRadius: p.radius },
          behindStyle,
        ]}
        pointerEvents="none"
      >
        <View style={[styles.side, { backgroundColor: p.color, justifyContent: 'flex-start' }]}>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path
              d={p.icon === 'trash' ? TRASH_PATH : 'M20 6L9 17l-5-5'}
              stroke="#fff"
              strokeWidth={p.icon === 'trash' ? 2.2 : 3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.label}>{p.doneLabel}</Text>
        </View>
        <View style={[styles.side, { backgroundColor: th.red, justifyContent: 'flex-end' }]}>
          <Text style={styles.label}>{p.undoLabel}</Text>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path
              d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1"
              stroke="#fff"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{p.children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 22 },
  behind: { flexDirection: 'row', borderRadius: 22, overflow: 'hidden' },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22 },
  label: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
});
