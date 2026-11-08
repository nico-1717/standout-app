import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { alpha, mix } from '@/features/buy/buyTheme';
import { cardShadow } from '@/ui/kit';

import { Bars, CalendarGrid, Heatmap, Kpi, StatCard } from './charts';
import type { HabitsTheme } from './habitsTheme';
import { freqLabel, goalTag, labelDate, monthTitle } from './labels';
import { addDays, isDue, type Habit, type HabitLog } from './logic';
import { Sheet } from './Sheet';
import {
  addMonths,
  barsLast,
  bestStreakOf,
  heatmap,
  monthCalendar,
  monthlyCounts,
  stateAt,
  streakOf,
  successAt,
  totalCheckins,
  weekdayRates,
  WEEK_HUES,
  windowStats,
  type Ctx,
} from './stats';

export interface HabitDetailProps {
  habit: Habit | null;
  /** tutti i check-in di questa abitudine */
  logs: HabitLog[];
  today: string;
  /** il giorno scelto nella pagina (il tasto «segna» agisce su di lui) */
  selectedDay: string;
  th: HabitsTheme;
  onClose: () => void;
  onEdit: (h: Habit) => void;
  onToggle: (h: Habit, day: string) => void;
  onNote: (h: Habit, day: string) => void;
}

/** La scheda di un'abitudine (#hbSheetDetail del sito): copertina, numeri, calendario del mese, heatmap, grafici, note. */
export function HabitDetail(p: HabitDetailProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={p.habit !== null}
      title={p.habit?.name ?? ''}
      th={p.th}
      onClose={p.onClose}
      testID="habit-detail"
    >
      {p.habit && <Body {...p} habit={p.habit} t={t} />}
    </Sheet>
  );
}

