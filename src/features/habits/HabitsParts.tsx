import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cardShadow } from '@/ui/kit';

import type { HabitsTheme } from './habitsTheme';
import { Ring } from './Ring';

export interface DayCell {
  day: string; // YYYY-MM-DD
  dow: string; // «Mon»
  num: number; // giorno del mese
  pct: number; // 0..1
  hasHabits: boolean;
}

/** La fascia dei giorni con un anello ciascuno (la «barra in alto» del sito). Parte scorrendo fino a oggi. */
export function DayStrip(p: {
  cells: DayCell[];
  selected: string;
  today: string;
  th: HabitsTheme;
  onSelect: (day: string) => void;
}) {
  const ref = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToEnd({ animated: false }), 0);
    return () => clearTimeout(id);
  }, []);
  const { th } = p;
  return (
    <ScrollView
      ref={(r) => {
        ref.current = r;
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {p.cells.map((c) => {
        const sel = c.day === p.selected;
        return (
          <Pressable
            key={c.day}
            testID={`day-${c.day}`}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => p.onSelect(c.day)}
            style={[
              styles.cell,
              sel && { backgroundColor: th.surface },
              sel && cardShadow(th.scheme === 'dark'),
            ]}
          >
            <Text style={[styles.dow, { color: sel ? th.accent : th.text2 }]}>{c.dow}</Text>
            <View style={styles.ringBox}>
              <Ring
                size={34}
                stroke={4}
                pct={c.hasHabits ? c.pct : 0}
                color={c.pct >= 1 ? th.green : th.accent}
                track={th.surface3}
              />
              <Text style={[styles.num, { color: c.day === p.today ? th.accent : th.text }]}>
                {c.num}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** La carta «Oggi»: anello grande, conteggio, frase e serie dei giorni perfetti. */
export function TodayCard(p: {
  th: HabitsTheme;
  title: string;
  pct: number;
  line1: string;
  line2: string;
  streakText?: string;
}) {
  const { th } = p;
  return (
    <View style={[styles.today, { backgroundColor: th.surface }, cardShadow(th.scheme === 'dark')]}>
      <View style={styles.bigRing}>
        <Ring
          size={78}
          stroke={9}
          pct={p.pct}
          color={p.pct >= 1 ? th.green : th.accent}
          track={th.surface3}
        />
        <Text style={[styles.pct, { color: th.text }]}>{Math.round(p.pct * 100)}%</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.todayTitle, { color: th.text }]}>{p.title}</Text>
        <Text style={{ color: th.text, fontWeight: '700', fontSize: 14 }}>{p.line1}</Text>
        <Text style={{ color: th.text2, fontSize: 13 }}>{p.line2}</Text>
        {!!p.streakText && (
          <View style={[styles.streak, { backgroundColor: th.surface2 }]}>
            <Text style={{ color: th.text, fontWeight: '800', fontSize: 12.5 }}>
              🔥 {p.streakText}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function FilterChips<K extends string>(p: {
  items: { key: K; label: string }[];
  value: K;
  th: HabitsTheme;
  onChange: (k: K) => void;
}) {
  const { th } = p;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {p.items.map((i) => {
        const on = i.key === p.value;
        return (
          <Pressable
            key={i.key}
            testID={`filter-${i.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => p.onChange(i.key)}
            style={[styles.chip, { backgroundColor: on ? th.text : th.surface }]}
          >
            <Text style={{ color: on ? th.bg : th.text, fontWeight: '700', fontSize: 13.5 }}>
              {i.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function GroupLabel({ text, th }: { text: string; th: HabitsTheme }) {
  return <Text style={[styles.group, { color: th.text2 }]}>{text.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  cell: { width: 50, alignItems: 'center', paddingVertical: 8, borderRadius: 18, gap: 5 },
  dow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  ringBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  num: { position: 'absolute', fontSize: 12.5, fontWeight: '800' },
  today: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 26,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bigRing: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  pct: { position: 'absolute', fontSize: 19, fontWeight: '800' },
  todayTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    opacity: 0.55,
  },
  streak: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  group: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 8,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
});
