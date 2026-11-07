import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PomodoroBar } from '@/features/pomodoro/PomodoroBar';

/** Icone provvisorie disegnate con forme semplici; le definitive arrivano con la rifinitura (fase 4). */
function Icon({
  kind,
  color,
}: {
  kind: 'home' | 'planner' | 'todo' | 'habits' | 'buy' | 'pills' | 'settings';
  color: string;
}) {
  if (kind === 'home') {
    // una casetta: tetto e porta
    return (
      <View style={{ width: 24, height: 24, justifyContent: 'flex-end' }}>
        <View style={{ height: 14, borderRadius: 4, borderWidth: 2, borderColor: color }} />
        <View
          style={{
            position: 'absolute',
            top: 1,
            left: 5,
            width: 14,
            height: 14,
            borderTopWidth: 2,
            borderLeftWidth: 2,
            borderColor: color,
            transform: [{ rotate: '45deg' }],
          }}
        />
      </View>
    );
  }
  if (kind === 'planner') {
    // un foglio d'agenda: cornice con la riga in alto
    return (
      <View style={{ width: 24, height: 24, justifyContent: 'flex-end' }}>
        <View style={{ height: 20, borderRadius: 5, borderWidth: 2, borderColor: color }}>
          <View style={{ height: 2.5, marginTop: 4, backgroundColor: color }} />
        </View>
      </View>
    );
  }
  if (kind === 'todo') {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      </View>
    );
  }
  if (kind === 'habits') {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 3,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{ rotate: '-35deg' }],
        }}
      />
    );
  }
  if (kind === 'buy') {
    return (
      <View style={{ width: 24, height: 24, justifyContent: 'flex-end' }}>
        <View style={{ height: 17, borderRadius: 5, borderWidth: 2, borderColor: color }} />
        <View
          style={{
            position: 'absolute',
            top: 1,
            left: 7,
            width: 10,
            height: 9,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: color,
          }}
        />
      </View>
    );
  }
  if (kind === 'pills') {
    // una capsula inclinata
    return (
      <View
        style={{
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-45deg' }],
        }}
      >
        <View
          style={{
            width: 11,
            height: 22,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: color,
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, backgroundColor: color, opacity: 0.45 }} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{ height: 2.5, borderRadius: 2, backgroundColor: color, width: i === 1 ? 16 : 24 }}
        />
      ))}
    </View>
  );
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
          title: t('sidebar.home'),
          tabBarIcon: ({ color }) => <Icon kind="home" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: t('sidebar.planner'),
          tabBarIcon: ({ color }) => <Icon kind="planner" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('planner.to_do'),
          tabBarIcon: ({ color }) => <Icon kind="todo" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: t('abitudini.titolo'),
          tabBarIcon: ({ color }) => <Icon kind="habits" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="buy"
        options={{
          // la lista della spesa si apre da «Altro» e dalla Home: la barra resta a cinque
          href: null,
          title: t('planner.to_buy'),
          tabBarIcon: ({ color }) => <Icon kind="buy" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="pills"
        options={{
          // la scheda si apre da «Altro» (impostazioni) e dalla Home: la barra resta a cinque
          href: null,
          title: t('todo.tipo_pills'),
          tabBarIcon: ({ color }) => <Icon kind="pills" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('progetti.altro'),
          tabBarIcon: ({ color }) => <Icon kind="settings" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
