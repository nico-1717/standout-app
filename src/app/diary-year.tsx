import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { diaryTheme } from '@/features/diary/diaryTheme';
import type { AiList as AiListData } from '@/features/diary/aiReading';
import { AiList } from '@/features/diary/AiList';
import type { Insights } from '@/features/diary/insights';
import { YearPage } from '@/features/diary/YearPage';
import { localToday } from '@/features/tasks/groups';

/** «Il diario in numeri»: l'anno a colpo d'occhio. I numeri li calcola il server, quindi serve la rete. */
export default function DiaryYearScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, uiStyle, diarySettings } = useApp();
  const d = diaryTheme(uiStyle, th, diarySettings);
  const thisYear = Number(localToday().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [load, setLoad] = useState<{ year: number; data: Insights | null; failed: boolean } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  const [ai, setAi] = useState<AiListData | null>(null);

  // i resoconti e i libri dell'IA: se non si riesce a leggerli, la lista semplicemente non c'è
  useEffect(() => {
    let alive = true;
    account
      .diaryAi()
      .then((list) => alive && setAi(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [account]);

  useEffect(() => {
    let alive = true;
    account
      .diaryInsights(year)
      .then((data) => alive && setLoad({ year, data, failed: false }))
      .catch(() => alive && setLoad({ year, data: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [account, year, retry]);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => t(`diario.mese_${i + 1}`)),
    [t],
  );
  const loading = load === null || load.year !== year;

  return (
    <View style={{ flex: 1, backgroundColor: d.page }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Pressable
          testID="year-back"
          accessibilityRole="button"
          accessibilityLabel={t('diario.torna_al_diario')}
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: d.pencil, fontSize: 28 }}>‹</Text>
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: d.ink,
            fontFamily: d.serif,
            fontSize: 24,
            fontWeight: d.style === 'standard' ? '700' : '400',
          }}
        >
          {t('diario.dn_titolo')}
        </Text>
        <Pressable
          accessibilityRole="button"
          testID="year-prev"
          accessibilityLabel={t('diario.dn_anno_prima')}
          onPress={() => setYear(year - 1)}
          style={{ padding: 10 }}
        >
          <Text style={{ color: d.ink2, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text
          testID="year-label"
          style={{
            color: d.ink,
            fontFamily: d.sans,
            fontSize: 15,
            minWidth: 42,
            textAlign: 'center',
          }}
        >
          {year}
        </Text>
        <Pressable
          accessibilityRole="button"
          testID="year-next"
          accessibilityLabel={t('diario.dn_anno_dopo')}
          disabled={year >= thisYear}
          onPress={() => setYear(year + 1)}
          style={{ padding: 10, opacity: year >= thisYear ? 0.3 : 1 }}
        >
          <Text style={{ color: d.ink2, fontSize: 22 }}>›</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 + insets.bottom }}>
        {loading ? (
          <ActivityIndicator testID="year-loading" color={d.accent} style={{ marginTop: 60 }} />
        ) : load.failed || !load.data ? (
          <View testID="year-failed" style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
            <Text style={{ color: d.ink2, fontFamily: d.sans, textAlign: 'center' }}>
              {t('comune.errore_rete')}
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="year-retry"
              onPress={() => {
                setLoad(null);
                setRetry(retry + 1);
              }}
              style={{
                backgroundColor: d.accent,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: d.onAccent }}>{t('diario.dn_riprova')}</Text>
            </Pressable>
          </View>
        ) : (
          <YearPage
            d={d}
            data={load.data}
            months={months}
            onYear={setYear}
            onOpenDay={(date) => router.push({ pathname: '/diary', params: { data: date } })}
          />
        )}
        {ai ? (
          <AiList
            d={d}
            list={ai}
            onOpen={(kind, id) =>
              router.push({ pathname: '/diary-read', params: { [kind]: String(id) } })
            }
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
