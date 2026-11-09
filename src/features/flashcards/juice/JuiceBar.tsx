import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { progressColor } from '../gameJuice';

/**
 * La barra di avanzamento della partita: cambia colore da blu a oro man mano che si arriva in fondo e, nell'ultimo
 * tratto, una luce la attraversa. Larghezza e colore si muovono piano, non a scatti.
 */
export function JuiceBar({
  progress,
  final,
  track,
}: {
  /** da 0 a 1 */
  progress: number;
  /** l'ultimo tratto: la luce che scorre */
  final: boolean;
  track: string;
}) {
  const still = useReducedMotion();
  const p = Math.max(0, Math.min(1, progress));
  const width = useSharedValue(p);
  const sweep = useSharedValue(0);
  const [w, setW] = useState(0);

  useEffect(() => {
    width.set(still ? p : withTiming(p, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [p, still, width]);

  useEffect(() => {
    if (!final || still) {
      cancelAnimation(sweep);
      sweep.set(0);
      return;
    }
    sweep.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(sweep);
  }, [final, still, sweep]);

  const fill = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));
  const light = useAnimatedStyle(() => ({
    opacity: final ? 0.55 : 0,
    transform: [{ translateX: -60 + sweep.get() * (w + 120) }],
  }));

  return (
    <View
      testID="fcg-bar"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: track }}
    >
      <Animated.View
        style={[
          { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: progressColor(p) },
          fill,
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 60,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
            },
            light,
          ]}
        />
      </Animated.View>
    </View>
  );
}
