import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/core/theme/ThemeProvider';

import { RING_TRACK, mix, withAlpha } from './colors';

const CIRC = 2 * Math.PI * 100;

/**
 * Il quadrante a cerchio del sito (.ring-wrap): alone dell'accento, faccia scura con un velo del colore del progetto,
 * anello sottile con la scintilla in punta, il tempo grande al centro e, sotto, la pastiglia piccola (.ring-sub).
 * Toccare il centro apre la scelta della durata (a timer fermo).
 */
export function Dial(p: {
  size: number;
  /** quanta parte dell'anello è piena (0–1) */
  fraction: number;
  accent: string;
  time: string;
  timeColor?: string;
  sub?: string;
  /** l'alone (acceso quando gira, finito o in pausa) */
  glow: boolean;
  /** la scintilla in punta alla barra */
  spark: boolean;
  onPress?: () => void;
}) {
  const th = useTheme();
  const S = p.size;
  const pct = Math.max(0, Math.min(1, p.fraction));
  const faceInset = S * 0.095;
  const face = S - faceInset * 2;
  const angle = pct * 360 - 90;
  const sx = 110 + 100 * Math.cos((angle * Math.PI) / 180);
  const sy = 110 + 100 * Math.sin((angle * Math.PI) / 180);
  const dark = th.scheme === 'dark';
  return (
    <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
      {p.glow ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: S * 0.07,
            top: S * 0.07,
            width: S * 0.86,
            height: S * 0.86,
            borderRadius: S,
            boxShadow: `0 0 ${S * 0.2}px ${S * 0.03}px ${withAlpha(p.accent, 0.3)}`,
          }}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: faceInset,
          top: faceInset,
          width: face,
          height: face,
          borderRadius: face / 2,
          overflow: 'hidden',
          backgroundColor: th.surface,
          boxShadow: dark
            ? '0 26px 54px -22px rgba(0,0,0,.9), inset 0 0.5px 0 rgba(255,255,255,.06), inset 0 0 0 0.5px rgba(255,255,255,.05)'
            : `0 22px 44px -24px rgba(0,0,0,.4), inset 0 0.5px 0 rgba(255,255,255,.7), inset 0 0 0 0.5px ${th.hairline}`,
        }}
      >
        <LinearGradient
          colors={[withAlpha(p.accent, 0.1), withAlpha(p.accent, 0)]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.7 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      </View>
      <Svg
        width={S}
        height={S}
        viewBox="0 0 220 220"
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Circle
          cx={110}
          cy={110}
          r={100}
          fill="none"
          stroke={RING_TRACK[th.scheme]}
          strokeWidth={5.5}
        />
        {pct > 0 ? (
          <G rotation={-90} origin="110, 110">
            <Circle
              cx={110}
              cy={110}
              r={100}
              fill="none"
              stroke={withAlpha(p.accent, 0.22)}
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - pct)}
            />
            <Circle
              cx={110}
              cy={110}
              r={100}
              fill="none"
              stroke={p.accent}
              strokeWidth={5.5}
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - pct)}
            />
          </G>
        ) : null}
        {p.spark ? (
          <>
            <Circle cx={sx} cy={sy} r={11} fill={withAlpha(p.accent, 0.26)} />
            <Circle
              cx={sx}
              cy={sy}
              r={6.4}
              fill={mix(p.accent, '#ffffff', 0.42)}
              stroke={mix(p.accent, '#ffffff', 0.82)}
              strokeWidth={1.4}
            />
          </>
        ) : null}
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: S,
          height: S,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pressable
          testID="pomodoro-dial"
          accessibilityRole={p.onPress ? 'button' : undefined}
          disabled={!p.onPress}
          onPress={p.onPress}
          style={({ pressed }) => ({
            alignItems: 'center',
            gap: 7,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 26,
            transform: [{ scale: pressed && p.onPress ? 0.95 : 1 }],
          })}
        >
          <Text
            testID="pomodoro-clock"
            style={{
              color: p.timeColor ?? th.text,
              fontSize: Math.max(40, Math.min(54, S * 0.18)),
              lineHeight: Math.max(40, Math.min(54, S * 0.18)),
              fontWeight: '700',
              letterSpacing: -1.6,
              fontVariant: ['tabular-nums'],
            }}
          >
            {p.time}
          </Text>
          {p.sub ? (
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 11,
                borderRadius: 999,
                backgroundColor: th.surface2,
                boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
              }}
            >
              <Text
                testID="pomodoro-sub"
                style={{ color: th.text2, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}
              >
                {p.sub}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
