import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Il movimento dell'app (campioni approvati il 7/11/2026): sempre breve, senza rimbalzo, e spento quando
 * il telefono ha «Riduci movimento» (ReduceMotion.System). Funziona sul filo dell'interfaccia (Reanimated).
 */

/** Il passo tra un elemento e il successivo quando entrano uno dopo l'altro. */
export const STAGGER_MS = 70;
const ENTER_MS = 320;
const PRESS_MS = 110;

/** Piccola vibrazione di conferma: solo su iPhone, mai un errore se non c'è. */
export const haptic = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};

function run(fn: () => Promise<void>) {
  if (process.env.EXPO_OS !== 'ios' && Platform.OS !== 'ios') return;
  try {
    void fn().catch(() => undefined);
  } catch {
    // niente vibrazione: pazienza
  }
}

/** Il ritardo di entrata dell'elemento numero `index` (limitato: una lista lunga non deve aspettare). */
export function riseDelay(index: number): number {
  return Math.min(index, 8) * STAGGER_MS;
}

/** Un blocco che entra dal basso con dissolvenza, dopo `index` passi. */
export function Rise({
  index = 0,
  style,
  children,
}: {
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(ENTER_MS)
        .delay(riseDelay(index))
        .easing(Easing.out(Easing.cubic))
        .reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Un pulsante che si «affonda» un poco quando lo si preme (scala 0.97, senza rimbalzo). */
export function PressScale({
  children,
  style,
  onPressIn,
  onPressOut,
  haptics = false,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  haptics?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withTiming(0.97, { duration: PRESS_MS, reduceMotion: ReduceMotion.System }));
        if (haptics) haptic.tap();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: PRESS_MS, reduceMotion: ReduceMotion.System }));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}
