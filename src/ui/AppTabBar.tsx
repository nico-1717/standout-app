import { useRouter, type Href } from 'expo-router';
import type { BottomTabBar } from 'expo-router/js-tabs';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useApp } from '@/core/app/AppProvider';
import { barLayout, litBarId, type BarId } from '@/core/settings/bar';
import { useTheme } from '@/core/theme/ThemeProvider';
import { focusParams } from '@/features/tasks/todoScroll';
import { Text } from '@/ui/CappedText';

import { BAR_ITEMS, SCROLL_TO_TABS } from './barItems';
import { TAB_COLOR, TabIcon } from './TabIcon';

type BarProps = Pick<ComponentProps<typeof BottomTabBar>, 'state' | 'insets'>;

const ITEM_W = 68;
/** La barra fluttuante è piccola e leggera a riposo; mentre la si usa (tocco, scorrimento) si ingrandisce, poi torna piccola. */
const COMPACT_H = 50;
const FULL_H = 66;
const ITEM_COMPACT_H = 44;
const ITEM_FULL_H = 56;
const LABEL_H = 13;
const GROW_MS = 220;
const SHRINK_AFTER_MS = 3500;

/**
 * 0 = piccola, 1 = grande. `wake()` la ingrandisce subito e ferma il conto alla rovescia; `rest()` la fa tornare
 * piccola dopo qualche secondo. All'avvio parte grande (si leggono i nomi) e si rimpicciolisce da sola.
 */
function useBarGrow() {
  const grow = useSharedValue(1);
  const reduce = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const to = (v: number) => {
    grow.set(reduce ? v : withTiming(v, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }));
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const wake = () => {
    clear();
    to(1);
  };
  const rest = () => {
    clear();
    timer.current = setTimeout(() => to(0), SHRINK_AFTER_MS);
  };
  useEffect(() => {
    rest();
    return clear;
    // solo all'avvio: la funzione `rest` cambia a ogni render ma fa sempre la stessa cosa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { grow, wake, rest };
}

/** Un bottone della barra fluttuante: l'icona sempre, il nome solo quando la barra è grande. */
function FloatingItem(p: {
  grow: SharedValue<number>;
  testID: string;
  label: string;
  selected: boolean;
  color: string;
  name: string;
  icon: ReactNode;
  onLayoutX: (x: number) => void;
  onPress: () => void;
}) {
  const box = useAnimatedStyle(() => ({
    height: interpolate(p.grow.get(), [0, 1], [ITEM_COMPACT_H, ITEM_FULL_H]),
  }));
  const label = useAnimatedStyle(() => ({
    height: interpolate(p.grow.get(), [0, 1], [0, LABEL_H]),
    marginTop: interpolate(p.grow.get(), [0, 1], [0, 3]),
    opacity: p.grow.get(),
  }));
  const icon = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.grow.get(), [0, 1], [0.9, 1]) }],
  }));
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ selected: p.selected }}
      onLayout={(e) => p.onLayoutX(e.nativeEvent.layout.x)}
      onPress={p.onPress}
      style={({ pressed }) => [{ width: ITEM_W, borderRadius: 24, opacity: pressed ? 0.6 : 1 }]}
    >
      <Animated.View style={[styles.itemBox, box]}>
        <Animated.View style={icon}>{p.icon}</Animated.View>
        <Animated.View style={[{ overflow: 'hidden' }, label]}>
          <Text
            numberOfLines={1}
            style={{ color: p.color, fontSize: 10.5, fontWeight: '700' }}
            accessibilityElementsHidden
          >
            {p.name}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * La barra in basso con TUTTE le pagine: quelle fissate stanno a sinistra, ferme, divise da una linea; le altre
 * scorrono di lato. Cosa mostrare, in che ordine e cosa fissare si sceglie in Altro › Barra in basso.
 * Nella versione fluttuante sta più in basso, è piccola e leggera, e si ingrandisce mentre la si tocca o la si scorre.
 */
