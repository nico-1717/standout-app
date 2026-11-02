import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReorderList } from '@/ui/ReorderList';
import { cardShadow } from '@/ui/kit';

import type { HabitsTheme } from './habitsTheme';
import type { Habit } from './logic';
import { Sheet } from './Sheet';

/** «Riordina» (#hbSheetReorder del sito): l'ordine dell'elenco si decide trascinando le abitudini. */
export function ReorderSheet(p: {
  visible: boolean;
  habits: Habit[];
  th: HabitsTheme;
  onMove: (h: Habit, from: number, to: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { th } = p;
  return (
    <Sheet
      visible={p.visible}
      title={t('abitudini.riordina')}
      th={th}
      onClose={p.onClose}
      testID="reorder-sheet"
    >
      {p.visible && (
        <ScrollView contentContainerStyle={styles.body} scrollEnabled>
          {p.habits.length === 0 ? (
            <Text style={{ color: th.text2, textAlign: 'center', padding: 24 }}>
              {t('abitudini.non_hai_ancora_abitudini_da')}
            </Text>
          ) : (
            <>
              <Text style={{ color: th.text2, fontSize: 14, marginBottom: 14 }}>
                {t('abitudini.trascina_dalla_maniglia_per_cambiare')}
              </Text>
              <ReorderList
                items={p.habits.map((h) => ({ key: h.uuid, h }))}
                rowHeight={60}
                gripColor={th.text2}
                onReorder={(from, to) => p.onMove(p.habits[from]!, from, to)}
                renderRow={({ h }, grip, dragging) => (
                  <View
                    style={[
                      styles.row,
                      { backgroundColor: th.surface },
                      cardShadow(th.scheme === 'dark'),
                      dragging && { borderColor: th.accent, borderWidth: 1.5 },
                    ]}
                  >
                    <View style={[styles.icon, { backgroundColor: h.color + '33' }]}>
                      <Text style={{ fontSize: 20 }}>{h.icon}</Text>
                    </View>
                    <Text
                      style={{ color: th.text, fontWeight: '700', fontSize: 16, flex: 1 }}
                      numberOfLines={1}
                    >
                      {h.name}
                    </Text>
                    {grip}
                  </View>
                )}
              />
            </>
          )}
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 30 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingLeft: 12,
    paddingRight: 6,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
