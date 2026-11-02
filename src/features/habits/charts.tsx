import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alpha } from '@/features/buy/buyTheme';
import { cardShadow } from '@/ui/kit';

import type { HabitsTheme } from './habitsTheme';
import type { Bar, CalCell, HeatWeek } from './stats';

/* I grafici del sito (public/planner/habits.css: hb-card, hb-kpi, hb-bars, hb-heat, hb-cal), disegnati con View. */

export function StatCard(p: {
  th: HabitsTheme;
  title?: string;
  note?: string;
  action?: { label: string; onPress: () => void; testID?: string };
  children: ReactNode;
}) {
  const { th } = p;
  return (
    <View style={[styles.card, { backgroundColor: th.surface }, cardShadow(th.scheme === 'dark')]}>
      {(p.title || p.note || p.action) && (
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: th.text2 }]}>
            {(p.title ?? '').toUpperCase()}
          </Text>
          {!!p.note && (
            <Text style={{ color: th.text2, fontSize: 13, fontWeight: '600' }}>{p.note}</Text>
          )}
          {p.action && (
            <Pressable
              testID={p.action.testID}
              accessibilityRole="button"
              onPress={p.action.onPress}
              style={[styles.act, { backgroundColor: alpha(th.accent, 0.14) }]}
            >
              <Text style={{ color: th.accent, fontWeight: '800', fontSize: 13.5 }}>
                {p.action.label}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {p.children}
    </View>
  );
}

/** Un numero grande con una macchia di colore in un angolo, come .hb-kpi. */
export function Kpi(p: {
  th: HabitsTheme;
  value: string;
  suffix?: string;
  label: string;
  color: string;
}) {
  const { th } = p;
  return (
    <View style={[styles.kpi, { backgroundColor: th.surface }, cardShadow(th.scheme === 'dark')]}>
      <LinearGradient
        colors={[alpha(p.color, 0.22), alpha(p.color, 0)]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.8 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text style={{ color: th.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>
        {p.value}
        {!!p.suffix && (
          <Text style={{ fontSize: 16, color: th.text2, fontWeight: '700' }}> {p.suffix}</Text>
        )}
      </Text>
      <Text
        style={{
          color: th.text2,
          fontSize: 11.5,
          fontWeight: '800',
          letterSpacing: 1.1,
          marginTop: 4,
        }}
      >
        {p.label.toUpperCase()}
      </Text>
    </View>
  );
}

/** Barre verticali (una per giorno/mese…). `max` = altezza della barra piena in punti. */
export function Bars(p: { th: HabitsTheme; bars: Bar[]; max?: number; testID?: string }) {
  const { th } = p;
  const max = p.max ?? 108;
  return (
    <View
      testID={p.testID}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: max + 22,
        gap: p.bars.length > 20 ? 2 : 6,
      }}
    >
      {p.bars.map((b, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View
            style={{
              width: '100%',
              height: Math.max(3, Math.round(Math.min(1, Math.max(0, b.value)) * max)),
              borderRadius: 4,
              backgroundColor: b.color,
              opacity: b.highlight ? 1 : 0.9,
            }}
          />
          <Text
            style={{
              color: b.highlight ? th.text : th.text3,
              fontSize: 9,
              fontWeight: '700',
              height: 14,
              marginTop: 4,
            }}
            numberOfLines={1}
          >
            {b.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const CELL = 11;
const GAP = 3;

/** Un quadratino al giorno, 53 colonne, si scorre di lato e parte da oggi. */
export function Heatmap(p: {
  th: HabitsTheme;
  weeks: HeatWeek[];
  color: string;
  monthName: (m: number) => string;
  lessLabel: string;
  moreLabel: string;
}) {
  const { th } = p;
  const ref = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToEnd({ animated: false }), 0);
    return () => clearTimeout(id);
  }, []);
  const level = (l: number) =>
    l < 0 ? 'transparent' : l === 0 ? th.surface3 : alpha(p.color, [0, 0.28, 0.5, 0.75, 1][l]!);
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        ref={(r) => {
          ref.current = r;
        }}
      >
        <View>
          <View style={{ flexDirection: 'row', gap: GAP, height: 16 }}>
            {p.weeks.map((w, i) => (
              <View key={i} style={{ width: CELL }}>
                {w.month !== null && (
                  <Text
                    numberOfLines={1}
                    style={{ color: th.text2, fontSize: 10, width: 30, fontWeight: '600' }}
                  >
                    {p.monthName(w.month)}
                  </Text>
                )}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {p.weeks.map((w, i) => (
              <View key={i} style={{ gap: GAP }}>
                {w.levels.map((l, j) => (
                  <View
                    key={j}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 3,
                      backgroundColor: level(l),
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <Text style={{ color: th.text2, fontSize: 12 }}>{p.lessLabel}</Text>
        {[0, 1, 2, 3, 4].map((l) => (
          <View
            key={l}
            style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: level(l) }}
          />
        ))}
        <Text style={{ color: th.text2, fontSize: 12 }}>{p.moreLabel}</Text>
      </View>
    </View>
  );
}

/** Il calendario del mese: giorno = cerchio (pieno se fatto, bordo se solo previsto). */
export function CalendarGrid(p: {
  th: HabitsTheme;
  cells: (CalCell | null)[];
  color: string;
  dowLabels: string[];
  onTap: (day: string) => void;
  onLong: (day: string) => void;
}) {
  const { th } = p;
  const rows: (CalCell | null)[][] = [];
  for (let i = 0; i < p.cells.length; i += 7) {
    const r = p.cells.slice(i, i + 7);
    while (r.length < 7) r.push(null);
    rows.push(r);
  }
  return (
    <View>
      <View style={styles.calRow}>
        {p.dowLabels.map((d, i) => (
          <Text key={i} style={[styles.calDow, { color: th.text3 }]}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={styles.calRow}>
          {r.map((c, ci) => {
            if (!c) return <View key={ci} style={styles.calSlot} />;
            const done = c.state === 'done';
            const partial = c.state === 'partial';
            const failed = c.state === 'failed';
            return (
              <View key={ci} style={styles.calSlot}>
                <Pressable
                  testID={`cal-${c.day}`}
                  disabled={c.future}
                  onPress={() => p.onTap(c.day)}
                  onLongPress={() => p.onLong(c.day)}
                  delayLongPress={380}
                  style={[
                    styles.calCell,
                    done && { backgroundColor: p.color },
                    partial && { backgroundColor: alpha(p.color, 0.3) },
                    failed && { backgroundColor: th.red },
                    c.state === 'skipped' && { backgroundColor: th.surface3 },
                    c.today && { borderWidth: 2, borderColor: p.color },
                    !done &&
                      !partial &&
                      !failed &&
                      c.due &&
                      !c.future &&
                      c.state === 'none' &&
                      !c.today && { borderWidth: 1.5, borderColor: alpha(p.color, 0.35) },
                    c.future && { opacity: 0.35 },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: done || failed ? '#fff' : c.due ? th.text : th.text3,
                    }}
                  >
                    {c.num}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, padding: 18, marginBottom: 14 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    minHeight: 28,
  },
  cardTitle: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1.3, flexShrink: 1 },
  act: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 6 },
  kpi: { flex: 1, borderRadius: 24, padding: 16, overflow: 'hidden', minHeight: 88 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 12,
  },
  calRow: { flexDirection: 'row' },
  calDow: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  calSlot: { flex: 1, aspectRatio: 1, padding: 2.5 },
  calCell: { flex: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
});
