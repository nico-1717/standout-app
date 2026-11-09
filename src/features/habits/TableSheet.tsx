import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Bars, StatCard } from './charts';
import { allLogsOf, ctxFor, rangeRate, ranking, tableRow } from './globalStats';
import type { HabitsTheme } from './habitsTheme';
import { addDays, dayProgress, isoWeekday, type Habit, type HabitLog } from './logic';
import { HBars, stateColor } from './overview';
import { Sheet } from './Sheet';
import { barsLast } from './stats';
import { Text } from '@/ui/CappedText';

export interface TableSheetProps {
  visible: boolean;
  habits: Habit[];
  logs: HabitLog[];
  today: string;
  th: HabitsTheme;
  onClose: () => void;
  /** Spunta/toglie un giorno di un'abitudine (come «toggle» del sito). */
  onToggle: (h: Habit, day: string) => void;
}

const NAME_W = 124;
const CELL_W = 40;
const PCT_W = 50;

/** «Vista tabella» (#hbSheetTable del sito): spunta veloce, i grafici sotto si aggiornano insieme. */
export function TableSheet(p: TableSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={p.visible}
      title={t('abitudini.vista_tabella')}
      th={p.th}
      onClose={p.onClose}
      testID="table-sheet"
    >
      {p.visible && <Body {...p} />}
    </Sheet>
  );
}

function Body({ habits, logs, today, th, onToggle }: TableSheetProps) {
  const { t } = useTranslation();
  const [span, setSpan] = useState<7 | 14 | 30>(14);
  const all = useMemo(() => allLogsOf(logs), [logs]);
  const list = useMemo(() => habits.filter((h) => !h.is_archived), [habits]);
  const ctxOf = useMemo(() => ctxFor(all, today), [all, today]);
  const dates = useMemo(
    () => Array.from({ length: span }, (_, i) => addDays(today, -(span - 1 - i))),
    [span, today],
  );
  const rows = useMemo(
    () => list.map((h) => ({ h, ...tableRow(h, dates, ctxOf) })),
    [list, dates, ctxOf],
  );
  const foot = useMemo(
    () =>
      dates.map((d) => {
        const pr = dayProgress(list, d, all, today);
        return pr.total ? String(Math.round(pr.pct * 100)) : '–';
      }),
    [dates, list, all, today],
  );
  const rate = rangeRate(list, span, ctxOf, today);
  const rank = ranking(list, span, ctxOf, today);

  if (!list.length)
    return (
      <Text style={{ color: th.text2, textAlign: 'center', padding: 24 }}>
        {t('abitudini.nessuna_abitudine_attiva')}
      </Text>
    );

  return (
    <ScrollView contentContainerStyle={styles.body} testID="table-scroll">
      <View style={[styles.seg, { backgroundColor: th.surface2 }]}>
        {([7, 14, 30] as const).map((n) => (
          <Pressable
            key={n}
            testID={`table-span-${n}`}
            accessibilityRole="button"
            accessibilityState={{ selected: span === n }}
            onPress={() => setSpan(n)}
            style={[styles.segBtn, span === n && { backgroundColor: th.surface }]}
          >
            <Text
              style={{ color: span === n ? th.text : th.text2, fontWeight: '700', fontSize: 13 }}
            >
              {n} {t('abitudini.giorni_l')}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
        <View>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: NAME_W, textAlign: 'left', color: th.text3 }]}>
              {t('abitudini.abitudine')}
            </Text>
            {dates.map((d) => (
              <Text
                key={d}
                style={[styles.th, { width: CELL_W, color: d === today ? th.accent : th.text3 }]}
              >
                {t(`abitudini.dowm_${isoWeekday(d)}`)}
                {'\n'}
                {Number(d.slice(8))}
              </Text>
            ))}
            <Text style={[styles.th, { width: PCT_W, color: th.text3 }]}>%</Text>
          </View>

          {rows.map((r) => (
            <View key={r.h.uuid} style={styles.tr}>
              <Text
                style={{ width: NAME_W, color: th.text, fontWeight: '700', fontSize: 13 }}
                numberOfLines={1}
              >
                {r.h.icon} {r.h.name}
              </Text>
              {r.cells.map((c, i) => {
                const d = dates[i]!;
                const na = c === 'na';
                return (
                  <View key={d} style={{ width: CELL_W, alignItems: 'center' }}>
                    <Pressable
                      testID={`cell-${r.h.uuid}-${d}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${r.h.name} ${d}`}
                      disabled={na}
                      onPress={() => onToggle(r.h, d)}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: na
                            ? 'transparent'
                            : c === 'none'
                              ? th.surface2
                              : stateColor(th, c, r.h.color),
                          borderWidth: na ? 1 : 0,
                          borderStyle: 'dashed',
                          borderColor: th.hairline2,
                        },
                      ]}
                    >
                      {c === 'done' && <Text style={styles.mark}>✓</Text>}
                      {c === 'failed' && <Text style={styles.mark}>✕</Text>}
                    </Pressable>
                  </View>
                );
              })}
              <Text
                style={{
                  width: PCT_W,
                  textAlign: 'center',
                  color: th.text2,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                {r.pct}%
              </Text>
            </View>
          ))}

          <View style={[styles.tr, { borderTopWidth: 1, borderTopColor: th.hairline2 }]}>
            <Text style={{ width: NAME_W, color: th.text2, fontWeight: '800', fontSize: 12 }}>
              {t('abitudini.giornata')}
            </Text>
            {foot.map((v, i) => (
              <Text
                key={dates[i]}
                style={{
                  width: CELL_W,
                  textAlign: 'center',
                  color: th.text2,
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {v}
              </Text>
            ))}
            <View style={{ width: PCT_W }} />
          </View>
        </View>
      </ScrollView>

      <View style={{ marginTop: 16 }}>
        <StatCard
          th={th}
          title={t('abitudini.completamento_giornaliero')}
          note={t('abitudini.pct_medio', { pct: Math.round(rate * 100) })}
        >
          <Bars th={th} bars={barsLast(span, (d) => dayProgress(list, d, all, today).pct, today)} />
        </StatCard>
        <StatCard th={th} title={t('abitudini.classifica')}>
          <HBars
            th={th}
            empty={t('abitudini.nessun_dato_ancora')}
            rows={rank.map((r) => ({
              name: `${r.habit.icon} ${r.habit.name}`,
              color: r.habit.color,
              fill: r.rate,
              value: `${Math.round(r.rate * 100)}%`,
            }))}
          />
        </StatCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 30 },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  th: { fontSize: 10.5, fontWeight: '800', textAlign: 'center' },
  cell: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  mark: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
