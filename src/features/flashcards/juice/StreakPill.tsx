import { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { stepOf } from '../gameJuice';

/** Il colore della fiamma sale con gli scalini della serie (arancio → rosa → viola). */
export function flameColor(n: number): string {
  const s = stepOf(n);
  if (s >= 30) return '#BF5AF2';
  if (s >= 10) return '#FF375F';
  if (s >= 5) return '#FF6B00';
  return '#FF9F0A';
}

/**
 * La pillola della serie («🔥 5»): compare dalla seconda risposta giusta di fila, fa un saltino a ogni risposta giusta
 * e trema quando la serie si spezza. Con «Riduci movimento» resta ferma.
 */
export function StreakPill({ n }: { n: number }) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const last = useRef(n);

  useEffect(() => {
    const before = last.current;
    last.current = n;
    if (still || before === n) return;
    if (n > before) {
      scale.set(
        withSequence(
          withTiming(1.3, { duration: 110, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        ),
      );
    } else if (before >= 3) {
      shake.set(
        withSequence(
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 80 }),
          withTiming(-4, { duration: 70 }),
          withTiming(0, { duration: 60 }),
        ),
      );
    }
  }, [n, still, scale, shake]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.get() }, { scale: scale.get() }],
  }));

  if (n < 2) return null;
  return (
    <Animated.View
      testID="fcg-streak"
      accessible
      accessibilityLabel={t('fcv.gj_serie_aria', { n })}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: flameColor(n),
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 14 }}>🔥</Text>
      <Text
        style={{ color: '#fff', fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}
      >
        {n}
      </Text>
    </Animated.View>
  );
}
