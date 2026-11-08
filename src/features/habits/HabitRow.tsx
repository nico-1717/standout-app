import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { alpha, mix } from '@/features/buy/buyTheme';
import { cardShadow } from '@/ui/kit';

import type { Habit, DayState } from './logic';
import type { HabitsTheme } from './habitsTheme';
import { Ring } from './Ring';

export interface HabitRowProps {
  habit: Habit;
  state: DayState;
  th: HabitsTheme;
  /** testo sotto il nome (serie, momento della giornata…) già tradotto */
  meta: string;
  /** a destra: «3/8 bicchieri» già formattato; vuoto per le abitudini da spuntare e basta */
  amountText?: string;
  unitText?: string;
  /** anello periodico (settimanali, mensili, a intervallo) */
  period?: { done: number; target: number };
  disabled?: boolean;
  /** il tocco sul cerchio: il punto sullo schermo serve a far partire i coriandoli da lì */
  onCheck: (e?: GestureResponderEvent) => void;
  onLongPress: () => void;
  onOpen: () => void;
}

const habit_uuid = (h: Habit) => h.uuid;

function CheckMark({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function XMark({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Una riga della lista, come .hb-row del sito: bianca, «pastiglia ink» se fatta, rossa se fallita, spenta se saltata. */
function HabitRowImpl(p: HabitRowProps) {
  const { habit: h, state: s, th } = p;
  const done = s.status === 'done' || s.status === 'clean';
  const failed = s.status === 'failed';
  const partial = s.status === 'partial';
  const skipped = s.status === 'skipped';
  const textColor = done ? th.inkText : th.text;
  const text2 = done ? th.inkText2 : th.text2;
  const quantity = h.goal_type === 'quantity';

  const body = (
    <View style={styles.inner}>
      <Pressable
        onPress={p.onCheck}
        disabled={p.disabled}
        hitSlop={8}
        accessibilityRole="button"
        testID={`habit-check-${habit_uuid(h)}`}
        style={[
          styles.check,
          done
            ? { backgroundColor: '#FFFFFF' }
            : failed
              ? { backgroundColor: th.red }
              : { borderWidth: 2, borderColor: partial ? h.color : th.hairline2 },
        ]}
      >
        {done && <CheckMark color={th.scheme === 'dark' ? '#0E0E13' : th.text} />}
        {failed && <XMark color="#fff" />}
      </Pressable>
      <View style={[styles.emoji, { backgroundColor: mix(h.color, th.surface, 0.15) }]}>
        <Text style={{ fontSize: 19 }}>{h.icon}</Text>
      </View>
      <View style={styles.main}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: textColor }, failed || skipped ? styles.strike : null]}
        >
          {h.name}
        </Text>
        {!!p.meta && (
          <Text numberOfLines={1} style={[styles.meta, { color: text2 }]}>
            {p.meta}
          </Text>
        )}
        {quantity && h.kind === 'build' && (
          <View style={[styles.barTrack, { backgroundColor: done ? th.inkBarTrack : th.surface3 }]}>
            <View
              style={{
                width: `${Math.round(s.pct * 100)}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: done ? '#FFFFFF' : h.color,
              }}
            />
          </View>
        )}
      </View>
      {p.period ? (
        <View style={styles.periodWrap}>
          <Ring
            size={38}
            stroke={4}
            pct={p.period.target ? p.period.done / p.period.target : 0}
            color={h.color}
            track={done ? th.inkTrack : th.surface3}
          />
          <Text style={[styles.periodText, { color: textColor }]}>
            {p.period.done}/{p.period.target}
          </Text>
        </View>
      ) : (
        !!p.amountText && (
          <View style={styles.amount}>
            <Text style={[styles.amountNum, { color: textColor }]}>{p.amountText}</Text>
            {!!p.unitText && <Text style={[styles.unit, { color: text2 }]}>{p.unitText}</Text>}
          </View>
        )
      )}
    </View>
  );

  const shadow = cardShadow(th.scheme === 'dark');
  return (
    <Pressable
      accessibilityRole="button"
      testID={`habit-row-${h.uuid}`}
      onPress={p.onOpen}
      onLongPress={p.onLongPress}
      delayLongPress={350}
      style={[styles.row, shadow, skipped && { opacity: 0.5 }]}
    >
      {done ? (
        <LinearGradient
          colors={[th.ink2, th.ink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.content,
            { borderColor: th.inkHairline, borderWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <LinearGradient
            colors={[alpha(h.color, 0), alpha(h.color, th.scheme === 'dark' ? 0.4 : 0.28)]}
            start={{ x: 0.2, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {body}
        </LinearGradient>
      ) : failed ? (
        <LinearGradient
          colors={[mix(th.red, th.surface, 0.22), th.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.content, { borderWidth: 1.5, borderColor: alpha(th.red, 0.45) }]}
        >
          {body}
        </LinearGradient>
      ) : (
        <View style={[styles.content, { backgroundColor: th.surface }]}>{body}</View>
      )}
    </Pressable>
  );
}

export const HabitRow = memo(HabitRowImpl);

const styles = StyleSheet.create({
  row: { borderRadius: 22 },
  content: { borderRadius: 22, overflow: 'hidden' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 16.5, fontWeight: '800', letterSpacing: -0.2 },
  strike: { textDecorationLine: 'line-through' },
  meta: { fontSize: 12.5, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 5 },
  amount: { alignItems: 'flex-end' },
  amountNum: { fontSize: 19, fontWeight: '800' },
  unit: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  periodWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  periodText: { position: 'absolute', fontSize: 10, fontWeight: '800' },
});
