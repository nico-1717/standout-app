import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

/**
 * La scena della pausa (portata da `pausa_scena.php` del sito): un disegno a matita all'aperto, con il sole che
 * respira, un albero, tre ciuffi d'erba, due uccelli, un'ape, una farfalla e una persona con la tisana (il vapore sale).
 * Tutto lento e sfasato. Con «Riduci movimento» il disegno resta fermo.
 *
 * Il disegno fermo è un unico SVG; ogni cosa che si muove è un SVG piccolo dentro una vista animata normale
 * (opacità e spostamenti). Non si animano le trasformazioni dei gruppi SVG: sul telefono facevano chiudere l'app.
 */

/** Un valore che va da 0 a 1 in `ms`, all'infinito (avanti e indietro se `yoyo`), dopo `delay`. Fermo a 0 se `still`. */
function useLoop(
  ms: number,
  still: boolean,
  opts: { yoyo?: boolean; delay?: number; linear?: boolean } = {},
) {
  const v = useSharedValue(0);
  const { yoyo = false, delay = 0, linear = false } = opts;
  useEffect(() => {
    if (still) {
      cancelAnimation(v);
      v.set(0);
      return;
    }
    v.set(
      withDelay(
        delay,
        withRepeat(
          withTiming(1, {
            duration: ms,
            easing: linear ? Easing.linear : Easing.inOut(Easing.sin),
          }),
          -1,
          yoyo,
        ),
      ),
    );
    return () => cancelAnimation(v);
  }, [v, ms, still, yoyo, delay, linear]);
  return v;
}

/** Un pezzo che si muove: un riquadro del disegno (in coordinate 320×132) con la sua vista animata. */
function Piece(p: {
  box: { x: number; y: number; w: number; h: number };
  k: number;
  style: ReturnType<typeof useAnimatedStyle>;
  children: ReactNode;
}) {
  const { x, y, w, h } = p.box;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: x * p.k, top: y * p.k, width: w * p.k, height: h * p.k },
        p.style,
      ]}
    >
      <Svg width={w * p.k} height={h * p.k} viewBox={`${x} ${y} ${w} ${h}`}>
        {p.children}
      </Svg>
    </Animated.View>
  );
}

