import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';

export interface ErrorRow {
  key: string;
  position: number;
  label: string;
}

/** L'elenco delle carte sbagliate di un tratto del tracciato (si apre toccando un disco rosso). */
export function ErrorsSheet({
  visible,
  from,
  to,
  rows,
  onClose,
}: {
  visible: boolean;
  from: number;
  to: number;
  rows: readonly ErrorRow[];
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  return (
    <Sheet
      visible={visible}
      th={ht}
      testID="fcg-errors"
      title={t('fc.gm_f2_elenco_tratto', { a: from, b: to })}
      onClose={onClose}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
        {rows.map((r) => (
          <View
            key={r.key}
            testID="fcg-error-row"
            style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
          >
            <Text style={{ color: th.red, fontWeight: '800', width: 34 }}>{r.position}</Text>
            <Text style={{ color: ht.text, flex: 1 }} numberOfLines={2}>
              {r.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}
