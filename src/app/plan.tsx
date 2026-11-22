import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DockHost } from '@/features/plan/dockHost';
import { PlanPanel, isPlanTab } from '@/features/plan/PlanPanel';
import { Header } from '@/ui/kit';

/**
 * La pagina «Piano» da sola (raggiunta dai collegamenti): Oggi, Calendario, Linea del tempo e Panoramica. Con `project`
 * si vede solo il calendario di quel progetto e dei suoi figli. Il contenuto vive in `PlanPanel`, lo stesso che sta
 * dentro la pagina Progetti.
 */
export default function PlanScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services } = useApp();
  const params = useLocalSearchParams<{ tab?: string; project?: string; sel?: string }>();
  const scoped = typeof params.project === 'string' ? params.project : null;
  const [showTime, setShowTime] = useState(false);
  if (!services?.plan) return null;

  const name = scoped ? services.projects.all().find((p) => p.uuid === scoped)?.name : '';
  const title = scoped ? name || t('progetti.piano_titolo') : t('progetti.piano_titolo');

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={title}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="plan-time"
              accessibilityRole="button"
              accessibilityLabel={t('piano.il_tuo_tempo')}
              onPress={() => setShowTime(true)}
            >
              <Text style={{ color: th.brand, fontSize: 18 }}>⏱</Text>
            </Pressable>
            <Pressable
              testID="plan-close"
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              onPress={() => router.back()}
            >
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        keyboardShouldPersistTaps="handled"
      >
        <PlanPanel
          scope={scoped}
          initialTab={isPlanTab(params.tab) ? params.tab : undefined}
          initialSel={typeof params.sel === 'string' ? params.sel : undefined}
          timeOpen={showTime}
          onTimeOpen={() => setShowTime(true)}
          onTimeClose={() => setShowTime(false)}
        />
      </ScrollView>
      <DockHost bottom={insets.bottom + 12} />
    </View>
  );
}
