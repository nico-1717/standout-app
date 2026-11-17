import { useRouter, type Href } from 'expo-router';
import type { BottomTabBar } from 'expo-router/js-tabs';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { barLayout, type BarId } from '@/core/settings/bar';
import { useTheme } from '@/core/theme/ThemeProvider';
import { focusParams } from '@/features/tasks/todoScroll';
import { Text } from '@/ui/CappedText';

import { BAR_ITEMS, SCROLL_TO_TABS } from './barItems';
import { TAB_COLOR, TabIcon } from './TabIcon';

type BarProps = Pick<ComponentProps<typeof BottomTabBar>, 'state' | 'insets'>;

const ITEM_W = 68;

/**
 * La barra in basso con TUTTE le pagine: quelle fissate stanno a sinistra, ferme, divise da una linea; le altre
 * scorrono di lato. Cosa mostrare, in che ordine e cosa fissare si sceglie in Altro › Barra in basso.
 */
export function AppTabBar({ state, insets }: BarProps) {
  const router = useRouter();
  const th = useTheme();
  const { t } = useTranslation();
  const { localPrefs } = useApp();
  const current = state.routes[state.index]?.name;
  const { pinned, scroll } = barLayout(localPrefs.bar);
  const scroller = useRef<ScrollViewInstance>(null);
  const xs = useRef(new Map<BarId, number>());

  // la scheda aperta resta in vista anche se sta fra quelle scorrevoli
  useEffect(() => {
    const id = scroll.find((x) => BAR_ITEMS[x].route === current);
    const x = id ? xs.current.get(id) : undefined;
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - ITEM_W), animated: true });
  }, [current, scroll]);

  const open = (id: BarId) => {
    const route = BAR_ITEMS[id].route;
    const pathname = route === 'index' ? '/' : `/${route}`;
    router.navigate({
      pathname,
      params: SCROLL_TO_TABS.includes(id) ? focusParams() : undefined,
    } as Href);
  };

  const button = (id: BarId) => {
    const it = BAR_ITEMS[id];
    const on = current === it.route;
    const color = on ? (TAB_COLOR[it.kind] ?? th.brand) : th.text2;
    return (
      <Pressable
        key={id}
        testID={`bar-${id}`}
        accessibilityRole="button"
        accessibilityLabel={t(it.label)}
        accessibilityState={{ selected: on }}
        onLayout={(e) => xs.current.set(id, e.nativeEvent.layout.x)}
        onPress={() => open(id)}
        style={({ pressed }) => [
          styles.item,
          th.floatingBar ? { borderRadius: 24 } : null,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <TabIcon kind={it.kind} color={color} active={on} />
        <Text
          numberOfLines={1}
          style={{ color, fontSize: 10.5, fontWeight: th.floatingBar || on ? '700' : '500' }}
        >
          {t(it.label)}
        </Text>
      </Pressable>
    );
  };

  const bar = (
    <View
      testID="app-tab-bar"
      style={
        th.floatingBar
          ? [
              styles.row,
              {
                height: 66,
                backgroundColor: th.barBg,
                borderRadius: 33,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: th.cardEdge,
                boxShadow: th.cardShadow,
              },
            ]
          : [
              styles.row,
              {
                paddingBottom: insets.bottom,
                backgroundColor: th.barBg,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: th.hairline,
              },
            ]
      }
    >
      {pinned.length ? <View style={styles.pinned}>{pinned.map(button)}</View> : null}
      {pinned.length && scroll.length ? (
        <View
          testID="bar-divider"
          style={{ width: StyleSheet.hairlineWidth * 2, height: 34, backgroundColor: th.hairline2 }}
        />
      ) : null}
      <ScrollView
        ref={scroller}
        testID="bar-scroll"
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {scroll.map(button)}
      </ScrollView>
    </View>
  );
  return th.floatingBar ? (
    <View style={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 6 }}>{bar}</View>
  ) : (
    bar
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  pinned: { flexDirection: 'row', alignItems: 'center' },
  item: { width: ITEM_W, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
});
