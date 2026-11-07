import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/core/theme/ThemeProvider';
import { evaluateAchievements, TIER_COLORS, type AchievementState } from './achievements';
import { Bars, Heatmap, Kpi, StatCard } from './charts';
import {
  allLogsOf,
  categoryRows,
  countDone,
  ctxFor,
  globalStreak,
  radarData,
  ranking,
  rangeRate,
  weekGrid,
  type AllLogs,
} from './globalStats';
import type { HabitsTheme } from './habitsTheme';
import { labelDate } from './labels';
import { addDays, dayProgress, type Habit, type HabitLog } from './logic';
import { HBars, LineChart, Radar, WeekGrid } from './overview';
import { Sheet } from './Sheet';
import { barsLast, checkInHours, heatmap, monthlyCounts, weekdayRates, WEEK_HUES } from './stats';

export interface StatsSheetProps {
  visible: boolean;
  habits: Habit[];
  logs: HabitLog[];
  categories: {
    uuid: string;
    name: string;
    color: string;
    icon: string;
    slug: string | null;
    is_system: number;
  }[];
  today: string;
  range: number;
  th: HabitsTheme;
  onClose: () => void;
}

/** «Statistiche» (#hbSheetStats del sito): tutte le abitudini insieme. */
export function StatsSheet(p: StatsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={p.visible}
      title={t('abitudini.statistiche')}
      th={p.th}
      onClose={p.onClose}
      testID="stats-sheet"
    >
      {p.visible && <Body {...p} />}
    </Sheet>
  );
}

