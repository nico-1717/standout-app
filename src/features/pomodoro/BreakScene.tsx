import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

/**
 * La scena della pausa (portata da `pausa_scena.php` del sito): un disegno a matita all'aperto, con il sole che
 * respira, un albero e tre ciuffi d'erba nella brezza, due uccelli, un'ape, una farfalla e una persona con la
 * tisana (il vapore sale). Tutto lento e sfasato. Con «Riduci movimento» il disegno resta fermo.
 */

const AG = Animated.createAnimatedComponent(G);
const AP = Animated.createAnimatedComponent(Path);

type Move = {
  /** il punto attorno a cui gira o si scala */
  ox?: number;
  oy?: number;
  tx?: number;
  ty?: number;
  rot?: number;
  sx?: number;
  sy?: number;
};

/** Una trasformazione attorno a un punto (le rotazioni di un SVG hanno bisogno di sapere attorno a cosa girare). */
function around(m: Move) {
  'worklet';
  const ox = m.ox ?? 0;
  const oy = m.oy ?? 0;
  return [
    { translateX: (m.tx ?? 0) + ox },
    { translateY: (m.ty ?? 0) + oy },
    { rotate: `${m.rot ?? 0}deg` },
    { scaleX: m.sx ?? 1 },
    { scaleY: m.sy ?? 1 },
    { translateX: -ox },
    { translateY: -oy },
  ];
}

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

