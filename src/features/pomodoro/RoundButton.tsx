import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/core/theme/ThemeProvider';

import { withAlpha } from './colors';

/**
 * Il luccichio del tasto «avvia» (`pomoShine` del sito): una striscia chiara obliqua che scorre da sinistra a destra in
 * 2,1 s, torna indietro in 1,9 s e sta ferma 1 s; ogni giro dura 5 s, all'infinito.
 */
function Shine({ size }: { size: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.inOut(Easing.ease);
    const run = { easing: ease, reduceMotion: ReduceMotion.System };
    x.set(0);
    x.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2100, ...run }),
          withTiming(0, { duration: 1900, ...run }),
          withDelay(1000, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
    return () => cancelAnimation(x);
  }, [x]);
  const style = useAnimatedStyle(() => ({
    // da -60 % a 130 % della larghezza del tasto, come `left` nel sito
    transform: [{ translateX: x.get() * size * 1.9 }, { rotate: '20deg' }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -size * 0.5,
          left: -size * 0.6,
          width: size * 0.35,
          height: size * 2,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,.42)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

export type RoundKind = 'play' | 'pause' | 'stop' | 'check' | 'cup';

/**
 * I tasti tondi del sito (.pomo-btn-icon): un simbolo, nessuna parola (la parola sta nell'etichetta per il lettore di
 * schermo). «play» e «cup» si tingono dell'accento (colore del progetto, o la pausa in teal); «stop» e «check» sono rossi.
 */
export function RoundButton({
  kind,
  testID,
  label,
  onPress,
  large = false,
  accent,
}: {
  kind: RoundKind;
  testID: string;
  label: string;
  onPress: () => void;
  large?: boolean;
  /** il colore del tasto «pieno» (play, tazza); senza, il colore del tema */
  accent?: string;
}) {
  const th = useTheme();
  const size = large ? 76 : 60;
  const color = accent ?? th.brand;
  const filled = kind === 'play' || kind === 'cup';
  const fill = filled ? color : kind === 'stop' || kind === 'check' ? th.redSoft : th.surface2;
  const ink = filled ? '#FFFFFF' : kind === 'stop' || kind === 'check' ? th.red : th.text;
  const icon = large ? 32 : 26;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: fill,
        boxShadow: filled
          ? `inset 0 1px 0 rgba(255,255,255,.25), inset 0 -1px 0 rgba(0,0,0,.16), 0 ${large ? 12 : 10}px ${large ? 28 : 24}px -10px ${withAlpha(color, 0.9)}`
          : kind === 'pause'
            ? `inset 0 0 0 0.5px ${th.hairline}`
            : `inset 0 0 0 0.5px ${withAlpha(th.red, 0.22)}`,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {kind === 'play' && large ? <Shine size={size} /> : null}
      <Svg width={icon} height={icon} viewBox="0 0 24 24">
        {kind === 'play' ? (
          <Path
            d="M8.4 5.2a1 1 0 0 1 1.53-.85l8.2 5.15a1 1 0 0 1 0 1.7l-8.2 5.15a1 1 0 0 1-1.53-.85z"
            fill={ink}
            transform="translate(-1.2 1)"
          />
        ) : kind === 'pause' ? (
          <>
            <Rect x={6.5} y={5} width={4} height={14} rx={1.6} fill={ink} />
            <Rect x={13.5} y={5} width={4} height={14} rx={1.6} fill={ink} />
          </>
        ) : kind === 'check' ? (
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={ink}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : kind === 'cup' ? (
          <>
            <Path
              d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h2.2a2.4 2.4 0 0 1 0 4.8H16M8 2.5v2.6M12 2.5v2.6"
              stroke={ink}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        ) : (
          <Rect x={6} y={6} width={12} height={12} rx={2.4} fill={ink} />
        )}
      </Svg>
    </Pressable>
  );
}