function Body(p: StatsSheetProps) {
  const { t } = useTranslation();
  const { th, today, range } = p;
  const all: AllLogs = useMemo(() => allLogsOf(p.logs), [p.logs]);
  const list = useMemo(() => p.habits.filter((h) => !h.is_archived), [p.habits]);
  const ctxOf = useMemo(() => ctxFor(all, today), [all, today]);

  const data = useMemo(() => {
    const prog = dayProgress(list, today, all, today);
    const pcts: number[] = [];
    for (let i = range - 1; i >= 0; i--)
      pcts.push(dayProgress(list, addDays(today, -i), all, today).pct);
    const catName = (c: { name: string; slug: string | null; is_system: number }) =>
      c.is_system && c.slug ? t(`abitudini.cat_${c.slug}`, { defaultValue: c.name }) : c.name;
    const catMap = new Map(
      p.categories.map((c) => [c.uuid, { name: `${c.icon} ${catName(c)}`.trim(), color: c.color }]),
    );
    return {
      streak: globalStreak(list, all, today),
      prog,
      month: countDone(all, `${today.slice(0, 8)}01`, today),
      total: countDone(all, '0000-01-01', today),
      pcts,
      rate: rangeRate(list, range, ctxOf, today),
      cats: categoryRows(list, range, ctxOf, today, catMap, t('abitudini.senza_categoria')),
      radar: radarData(
        list,
        range,
        ctxOf,
        today,
        p.categories.map((c) => ({ uuid: c.uuid, name: catName(c) })),
      ),
      week: weekGrid(list, today, ctxOf),
      rank: ranking(list, range, ctxOf, today),
      heat: heatmap((d) => dayProgress(list, d, all, today).pct, today),
      wd: weekdayRates(list, today, ctxOf, false),
      months: monthlyCounts(p.logs, Number(today.slice(0, 4))),
      hours: checkInHours(p.logs, today),
      awards: evaluateAchievements(p.habits, p.logs, today),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, all, ctxOf, today, range, p.categories, p.logs]);

  const wdMax = Math.max(0.01, ...data.wd);
  const monthMax = Math.max(1, ...data.months);
  const hourMax = Math.max(1, ...data.hours);
  const days = t('abitudini.giorni_l');

  return (
    <ScrollView contentContainerStyle={styles.body} testID="stats-scroll">
      <View style={styles.kpis}>
        <Kpi
          th={th}
          value={String(data.streak)}
          suffix={days}
          label={t('abitudini.serie_perfetta')}
          color="#FF6B35"
        />
        <Kpi
          th={th}
          value={String(data.prog.done)}
          suffix={`/${data.prog.total}`}
          label={t('comune.oggi')}
          color="#7C5CFF"
        />
      </View>
      <View style={styles.kpis}>
        <Kpi
          th={th}
          value={String(data.month)}
          label={t('abitudini.questo_mese')}
          color="#0A84FF"
        />
        <Kpi th={th} value={String(data.total)} label={t('abitudini.da_sempre')} color="#FFCC00" />
      </View>

      <StatCard th={th} title={t('abitudini.completamento_giornaliero')} note={`${range} ${days}`}>
        <Bars th={th} bars={barsLast(range, (d) => dayProgress(list, d, all, today).pct, today)} />
        <View style={styles.axis}>
          <Text style={{ color: th.text2, fontSize: 12 }}>
            {labelDate(addDays(today, -(range - 1)), today, t)}
          </Text>
          <Text style={{ color: th.text2, fontSize: 12 }}>{t('comune.oggi')}</Text>
        </View>
      </StatCard>

      <StatCard
        th={th}
        title={t('abitudini.andamento')}
        note={t('abitudini.pct_medio', { pct: Math.round(data.rate * 100) })}
      >
        <LineChart th={th} points={data.pcts} color={th.accent} />
      </StatCard>

      <StatCard
        th={th}
        title={t('abitudini.per_categoria')}
        note={t('abitudini.completate_previste')}
      >
        <HBars
          th={th}
          empty={t('abitudini.nessun_dato_ancora')}
          rows={data.cats.map((r) => ({
            name: r.name,
            color: r.color,
            fill: r.due ? r.ok / Math.max(...data.cats.map((x) => x.due)) : 0,
            value: `${r.ok}/${r.due}`,
          }))}
        />
      </StatCard>

      <StatCard th={th} title={t('abitudini.equilibrio_delle_aree')}>
        <Radar th={th} data={data.radar} empty={t('abitudini.servono_abitudini_in_almeno_3')} />
      </StatCard>

      <StatCard th={th} title={t('abitudini.settimana_per_abitudine')}>
        <WeekGrid
          th={th}
          empty={t('abitudini.nessuna_abitudine_attiva')}
          dowLabels={[1, 2, 3, 4, 5, 6, 7].map((n) => t(`abitudini.dowm_${n}`))}
          rows={data.week.map((r) => ({
            name: `${r.habit.icon} ${r.habit.name}`,
            color: r.habit.color,
            cells: r.cells,
          }))}
        />
      </StatCard>

      <StatCard
        th={th}
        title={t('abitudini.heatmap_annuale')}
        note={t('abitudini.tutte_le_abitudini')}
      >
        <Heatmap
          th={th}
          weeks={data.heat}
          color={th.accent}
          monthName={(m) => t(`abitudini.mesb_${m + 1}`)}
          lessLabel={t('abitudini.meno')}
          moreLabel={t('abitudini.piu')}
        />
      </StatCard>

      <StatCard th={th} title={t('abitudini.giorni_forti_e_deboli')}>
        <Bars
          th={th}
          max={78}
          bars={data.wd.map((r, i) => ({
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
          bars={data.months.map((c, i) => ({
            value: c / monthMax,
            label: t(`abitudini.mesb_${i + 1}`).slice(0, 1),
            color: WEEK_HUES[i % WEEK_HUES.length]!,
            highlight: i === Number(today.slice(5, 7)) - 1,
          }))}
        />
        <View style={styles.axis}>
          <Text style={{ color: th.text2, fontSize: 12 }}>{today.slice(0, 4)}</Text>
          <Text style={{ color: th.text2, fontSize: 12 }}>max {monthMax}</Text>
        </View>
      </StatCard>

      <StatCard
        th={th}
        title={t('abitudini.traguardi')}
        note={`${data.awards.filter((a) => a.unlocked).length}/${data.awards.length}`}
      >
        <View style={styles.badges} testID="achievements">
          {data.awards.map((a) => (
            <View
              key={a.code}
              testID={`award-${a.code}`}
              accessible
              accessibilityLabel={`${a.name}. ${a.description}. ${a.tier}${a.unlocked ? '' : ' (bloccato)'}`}
              style={[
                styles.badge,
                { backgroundColor: th.surface2, opacity: a.unlocked ? 1 : 0.42 },
              ]}
            >
              <Medal a={a} />
              <Text
                style={{ color: th.text, fontSize: 11, fontWeight: '800', textAlign: 'center' }}
              >
                {a.name}
              </Text>
              <Text
                style={{
                  color: th.text3,
                  fontSize: 8.5,
                  fontWeight: '800',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                {a.tier}
              </Text>
            </View>
          ))}
        </View>
      </StatCard>

      <StatCard
        th={th}
        title={t('abitudini.quando_ti_muovi')}
        note={t('abitudini.ultimi_90_giorni')}
      >
        <Bars
          th={th}
          testID="hours-bars"
          max={80}
          bars={data.hours.map((c, i) => ({
            value: c / hourMax,
            label: i % 6 === 0 ? String(i) : '',
            color: WEEK_HUES[Math.floor(i / 5) % WEEK_HUES.length]!,
            highlight: false,
          }))}
        />
      </StatCard>

      <StatCard th={th} title={t('abitudini.classifica_abitudini')}>
        <HBars
          th={th}
          empty={t('abitudini.nessun_dato_ancora')}
          rows={data.rank.map((r) => ({
            name: `${r.habit.icon} ${r.habit.name}`,
            color: r.habit.color,
            fill: r.rate,
            value: `${Math.round(r.rate * 100)}%`,
          }))}
        />
      </StatCard>
    </ScrollView>
  );
}

/** La medaglia di un traguardo: tonda, con il colore del livello. Glass = sfumatura piena; Calm paper = anello sottile. */
function Medal({ a }: { a: AchievementState }) {
  const app = useTheme();
  const c = TIER_COLORS[a.tier];
  const ring = app.scheme === 'dark' ? c.ringDark : c.ringLight;
  const base = {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 7,
    // chi non l'ha ancora sbloccata la vede spenta e grigia
    opacity: a.unlocked ? 1 : 0.6,
  };
  if (app.style === 'paper') {
    return (
      <View
        style={[
          base,
          {
            borderWidth: 1.5,
            borderColor: ring,
            borderStyle: a.unlocked ? 'solid' : 'dashed',
            backgroundColor: a.unlocked ? ring + '1A' : 'transparent',
          },
        ]}
      >
        <Text style={styles.badgeIcon}>{a.icon}</Text>
      </View>
    );
  }
  return (
    <LinearGradient
      colors={a.unlocked ? c.glass : ['#B9BECB', '#8E94A5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[base, { boxShadow: a.unlocked ? `0 4px 12px ${c.glass[1]}59` : undefined }]}
    >
      <Text style={styles.badgeIcon}>{a.icon}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 30 },
  kpis: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    width: '30.5%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
  },
  badgeIcon: { fontSize: 22 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
});
