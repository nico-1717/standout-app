import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BuyTheme } from '@/features/buy/buyTheme';
import { haptic } from '@/ui/motion';

export type TodoTab = 'todo' | 'buy' | 'pills';

const TABS: { id: TodoTab; label: string; href: '/' | '/buy' | '/pills' }[] = [
  { id: 'todo', label: 'planner.to_do', href: '/' },
  { id: 'buy', label: 'planner.to_buy', href: '/buy' },
  { id: 'pills', label: 'todo.tipo_pills', href: '/pills' },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Le tre liste che sul sito stanno nello stesso riquadro (todo_widget: «to do · to buy · pills»). Nell'app le
 * schede Spesa e Pastiglie non hanno un posto nella barra in basso, quindi si passa da una all'altra da qui.
 */
export function TodoTabs({
  current,
  bt,
}: {
  current: TodoTab;
  bt: Pick<BuyTheme, 'panel' | 'card' | 'ink2' | 'accent' | 'onAccent' | 'sans' | 'style'>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const paper = bt.style === 'paper';
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.row, { backgroundColor: bt.panel, borderRadius: paper ? 14 : 18 }]}
    >
      {TABS.map((tab) => {
        const on = tab.id === current;
        return (
          <Pressable
            key={tab.id}
            testID={`todo-tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              haptic.tap();
              router.navigate(tab.href);
            }}
            style={[
              styles.tab,
              { borderRadius: paper ? 11 : 15 },
              on && { backgroundColor: bt.accent },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                {
                  color: on ? bt.onAccent : bt.ink2,
                  fontSize: 14,
                  fontWeight: on ? '700' : '500',
                },
                bt.sans ? { fontFamily: bt.sans } : null,
              ]}
            >
              {cap(t(tab.label))}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, gap: 4, marginBottom: 12 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
});
