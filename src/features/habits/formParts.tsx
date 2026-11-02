import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';

import { alpha } from '@/features/buy/buyTheme';
import { cardShadow } from '@/ui/kit';

import type { HabitsTheme } from './habitsTheme';

/* Pezzi piccoli del modulo, uguali a quelli di public/planner/habits.css (hb-label, hb-seg, hb-chip, hb-swatch, hb-stepper). */

export function Field({
  label,
  children,
  th,
}: {
  label?: string;
  children: ReactNode;
  th: HabitsTheme;
}) {
  return (
    <View style={{ marginBottom: 22 }}>
      {!!label && <Text style={[styles.label, { color: th.text2 }]}>{label.toUpperCase()}</Text>}
      {children}
    </View>
  );
}

export function Hint({ children, th }: { children: ReactNode; th: HabitsTheme }) {
  return (
    <Text style={{ color: th.text2, fontSize: 14, marginTop: 8, lineHeight: 20 }}>{children}</Text>
  );
}

/** Interruttore a più voci («Da fare / Da evitare», «Completata / Quantità», frequenza, durata). */
export function Segmented<K extends string>(p: {
  items: { key: K; label: string }[];
  value: K;
  th: HabitsTheme;
  onChange: (k: K) => void;
  testPrefix: string;
}) {
  const { th } = p;
  return (
    <View style={[styles.seg, { backgroundColor: th.surface2, borderColor: th.hairline }]}>
      {p.items.map((i) => {
        const on = i.key === p.value;
        return (
          <Pressable
            key={i.key}
            testID={`${p.testPrefix}-${i.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => p.onChange(i.key)}
            style={[
              styles.segItem,
              on && { backgroundColor: th.surface },
              on && cardShadow(th.scheme === 'dark'),
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: on ? th.text : th.text2, fontWeight: '700', fontSize: 15 }}
            >
              {i.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Una «pillola»: acquisisce il colore dato quando è accesa. */
export function Pill(p: {
  label: string;
  on: boolean;
  color: string;
  th: HabitsTheme;
  onPress: () => void;
  testID?: string;
  minWidth?: number;
}) {
  const { th } = p;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityState={{ selected: p.on }}
      onPress={p.onPress}
      style={[
        styles.pill,
        { minWidth: p.minWidth },
        p.on
          ? { backgroundColor: alpha(p.color, 0.16), borderColor: alpha(p.color, 0.55) }
          : { backgroundColor: th.surface2, borderColor: 'transparent' },
      ]}
    >
      <Text style={{ color: p.on ? p.color : th.text, fontWeight: '700', fontSize: 15 }}>
        {p.label}
      </Text>
    </Pressable>
  );
}

export function Swatches(p: {
  colors: { hex: string; name: string }[];
  value: string;
  th: HabitsTheme;
  onChange: (hex: string) => void;
}) {
  return (
    <View style={styles.swatches}>
      {p.colors.map((c) => {
        const on = c.hex.toUpperCase() === p.value.toUpperCase();
        return (
          <Pressable
            key={c.hex}
            testID={`swatch-${c.hex}`}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            accessibilityState={{ selected: on }}
            onPress={() => p.onChange(c.hex)}
            style={[styles.swatchOuter, on && { borderColor: alpha(c.hex, 0.55), borderWidth: 3 }]}
          >
            <View style={[styles.swatch, { backgroundColor: c.hex }]}>
              {on && (
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path
                    d="M20 6L9 17l-5-5"
                    stroke="#fff"
                    strokeWidth={3.4}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − valore + con un testo a sinistra o davanti al numero. `value` è un numero; si ferma a min e max. */
export function Stepper(p: {
  value: number;
  min: number;
  max: number;
  step: number;
  th: HabitsTheme;
  onChange: (n: number) => void;
  label?: string;
  prefix?: string;
  testID: string;
}) {
  const { th } = p;
  const set = (n: number) =>
    p.onChange(Math.min(p.max, Math.max(p.min, Math.round(n * 100) / 100)));
  const btn = (sign: -1 | 1) => (
    <Pressable
      testID={`${p.testID}-${sign < 0 ? 'minus' : 'plus'}`}
      accessibilityRole="button"
      accessibilityLabel={sign < 0 ? '−' : '+'}
      onPress={() => set(p.value + sign * p.step)}
      style={[styles.stepBtn, { backgroundColor: th.surface3 }]}
    >
      <Text style={{ color: th.text, fontSize: 22, fontWeight: '600', lineHeight: 24 }}>
        {sign < 0 ? '−' : '+'}
      </Text>
    </Pressable>
  );
  return (
    <View style={[styles.stepper, { backgroundColor: th.surface2 }]}>
      {btn(-1)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text
          testID={`${p.testID}-value`}
          style={{ color: th.text, fontSize: 20, fontWeight: '800' }}
        >
          {p.prefix ?? ''}
          {String(Math.round(p.value * 100) / 100)}
        </Text>
        {!!p.label && (
          <Text style={{ color: th.text2, fontSize: 12, fontWeight: '600' }}>{p.label}</Text>
        )}
      </View>
      {btn(1)}
    </View>
  );
}

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Un giorno da scegliere. iPhone/iPad: il selettore compatto di sistema. Android: la finestra di sistema, aperta toccando. */
export function DateField(p: {
  value: string | null;
  min?: string;
  th: HabitsTheme;
  placeholder: string;
  testID: string;
  onChange: (iso: string) => void;
}) {
  const { th } = p;
  const [, force] = useState(0);
  const v = p.value ? toDate(p.value) : new Date();
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.dateBox, { backgroundColor: th.surface2 }]}>
        <Text style={{ color: p.value ? th.text : th.text2, fontSize: 16, flex: 1 }}>
          {p.value ?? p.placeholder}
        </Text>
        <DateTimePicker
          testID={p.testID}
          value={v}
          mode="date"
          display="compact"
          minimumDate={p.min ? toDate(p.min) : undefined}
          themeVariant={th.scheme}
          onValueChange={(_, d) => d && p.onChange(toIso(d))}
        />
      </View>
    );
  }
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      onPress={() => {
        DateTimePickerAndroid.open({
          value: v,
          mode: 'date',
          minimumDate: p.min ? toDate(p.min) : undefined,
          onValueChange: (_, d) => {
            if (d) p.onChange(toIso(d));
            force((n) => n + 1);
          },
        });
      }}
      style={[styles.dateBox, { backgroundColor: th.surface2 }]}
    >
      <Text style={{ color: p.value ? th.text : th.text2, fontSize: 16 }}>
        {p.value ?? p.placeholder}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10 },
  seg: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 6, gap: 6 },
  stepBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBox: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
