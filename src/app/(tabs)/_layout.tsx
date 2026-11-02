import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

/** Icone provvisorie disegnate con forme semplici; le definitive arrivano con la rifinitura (fase 4). */
function Icon({ kind, color }: { kind: 'todo' | 'habits' | 'buy' | 'settings'; color: string }) {
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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: th.brand,
        tabBarInactiveTintColor: th.text2,
        tabBarStyle: { backgroundColor: th.headerGlass, borderTopColor: th.hairline },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
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
          title: t('planner.to_buy'),
          tabBarIcon: ({ color }) => <Icon kind="buy" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('comune.impostazioni'),
          tabBarIcon: ({ color }) => <Icon kind="settings" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