export function AppTabBar({ state, insets }: BarProps) {
  const router = useRouter();
  const th = useTheme();
  const { t } = useTranslation();
  const { localPrefs } = useApp();
  const { grow, wake, rest } = useBarGrow();
  const current = state.routes[state.index]?.name;
  const currentId = (Object.keys(BAR_ITEMS) as BarId[]).find((x) => BAR_ITEMS[x].route === current);
  // su una pagina nascosta (Pillole, Da comprare, Lingue) si accende l'icona della pagina che la contiene
  const lit = currentId ? litBarId(localPrefs.bar, currentId) : null;
  const { pinned, scroll } = barLayout(localPrefs.bar);
  const scroller = useRef<ScrollViewInstance>(null);
  const xs = useRef(new Map<BarId, number>());

  // la scheda aperta resta in vista anche se sta fra quelle scorrevoli
  useEffect(() => {
    const id = scroll.find((x) => x === lit);
    const x = id ? xs.current.get(id) : undefined;
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - ITEM_W), animated: true });
  }, [lit, scroll]);

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
    const on = lit === id;
    const color = on ? (TAB_COLOR[it.kind] ?? th.brand) : th.text2;
    if (th.floatingBar)
      return (
        <FloatingItem
          key={id}
          grow={grow}
          testID={`bar-${id}`}
          label={t(it.label)}
          name={t(it.label)}
          selected={on}
          color={color}
          icon={<TabIcon kind={it.kind} color={color} active={on} />}
          onLayoutX={(x) => xs.current.set(id, x)}
          onPress={() => open(id)}
        />
      );
    return (
      <Pressable
        key={id}
        testID={`bar-${id}`}
        accessibilityRole="button"
        accessibilityLabel={t(it.label)}
        accessibilityState={{ selected: on }}
        onLayout={(e) => xs.current.set(id, e.nativeEvent.layout.x)}
        onPress={() => open(id)}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
      >
        <TabIcon kind={it.kind} color={color} active={on} />
        <Text numberOfLines={1} style={{ color, fontSize: 10.5, fontWeight: on ? '700' : '500' }}>
          {t(it.label)}
        </Text>
      </Pressable>
    );
  };

  const content = (
    <>
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
        onScrollBeginDrag={th.floatingBar ? wake : undefined}
        onScrollEndDrag={th.floatingBar ? rest : undefined}
        onMomentumScrollEnd={th.floatingBar ? rest : undefined}
      >
        {scroll.map(button)}
      </ScrollView>
    </>
  );

  if (!th.floatingBar)
    return (
      <View
        testID="app-tab-bar"
        style={[
          styles.row,
          {
            paddingBottom: insets.bottom,
            backgroundColor: th.barBg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: th.hairline,
          },
        ]}
      >
        {content}
      </View>
    );
  return (
    <FloatingBar grow={grow} wake={wake} rest={rest} bottom={Math.max(insets.bottom - 16, 8)}>
      {content}
    </FloatingBar>
  );
}

/** La pillola: lo sfondo si fa più chiaro e la barra più bassa a riposo; il tocco la sveglia, il rilascio avvia il conto alla rovescia. */
function FloatingBar(p: {
  grow: SharedValue<number>;
  wake: () => void;
  rest: () => void;
  bottom: number;
  children: ReactNode;
}) {
  const th = useTheme();
  const size = useAnimatedStyle(() => ({
    height: interpolate(p.grow.get(), [0, 1], [COMPACT_H, FULL_H]),
  }));
  const skin = useAnimatedStyle(() => ({ opacity: interpolate(p.grow.get(), [0, 1], [0.7, 1]) }));
  return (
    <View
      style={{ paddingHorizontal: 14, paddingBottom: p.bottom }}
      onTouchStart={p.wake}
      onTouchEnd={p.rest}
      onTouchCancel={p.rest}
    >
      <Animated.View testID="app-tab-bar" style={[styles.row, { minHeight: 0 }, size]}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: th.barBg,
              borderRadius: FULL_H / 2,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: th.cardEdge,
              boxShadow: th.cardShadow,
            },
            skin,
          ]}
        />
        {p.children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  pinned: { flexDirection: 'row', alignItems: 'center' },
  item: { width: ITEM_W, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
  itemBox: { alignItems: 'center', justifyContent: 'center' },
});