const swing = (v: SharedValue<number>, deg: number) => {
  'worklet';
  return interpolate(v.value, [0, 1], [-deg, deg]);
};

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
  const sun = useLoop(7000, still, { yoyo: true });
  const rays = useLoop(22000, still, { linear: true });
  const steam1 = useLoop(2500, still);
  const steam2 = useLoop(2500, still, { delay: 830 });
  const steam3 = useLoop(2500, still, { delay: 1660 });
  const person = useLoop(5500, still, { yoyo: true });
  const tree = useLoop(6500, still, { yoyo: true });
  const grass1 = useLoop(4200, still, { yoyo: true });
  const grass2 = useLoop(5100, still, { yoyo: true, delay: 800 });
  const grass3 = useLoop(4700, still, { yoyo: true, delay: 1600 });
  const bird1 = useLoop(15000, still, { linear: true });
  const bird2 = useLoop(19000, still, { linear: true, delay: 5000 });
  const flap = useLoop(1100, still, { yoyo: true });
  const bee = useLoop(11000, still, { yoyo: true });
  const butterfly = useLoop(13000, still, { yoyo: true });
  const wings = useLoop(1400, still, { yoyo: true });

  const sunProps = useAnimatedProps(() => ({
    opacity: interpolate(sun.value, [0, 1], [0.85, 1]),
    transform: around({
      ox: 266,
      oy: 30,
      sx: interpolate(sun.value, [0, 1], [1, 1.06]),
      sy: interpolate(sun.value, [0, 1], [1, 1.06]),
    }),
  }));
  const raysProps = useAnimatedProps(() => ({
    transform: around({ ox: 266, oy: 30, rot: rays.value * 360 }),
  }));
  const steamProps = (v: SharedValue<number>) => ({
    opacity: interpolate(v.value, [0, 0.35, 1], [0, 0.7, 0]),
    transform: around({
      ty: interpolate(v.value, [0, 1], [2, -7]),
      sy: interpolate(v.value, [0, 1], [0.7, 1.15]),
      oy: 70,
    }),
  });
  const s1 = useAnimatedProps(() => steamProps(steam1));
  const s2 = useAnimatedProps(() => steamProps(steam2));
  const s3 = useAnimatedProps(() => steamProps(steam3));
  const personProps = useAnimatedProps(() => ({
    transform: around({ ox: 160, oy: 106, sy: interpolate(person.value, [0, 1], [1, 1.015]) }),
  }));
  const treeProps = useAnimatedProps(() => ({
    transform: around({ ox: 42, oy: 106, rot: swing(tree, 1.6) }),
  }));
  const g1 = useAnimatedProps(() => ({
    transform: around({ ox: 198, oy: 108, rot: swing(grass1, 1.6) }),
  }));
  const g2 = useAnimatedProps(() => ({
    transform: around({ ox: 232, oy: 107, rot: swing(grass2, 1.6) }),
  }));
  const g3 = useAnimatedProps(() => ({
    transform: around({ ox: 86, oy: 108, rot: swing(grass3, 1.6) }),
  }));
  const flyProps = (v: SharedValue<number>, y: [number, number, number]) => ({
    opacity: interpolate(v.value, [0, 0.12, 0.88, 1], [0, 0.8, 0.8, 0]),
    transform: around({
      tx: interpolate(v.value, [0, 1], [-30, 330]),
      ty: interpolate(v.value, [0, 0.5, 1], y),
    }),
  });
  const b1 = useAnimatedProps(() => flyProps(bird1, [6, -6, 4]));
  const b2 = useAnimatedProps(() => flyProps(bird2, [6, -6, 4]));
  const flapProps = useAnimatedProps(() => ({
    transform: around({ ox: 5, oy: 22, sy: interpolate(flap.value, [0, 1], [1, 0.45]) }),
  }));
  const flapProps2 = useAnimatedProps(() => ({
    transform: around({ ox: 8, oy: 40, sy: interpolate(flap.value, [0, 1], [1, 0.45]) }),
  }));
  const beeProps = useAnimatedProps(() => ({
    transform: around({
      tx: interpolate(bee.value, [0, 0.23, 0.41, 0.68, 0.85, 1], [0, -26, -14, 18, 9, 0]),
      ty: interpolate(bee.value, [0, 0.23, 0.41, 0.68, 0.85, 1], [0, -13, 4, -16, -3, 0]),
    }),
  }));
  const butterflyProps = useAnimatedProps(() => ({
    transform: around({
      tx: interpolate(butterfly.value, [0, 0.3, 0.55, 0.8, 1], [0, 22, 38, 16, 0]),
      ty: interpolate(butterfly.value, [0, 0.3, 0.55, 0.8, 1], [0, -18, -4, -22, 0]),
    }),
  }));
  const wingL = useAnimatedProps(() => ({
    transform: around({ ox: 92, oy: 52, sx: interpolate(wings.value, [0, 1], [1, 0.35]) }),
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

  return (
    <View testID={testID} style={{ width, height: (width * 132) / 320 }}>
      <Svg
        width={width}
        height={(width * 132) / 320}
        viewBox="0 0 320 132"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {/* il sole, in alto a destra, con i raggi che girano lentissimi */}
        <AG animatedProps={sunProps}>
          <Circle cx={266} cy={30} r={11} {...live} />
          <AG animatedProps={raysProps} opacity={0.65}>
            <Path
              {...live}
              d="M266 12v-5M266 48v5M248 30h-5M284 30h5M253.3 17.3l-3.6-3.6M278.7 42.7l3.6 3.6M278.7 17.3l3.6-3.6M253.3 42.7l-3.6 3.6"
            />
          </AG>
        </AG>

        {/* due uccelli che passano */}
        <AG animatedProps={b1}>
          <AG animatedProps={flapProps}>
            <Path {...line} d="M0 22q5-5 10 0" />
            <Path {...line} d="M10 22q5-5 10 0" />
          </AG>
        </AG>
        <AG animatedProps={b2}>
          <AG animatedProps={flapProps2}>
            <Path {...line} d="M0 40q4-4 8 0" />
            <Path {...line} d="M8 40q4-4 8 0" />
          </AG>
        </AG>

        {/* l'albero a sinistra, che si piega nella brezza */}
        <AG animatedProps={treeProps}>
          <Path {...line} d="M42 106V74" />
          <Path {...live} d="M42 76c-13 0-20-8-20-16s9-15 20-15 20 7 20 15-7 16-20 16z" />
          <Path {...line} strokeOpacity={0.21} d="M42 84l-8-7M42 90l9-8" />
        </AG>

        {/* la persona seduta, di profilo, con la tisana in mano */}
        <AG animatedProps={personProps}>
          <Circle {...line} cx={150} cy={62} r={7.5} />
          <Path {...line} d="M151 70q-6 16-4 33" />
          <Path {...line} d="M147 103q10-6 18-4q-4 9-13 7" />
          <Path {...line} strokeOpacity={0.23} d="M147 104q9-4 15-2q-4 6-11 4" />
          <Path {...line} d="M149 79q9 3 13-1" />
          <Path {...live} d="M162 72h11v5a5.5 5.5 0 0 1-5.5 5.5h0A5.5 5.5 0 0 1 162 77z" />
          <Path {...live} strokeOpacity={0.62} d="M173 74h2.4a2.2 2.2 0 0 1 0 4.4H173" />
          <G transform="translate(0 -7)">
            <AP animatedProps={s1} {...live} strokeWidth={1.3} d="M165 70q2.5-3.5 0-7" />
            <AP animatedProps={s2} {...live} strokeWidth={1.3} d="M169 70q2.5-3.5 0-7" />
            <AP animatedProps={s3} {...live} strokeWidth={1.3} d="M172.5 70q2.5-3.5 0-7" />
          </G>
        </AG>

        {/* l'ape, che ronza attorno all'erba */}
        <AG animatedProps={beeProps}>
          <Ellipse cx={212} cy={72} rx={3.2} ry={2.3} fill={accent} fillOpacity={0.7} />
          <Path {...line} strokeWidth={1.2} strokeOpacity={0.3} d="M210 69.5q2-3.5 4.5-1" />
        </AG>

        {/* la farfalla */}
        <AG animatedProps={butterflyProps}>
          <AG animatedProps={wingL}>
            <Path {...live} strokeWidth={1.3} d="M92 52q-6-6-9 0t9 3z" />
            <Path {...live} strokeWidth={1.3} d="M92 52q6-6 9 0t-9 3z" />
          </AG>
        </AG>

        {/* il terreno e tre ciuffi d'erba */}
        <Path {...line} strokeOpacity={0.23} d="M4 108q76-9 156-3t156-1" />
        <AG animatedProps={g1} opacity={0.7}>
          <Path {...live} d="M198 108v-9M198 108q-4-5-6-7M198 108q4-4 6-6" />
        </AG>
        <AG animatedProps={g2} opacity={0.7}>
          <Path {...live} d="M232 107v-7M232 107q-3.5-4-5.5-5.5" />
        </AG>
        <AG animatedProps={g3} opacity={0.7}>
          <Path {...live} d="M86 108v-8M86 108q4-4 6-6" />
        </AG>
      </Svg>
    </View>
  );
}
