import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Come sul sito (`.fcv-inner`): la carta gira di 180° attorno all'asse verticale, 0,55 s, curva (.32,.72,0,1), prospettiva 1400. */
export const FLIP_MS = 550;
export const FLIP_PERSPECTIVE = 1400;
const FLIP_EASING = Easing.bezier(0.32, 0.72, 0, 1);

const FACE: ViewStyle = { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Una carta con due facce che si gira davvero (3D). La faccia nascosta non si legge e non si tocca: per VoiceOver
 * esiste una sola faccia alla volta. Con «Riduci movimento» il cambio è immediato.
 * Per cambiare carta senza il giro, si cambia `key` (la carta nuova nasce già dal lato giusto).
 */
export function FlipCard({
  flipped,
  front,
  back,
  style,
  frontStyle,
  backStyle,
  testID,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  /** la cornice (misure, margini) */
  style?: StyleProp<ViewStyle>;
  /** l'aspetto di ciascuna faccia (sfondo, bordo, angoli) */
  frontStyle?: StyleProp<ViewStyle>;
  backStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(flipped ? 1 : 0);
  useEffect(() => {
    const to = flipped ? 1 : 0;
    turn.set(reduce ? to : withTiming(to, { duration: FLIP_MS, easing: FLIP_EASING }));
  }, [flipped, reduce, turn]);

  const frontAnim = useAnimatedStyle(() => ({
    transform: [{ perspective: FLIP_PERSPECTIVE }, { rotateY: `${turn.get() * 180}deg` }],
  }));
  const backAnim = useAnimatedStyle(() => ({
    transform: [{ perspective: FLIP_PERSPECTIVE }, { rotateY: `${180 + turn.get() * 180}deg` }],
  }));

  return (
    <View testID={testID} style={style}>
      <Animated.View
        style={[FACE, { backfaceVisibility: 'hidden' }, frontStyle, frontAnim]}
        pointerEvents={flipped ? 'none' : 'auto'}
        accessibilityElementsHidden={flipped}
        importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
      >
        {front}
      </Animated.View>
      <Animated.View
        style={[FACE, { backfaceVisibility: 'hidden' }, backStyle, backAnim]}
        pointerEvents={flipped ? 'auto' : 'none'}
        accessibilityElementsHidden={!flipped}
        importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
      >
        {back}
      </Animated.View>
    </View>
  );
}
