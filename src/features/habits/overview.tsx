import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import { alpha } from '@/features/buy/buyTheme';
import { cardShadow } from '@/ui/kit';

import type { HabitsTheme } from './habitsTheme';
import type { WeekCell } from './globalStats';
import { Text } from '@/ui/CappedText';

/* Pezzi della pagina principale e delle schede «Statistiche» / «Vista tabella» (habits.css: hb-stat, hb-hbars, hb-line, hb-radar, hb-week-grid). */

export function HeaderIcon({
  kind,
  color,
}: {
  kind: 'table' | 'stats' | 'settings';
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 2.2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {kind === 'table' && <Path d="M4 6h16M4 12h16M4 18h16M9 6v12M15 6v12" {...common} />}
      {kind === 'stats' && <Path d="M6 20V11M12 20V4M18 20v-6" {...common} />}
      {kind === 'settings' && (
        <>
          <Circle cx={12} cy={12} r={3} {...common} />
          <Path
            d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
            {...common}
          />
        </>
      )}
    </Svg>
  );
}

/** L'intestazione della pagina: «Oggi» piccolo, titolo grande, tre tasti rotondi. */
export function HabitsHeader(p: {
  th: HabitsTheme;
  top: number;
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
  onTable: () => void;
  onStats: () => void;
  onSettings?: () => void;
}) {
  const { th } = p;
  const display = useTheme().display;
  const btn = (kind: 'table' | 'stats' | 'settings', onPress: () => void, label: string) => (
    <Pressable
      testID={`hb-${kind}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.hBtn, { backgroundColor: th.surface }, cardShadow(th.scheme === 'dark')]}
    >
      <HeaderIcon kind={kind} color={th.text} />
    </Pressable>
  );
  return (
    <View
      style={{
        paddingTop: p.top + 8,
        paddingHorizontal: 20,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <View>
        <Text style={{ color: th.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 }}>
          {p.eyebrow.toUpperCase()}
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: th.text,
            fontSize: display ? 38 : 32,
            fontFamily: display,
            fontWeight: display ? undefined : '800',
            letterSpacing: display ? -1 : -0.9,
          }}
        >
          {p.title}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {p.right}
        {btn('table', p.onTable, 'table')}
        {btn('stats', p.onStats, 'statistics')}
        {p.onSettings && btn('settings', p.onSettings, 'settings')}
      </View>
    </View>
  );
}

export interface CardView {
  key: string;
  color: string;
  emoji: string;
  kicker: string;
  value: number;
  suffix: string;
  sub: string;
  spark?: number[];
  ring?: number;
}

const CARD_GAP = 11;

/** Il carosello delle carte statistiche: scorre a scatti, ha i puntini, e (se acceso) va avanti da solo finché non lo tocchi. */
export function StatCarousel(p: {
  th: HabitsTheme;
  cards: CardView[];
  autoplay: boolean;
  intervalS: number;
}) {
  const { th } = p;
  const { width } = useWindowDimensions();
  const cardW = Math.min(300, Math.round((width - 32) * 0.78));
  const step = cardW + CARD_GAP;
  const ref = useRef<{ scrollTo: (o: { x: number; animated?: boolean }) => void } | null>(null);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const paused = useRef(false);
  const count = p.cards.length;

  useEffect(() => {
    if (!p.autoplay || count < 2) return;
    const id = setInterval(
      () => {
        if (paused.current) return;
        const next = (idxRef.current + 1) % count;
        ref.current?.scrollTo({ x: next * step, animated: true });
      },
      Math.max(2, p.intervalS) * 1000,
    );
    return () => clearInterval(id);
  }, [p.autoplay, p.intervalS, count, step]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / step);
    if (i !== idxRef.current) {
      idxRef.current = i;
      setIdx(i);
    }
  };
  return (
    <View>
      <ScrollView
        ref={(r) => {
          ref.current = r;
        }}
        testID="stat-carousel"
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: CARD_GAP, paddingVertical: 8 }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onScrollBeginDrag={() => {
          paused.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            paused.current = false;
          }, 6000);
        }}
      >
        {p.cards.map((c) => (
          <View
            key={c.key}
            testID={`stat-${c.key}`}
            style={[
              styles.stat,
              { width: cardW, backgroundColor: th.surface },
              cardShadow(th.scheme === 'dark'),
            ]}
          >
            <LinearGradient
              colors={[alpha(c.color, 0.28), alpha(c.color, 0)]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.3, y: 0.7 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
              <Text
                style={{ color: th.text2, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}
              >
                {c.kicker.toUpperCase()}
              </Text>
            </View>
            <View style={styles.statRight}>
              {c.spark ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 46 }}>
                  {c.spark.map((v, i) => (
                    <View
                      key={i}
                      style={{
                        width: 7,
                        height: Math.max(6, Math.round(v * 44)),
                        borderRadius: 3,
                        backgroundColor: c.color,
                      }}
                    />
                  ))}
                </View>
              ) : c.ring != null ? (
                <MiniRing pct={c.ring} color={c.color} track={th.surface3} />
              ) : null}
            </View>
            <View style={{ marginTop: 'auto' }}>
              <Text style={{ color: th.text, fontSize: 40, fontWeight: '800', letterSpacing: -1 }}>
                {c.value}
                {!!c.suffix && (
                  <Text style={{ fontSize: 20, color: th.text2, fontWeight: '700' }}>
                    {c.suffix}
                  </Text>
                )}
              </Text>
              <Text style={{ color: th.text2, fontSize: 13.5 }} numberOfLines={2}>
                {c.sub}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {p.cards.map((c, i) => (
          <View
            key={c.key}
            style={{
              width: i === idx ? 22 : 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: i === idx ? th.accent : th.surface3,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function MiniRing({ pct, color, track }: { pct: number; color: string; track: string }) {
  const r = 24;
  const C = 2 * Math.PI * r;
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Circle cx={28} cy={28} r={r} stroke={track} strokeWidth={6} fill="none" />
      <Circle
        cx={28}
        cy={28}
        r={r}
        stroke={color}
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${C}`}
        strokeDashoffset={C * (1 - Math.min(1, Math.max(0, pct)))}
        transform="rotate(-90 28 28)"
      />
    </Svg>
  );
}

