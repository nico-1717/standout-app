import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { useMemo } from 'react';

import { Glyph } from './deckUi';

export type MenuOption = { value: string; label: string; dot?: string; testID: string };

/**
 * Il menu a tendina del sito (`<select class="tb-select">`) come un foglio dal basso: l'elenco delle scelte, con il pallino
 * del colore (i livelli) e la spunta su quella di adesso. Si chiude da solo appena si sceglie.
 */
export function OptionMenu({
  title,
  options,
  value,
  onPick,
  onClose,
  testID,
}: {
  title: string;
  options: MenuOption[];
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
  testID: string;
}) {
  const th = useTheme();
  const ht = useMemo(() => habitsTheme(th.scheme, undefined, th.style), [th.scheme, th.style]);
  return (
    <Sheet visible title={title} th={ht} onClose={onClose} testID={testID}>
      <View style={{ paddingHorizontal: 14, paddingBottom: 20, gap: 4 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value || 'all'}
              testID={o.testID}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                onPick(o.value);
                onClose();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: on ? th.brandSoft : 'transparent',
              }}
            >
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: o.dot ?? 'transparent',
                }}
              />
              <Text
                style={{ flex: 1, color: th.text, fontSize: 16, fontWeight: on ? '800' : '600' }}
              >
                {o.label}
              </Text>
              {on ? <Glyph name="check" size={18} color={th.brand} stroke={2.8} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
