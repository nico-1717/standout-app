/**
 * I pezzi grafici della pagina Voti, ricalcati da voti.css / voti.php del sito:
 * intestazioni di sezione, linguette, medaglie dei voti, barra del voto di laurea, riquadri dei numeri.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Theme } from '@/core/theme/ThemeProvider';

import { faculties } from './catalog';
import { gradePct, dispFinal, gradeBase, type GradeData } from './logic';

/* ---------------------------------- colori ---------------------------------- */

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const rgbOf = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  if (h.length !== 6) return [10, 132, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export const rgba = (hex: string, a: number): string => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
};

/** Come `shade()` del sito: schiarisce o scurisce un colore di `pct` per cento. */
export const shade = (hex: string, pct: number): string => {
  const [r, g, b] = rgbOf(hex);
  const hx = (n: number) =>
    clamp255((n * (100 + pct)) / 100)
      .toString(16)
      .padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
};

/** Il secondo colore della sfumatura d'accento: quello della facoltà, se c'è, altrimenti più scuro del 16%. */
export const accent2Of = (accent: string): string => {
  const facs = faculties();
  for (const k of Object.keys(facs)) {
    const f = facs[k]!;
    if (f.color.toLowerCase() === accent.toLowerCase() && f.gradient && f.gradient.length > 1)
      return f.gradient[1]!;
  }
  return shade(accent, -16);
};

export interface GradeTone {
  accent: string;
  accent2: string;
  gold: string;
  silver: string;
  surface3: string;
  th: Theme;
}

export const toneOf = (th: Theme, accent: string): GradeTone => {
  const dark = th.scheme === 'dark';
  return {
    accent,
    accent2: accent2Of(accent),
    gold: dark ? '#FFCC33' : '#E8A600',
    silver: dark ? '#9AA3AA' : '#B7BEC5',
    surface3: dark ? '#3A3A3C' : '#E7E7EC',
    th,
  };
};

export const GOLD_GRADIENT = ['#B8860B', '#FFD700', '#E8A600', '#FFF1A8'] as const;