export function BreakScene({
  color,
  accent,
  width = 300,
  testID = 'break-scene',
}: {
  /** il colore dei tratti (il testo del tema: si usa tenue) */
  color: string;
  /** il verde della pausa */
  accent: string;
  width?: number;
  testID?: string;
}) {
  const still = useReducedMotion();
  const k = width / 320;
  const sun = useLoop(7000, still, { yoyo: true });
  const rays = useLoop(22000, still, { linear: true });
  const steam1 = useLoop(2500, still);
  const steam2 = useLoop(2500, still, { delay: 830 });
  const steam3 = useLoop(2500, still, { delay: 1660 });
  const bird1 = useLoop(15000, still, { linear: true });
  const bird2 = useLoop(19000, still, { linear: true, delay: 5000 });
  const bee = useLoop(11000, still, { yoyo: true });
  const butterfly = useLoop(13000, still, { yoyo: true });

  const sunStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sun.value, [0, 1], [0.85, 1]),
    transform: [{ scale: interpolate(sun.value, [0, 1], [1, 1.06]) }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rays.value * 360}deg` }],
  }));
  const steamStyle = (v: SharedValue<number>) => () => {
    'worklet';
    return {
      opacity: interpolate(v.value, [0, 0.35, 1], [0, 0.7, 0]),
      transform: [{ translateY: interpolate(v.value, [0, 1], [2, -7]) * k }],
    };
  };
  const s1 = useAnimatedStyle(steamStyle(steam1));
  const s2 = useAnimatedStyle(steamStyle(steam2));
  const s3 = useAnimatedStyle(steamStyle(steam3));
  const flyStyle = (v: SharedValue<number>) => () => {
    'worklet';
    return {
      opacity: interpolate(v.value, [0, 0.12, 0.88, 1], [0, 0.8, 0.8, 0]),
      transform: [
        { translateX: interpolate(v.value, [0, 1], [-30, 330]) * k },
        { translateY: interpolate(v.value, [0, 0.5, 1], [6, -6, 4]) * k },
      ],
    };
  };
  const b1 = useAnimatedStyle(flyStyle(bird1));
  const b2 = useAnimatedStyle(flyStyle(bird2));
  const beeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          interpolate(bee.value, [0, 0.23, 0.41, 0.68, 0.85, 1], [0, -26, -14, 18, 9, 0]) * k,
      },
      {
        translateY:
          interpolate(bee.value, [0, 0.23, 0.41, 0.68, 0.85, 1], [0, -13, 4, -16, -3, 0]) * k,
      },
    ],
  }));
  const butterflyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(butterfly.value, [0, 0.3, 0.55, 0.8, 1], [0, 22, 38, 16, 0]) * k },
      {
        translateY: interpolate(butterfly.value, [0, 0.3, 0.55, 0.8, 1], [0, -18, -4, -22, 0]) * k,
      },
    ],
  }));

  const line = {
    fill: 'none',
    stroke: color,
    strokeOpacity: 0.42,
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  const live = {
    fill: 'none',
    stroke: accent,
    strokeOpacity: 0.78,
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  const steam = { ...live, strokeWidth: 1.3 } as const;

  return (
    <View testID={testID} style={{ width, height: (width * 132) / 320 }}>
      {/* il disegno fermo: l'albero, la persona con la tisana, il terreno e l'erba */}
      <Svg
        width={width}
        height={(width * 132) / 320}
        viewBox="0 0 320 132"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Path {...line} d="M42 106V74" />
        <Path {...live} d="M42 76c-13 0-20-8-20-16s9-15 20-15 20 7 20 15-7 16-20 16z" />
        <Path {...line} strokeOpacity={0.21} d="M42 84l-8-7M42 90l9-8" />
        <Circle {...line} cx={150} cy={62} r={7.5} />
        <Path {...line} d="M151 70q-6 16-4 33" />
        <Path {...line} d="M147 103q10-6 18-4q-4 9-13 7" />
        <Path {...line} strokeOpacity={0.23} d="M147 104q9-4 15-2q-4 6-11 4" />
        <Path {...line} d="M149 79q9 3 13-1" />
        <Path {...live} d="M162 72h11v5a5.5 5.5 0 0 1-5.5 5.5h0A5.5 5.5 0 0 1 162 77z" />
        <Path {...live} strokeOpacity={0.62} d="M173 74h2.4a2.2 2.2 0 0 1 0 4.4H173" />
        <Path {...line} strokeOpacity={0.23} d="M4 108q76-9 156-3t156-1" />
        <Path {...live} strokeOpacity={0.55} d="M198 108v-9M198 108q-4-5-6-7M198 108q4-4 6-6" />
        <Path {...live} strokeOpacity={0.55} d="M232 107v-7M232 107q-3.5-4-5.5-5.5" />
        <Path {...live} strokeOpacity={0.55} d="M86 108v-8M86 108q4-4 6-6" />
      </Svg>

      {/* il sole che respira, con i raggi che girano lentissimi */}
      <Piece box={{ x: 240, y: 4, w: 52, h: 52 }} k={k} style={sunStyle}>
        <Circle cx={266} cy={30} r={11} {...live} />
      </Piece>
      <Piece box={{ x: 240, y: 4, w: 52, h: 52 }} k={k} style={raysStyle}>
        <Path
          {...live}
          strokeOpacity={0.5}
          d="M266 12v-5M266 48v5M248 30h-5M284 30h5M253.3 17.3l-3.6-3.6M278.7 42.7l3.6 3.6M278.7 17.3l3.6-3.6M253.3 42.7l-3.6 3.6"
        />
      </Piece>

      {/* il vapore della tisana */}
      <Piece box={{ x: 162, y: 54, w: 6, h: 12 }} k={k} style={s1}>
        <Path {...steam} d="M165 63q2.5-3.5 0-7" />
      </Piece>
      <Piece box={{ x: 166, y: 54, w: 6, h: 12 }} k={k} style={s2}>
        <Path {...steam} d="M169 63q2.5-3.5 0-7" />
      </Piece>
      <Piece box={{ x: 170, y: 54, w: 6, h: 12 }} k={k} style={s3}>
        <Path {...steam} d="M172.5 63q2.5-3.5 0-7" />
      </Piece>

      {/* due uccelli che passano */}
      <Piece box={{ x: 0, y: 14, w: 24, h: 14 }} k={k} style={b1}>
        <Path {...line} d="M0 22q5-5 10 0" />
        <Path {...line} d="M10 22q5-5 10 0" />
      </Piece>
      <Piece box={{ x: 0, y: 34, w: 20, h: 10 }} k={k} style={b2}>
        <Path {...line} d="M0 40q4-4 8 0" />
        <Path {...line} d="M8 40q4-4 8 0" />
      </Piece>

      {/* l'ape che ronza attorno all'erba */}
      <Piece box={{ x: 206, y: 64, w: 14, h: 14 }} k={k} style={beeStyle}>
        <Ellipse cx={212} cy={72} rx={3.2} ry={2.3} fill={accent} fillOpacity={0.7} />
        <Path {...line} strokeWidth={1.2} strokeOpacity={0.3} d="M210 69.5q2-3.5 4.5-1" />
      </Piece>

      {/* la farfalla */}
      <Piece box={{ x: 80, y: 44, w: 24, h: 14 }} k={k} style={butterflyStyle}>
        <Path {...live} strokeWidth={1.3} d="M92 52q-6-6-9 0t9 3z" />
        <Path {...live} strokeWidth={1.3} d="M92 52q6-6 9 0t-9 3z" />
      </Piece>
    </View>
  );
}