/** Andamento: linea con area (lineChart del sito). `points` 0..1. */
export function LineChart({
  th,
  points,
  color,
}: {
  th: HabitsTheme;
  points: number[];
  color: string;
}) {
  const w = 320;
  const h = 140;
  const pad = 6;
  if (!points.length) return null;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((v, i) => [pad + i * step, h - pad - v * (h - pad * 2)] as const);
  const d = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1]!;
  const area = `${d} L${last[0].toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`;
  return (
    <Svg
      width="100%"
      height={140}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${Math.round(points[0]! * 100)}% → ${Math.round(points[points.length - 1]! * 100)}%`}
    >
      <Defs>
        <SvgGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <Path
          key={g}
          d={`M${pad} ${h - pad - g * (h - pad * 2)} L${w - pad} ${h - pad - g * (h - pad * 2)}`}
          stroke={th.hairline}
          strokeWidth={1}
        />
      ))}
      <Path d={area} fill="url(#lg)" />
      <Path
        d={d}
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last[0]} cy={last[1]} r={4.5} fill={color} />
    </Svg>
  );
}

/** Barre orizzontali con nome, riempimento e valore (categorie e classifica). */
export function HBars(p: {
  th: HabitsTheme;
  rows: { name: string; color: string; fill: number; value: string }[];
  empty: string;
}) {
  const { th } = p;
  if (!p.rows.length)
    return (
      <Text style={{ color: th.text2, textAlign: 'center', paddingVertical: 12 }}>{p.empty}</Text>
    );
  return (
    <View style={{ gap: 12 }}>
      {p.rows.map((r, i) => (
        <View
          key={i}
          accessible
          accessibilityLabel={`${r.name}: ${r.value}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Text
            style={{ color: th.text, fontWeight: '700', fontSize: 14, width: 118 }}
            numberOfLines={1}
          >
            {r.name}
          </Text>
          <View
            style={{
              flex: 1,
              height: 10,
              borderRadius: 5,
              backgroundColor: th.surface3,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(Math.min(1, r.fill) * 100)}%`,
                height: '100%',
                borderRadius: 5,
                backgroundColor: r.color,
              }}
            />
          </View>
          <Text
            style={{
              color: th.text2,
              fontWeight: '700',
              fontSize: 13,
              width: 46,
              textAlign: 'right',
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Equilibrio delle aree: ragnatela con una punta per categoria. */
export function Radar({
  th,
  data,
  empty,
}: {
  th: HabitsTheme;
  data: { name: string; v: number }[];
  empty: string;
}) {
  if (data.length < 3)
    return (
      <Text style={{ color: th.text2, textAlign: 'center', paddingVertical: 12 }}>{empty}</Text>
    );
  const cx = 150;
  const cy = 130;
  const R = 92;
  const n = data.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = (r: (i: number) => number) =>
    data
      .map((_, i) =>
        pt(i, r(i))
          .map((x) => x.toFixed(1))
          .join(','),
      )
      .join(' ');
  return (
    <Svg
      width="100%"
      height={262}
      viewBox="0 0 300 262"
      accessible
      accessibilityRole="image"
      accessibilityLabel={data.map((d) => `${d.name}: ${Math.round(d.v * 100)}%`).join(', ')}
    >
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <Polygon
          key={g}
          points={poly(() => R * g)}
          fill="none"
          stroke={th.hairline2}
          strokeWidth={1}
        />
      ))}
      <Polygon
        points={poly((i) => Math.max(6, R * data[i]!.v))}
        fill={alpha(th.accent, 0.25)}
        stroke={th.accent}
        strokeWidth={2}
      />
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 17);
        return (
          <SvgText
            key={i}
            x={x}
            y={y + 3}
            fontSize={10}
            fontWeight="700"
            fill={th.text2}
            textAnchor={x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle'}
          >
            {d.name.slice(0, 11)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

/** Un quadratino di stato (settimana per abitudine, tabella). */
export function stateColor(th: HabitsTheme, s: WeekCell, color: string): string {
  switch (s) {
    case 'done':
      return color;
    case 'partial':
      return alpha(color, 0.35);
    case 'failed':
      return th.red;
    case 'skipped':
      return th.surface3;
    default:
      return 'transparent';
  }
}

export function WeekGrid(p: {
  th: HabitsTheme;
  rows: { name: string; color: string; cells: WeekCell[] }[];
  dowLabels: string[];
  empty: string;
}) {
  const { th } = p;
  if (!p.rows.length)
    return (
      <Text style={{ color: th.text2, textAlign: 'center', paddingVertical: 12 }}>{p.empty}</Text>
    );
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 130 }} />
        {p.dowLabels.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              color: th.text3,
              fontSize: 11,
              fontWeight: '800',
            }}
          >
            {d}
          </Text>
        ))}
      </View>
      {p.rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={{ width: 130, color: th.text, fontWeight: '700', fontSize: 13 }}
            numberOfLines={1}
          >
            {r.name}
          </Text>
          {r.cells.map((c, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  backgroundColor:
                    c === 'na'
                      ? 'transparent'
                      : c === 'none'
                        ? th.surface2
                        : stateColor(th, c, r.color),
                  borderWidth: c === 'na' ? 1 : 0,
                  borderStyle: 'dashed',
                  borderColor: th.hairline2,
                }}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stat: { height: 168, borderRadius: 28, padding: 18, overflow: 'hidden' },
  statRight: { position: 'absolute', right: 18, top: 44 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 6, marginBottom: 6 },
});
