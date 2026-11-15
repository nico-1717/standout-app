import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PomodoroBar } from '@/features/pomodoro/PomodoroBar';
import { TAB_COLOR, TabIcon, type TabIconKind } from '@/ui/TabIcon';

/** Le opzioni di una scheda: titolo, icona a linea come sul sito e il colore della sezione quando è aperta. */
function tabLook(kind: TabIconKind, title: string, fallback: string) {
  return {
    title,
    tabBarActiveTintColor: TAB_COLOR[kind] ?? fallback,
    tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <TabIcon kind={kind} color={String(color)} active={focused} />
    ),
  };
}

export default function TabsLayout() {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <Tabs
      tabBar={(props) =>
        th.floatingBar ? (
          // Glass: la barra è una pillola sospesa sopra il bordo basso (lo spazio sicuro sta fuori dalla pillola)
          <View style={{ backgroundColor: th.bg }}>
            <PomodoroBar />
            <View style={{ paddingHorizontal: 14, paddingBottom: props.insets.bottom + 6 }}>
              <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
            </View>
          </View>
        ) : (
          <View>
            <PomodoroBar />
            <BottomTabBar {...props} />
          </View>
        )
      }
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: th.brand,
        tabBarInactiveTintColor: th.text2,
        tabBarStyle: th.floatingBar
          ? {
              backgroundColor: th.barBg,
              borderRadius: 33,
              borderTopWidth: 0,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: th.cardEdge,
              boxShadow: th.cardShadow,
              height: 66,
            }
          : {
              backgroundColor: th.barBg,
              borderTopColor: th.hairline,
              borderTopWidth: StyleSheet.hairlineWidth,
            },
        tabBarItemStyle: th.floatingBar ? { borderRadius: 24, marginVertical: 5 } : undefined,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: th.floatingBar ? '700' : '500' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          ...tabLook('home', t('sidebar.home'), th.brand),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          ...tabLook('planner', t('sidebar.planner'), th.brand),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          ...tabLook('todo', t('planner.to_do'), th.brand),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          ...tabLook('habits', t('abitudini.titolo'), th.brand),
        }}
      />
      <Tabs.Screen
        name="buy"
        options={{
          // la lista della spesa si apre da «Altro» e dalla Home: la barra resta a cinque
          href: null,
          ...tabLook('buy', t('planner.to_buy'), th.brand),
        }}
      />
      <Tabs.Screen
        name="pills"
        options={{
          // la scheda si apre da «Altro» (impostazioni) e dalla Home: la barra resta a cinque
          href: null,
          ...tabLook('pills', t('todo.tipo_pills'), th.brand),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          ...tabLook('more', t('progetti.altro'), th.brand),
        }}
      />
    </Tabs>
  );
}
