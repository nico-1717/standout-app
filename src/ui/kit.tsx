import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { radius } from '@/core/theme/tokens';

/** L'ombra delle carte del sito (--shadow-card). Su Android si usa `elevation`. */
export function cardShadow(dark: boolean): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: dark ? 0.5 : 0.07,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: 10 },
    },
    default: { elevation: dark ? 0 : 3 },
  })!;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const th = useTheme();
  return (
    <View
      style={[
        { backgroundColor: th.surface, borderRadius: radius.card, overflow: 'hidden' },
        cardShadow(th.scheme === 'dark'),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
  danger,
  testID,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: danger ? th.red : th.brand,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{label}</Text>}
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  danger,
  testID,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={10}
      style={{ alignItems: 'center', padding: 8 }}
    >
      <Text style={{ color: danger ? th.red : th.brand, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  const th = useTheme();
  return (
    <TextInput
      placeholderTextColor={th.text3}
      {...props}
      style={[
        styles.field,
        { backgroundColor: th.surface, borderColor: th.hairline, color: th.text },
        props.style,
      ]}
    />
  );
}

export function Chip({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'orange' }) {
  const th = useTheme();
  const bg = tone === 'orange' ? th.orangeSoft : th.brandSoft;
  const fg = tone === 'orange' ? th.orange : th.brand;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const th = useTheme();
  return <Text style={[styles.section, { color: th.text2 }]}>{children.toUpperCase()}</Text>;
}

/** L'intestazione: titolo a sinistra, stato a destra. Il vetro sfocato vero arriva con la rifinitura (fase 4). */
export function Header({ title, right, top }: { title: string; right?: ReactNode; top: number }) {
  const th = useTheme();
  return (
    <View
      style={{
        paddingTop: top + 12,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: th.headerGlass,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: th.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ color: th.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.42 }}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.button,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  field: {
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 12,
  },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.chip },
  section: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginHorizontal: 28,
    marginTop: 20,
  },
});