function Body(p: HabitDetailProps & { habit: Habit; t: ReturnType<typeof useTranslation>['t'] }) {
  const { habit: h, th, today, t } = p;
  const [month, setMonth] = useState(p.selectedDay.slice(0, 7));

  const ctx = useMemo<Ctx>(() => {
    const logs = new Map<string, HabitLog>();
    for (const l of p.logs) logs.set(l.log_date, l);
    return { today, logs };
  }, [p.logs, today]);

  const stats = useMemo(() => {
    const monthStart = `${month}-01`;
    const monthEnd = addDays(addMonths(month, 1) + '-01', -1);
    return {
      streak: streakOf(h, ctx),
      best: bestStreakOf(h, ctx),
      total: totalCheckins(ctx),
      all: windowStats(h, h.start_date, today, ctx),
      w30: windowStats(h, addDays(today, -29), today, ctx),
      month: windowStats(h, monthStart, monthEnd > today ? today : monthEnd, ctx),
    };
  }, [h, ctx, today, month]);

  const heat = useMemo(
    () =>
      heatmap(
        (d) => (isDue(h, d) ? (successAt(h, d, ctx) ? 1 : stateAt(h, d, ctx).pct) : 0),
        today,
      ),
    [h, ctx, today],
  );
  const bars30 = useMemo(
    () => barsLast(30, (d) => (isDue(h, d) ? stateAt(h, d, ctx).pct : 0), today, h.color),
    [h, ctx, today],
  );
  const wd = useMemo(() => weekdayRates([h], today, () => ctx, true), [h, ctx, today]);
  const wdMax = Math.max(0.01, ...wd);
  const months = useMemo(() => monthlyCounts(p.logs, Number(today.slice(0, 4))), [p.logs, today]);
  const monthMax = Math.max(1, ...months);
  const notes = useMemo(
    () =>
      p.logs
        .filter((l) => l.note)
        .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
        .slice(0, 12),
    [p.logs],
  );
  const cells = useMemo(() => monthCalendar(h, month, ctx), [h, month, ctx]);

  const done = successAt(h, p.selectedDay, ctx);
  const partLabel = t(`abitudini.part_${h.day_part}`);
  const partIcon = { any: '🕐', morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' }[
    h.day_part
  ];

  return (
    <ScrollView contentContainerStyle={styles.body} testID="habit-detail-scroll">
      <LinearGradient
        colors={[h.color, mix(h.color, '#000000', 0.72)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.glow} />
        <Text style={{ fontSize: 44 }}>{h.icon}</Text>
        <Text style={styles.name}>{h.name}</Text>
        {!!h.motivation && <Text style={styles.moti}>{h.motivation}</Text>}
        <View style={styles.tags}>
          <Tag text={freqLabel(h, t)} />
          <Tag text={`${partIcon} ${partLabel}`} />
          <Tag text={goalTag(h, t)} />
          {!!h.end_date && <Tag text={t('abitudini.fino_al', { data: h.end_date })} />}
        </View>
      </LinearGradient>

      <View style={styles.actions}>
        <Pressable
          testID="detail-edit"
          accessibilityRole="button"
          onPress={() => p.onEdit(h)}
          style={[styles.btn, { backgroundColor: th.surface3 }]}
        >
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>
            {t('comune.modifica')}
          </Text>
        </Pressable>
        <Pressable
          testID="detail-toggle"
          accessibilityRole="button"
          onPress={() => p.onToggle(h, p.selectedDay)}
          style={[styles.btn, { backgroundColor: th.scheme === 'dark' ? th.surface3 : '#1C1C1E' }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
            {done
              ? t('abitudini.annulla_oggi')
              : h.kind === 'quit'
                ? t('abitudini.ci_sono_cascato')
                : t('abitudini.segna_fatto')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.kpis}>
        <Kpi
          th={th}
          value={String(stats.streak)}
          suffix={t('abitudini.giorni_l')}
          label={t('abitudini.serie_attuale')}
          color="#FF6B35"
        />
        <Kpi
          th={th}
          value={String(stats.best)}
          suffix={t('abitudini.giorni_l')}
          label={t('abitudini.record')}
          color="#FFCC00"
        />
      </View>
      <View style={styles.kpis}>
        <Kpi
          th={th}
          value={String(stats.total)}
          label={t('abitudini.check_in_totali')}
          color="#00E0A0"
        />
        <Kpi
          th={th}
          value={String(Math.round(stats.all.rate * 100))}
          suffix="%"
          label={t('abitudini.completamento')}
          color={h.color}
        />
      </View>

      <StatCard th={th}>
        <View style={styles.calHead}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('planner.mese_prec')}
            testID="cal-prev"
            onPress={() => setMonth(addMonths(month, -1))}
            style={[styles.nav, { backgroundColor: th.surface2 }]}
          >
            <Text style={{ color: th.text, fontSize: 18, fontWeight: '700' }}>‹</Text>
          </Pressable>
          <Text testID="cal-title" style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>
            {monthTitle(month, t)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('planner.mese_succ')}
            testID="cal-next"
            onPress={() => setMonth(addMonths(month, 1))}
            style={[styles.nav, { backgroundColor: th.surface2 }]}
          >
            <Text style={{ color: th.text, fontSize: 18, fontWeight: '700' }}>›</Text>
          </Pressable>
        </View>
        <CalendarGrid
          th={th}
          cells={cells}
          color={h.color}
          dowLabels={[1, 2, 3, 4, 5, 6, 7].map((n) => t(`abitudini.dowm_${n}`))}
          onTap={(d) => p.onToggle(h, d)}
          onLong={(d) => p.onNote(h, d)}
        />
        <View style={styles.monthLine}>
          <Text style={{ color: th.text2, fontSize: 13 }}>
            {t('abitudini.n_su_n_mese', { fatti: stats.month.ok, totale: stats.month.due })}
          </Text>
          <Text style={{ color: th.text2, fontSize: 13 }}>
            {Math.round(stats.month.rate * 100)}%
          </Text>
        </View>
      </StatCard>

      <StatCard th={th} title={t('abitudini.heatmap_annuale')} note={t('abitudini.365_giorni')}>
        <Heatmap
          th={th}
          weeks={heat}
          color={h.color}
          monthName={(m) => t(`abitudini.mesb_${m + 1}`)}
          lessLabel={t('abitudini.meno')}
          moreLabel={t('abitudini.piu')}
        />
      </StatCard>

      <StatCard
        th={th}
        title={t('abitudini.ultimi_30_giorni')}
        note={t('abitudini.pct_completato', { pct: Math.round(stats.w30.rate * 100) })}
      >
        <Bars th={th} bars={bars30} />
      </StatCard>

      <StatCard th={th} title={t('abitudini.giorni_forti_e_deboli')}>
        <Bars
          th={th}
          max={78}
          bars={wd.map((r, i) => ({
            value: r / wdMax,
            label: t(`abitudini.dowm_${i + 1}`),
            color: WEEK_HUES[i % WEEK_HUES.length]!,
            highlight: false,
          }))}
        />
      </StatCard>

      <StatCard th={th} title={t('abitudini.frequenza_per_mese')}>
        <Bars
          th={th}
          max={88}
          bars={months.map((c, i) => ({
            value: c / monthMax,
            label: t(`abitudini.mesb_${i + 1}`).slice(0, 1),
            color: WEEK_HUES[i % WEEK_HUES.length]!,
            highlight: i === Number(today.slice(5, 7)) - 1,
          }))}
        />
        <View style={styles.monthLine}>
          <Text style={{ color: th.text2, fontSize: 13 }}>{today.slice(0, 4)}</Text>
          <Text style={{ color: th.text2, fontSize: 13 }}>max {monthMax}</Text>
        </View>
      </StatCard>

      <StatCard
        th={th}
        title={t('abitudini.note_dei_check_in')}
        action={{
          label: t('abitudini.scrivi_b'),
          onPress: () => p.onNote(h, p.selectedDay),
          testID: 'detail-note',
        }}
      >
        {notes.length === 0 ? (
          <Text
            style={{ color: th.text2, textAlign: 'center', lineHeight: 21, paddingVertical: 12 }}
          >
            {t('abitudini.nessuna_nota_per_ora_tieni')}
          </Text>
        ) : (
          notes.map((n) => (
            <View
              key={n.log_date}
              style={[styles.note, { backgroundColor: th.surface2 }, cardShadow(false)]}
            >
              <Text style={{ color: th.text2, fontSize: 12, fontWeight: '800', marginBottom: 2 }}>
                {labelDate(n.log_date, today, t)}
              </Text>
              <Text style={{ color: th.text, fontSize: 15, lineHeight: 21 }}>{n.note}</Text>
            </View>
          ))
        )}
      </StatCard>
    </ScrollView>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 30 },
  hero: { borderRadius: 30, padding: 22, overflow: 'hidden', marginBottom: 14, gap: 6 },
  glow: {
    position: 'absolute',
    right: -60,
    top: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: alpha('#FFFFFF', 0.16),
  },
  name: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  moti: { color: 'rgba(255,255,255,.85)', fontSize: 15, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: {
    backgroundColor: 'rgba(255,255,255,.22)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btn: { flex: 1, borderRadius: 20, paddingVertical: 16, alignItems: 'center' },
  kpis: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: -14,
  },
  nav: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  monthLine: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  note: { borderRadius: 16, padding: 12, marginBottom: 8 },
});
