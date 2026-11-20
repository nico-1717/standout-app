import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BuyTheme } from '@/features/buy/buyTheme';
import { haptic } from '@/ui/motion';

import { focusParams } from './todoScroll';

export type TodoTab = 'todo' | 'buy' | 'pills';

const TABS: { id: TodoTab; label: string; href: '/todo' | '/buy' | '/pills' }[] = [
  { id: 'todo', label: 'planner.to_do', href: '/todo' },
  { id: 'buy', label: 'planner.to_buy', href: '/buy' },
  { id: 'pills', label: 'todo.tipo_pills', href: '/pills' },
];

/**
 * Le tre liste che sul sito stanno nello stesso riquadro (todo_widget: «to do · to buy · pills»). Nell'app le
 * schede Spesa e Pastiglie non hanno un posto nella barra in basso, quindi si passa da una all'altra da qui.
 */
export function TodoTabs({
  current,
  bt,
}: {
  current: TodoTab;
  bt: Pick<BuyTheme, 'panel' | 'card' | 'page' | 'ink' | 'ink2' | 'sans' | 'style'> & {
    dark?: boolean;
  };
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const paper = bt.style === 'paper';
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.row, { backgroundColor: bt.panel, borderRadius: 999 }]}
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
              haptic.tap();
              // anche sulla linguetta già aperta: si scende alla lista, lontano dalla nota
              router.navigate({ pathname: tab.href, params: focusParams() });
            }}
            style={[
              styles.tab,
              { borderRadius: 999 },
              on && {
                backgroundColor: bt.dark && !paper ? bt.page : bt.card,
                boxShadow: '0 1px 2px rgba(0,0,0,.08), 0 6px 14px -8px rgba(0,0,0,.28)',
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                {
                  color: on ? bt.ink : bt.ink2,
                  fontSize: 13,
                  fontWeight: '500',
                  letterSpacing: 0.26,
                },
                bt.sans ? { fontFamily: bt.sans } : null,
              ]}
            >
              {t(tab.label).toLowerCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, gap: 4, marginBottom: 14 },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
});
