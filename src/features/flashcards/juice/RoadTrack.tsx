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

/** Il testo sopra un colore: scuro sui colori chiari, bianco sugli scuri (il «lch» del sito). */
export function inkOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1C1C1E' : '#fff';
}

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
  const p1 = useAnimatedProps(() => ({ strokeDasharray: `${C1 * o1.get()} ${C1}` }));
  const p2 = useAnimatedProps(() => ({ strokeDasharray: `${C2 * o2.get()} ${C2}` }));
  return (
    <Svg
      width={46}
      height={46}
      viewBox="0 0 36 36"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Circle cx={18} cy={18} r={15.2} stroke={track} strokeWidth={4.2} fill="none" />
      <AnimatedCircle
        cx={18}
        cy={18}
        r={15.2}
        stroke={color}
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
        transform="rotate(-90 18 18)"
        animatedProps={p1}
      />
      {two ? (
        <>
          <Circle cx={18} cy={18} r={9.6} stroke={track} strokeWidth={3.6} fill="none" />
          <AnimatedCircle
            cx={18}
            cy={18}
            r={9.6}
            stroke={color}
            strokeWidth={3.6}
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
export function roadX(percent: number, width: number): number {
  // 'worklet': the line is sized on the UI thread (a plain function there makes the app crash)
  'worklet';
  return DISC / 2 + (width - DISC) * (percent / 100);
}

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
  right,
  onErrors,
}: {
  model: RoadModel;
  every: number;
  /** le posizioni con almeno una risposta sbagliata */
  wrong: readonly number[];
  accent: string;
  /** il testo accanto all'anello (dove si è arrivati, la serie) */
  title: ReactNode;
  /** a destra nella riga dell'anello: orologio, impostazioni, microfono */
  right?: ReactNode;
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

  const ink = inkOn(accent);
  const path = (
    <View
      accessibilityLabel={t('fc.gm_f2_percorso')}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 26, justifyContent: 'center' }}
    >
      <View style={{ height: 2, borderRadius: 1, backgroundColor: th.hairline2 }} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            height: 2,
            borderRadius: 1,
            backgroundColor: accent,
            opacity: 0.3,
          },
          beyondStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            height: 2,
            borderRadius: 1,
            backgroundColor: accent,
            shadowColor: accent,
            shadowOpacity: 0.6,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
          },
          fillStyle,
        ]}
      />
      {width > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
      ) : null}
      {width > 0
        ? discs.map(([a, b]) => {
            const n = wrongIn(wrong, a, b);
            const state = discState(model.pos, a, b);
            const cur = state === 'cur';
            const size = n > 0 || cur ? (cur ? 22 : 18) : state === 'ok' ? 5 : 4;
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
                    backgroundColor: accent,
                    borderWidth: cur ? 1.5 : 0,
                    borderColor: th.surface,
                    shadowColor: accent,
                    shadowOpacity: 0.55,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 },
                  }
                : cur
                  ? {
                      ...base,
                      backgroundColor: th.surface,
                      borderWidth: 1.5,
                      borderColor: accent,
                      shadowColor: accent,
                      shadowOpacity: 0.35,
                      shadowRadius: 5,
                      shadowOffset: { width: 0, height: 0 },
                    }
                  : state === 'ok'
                    ? { ...base, backgroundColor: accent, opacity: 0.85 }
                    : { ...base, backgroundColor: th.hairline2 };
            return n > 0 ? (
              <Pressable
                key={a}
                testID={`fcg-disc-${a}`}
                accessibilityRole="button"
                accessibilityLabel={t('fc.gm_f2_nodo', { n })}
                hitSlop={9}
                onPress={() => onErrors(a, b)}
                style={style}
              >
                <Text
                  style={{
                    color: ink,
                    fontSize: 10,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            ) : (
              <View key={a} testID={`fcg-disc-${a}`} style={style} />
            );
          })
        : null}
    </View>
  );

  return (
    <View testID="fcg-road" style={{ gap: 6 }}>
      {path}
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
        <View style={{ flex: 1, minWidth: 0 }}>{title}</View>
        {right}
      </View>
    </View>
  );
}
