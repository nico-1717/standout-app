import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AiList as AiListData } from './aiReading';
import type { DiaryTheme } from './diaryTheme';

/**
 * «Resoconti e libri»: i testi che l'IA ha scritto dal diario, da leggere (si creano dal sito, con i crediti).
 * Se non ce ne sono, non compare.
 */
export function AiList({
  d,
  list,
  onOpen,
  bare = false,
}: {
  d: DiaryTheme;
  list: AiListData;
  onOpen: (kind: 'report' | 'book', id: number) => void;
  /** il titolo «Resoconti e libro» lo scrive già chi sta sopra */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  if (!list.reports.length && !list.books.length) return null;
  const row = (testID: string, title: string, sub: string, onPress: () => void) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: d.card,
        borderColor: d.hair,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 2,
      }}
    >
      <Text style={{ color: d.ink, fontFamily: d.serif, fontSize: 17, fontWeight: '700' }}>
        {title}
      </Text>
      <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 13 }}>{sub}</Text>
    </Pressable>
  );
  return (
    <View testID="ai-list" style={{ gap: 8, marginTop: 20 }}>
      {bare ? null : (
        <Text
          accessibilityRole="header"
          style={{ color: d.ink, fontFamily: d.serif, fontSize: 20, fontWeight: '700' }}
        >
          {t('diario.dn_ai_titolo')}
        </Text>
      )}
      {list.reports.map((r) =>
        row(
          `ai-report-${r.id}`,
          r.title || t('diario.dn_resoconto_di', { q: r.quarter, anno: r.year }),
          t('diario.dn_resoconto_di', { q: r.quarter, anno: r.year }),
          () => onOpen('report', r.id),
        ),
      )}
      {list.books.length ? (
        <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 13, marginTop: 6 }}>
          {t('diario.dn_i_tuoi_libri')}
        </Text>
      ) : null}
      {list.books.map((b) =>
        row(
          `ai-book-${b.id}`,
          b.title || t('diario.dn_libro_senza_titolo'),
          `${b.from.slice(0, 7)} – ${b.to.slice(0, 7)}${b.done ? '' : ' · ' + t('diario.dn_in_corso')}`,
          () => onOpen('book', b.id),
        ),
      )}
    </View>
  );
}
