import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { haptic } from '@/ui/motion';
import { habitsTheme, type HabitsTheme } from '@/features/habits/habitsTheme';

import { hoursField, parseHours } from './format';

/** I colori dei fogli del Piano (stessa famiglia dei fogli delle Abitudini). */
export function usePlanTheme(): HabitsTheme {
  const th = useTheme();
  return useMemo(() => habitsTheme(th.scheme, undefined, th.style), [th.scheme, th.style]);
}

/** Più / meno: il valore al centro, due tasti ai lati. Serve al posto dei cursori del sito (stessi passi: 15 minuti). */
export function Stepper(p: {
  value: number;
  step: number;
  min?: number;
  max?: number;
  label: string;
  format: (v: number) => string;
  onChange: (v: number) => void;
  minusLabel?: string;
  plusLabel?: string;
  testID: string;
  disabled?: boolean;
}) {
  const ht = usePlanTheme();
  const min = p.min ?? 0;
  const max = p.max ?? Number.MAX_SAFE_INTEGER;
  const go = (d: number) => {
    const next = Math.max(min, Math.min(max, p.value + d));
    if (next !== p.value) {
      haptic.tap();
      p.onChange(next);
    }
  };
  const btn = (sign: -1 | 1, off: boolean) => (
    <Pressable
      testID={`${p.testID}-${sign < 0 ? 'minus' : 'plus'}`}
      accessibilityRole="button"
      accessibilityLabel={(sign < 0 ? p.minusLabel : p.plusLabel) ?? (sign < 0 ? '−' : '+')}
      disabled={p.disabled || off}
      onPress={() => go(sign * p.step)}
      hitSlop={6}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ht.surface2,
        opacity: p.disabled || off ? 0.35 : 1,
      }}
    >
      <Text style={{ color: ht.text, fontSize: 22, fontWeight: '600' }}>
        {sign < 0 ? '−' : '+'}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: ht.text2, flex: 1, fontSize: 15 }}>{p.label}</Text>
      {btn(-1, p.value <= min)}
      <Text
        testID={`${p.testID}-value`}
        style={{
          color: ht.text,
          fontWeight: '700',
          fontSize: 16,
          minWidth: 78,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      >
        {p.format(p.value)}
      </Text>
      {btn(1, p.value >= max)}
    </View>
  );
}

/** Una fila di scelte (tipo, priorità, giorno di riposo…): una sola è accesa. */
export function Choices<T extends string | number>(p: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID: string;
  tone?: (v: T) => string | undefined;
}) {
  const ht = usePlanTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {p.options.map((o) => {
        const on = o.value === p.value;
        const color = p.tone?.(o.value) ?? ht.accent;
        return (
          <Pressable
            key={String(o.value)}
            testID={`${p.testID}-${String(o.value)}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              p.onChange(o.value);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: on ? color : ht.surface2,
              minHeight: 40,
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ color: on ? '#fff' : ht.text, fontWeight: on ? '700' : '500', fontSize: 14 }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Un campo con il suo titolo (e un aiuto sotto). */
export function Row(p: { label?: string; hint?: string; children: ReactNode }) {
  const ht = usePlanTheme();
  return (
    <View style={{ gap: 8 }}>
      {p.label ? (
        <Text style={{ color: ht.text, fontWeight: '700', fontSize: 15 }}>{p.label}</Text>
      ) : null}
      {p.children}
      {p.hint ? (
        <Text style={{ color: ht.text2, fontSize: 13, lineHeight: 18 }}>{p.hint}</Text>
      ) : null}
    </View>
  );
}

/** Un numero intero che si può anche scrivere. */
export function NumberField(p: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  testID: string;
  label: string;
}) {
  const ht = usePlanTheme();
  return (
    <TextInput
      testID={p.testID}
      accessibilityLabel={p.label}
      value={String(p.value)}
      keyboardType="number-pad"
      onChangeText={(s) => {
        const n = Number(s.replace(/\D/g, ''));
        p.onChange(Math.max(p.min ?? 0, Math.min(p.max ?? 1000000, Number.isFinite(n) ? n : 0)));
      }}
      style={{
        minWidth: 70,
        textAlign: 'center',
        color: ht.text,
        backgroundColor: ht.surface2,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 16,
        fontWeight: '700',
      }}
    />
  );
}

/** Le ore di un progetto: si scrivono («2,5» o «1:30») oppure si cambiano a passi di 15 minuti. */
export function HoursInput(p: {
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
  testID: string;
  max?: number;
  minusLabel?: string;
  plusLabel?: string;
  unit: string;
}) {
  const ht = usePlanTheme();
  const [text, setText] = useState<string | null>(null);
  const max = p.max ?? 600000;
  const commit = () => {
    const m = text === null ? null : parseHours(text);
    if (m !== null) p.onChange(Math.max(0, Math.min(max, m)));
    setText(null);
  };
  const step = (d: number) => {
    haptic.tap();
    setText(null);
    p.onChange(Math.max(0, Math.min(max, p.minutes + d)));
  };
  const btn = (sign: -1 | 1) => (
    <Pressable
      testID={`${p.testID}-${sign < 0 ? 'minus' : 'plus'}`}
      accessibilityRole="button"
      accessibilityLabel={(sign < 0 ? p.minusLabel : p.plusLabel) ?? (sign < 0 ? '−' : '+')}
      onPress={() => step(sign * 15)}
      hitSlop={6}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ht.surface2,
      }}
    >
      <Text style={{ color: ht.text, fontSize: 22, fontWeight: '600' }}>
        {sign < 0 ? '−' : '+'}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: ht.text2, flex: 1, fontSize: 15 }}>{p.label}</Text>
      {btn(-1)}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          testID={p.testID}
          accessibilityLabel={p.label}
          value={text ?? hoursField(p.minutes)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          style={{
            minWidth: 64,
            textAlign: 'center',
            color: ht.text,
            backgroundColor: ht.surface2,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 10,
            fontSize: 16,
            fontWeight: '700',
          }}
        />
        <Text style={{ color: ht.text2, fontSize: 14 }}>{p.unit}</Text>
      </View>
      {btn(1)}
    </View>
  );
}
