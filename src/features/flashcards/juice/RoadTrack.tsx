import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { stretches, wrongIn } from '../gameJuice';
import { discState, ringNumbers, type RoadModel } from '../roadModel';

/** Il lilla dei flashcard, quando il mazzo non ha un colore suo. */
export const ROAD_ACCENT = '#B79CFF';

const C1 = 2 * Math.PI * 15.2;
const C2 = 2 * Math.PI * 9.6;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * L'anello doppio verso il prossimo checkpoint: fuori le posizioni del tratto, dentro le carte (se ci sono sottocarte).
 * Quando si passa un checkpoint l'anello riparte da zero, non torna indietro girando al contrario.
 */
export function RoadRing({
  outer,
  inner,
  two,
  color,
  track,
}: {
  outer: number;
  inner: number;
  two: boolean;
  color: string;
  track: string;
}) {
  const still = useReducedMotion();
  const o1 = useSharedValue(outer);
  const o2 = useSharedValue(inner);
  useEffect(() => {
    const go = (sv: typeof o1, to: number) => {
      if (still) {
        sv.set(to);
        return;
      }
      if (to < sv.get()) sv.set(0);
      sv.set(withTiming(to, { duration: 450, easing: Easing.out(Easing.cubic) }));
    };
    go(o1, outer);
    go(o2, inner);
  }, [outer, inner, still, o1, o2]);
  const p1 = useAnimatedProps(() => ({ strokeDasharray: [C1 * o1.get(), C1] }));
  const p2 = useAnimatedProps(() => ({ strokeDasharray: [C2 * o2.get(), C2] }));
  return (
    <Svg
      width={46}
      height={46}
      viewBox="0 0 36 36"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Circle cx={18} cy={18} r={15.2} stroke={track} strokeWidth={3} fill="none" />
      <AnimatedCircle
        cx={18}
        cy={18}
        r={15.2}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        transform="rotate(-90 18 18)"
        animatedProps={p1}
      />
      {two ? (
        <>
          <Circle cx={18} cy={18} r={9.6} stroke={track} strokeWidth={3} fill="none" />
          <AnimatedCircle
            cx={18}
            cy={18}
            r={9.6}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            transform="rotate(-90 18 18)"
            animatedProps={p2}
          />
        </>
      ) : null}
    </Svg>
  );
}

const DISC = 17;

/** La posizione di un punto sulla linea: tiene l'ultimo disco dentro i bordi (come `f2X` del sito). */
export const roadX = (percent: number, width: number): number =>
  DISC / 2 + (width - DISC) * (percent / 100);

/**
 * Il tracciato della partita: una linea con i dischi dei tratti (uno per checkpoint; se sono troppi più tratti si
 * fondono). Un disco con errori mostra quanti e, se lo si tocca, apre l'elenco di quelle carte.
 */
export function RoadTrack({
  model,
  every,
  wrong,
  accent,
  title,
  onErrors,
}: {
  model: RoadModel;
  every: number;
  /** le posizioni con almeno una risposta sbagliata */
  wrong: readonly number[];
  accent: string;
  /** il testo accanto all'anello (dove si è arrivati, la serie) */
  title: ReactNode;
  onErrors: (from: number, to: number) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const v = ringNumbers(model, every);
  const discs = stretches(model.tot, every);
  const fillW = useSharedValue(v.fill);
  const beyondW = useSharedValue(v.beyond);
  const still = useReducedMotion();
  useEffect(() => {
    const to = (sv: typeof fillW, x: number) =>
      sv.set(still ? x : withTiming(x, { duration: 420, easing: Easing.out(Easing.cubic) }));
    to(fillW, v.fill);
    to(beyondW, v.beyond);
  }, [v.fill, v.beyond, still, fillW, beyondW]);
  const fillStyle = useAnimatedStyle(() => ({ width: roadX(fillW.get(), width) }));
  const beyondStyle = useAnimatedStyle(() => ({ width: roadX(beyondW.get(), width) }));

  return (
    <View testID="fcg-road" style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {v.ring ? (
          <View
            testID="fcg-road-ring"
            accessible
            accessibilityLabel={t('fc.gm_f2_ring', { c: v.leftPositions, k: v.leftCards })}
          >
            <RoadRing outer={v.o1} inner={v.o2} two={v.r2} color={accent} track={th.hairline2} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>{title}</View>
      </View>
      <View
        accessibilityLabel={t('fc.gm_f2_percorso')}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 26, justifyContent: 'center' }}
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: th.hairline2 }} />
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              height: 4,
              borderRadius: 2,
              backgroundColor: accent,
              opacity: 0.35,
            },
            beyondStyle,
          ]}
        />
        <Animated.View
          style={[
            { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: accent },
            fillStyle,
          ]}
        />
        {width > 0
          ? discs.map(([a, b]) => {
              const n = wrongIn(wrong, a, b);
              const state = discState(model.pos, a, b);
              const size = state === 'cur' ? DISC + 3 : DISC;
              const left = roadX((b / model.tot) * 100, width) - size / 2;
              const base = {
                position: 'absolute' as const,
                left,
                width: size,
                height: size,
                borderRadius: size / 2,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
              };
              const style =
                n > 0
                  ? {
                      ...base,
                      backgroundColor: th.red,
                      borderWidth: state === 'cur' ? 2 : 0,
                      borderColor: th.text,
                    }
                  : state === 'ok'
                    ? { ...base, backgroundColor: accent }
                    : state === 'cur'
                      ? { ...base, backgroundColor: th.bg, borderWidth: 3, borderColor: accent }
                      : {
                          ...base,
                          backgroundColor: th.bg,
                          borderWidth: 2,
                          borderColor: th.hairline2,
                        };
              const text =
                n > 0 ? (
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{n}</Text>
                ) : null;
              return n > 0 ? (
                <Pressable
                  key={a}
                  testID={`fcg-disc-${a}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('fc.gm_f2_nodo', { n })}
                  hitSlop={8}
                  onPress={() => onErrors(a, b)}
                  style={style}
                >
                  {text}
                </Pressable>
              ) : (
                <View key={a} testID={`fcg-disc-${a}`} style={style} />
              );
            })
          : null}
      </View>
    </View>
  );
}
