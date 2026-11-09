import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Circle, Defs, G, Path } from 'react-native-svg';

import {
  HOURGLASS_CHAMBER,
  HOURGLASS_FRAME,
  HOURGLASS_RATIO,
  HOURGLASS_VIEWBOX,
} from './hourglassPaths';

/**
 * La clessidra del sito (`clessidra.php`): la sabbia scende dall'alto al basso man mano che passa il tempo, i granelli
 * cadono dalla strozzatura mentre il timer corre, e a inizio sessione il vetro si capovolge. Il sito la offre come
 * alternativa all'anello; l'impostazione è la stessa (`last_display_style`).
 */

const NECK_X = 693;
const NECK_Y = 378;
/** 80% dell'altezza della camera, come sul sito */
const MAX_FILL = 188;
const FLIP_MS = 800;
const GRAINS = 8;

const AP = Animated.createAnimatedComponent(Path);
const AC = Animated.createAnimatedComponent(Circle);

/** La sabbia di sopra: `fill` va da 1 (piena) a 0 (vuota). Il bordo si incava al centro man mano che si svuota. */
export function topSandPath(fill: number): string {
  'worklet';
  if (fill <= 0) return `M ${NECK_X},${NECK_Y} Z`;
  let edgeY = NECK_Y - fill * MAX_FILL;
  let centerY = edgeY + (1 - fill) * 60;
  if (centerY > NECK_Y) centerY = NECK_Y;
  if (edgeY > NECK_Y) edgeY = NECK_Y;
  const half = 16;
  const tipY = NECK_Y + 30;
  return (
    `M 450,${edgeY} Q ${NECK_X},${centerY} 940,${edgeY} L 940,${NECK_Y} ` +
    `L ${NECK_X + half},${NECK_Y} Q ${NECK_X},${tipY} ${NECK_X - half},${NECK_Y} L 450,${NECK_Y} Z`
  );
}

/** Il livello di sotto (y) e il cumulo al centro, per una sabbia di sopra che vale `fill`. */
export function bottomLevel(fill: number): { y: number; mound: number } {
  'worklet';
  const empty = 1 - fill;
  return { y: 614 - empty * MAX_FILL, mound: empty > 0 && empty < 1 ? 22 : 0 };
}

export function bottomSandPath(fill: number): string {
  'worklet';
  const { y, mound } = bottomLevel(fill);
  return `M 450,620 L 940,620 L 940,${y} Q ${NECK_X},${y - mound} 450,${y} Z`;
}

function Grain({
  index,
  fill,
  flowing,
  color,
}: {
  index: number;
  fill: SharedValue<number>;
  flowing: SharedValue<number>;
  color: string;
}) {
  const t = useSharedValue(0);
  const still = useReducedMotion();
  const dx = ((index * 37) % 9) - 4;
  const r = 1.4 + ((index * 53) % 10) / 8;
  useEffect(() => {
    if (still) return;
    t.set(
      withDelay(
        (index * 520) / GRAINS,
        withRepeat(withTiming(1, { duration: 520, easing: Easing.in(Easing.quad) }), -1, false),
      ),
    );
    return () => cancelAnimation(t);
  }, [index, still, t]);
  const props = useAnimatedProps(() => {
    const end = bottomLevel(fill.get()).y + 4;
    return {
      cy: NECK_Y + t.get() * (end - NECK_Y),
      opacity: flowing.get() > 0.5 && fill.get() > 0.001 && fill.get() < 0.999 ? 1 : 0,
    };
  });
  return <AC cx={NECK_X + dx} r={r} fill={color} animatedProps={props} />;
}

export function Hourglass({
  fraction,
  running,
  color,
  glass,
  width = 150,
  flip = false,
  testID = 'hourglass',
}: {
  /** quanto tempo è passato, da 0 a 1 */
  fraction: number;
  running: boolean;
  /** il colore della sabbia (quello del progetto) */
  color: string;
  /** il colore del vetro */
  glass: string;
  width?: number;
  /** capovolgi il vetro all'avvio (solo se la sessione è appena partita) */
  flip?: boolean;
  testID?: string;
}) {
  const still = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, fraction));
  /** quanta sabbia c'è ancora sopra (1 = piena) */
  const fill = useSharedValue(flip && !still ? 0 : 1 - clamped);
  const flowing = useSharedValue(running ? 1 : 0);
  const rot = useSharedValue(0);
  const flipping = useSharedValue(flip && !still ? 1 : 0);
  const target = 1 - clamped;
  const flipped = useRef(false);

  useEffect(() => {
    flowing.set(running ? 1 : 0);
  }, [running, flowing]);

  useEffect(() => {
    if (flip && !still && !flipped.current) {
      flipped.current = true;
      // durante il giro la sabbia sta tutta in basso: ruotata di 180° è tutta in alto, senza salti
      fill.set(0);
      rot.set(
        withTiming(180, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
          if (!done) return;
          rot.set(0);
          flipping.set(0);
          fill.set(1);
        }),
      );
      return;
    }
    if (flipping.get() === 1 && !still) return;
    fill.set(still ? target : withTiming(target, { duration: 250, easing: Easing.linear }));
  }, [flip, still, target, fill, rot, flipping]);

  const topProps = useAnimatedProps(() => ({ d: topSandPath(fill.get()) }));
  const bottomProps = useAnimatedProps(() => ({ d: bottomSandPath(fill.get()) }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.get()}deg` }] }));

  const height = width / HOURGLASS_RATIO;
  return (
    <View testID={testID} style={{ width, height }}>
      <Animated.View style={[{ width, height }, spin]}>
        <Svg
          width={width}
          height={height}
          viewBox={HOURGLASS_VIEWBOX}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Defs>
            <ClipPath id="clGlassChamber">
              <Path d={HOURGLASS_CHAMBER} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#clGlassChamber)">
            <AP fill={color} animatedProps={topProps} />
            <AP fill={color} animatedProps={bottomProps} />
            {Array.from({ length: GRAINS }, (_, i) => (
              <Grain key={i} index={i} fill={fill} flowing={flowing} color={color} />
            ))}
          </G>
          <Path d={HOURGLASS_FRAME} fillRule="evenodd" fill={glass} />
        </Svg>
      </Animated.View>
    </View>
  );
}
