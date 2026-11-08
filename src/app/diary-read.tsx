import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import type { AiBook, AiReport } from '@/features/diary/aiReading';
import { BookReader, ReportReader } from '@/features/diary/AiReader';
import { diaryTheme } from '@/features/diary/diaryTheme';

type Loaded =
  | { key: string; kind: 'report'; report: AiReport }
  | { key: string; kind: 'book'; book: AiBook }
  | { key: string; kind: 'failed' };

/**
 * Leggere un resoconto trimestrale o un libro che l'IA ha scritto dal diario (`diario_lettura.php`). Parametri:
 * `report` o `book` (l'id). Si scarica dal sito quando si apre, quindi serve la rete.
 */
export default function DiaryReadScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, uiStyle, diarySettings } = useApp();
  const params = useLocalSearchParams<{ report?: string; book?: string }>();
  const d = diaryTheme(uiStyle, th, diarySettings);
  const kind = params.book ? 'book' : 'report';
  const id = Number(params.book ?? params.report);
  const key = `${kind}:${id}`;
  const badId = !Number.isInteger(id) || id <= 0;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [retry, setRetry] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const chapterY = useRef<Record<number, number>>({});
  const bookTop = useRef(0);

  useEffect(() => {
    let alive = true;
    if (badId) return;
    const done = (v: Loaded) => alive && setLoaded(v);
    if (kind === 'book') {
      account
        .diaryBook(id)
        .then((book) => done({ key, kind: 'book', book }))
        .catch(() => done({ key, kind: 'failed' }));
    } else {
      account
        .diaryReport(id)
        .then((report) => done({ key, kind: 'report', report }))
        .catch(() => done({ key, kind: 'failed' }));
    }
    return () => {
      alive = false;
    };
  }, [account, kind, id, key, badId, retry]);

  const ready: Loaded | null = badId
    ? { key, kind: 'failed' }
    : loaded && loaded.key === key
      ? loaded
      : null;
  return (
    <View style={{ flex: 1, backgroundColor: d.page }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          testID="read-back"
          accessibilityRole="button"
          accessibilityLabel={t('comune.indietro')}
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: d.pencil, fontSize: 28 }}>‹</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 60 + insets.bottom,
          maxWidth: 680,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {!ready ? (
          <ActivityIndicator testID="read-loading" color={d.accent} style={{ marginTop: 60 }} />
        ) : ready.kind === 'failed' ? (
          <View testID="read-failed" style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
            <Text style={{ color: d.ink2, fontFamily: d.sans, textAlign: 'center' }}>
              {t('comune.errore_rete')}
            </Text>
            <Pressable
              testID="read-retry"
              accessibilityRole="button"
              onPress={() => {
                setLoaded(null);
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
        ) : ready.kind === 'report' ? (
          <ReportReader d={d} report={ready.report} />
        ) : (
          <View onLayout={(e) => (bookTop.current = e.nativeEvent.layout.y)}>
            <BookReader
              d={d}
              book={ready.book}
              onChapterLayout={(i, y) => (chapterY.current[i] = y)}
              onJump={(i) =>
                scroll.current?.scrollTo({
                  y: (chapterY.current[i] ?? 0) + bookTop.current + 20,
                  animated: true,
                })
              }
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