/** La sfumatura d'accento (135°) del sito: `--uni-grad`. */
export function AccentGrad({
  tone,
  style,
  children,
}: {
  tone: GradeTone;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  return (
    <LinearGradient
      colors={[tone.accent, tone.accent2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

/* ------------------------------- intestazioni ------------------------------- */

export function SectionHead({
  icon,
  bg,
  title,
  right,
  th,
}: {
  icon: string;
  bg: string;
  title: string;
  right?: ReactNode;
  th: Theme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        marginHorizontal: 2,
        marginBottom: 14,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          color: th.text,
          fontSize: 16.3,
          fontWeight: '800',
          letterSpacing: -0.16,
        }}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

/** Il tasto a pillola in cima a una sezione («+ Bonus», «Seleziona»). */
export function ActionPill({
  label,
  onPress,
  tone,
  soft,
  testID,
}: {
  label: string;
  onPress: () => void;
  tone: GradeTone;
  soft?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: soft ? tone.th.surface2 : tone.accent,
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: 999,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Text style={{ color: soft ? tone.accent : '#fff', fontWeight: '700', fontSize: 12.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** I pulsanti pieni del sito (`pill-btn accent`, `ghost`). */
export function SoftButton({
  label,
  onPress,
  tone,
  variant = 'accent',
  testID,
}: {
  label: string;
  onPress: () => void;
  tone: GradeTone;
  variant?: 'accent' | 'ghost' | 'danger';
  testID?: string;
}) {
  const bg =
    variant === 'accent' ? tone.accent : variant === 'danger' ? tone.th.redSoft : 'transparent';
  const color = variant === 'accent' ? '#fff' : variant === 'danger' ? tone.th.red : tone.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 15,
        alignItems: 'center',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Text style={{ color, fontWeight: '700', fontSize: 13.6 }}>{label}</Text>
    </Pressable>
  );
}

/* --------------------------------- linguette --------------------------------- */

export function Seg({
  items,
  value,
  onChange,
  tone,
}: {
  items: { key: string; label: string; count?: number; testID: string }[];
  value: string;
  onChange: (k: string) => void;
  tone: GradeTone;
}) {
  const th = tone.th;
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: th.surface2,
        borderRadius: 12,
        padding: 3,
        marginBottom: 12,
      }}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            testID={it.testID}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={{
              flex: 1,
              paddingVertical: 9,
              paddingHorizontal: 2,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? th.surface : 'transparent',
              boxShadow: on
                ? th.scheme === 'dark'
                  ? '0 1px 1.5px rgba(0,0,0,.5), 0 5px 12px -4px rgba(0,0,0,.6)'
                  : '0 1px 1.5px rgba(0,0,0,.08), 0 5px 12px -4px rgba(0,0,0,.13)'
                : undefined,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                color: on ? th.text : th.text2,
                fontWeight: '700',
                fontSize: 12.8,
                textAlign: 'center',
              }}
            >
              {it.label}
              {it.count != null ? (
                <Text style={{ fontSize: 11.5, opacity: 0.7 }}>{`  ${it.count}`}</Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ----------------------------- medaglie dei voti ----------------------------- */

/** Il colore di un voto da 18 a 27: più è lontano dalla media, più è chiaro (gradeDynamicStyle del sito). */
export function dynamicGradeStyle(
  g: number,
  avg: number,
  tone: GradeTone,
): { backgroundColor: string; color: string; boxShadow?: string } {
  let alpha: number;
  if (g <= 18) alpha = 0.15;
  else if (g >= avg + 1) {
    const maxG = Math.max(27, avg + 2);
    alpha = 0.85 + 0.15 * Math.min(1, (g - avg) / (maxG - avg));
  } else {
    const range = Math.max(1, avg - 18);
    alpha = 0.15 + 0.7 * ((g - 18) / range);
  }
  const out: { backgroundColor: string; color: string; boxShadow?: string } = {
    backgroundColor: rgba(tone.accent, alpha),
    color: alpha > 0.6 ? '#fff' : tone.th.text,
  };
  if (g >= avg + 1)
    out.boxShadow = `0 3px 12px ${rgba(tone.accent, Math.min(0.4, (g - avg) * 0.08))}`;
  return out;
}

const badgeBase: ViewStyle = {
  minWidth: 44,
  height: 34,
  paddingHorizontal: 9,
  borderRadius: 11,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  overflow: 'hidden',
};

export function GradeBadge({
  kind,
  text,
  tone,
  style,
}: {
  kind: 'pass' | 'todo' | 'lode' | 'g30' | 'g29' | 'g28' | 'dyn';
  text: string;
  tone: GradeTone;
  style?: { backgroundColor: string; color: string; boxShadow?: string };
}) {
  const th = tone.th;
  const dark = th.scheme === 'dark';
  if (kind === 'pass')
    return (
      <View style={[badgeBase, { backgroundColor: tone.surface3 }]}>
        <Text style={{ color: th.text2, fontSize: 11.8, fontWeight: '800', letterSpacing: 0.3 }}>
          {text}
        </Text>
      </View>
    );
  if (kind === 'todo')
    return (
      <View
        style={[
          badgeBase,
          {
            backgroundColor: th.surface2,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: th.hairline2,
          },
        ]}
      >
        <Text style={{ color: th.text3, fontSize: 11.5, fontWeight: '800' }}>{text}</Text>
      </View>
    );
  if (kind === 'lode' || kind === 'g30')
    return (
      <LinearGradient
        colors={[...GOLD_GRADIENT]}
        locations={[0, 0.45, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
        style={[badgeBase, { boxShadow: '0 2px 9px rgba(232,166,0,.35)' }]}
      >
        <Text style={{ color: dark ? '#2a1c00' : '#5a3d00', fontSize: 15.7, fontWeight: '800' }}>
          {kind === 'lode' ? '30' : text}
        </Text>
        {kind === 'lode' ? (
          <Text
            style={{
              color: dark ? '#2a1c00' : '#5a3d00',
              fontSize: 11,
              fontWeight: '800',
              marginLeft: 1,
            }}
          >
            L
          </Text>
        ) : null}
      </LinearGradient>
    );
  if (kind === 'g29')
    return (
      <View style={[badgeBase, { backgroundColor: dark ? '#FFCC33' : '#E8A600' }]}>
        <Text style={{ color: '#3a2700', fontSize: 15.7, fontWeight: '800' }}>{text}</Text>
      </View>
    );
  if (kind === 'g28')
    return (
      <View style={[badgeBase, { backgroundColor: tone.silver }]}>
        <Text style={{ color: dark ? '#14171a' : '#2b3136', fontSize: 15.7, fontWeight: '800' }}>
          {text}
        </Text>
      </View>
    );
  return (
    <View
      style={[badgeBase, { backgroundColor: style?.backgroundColor, boxShadow: style?.boxShadow }]}
    >
      <Text style={{ color: style?.color, fontSize: 15.7, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

/** Il quadratino a destra di ogni esame: vuoto da fare, cerchio verde con la spunta se fatto. */
export function CheckMark({ done, tone }: { done: boolean; tone: GradeTone }) {
  const th = tone.th;
  if (done)
    return (
      <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={32} height={32} viewBox="0 0 32 32">
          <Path d="M16 2.5a13.5 13.5 0 1 0 0 27 13.5 13.5 0 0 0 0-27z" fill={th.green} />
          <Path
            d="M9.5 16.5l4.5 4.5 8.5-9.5"
            fill="none"
            stroke="#fff"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: th.hairline2,
        backgroundColor: th.surface2,
      }}
    />
  );
}

/* ------------------------- barra del voto di laurea ------------------------- */

/** Asse non lineare: più spazio vicino ai voti stimati, per non far accavallare le etichette (buildAxisWarp). */
export function buildAxisWarp(focus: number[]): (pct: number) => number {
  const N = 100;
  const SIGMA = 6;
  const BOOST = 2.5;
  const dens: number[] = [];
  for (let i = 0; i <= N; i++) {
    let dd = 1;
    for (const f of focus) {
      const dist = Math.abs(i - f);
      dd += BOOST * Math.exp(-(dist * dist) / (2 * SIGMA * SIGMA));
    }
    dens.push(dd);
  }
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1]! + (dens[i - 1]! + dens[i]!) / 2);
  const total = cum[N] || 1;
  return (pct: number) => {
    const p = Math.max(0, Math.min(100, pct));
    const i0 = Math.floor(p);
    const i1 = Math.min(N, i0 + 1);
    const c = cum[i0]! + (cum[i1]! - cum[i0]!) * (p - i0);
    return (c / total) * 100;
  };
}

type Anchor = 'start' | 'center' | 'end';
const anchorOf = (p: number): Anchor => (p < 7 ? 'start' : p > 93 ? 'end' : 'center');

/** Mette un figlio largo `w` con il suo punto di ancoraggio sul `p`% della barra. */
function Anchored({
  p,
  w,
  top,
  children,
}: {
  p: number;
  w: number;
  top: number;
  children: ReactNode;
}) {
  const a = anchorOf(p);
  const pos: ViewStyle =
    a === 'end'
      ? { right: `${100 - p}%`, alignItems: 'flex-end' }
      : a === 'start'
        ? { left: `${p}%`, alignItems: 'flex-start' }
        : { left: `${p}%`, marginLeft: -w / 2, alignItems: 'center' };
  return <View style={[{ position: 'absolute', top, width: w }, pos]}>{children}</View>;
}

function Flag({
  p,
  label,
  gold,
  tone,
}: {
  p: number;
  label: string;
  gold?: boolean;
  tone: GradeTone;
}) {
  const th = tone.th;
  const a = anchorOf(p);
  const bg = th.text;
  const notchColor = gold ? '#E8A600' : bg;
  const notch: ViewStyle =
    a === 'end' ? { right: -4 } : a === 'start' ? { left: -4 } : { left: '50%', marginLeft: -4 };
  const body = (
    <Text
      style={{
        color: gold ? '#3a2700' : th.surface,
        fontSize: 10.9,
        fontWeight: '800',
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      {label}
    </Text>
  );
  return (
    <Anchored p={p} w={80} top={-24}>
      <View>
        {gold ? (
          <LinearGradient
            colors={['#B8860B', '#FFD700', '#E8A600']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.4 }}
            style={{ borderRadius: 7 }}
          >
            {body}
          </LinearGradient>
        ) : (
          <View style={{ backgroundColor: bg, borderRadius: 7 }}>{body}</View>
        )}
        <View
          style={[
            {
              position: 'absolute',
              bottom: -4,
              width: 0,
              height: 0,
              borderLeftWidth: 4,
              borderRightWidth: 4,
              borderTopWidth: 4,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: notchColor,
            },
            notch,
          ]}
        />
      </View>
    </Anchored>
  );
}

function Mark({
  p,
  label,
  gold,
  tone,
}: {
  p: number;
  label: string;
  gold?: boolean;
  tone: GradeTone;
}) {
  return (
    <Anchored p={p} w={60} top={0}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10.5,
          fontWeight: gold ? '800' : '700',
          color: gold ? tone.gold : tone.th.text2,
        }}
      >
        {label}
      </Text>
    </Anchored>
  );
}

/** La scala 66 · 88 · 110 · L con la forbice del voto di laurea stimato (thesisVisHTML). `range` null = scala vuota. */
export function ThesisScale({
  d,
  range,
  tone,
}: {
  d: GradeData;
  range: { min: number; max: number } | null;
  tone: GradeTone;
}) {
  const th = tone.th;
  const gb = gradeBase(d);
  const x1 = range ? gradePct(d, range.min) : 0;
  const x2 = range ? gradePct(d, range.max) : 0;
  const topReached = range ? range.max > gb + 0.001 : false;
  const focus = range ? (Math.abs(x2 - x1) > 0.01 ? [x1, x2] : [x1]) : [];
  const warp = buildAxisWarp(focus);
  const wx1 = warp(x1);
  const wx2 = warp(x2);
  return (
    <View testID="grades-thesis-scale">
      <View style={{ height: 8, marginTop: 26, marginBottom: 8, marginHorizontal: 4 }}>
        <LinearGradient
          colors={[th.red, th.orange, th.green]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: 5,
            opacity: 0.28,
          }}
        />
        {range ? (
          <>
            {topReached ? (
              <LinearGradient
                colors={[...GOLD_GRADIENT]}
                locations={[0, 0.45, 0.7, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${wx1}%`,
                  width: `${Math.max(1.5, wx2 - wx1)}%`,
                  borderRadius: 5,
                }}
              />
            ) : (
              <AccentGrad
                tone={tone}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${wx1}%`,
                  width: `${Math.max(1.5, wx2 - wx1)}%`,
                  borderRadius: 5,
                }}
              />
            )}
            <Flag
              p={wx1}
              label={dispFinal(d, range.min)}
              gold={range.min > gb + 0.001}
              tone={tone}
            />
            {Math.abs(x2 - x1) > 7 ? (
              <Flag p={wx2} label={dispFinal(d, range.max)} gold={topReached} tone={tone} />
            ) : null}
          </>
        ) : null}
        <View
          style={{
            position: 'absolute',
            top: -3,
            bottom: -3,
            width: 2,
            borderRadius: 1,
            left: `${warp(92)}%`,
            marginLeft: -1,
            backgroundColor: th.hairline2,
          }}
        />
      </View>
      <View style={{ height: 15, marginTop: 7 }}>
        <Mark p={warp(0)} label="66" tone={tone} />
        <Mark p={warp(gradePct(d, 88))} label="88" tone={tone} />
        <Mark p={warp(92)} label={String(gb)} tone={tone} />
        <Mark p={warp(100)} label="L" gold tone={tone} />
      </View>
    </View>
  );
}

/* ------------------------------ piccoli riquadri ------------------------------ */

export function DeltaPill({
  text,
  mood,
  th,
  testID,
}: {
  text: string;
  mood: 'up' | 'down' | 'flat';
  th: Theme;
  testID?: string;
}) {
  const dark = th.scheme === 'dark';
  const bg =
    mood === 'up'
      ? dark
        ? 'rgba(48,209,88,.18)'
        : 'rgba(52,199,89,.14)'
      : mood === 'down'
        ? dark
          ? 'rgba(255,69,58,.18)'
          : 'rgba(255,59,48,.12)'
        : dark
          ? '#3A3A3C'
          : '#E7E7EC';
  const color = mood === 'up' ? th.green : mood === 'down' ? th.red : th.text2;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text testID={testID} style={{ color, fontSize: 12.8, fontWeight: '800' }}>
        {text}
      </Text>
    </View>
  );
}

export function StatTile({
  value,
  small,
  label,
  testID,
  th,
}: {
  value: string;
  small?: string;
  label: string;
  testID: string;
  th: Theme;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: th.surface2,
        borderRadius: 15,
        paddingVertical: 11,
        paddingHorizontal: 8,
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          testID={testID}
          style={{
            color: th.text,
            fontSize: 18.9,
            fontWeight: '800',
            letterSpacing: -0.38,
            fontVariant: ['tabular-nums'],
          }}
        >
          {value}
        </Text>
        {small ? (
          <Text style={{ color: th.text2, fontSize: 12, fontWeight: '700' }}>{small}</Text>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: th.text2,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Le righe di una lista in un riquadro: separate da un filo. */
export const hairRow = (th: Theme, first: boolean): ViewStyle => ({
  borderTopWidth: first ? 0 : 1,
  borderTopColor: th.hairline,
});
