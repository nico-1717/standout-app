import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { usePlanTheme } from '@/features/plan/ui';
import { haptic } from '@/ui/motion';

/** Un tasto del Tracker: pieno (azione principale), con bordo (secondaria) o solo testo. */
export function Btn(p: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'plain' | 'danger';
  disabled?: boolean;
  small?: boolean;
  testID?: string;
  full?: boolean;
}) {
  const ht = usePlanTheme();
  const primary = p.tone === 'primary';
  const color = p.tone === 'danger' ? ht.red : primary ? ht.inkText : ht.text;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      disabled={p.disabled}
      onPress={() => {
        haptic.tap();
        p.onPress();
      }}
      style={({ pressed }) => ({
        minHeight: p.small ? 40 : 46,
        paddingHorizontal: p.small ? 12 : 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: p.full ? 'stretch' : 'flex-start',
        backgroundColor: primary ? ht.accent : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: p.tone === 'danger' ? ht.red : ht.hairline2,
        opacity: p.disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color, fontWeight: '600', fontSize: p.small ? 14 : 15 }}>{p.label}</Text>
    </Pressable>
  );
}

/** Una pastiglia colorata (difficoltà, voto). */
export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 2,
        backgroundColor: `${color}26`,
      }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** Una scelta fra poche (Facile | Medio | Difficile). */
export function Segment<T extends string>(p: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID: string;
}) {
  const ht = usePlanTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: ht.hairline2,
        overflow: 'hidden',
        alignSelf: 'flex-start',
      }}
    >
      {p.items.map((it) => {
        const on = it.id === p.value;
        return (
          <Pressable
            key={it.id}
            testID={`${p.testID}-${it.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              p.onChange(it.id);
            }}
            style={{
              minHeight: 42,
              paddingHorizontal: 14,
              justifyContent: 'center',
              backgroundColor: on ? ht.accent : 'transparent',
            }}
          >
            <Text
              style={{
                color: on ? ht.inkText : ht.text,
                fontWeight: on ? '700' : '500',
                fontSize: 14,
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  const ht = usePlanTheme();
  return <Text style={{ color: ht.text2, fontSize: 13, lineHeight: 19 }}>{children}</Text>;
}

/** Una casella con la spunta, grande quanto basta per il dito (44). */
export function Check(p: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  testID?: string;
}) {
  const ht = usePlanTheme();
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: p.on }}
      onPress={() => {
        haptic.tap();
        p.onChange(!p.on);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: p.on ? ht.accent : ht.hairline2,
          backgroundColor: p.on ? ht.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {p.on ? (
          <Text style={{ color: ht.inkText, fontSize: 14, fontWeight: '800' }}>✓</Text>
        ) : null}
      </View>
      {p.label ? <Text style={{ color: ht.text, fontSize: 15, flex: 1 }}>{p.label}</Text> : null}
    </Pressable>
  );
}
