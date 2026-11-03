import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmmOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
const timeOf = (hhmm: string) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
};

/**
 * Un giorno («AAAA-MM-GG») o un'ora («HH:MM») scelti col selettore di sistema: compatto su iPhone/iPad, finestra su Android.
 * `value` vuoto = non scelto (si mostra `placeholder`); `clearable` aggiunge la ✕ per svuotarlo.
 */
export function DateTimeField({
  kind,
  value,
  fallback,
  onChange,
  testID,
  placeholder,
  clearable,
}: {
  kind: 'date' | 'time';
  value: string;
  fallback: string;
  onChange: (v: string) => void;
  testID: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  const th = useTheme();
  const isDate = kind === 'date';
  const make = isDate ? dateOf : timeOf;
  const out = (d: Date) => (isDate ? isoOf(d) : hhmmOf(d));
  const current = value ? make(value) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {current && Platform.OS === 'ios' ? (
        <DateTimePicker
          testID={testID}
          value={current}
          mode={kind}
          display="compact"
          themeVariant={th.scheme}
          onValueChange={(_, d) => d && onChange(out(d))}
        />
      ) : (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          onPress={() => {
            const base = current ?? make(fallback);
            if (Platform.OS === 'ios') {
              onChange(out(base));
              return;
            }
            DateTimePickerAndroid.open({
              value: base,
              mode: kind,
              is24Hour: true,
              onValueChange: (_, d) => d && onChange(out(d)),
            });
          }}
          style={{ paddingVertical: 6 }}
        >
          <Text style={{ color: current ? th.text : th.text3, fontSize: 15 }}>
            {value || placeholder || '—'}
          </Text>
        </Pressable>
      )}
      {clearable && current ? (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onChange('')}
        >
          <Text style={{ color: th.text3, fontSize: 16 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
