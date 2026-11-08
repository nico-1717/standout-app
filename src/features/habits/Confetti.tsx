import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FRAMES, makeBurst, particleAt, type Particle } from './confetti';

let lastBurstId = 0;

/** Un nuovo lancio con un numero tutto suo (fuori dal render, così resta puro). */
export function newBurst(x: number, y: number, color: string, n: number): Burst {
  lastBurstId += 1;
  return { id: lastBurstId, particles: makeBurst(x, y, color, n) };
}

export interface Burst {
  id: number;
  particles: Particle[];
}

/** Un solo pezzetto: la sua posizione la dà `particleAt` dal numero di passi `n` (sale da 0 a FRAMES). */
function Piece({ p, n }: { p: Particle; n: { value: number } }) {
  const style = useAnimatedStyle(() => {
    const pose = particleAt(p, n.value);
    return {
      opacity: pose.opacity,
      transform: [{ translateX: pose.x }, { translateY: pose.y }, { rotate: `${pose.rotate}rad` }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: p.size, height: p.size * 1.6, backgroundColor: p.color },
        style,
      ]}
    />
  );
}

function BurstView({ burst, onDone }: { burst: Burst; onDone: (id: number) => void }) {
  const n = useSharedValue(0);
  useEffect(() => {
    n.value = withTiming(
      FRAMES,
      { duration: (FRAMES * 1000) / 60, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onDone)(burst.id);
      },
    );
  }, [n, burst.id, onDone]);
  return (
    <>
      {burst.particles.map((p, i) => (
        <Piece key={i} p={p} n={n} />
      ))}
    </>
  );
}

/**
 * Lo strato dei coriandoli: sopra a tutto, non prende i tocchi. Ogni lancio ha i suoi pezzetti e sparisce da solo.
 * Con «Riduci movimento» del telefono non si vede niente.
 */
export function Confetti({
  bursts,
  onDone,
}: {
  bursts: readonly Burst[];
  onDone: (id: number) => void;
}) {
  const reduce = useReducedMotion();
  if (reduce || !bursts.length) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="confetti">
      {bursts.map((b) => (
        <BurstView key={b.id} burst={b} onDone={onDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
});
