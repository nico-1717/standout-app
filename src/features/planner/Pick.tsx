import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import type { PlannerTheme } from './plannerTheme';
import { fieldBox } from './sheetUi';

export const dateOf = (s: string) => new Date(`${s}T12:00:00`);
export const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const clockOf = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
};
export const hhmmOf = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** `.pl-pick`: data o ora. Su iPhone il selettore compatto di sistema; altrove un tocco apre quello del telefono. */
export function Pick({
  pt,
  kind,
  value,
  onChange,
  clearable,
  placeholder,
  testID,
  dim,
  width,
}: {
  pt: PlannerTheme;
  kind: 'date' | 'time';
  value: string;
  onChange: (v: string) => void;
  clearable?: boolean;
  placeholder?: string;
  testID: string;
  /** sbiadita (la fine nello stesso giorno dell'inizio) */
  dim?: boolean;
  width?: number;
}) {
  const { t } = useTranslation();
  const isDate = kind === 'date';
  const current = value ? (isDate ? dateOf(value) : clockOf(value)) : null;
  const from = (d: Date) => (isDate ? isoOf(d) : hhmmOf(d));
  const native = current && Platform.OS === 'ios';
  return (
    <View
      style={[
        native
          ? { flexDirection: 'row', alignItems: 'center' }
          : [fieldBox(pt), { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }],
        { minHeight: 38, width },
        dim ? { opacity: 0.42 } : null,
      ]}
    >
      {native ? (
        <DateTimePicker
          testID={testID}
          value={current}
          mode={kind}
          display="compact"
          themeVariant={pt.dark ? 'dark' : 'light'}
          onValueChange={(_, d) => d && onChange(from(d))}
        />
      ) : (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          onPress={() => {
            const base = current ?? new Date();
            if (Platform.OS === 'ios') return onChange(from(base));
            DateTimePickerAndroid.open({
              value: base,
              mode: kind,
              is24Hour: true,
              onValueChange: (_, d) => d && onChange(from(d)),
            });
          }}
          style={{ paddingVertical: 8, justifyContent: 'center', flexGrow: 1 }}
        >
          <Text
            style={{
              color: current ? pt.ink : pt.ink3,
              fontSize: 14,
              fontFamily: pt.sans,
              textAlign: width ? 'center' : 'left',
            }}
          >
            {value || placeholder || '—'}
          </Text>
        </Pressable>
      )}
      {clearable && current ? (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={t('comune.annulla')}
          hitSlop={8}
          onPress={() => onChange('')}
          style={{ marginLeft: 8 }}
        >
          <Text style={{ color: pt.ink3, fontSize: 16 }}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
