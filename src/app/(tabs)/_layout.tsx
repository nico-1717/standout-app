import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PomodoroBar } from '@/features/pomodoro/PomodoroBar';
import { AppTabBar } from '@/ui/AppTabBar';
import { BAR_ITEMS } from '@/ui/barItems';
import { BAR_IDS } from '@/core/settings/bar';
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
  // NON usare `href: null` (= `hidden`): in questa versione di Expo Router chi ci naviga viene rimandato alla Home.
  // Le schede non hanno un bottone proprio: la barra è la nostra (AppTabBar), con tutte le pagine.
  return (
    <Tabs
      tabBar={(props) => (
        <View style={{ backgroundColor: th.floatingBar ? th.bg : undefined }}>
          {props.state.routes[props.state.index]?.name === 'pomodoro' ? null : <PomodoroBar />}
          <AppTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: th.brand,
        tabBarInactiveTintColor: th.text2,
      }}
    >
      {BAR_IDS.map((id) => (
        <Tabs.Screen
          key={id}
          name={BAR_ITEMS[id].route}
          options={tabLook(BAR_ITEMS[id].kind, t(BAR_ITEMS[id].label), th.brand)}
        />
      ))}
    </Tabs>
  );
}
