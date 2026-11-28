import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
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
  if (s >= 30) return '#C2410C';
  if (s >= 15) return '#BF5AF2';
  if (s >= 10) return '#FF375F';
  if (s >= 5) return '#FF6B00';
  return '#FF9F0A';
}

const FLAME =
  'M12.6 2.2c.3 3-1.4 4.6-2.9 6.2C8.2 10 6.6 11.7 6.6 14.6A5.4 5.4 0 0 0 12 20a5.4 5.4 0 0 0 5.4-5.4c0-2.3-1-4-2.1-5.5-.2 1.3-.8 2.3-1.8 2.8.4-3.3-.1-6.8-.9-9.7Z';

/**
 * La pillola della serie («🔥 5»): compare dalla seconda risposta giusta di fila, fa un saltino a ogni risposta giusta
 * e trema quando la serie si spezza. Con «Riduci movimento» resta ferma.
 */
export function StreakPill({ n }: { n: number }) {
  const { t } = useTranslation();
  const th = useTheme();
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
  const step = stepOf(n);
  const gold = step >= 30;
  const fire = step > 0 ? flameColor(n) : th.text3;
  const body = (
    <>
      <View style={{ width: 20, height: 20 }}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d={FLAME} fill={fire} />
        </Svg>
      </View>
      <Text
        style={{
          color: gold ? '#1C1C1E' : th.text,
          fontWeight: '900',
          fontSize: 17,
          letterSpacing: -0.3,
          fontVariant: ['tabular-nums'],
        }}
      >
        {n}
      </Text>
      <Text
        style={{
          color: gold ? '#1C1C1E' : th.text,
          opacity: 0.55,
          fontWeight: '800',
          fontSize: 13,
        }}
      >
        ×
      </Text>
    </>
  );
  return (
    <Animated.View
      testID="fcg-streak"
      accessible
      accessibilityLabel={t('fcv.gj_serie_aria', { n })}
      style={[
        {
          minWidth: 80,
          height: 34,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: th.surface,
          borderWidth: step > 0 && !gold ? 1 : 0.5,
          borderColor: step > 0 && !gold ? `${fire}8C` : th.hairline2,
          shadowColor: step > 0 ? fire : '#000',
          shadowOpacity: 0.45,
          shadowRadius: 11,
          shadowOffset: { width: 0, height: 6 },
        },
        style,
      ]}
    >
      {gold ? (
        <LinearGradient
          colors={['#FFE066', '#FFC300', '#FF9F0A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingLeft: 8,
          paddingRight: 12,
        }}
      >
        {body}
      </View>
    </Animated.View>
  );
}
