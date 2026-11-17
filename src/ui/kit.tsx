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
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme, type Theme } from '@/core/theme/ThemeProvider';
import { radius } from '@/core/theme/tokens';

import { Avatar } from './Avatar';
import { Rise } from './motion';

/** L'ombra delle carte del sito (--shadow-card). Ancora usata dalle pagine non ancora passate alle nuove vesti. */
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

export function Card({
  children,
  style,
  index,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** se c'è, la carta entra con dissolvenza dopo `index` passi (vedi ui/motion) */
  index?: number;
}) {
  const th = useTheme();
  const card = (
    <View
      style={[
        {
          backgroundColor: th.surface,
          borderRadius: th.radiusCard,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: th.cardEdge,
          overflow: 'hidden',
          // Glass: ombra morbida; Paper: nessuna ombra, solo la linea sottile
          boxShadow: th.cardShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  return index === undefined ? card : <Rise index={index}>{card}</Rise>;
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
          borderRadius: th.radiusButton,
          backgroundColor: danger ? th.red : th.brand,
          opacity: disabled ? 0.5 : 1,
          // un piccolo «affondo» quando si preme, senza rimbalzo
          transform: [{ scale: pressed ? 0.97 : 1 }],
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
        {
          backgroundColor: th.surface,
          borderColor: th.hairline2,
          borderRadius: th.radiusButton,
          color: th.text,
        },
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
export function Header({
  title,
  right,
  top,
  account,
  sub,
}: {
  title: string;
  right?: ReactNode;
  top: number;
  /** il pallino del profilo, sempre all'estrema destra (come sul sito) */
  account?: { letter: string; label: string; onPress: () => void };
  /** la riga sotto il titolo (grigia, piccola) */
  sub?: string;
}) {
  const th = useTheme();
  return (
    <View
      style={{
        paddingTop: top + 10,
        paddingBottom: 10,
        paddingHorizontal: 16,
        backgroundColor: th.headerGlass,
        borderBottomWidth: 0.5,
        borderBottomColor: th.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <View style={{ flexShrink: 1, flex: 1 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{
            color: th.text,
            fontSize: th.display ? 28 : 21,
            fontWeight: th.display ? undefined : '800',
            fontFamily: th.display,
            letterSpacing: th.display ? -0.6 : -0.42,
          }}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{ color: th.text2, fontSize: 13, fontWeight: '500', marginTop: 2 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
      {account ? (
        <Avatar letter={account.letter} label={account.label} onPress={account.onPress} />
      ) : null}
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

/** Un numero grande (media, serie, punteggio): in Calm paper è in serif sottile, in Glass in grassetto. */
export function bigNumber(th: Pick<Theme, 'display'>, size: number): TextStyle {
  return th.display
    ? { fontSize: size, fontFamily: th.display, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }
    : { fontSize: size, fontWeight: '800', fontVariant: ['tabular-nums'] };
}

/** Il testo di un titolo (di pagina, di scheda): serif sottile in Calm paper, grassetto in Glass. */
export function titleStyle(
  th: Pick<Theme, 'display'>,
  size: number,
  weight: TextStyle['fontWeight'] = '800',
): TextStyle {
  return th.display
    ? { fontSize: Math.round(size * 1.3), fontFamily: th.display, letterSpacing: -0.5 }
    : { fontSize: size, fontWeight: weight, letterSpacing: -size * 0.02 };
}
