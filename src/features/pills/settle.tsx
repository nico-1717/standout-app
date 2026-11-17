/**
 * Il «preso» che si vede: la pastiglia si segna SUBITO (la risposta è già scritta), ma la scheda resta ancora un
 * attimo con la spunta che si riempie, poi esce piano e le altre scorrono al suo posto. Così non è uno sparire di
 * colpo, e la lista non salta.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutLeft,
  interpolateColor,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { DoseView } from './repo';

/** Quanto resta la scheda «fatta» prima di uscire. */
export const SETTLE_MS = 560;
const FILL_MS = 220;
const OUT_MS = 220;
const FLOW_MS = 240;

export type Answer = 'taken' | 'skipped';
export interface SettleRow {
  dose: DoseView;
  /** null = ancora da rispondere */
  how: Answer | null;
}

/** Le prese da mostrare: quelle in sospeso, più per un attimo quelle appena segnate. */
export function useSettling(doses: DoseView[]): {
  rows: SettleRow[];
  settle: (dose: DoseView, how: Answer) => void;
} {
  const [held, setHeld] = useState<ReadonlyMap<string, SettleRow>>(new Map());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const rows = useMemo(() => {
    const live = new Set(doses.map((d) => d.uuid));
    const mine = doses.map((dose) => ({ dose, how: held.get(dose.uuid)?.how ?? null }));
    const gone = [...held.values()].filter((h) => !live.has(h.dose.uuid));
    return [...mine, ...gone].sort((a, b) =>
      `${a.dose.due_date} ${a.dose.due_time}`.localeCompare(
        `${b.dose.due_date} ${b.dose.due_time}`,
      ),
    );
  }, [doses, held]);

  const settle = (dose: DoseView, how: Answer) => {
    setHeld((m) => new Map(m).set(dose.uuid, { dose, how }));
    const t = setTimeout(() => {
      timers.current.delete(t);
      setHeld((m) => {
        const next = new Map(m);
        next.delete(dose.uuid);
        return next;
      });
    }, SETTLE_MS);
    timers.current.add(t);
  };
  return { rows, settle };
}

const system = ReduceMotion.System;

/** Una scheda che entra dal basso, esce verso sinistra e fa scorrere le vicine; da «fatta» si tinge del suo colore. */
export function SettleCard({
  settled,
  base,
  tint,
  style,
  testID,
  children,
}: {
  settled: boolean;
  /** lo sfondo normale e quello da «fatta» (due #RRGGBB) */
  base: string;
  tint: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}) {
  const p = useSharedValue(settled ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(settled ? 1 : 0, { duration: FILL_MS, reduceMotion: system }));
  }, [settled, p]);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.get(), [0, 1], [base, tint]),
  }));
  return (
    <Animated.View
      testID={testID}
      entering={FadeInDown.duration(OUT_MS).easing(Easing.out(Easing.cubic)).reduceMotion(system)}
      exiting={FadeOutLeft.duration(OUT_MS).reduceMotion(system)}
      layout={LinearTransition.duration(FLOW_MS).reduceMotion(system)}
      style={[style, bg]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Il tondo con la spunta: premuto si riempie del colore e la spunta si fa bianca crescendo da piccola a piena
 * (senza rimbalzo). `how` dice se è già stata data la risposta (e non si preme più).
 */
export function TickButton({
  color,
  onColor,
  how,
  size = 28,
  glyph = 13,
  testID,
  label,
  onPress,
}: {
  color: string;
  /** il colore della spunta sul fondo pieno */
  onColor: string;
  how: Answer | null;
  size?: number;
  glyph?: number;
  testID: string;
  label: string;
  onPress: () => void;
}) {
  const done = how === 'taken';
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(done ? 1 : 0, { duration: FILL_MS, reduceMotion: system }));
  }, [done, p]);
  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.get(), [0, 1], [`${color}29`, color]),
  }));
  const tick = useAnimatedStyle(() => ({
    transform: [{ scale: 0.7 + 0.3 * p.get() }],
  }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: how !== null, checked: done }}
      disabled={how !== null}
      hitSlop={8}
      onPress={onPress}
    >
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          { alignItems: 'center', justifyContent: 'center' },
          fill,
        ]}
      >
        <Animated.View style={tick}>
          <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 12.5l5.2 5.2L20 6.6"
              stroke={done ? onColor : color}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
