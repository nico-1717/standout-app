import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/*
 * Lo swipe «alla Tinder» della carta (fc_game.php del sito): a risposta vista si trascina a destra per «giusta» e a
 * sinistra per «sbagliata». Mentre si trascina lo schermo si tinge di verde o di rosso e compare il timbro; oltre la
 * soglia (130 punti, o un terzo dello schermo) la carta vola via. Lo stesso volo parte quando si vota coi tasti o con la
 * voce (gradeFeedback del sito): a destra la giusta, a sinistra la sbagliata, in alto l'imparata.
 */

export type FlyKind = 'correct' | 'wrong' | 'learnt';

/** Quanto dura il volo prima che arrivi la carta dopo (nei test niente attesa). */
export const FLY_MS = process.env.JEST_WORKER_ID ? 0 : 290;

export interface SwipeState {
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** la carta che sparisce volando e riappare con quella dopo */
  o: SharedValue<number>;
  /** il lampo del colore del voto su tutto lo schermo (0..1) e il suo colore: 1 verde, -1 rosso, 2 arancio */
  flash: SharedValue<number>;
  tone: SharedValue<number>;
}

export function useSwipeState(): SwipeState {
  return {
    x: useSharedValue(0),
    y: useSharedValue(0),
    o: useSharedValue(1),
    flash: useSharedValue(0),
    tone: useSharedValue(1),
  };
}

/** La soglia dello swipe (TH del sito). */
const threshold = (w: number): number => {
  'worklet';
  return Math.min(130, w * 0.34);
};

/** Fa volare via la carta per un voto (tasto o voce), con il lampo del suo colore. */
export function flyAway(s: SwipeState, kind: FlyKind, w: number, h: number): void {
  const ease = { duration: 340, easing: Easing.bezier(0.5, 0, 0.9, 0.45) };
  s.tone.set(kind === 'correct' ? 1 : kind === 'wrong' ? -1 : 2);
  s.flash.set(0.42);
  s.flash.set(withTiming(0, { duration: 420 }));
  if (kind === 'learnt') {
    s.y.set(withTiming(-1.2 * h, ease));
  } else {
    s.x.set(withTiming((kind === 'correct' ? 1.2 : -1.2) * w, ease));
    s.y.set(withTiming(-0.06 * h, ease));
  }
  s.o.set(withTiming(0, ease));
}

/** La carta dopo: torna al centro e compare sfumando. */
export function comeBack(s: SwipeState): void {
  s.x.set(0);
  s.y.set(0);
  s.o.set(0);
  s.o.set(withTiming(1, { duration: 180 }));
}

/** La carta che si può trascinare (solo con la risposta vista). */
export function SwipeCard(p: {
  s: SwipeState;
  enabled: boolean;
  onCommit: (good: boolean) => void;
  onCross: () => void;
  /** la carta dopo, che si vede dietro mentre si trascina */
  behind?: ReactNode;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const { s } = p;
  const crossed = useSharedValue(false);
  const latest = useRef(p);
  useEffect(() => {
    latest.current = p;
  });
  const cross = useCallback(() => latest.current.onCross(), []);
  const commit = useCallback((good: boolean) => latest.current.onCommit(good), []);
  const pan = usePanGesture({
    enabled: p.enabled,
    activeOffsetX: [-10, 10],
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      s.x.set(e.translationX);
      s.y.set(e.translationY * 0.4);
      const over = Math.abs(e.translationX) >= threshold(width);
      if (over && !crossed.get()) scheduleOnRN(cross);
      crossed.set(over);
    },
    onDeactivate: (e) => {
      'worklet';
      crossed.set(false);
      if (!e.canceled && Math.abs(e.translationX) >= threshold(width)) {
        const good = e.translationX > 0;
        s.tone.set(good ? 1 : -1);
        s.flash.set(0.68);
        s.flash.set(withTiming(0, { duration: 320 }));
        s.x.set(
          withTiming((good ? 1.2 : -1.2) * width, {
            duration: 340,
            easing: Easing.bezier(0.5, 0, 0.9, 0.45),
          }),
        );
        s.y.set(withTiming(e.translationY * 0.4 + 60, { duration: 340 }));
        s.o.set(withTiming(0, { duration: 340 }));
        scheduleOnRN(commit, good);
      } else {
        s.x.set(withSpring(0, { damping: 18, stiffness: 220 }));
        s.y.set(withSpring(0, { damping: 18, stiffness: 220 }));
      }
    },
  });
  const style = useAnimatedStyle(() => {
    const x = s.x.get();
    const rot = Math.max(-20, Math.min(20, x * 0.06));
    return {
      opacity: s.o.get(),
      transform: [
        { translateX: x },
        { translateY: s.y.get() },
        { rotate: `${rot}deg` },
        { scale: x === 0 && s.y.get() === 0 ? 1 : 1.02 },
      ],
    };
  });
  // la carta dietro si avvicina man mano che quella davanti si allontana
  const back = useAnimatedStyle(() => {
    const k = Math.min(1, Math.abs(s.x.get()) / threshold(width));
    const gone = 1 - s.o.get();
    const v = Math.max(k, gone);
    return {
      opacity: s.x.get() === 0 && gone === 0 ? 0 : 0.55 + v * 0.45,
      transform: [{ scale: 0.94 + v * 0.06 }],
    };
  });
  return (
    <View>
      {p.behind ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, back]}
        >
          {p.behind}
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={style}>{p.children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

/** La tinta dello schermo e il timbro «CORRECT» / «WRONG» (#swipe-tint, .swipe-stamp del sito). */
export function SwipeOverlay({ s }: { s: SwipeState }) {
  const { width } = useWindowDimensions();
  const tint = useAnimatedStyle(() => {
    const x = s.x.get();
    const drag = s.o.get() > 0.99 ? Math.min(1, Math.abs(x) / threshold(width)) * 0.55 : 0;
    const f = s.flash.get();
    const tone = f > 0 ? s.tone.get() : x >= 0 ? 1 : -1;
    return {
      opacity: Math.max(drag, f),
      backgroundColor: tone === 2 ? '#FF9500' : tone === 1 ? '#30D158' : '#FF453A',
    };
  });
  const okStyle = useAnimatedStyle(() => {
    const x = s.x.get();
    const p = Math.min(1, Math.abs(x) / threshold(width));
    return {
      opacity: x > 4 && s.o.get() > 0.99 ? Math.min(1, p * 1.25) : 0,
      transform: [{ translateX: -160 }, { rotate: '-10deg' }, { scale: 0.8 + p * 0.28 }],
    };
  });
  const koStyle = useAnimatedStyle(() => {
    const x = s.x.get();
    const p = Math.min(1, Math.abs(x) / threshold(width));
    return {
      opacity: x < -4 && s.o.get() > 0.99 ? Math.min(1, p * 1.25) : 0,
      transform: [{ translateX: -160 }, { rotate: '10deg' }, { scale: 0.8 + p * 0.28 }],
    };
  });
  const box = {
    position: 'absolute' as const,
    top: '38%' as const,
    left: '50%' as const,
    width: 320,
    alignItems: 'center' as const,
  };
  const label = (text: string) => (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 30,
        borderWidth: 5,
        borderColor: '#fff',
        borderRadius: 18,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: 4.6 }}>
        {text}
      </Text>
    </View>
  );
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
    >
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, tint]}
      />
      <Animated.View style={[box, okStyle]}>{label('CORRECT')}</Animated.View>
      <Animated.View style={[box, koStyle]}>{label('WRONG')}</Animated.View>
    </View>
  );
}
