import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ActionSheet, type SheetAction } from '@/features/habits/ActionSheet';
import { HabitRow } from '@/features/habits/HabitRow';
import {
  DayStrip,
  FilterChips,
  GroupLabel,
  TodayCard,
  type DayCell,
} from '@/features/habits/HabitsParts';
import { habitsTheme } from '@/features/habits/habitsTheme';
import {
  addDays,
  currentStreak,
  dailyFor,
  dayMessageKey,
  dayProgress,
  isoWeekday,
  ofKind,
  perfectStreak,
  periodProgress,
  stateOf,
  type CheckInMode,
  type Habit,
  type HabitLog,
} from '@/features/habits/logic';
import { localToday } from '@/features/tasks/groups';
import { Header } from '@/ui/kit';
import { SyncBadge } from '@/ui/SyncBadge';

type Filter = 'all' | Habit['frequency_type'];
const PARTS: Habit['day_part'][] = ['any', 'morning', 'afternoon', 'evening', 'night'];
const WINDOW_DAYS = 28;

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export default function HabitsScreen() {
  const th = useTheme();
  const ht = useMemo(() => habitsTheme(th.scheme), [th.scheme]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();

  const today = localToday();
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<Habit | null>(null);

  const habits = useMemo(
    () => (services ? services.habits.list() : []),
    // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere i dati
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const logs = useMemo(() => {
    const m = new Map<string, HabitLog>();
    if (!services) return m;
    for (const l of services.habits.logsBetween(addDays(today, -(WINDOW_DAYS - 1)), today))
      m.set(`${l.habit_uuid}|${l.log_date}`, l);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, version, today]);

  /** I giorni «fatti» di ogni abitudine non giornaliera (servono ad anello settimanale/mensile/intervallo) e la serie di ogni abitudine. */
  const history = useMemo(() => {
    const doneDates = new Map<string, string[]>();
    const streak = new Map<string, number>();
    if (!services) return { doneDates, streak };
    for (const h of habits) {
      const by = services.habits.statusByDate(h.uuid);
      doneDates.set(
        h.uuid,
        Object.keys(by).filter((d) => by[d] === 'done'),
      );
      streak.set(h.uuid, currentStreak(h, by, today));
    }
    return { doneDates, streak };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, habits, version, today]);

  const cells = useMemo<DayCell[]>(() => {
    const out: DayCell[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const p = dayProgress(habits, d, logs, today);
      out.push({
        day: d,
        dow: t(`abitudini.dow_${isoWeekday(d)}`),
        num: Number(d.slice(8)),
        pct: p.pct,
        hasHabits: p.total > 0,
      });
    }
    return out;
  }, [habits, logs, today, t]);

  const progress = useMemo(() => dayProgress(habits, day, logs, today), [habits, day, logs, today]);
  const streakDays = useMemo(
    () => perfectStreak(habits, logs, today, WINDOW_DAYS),
    [habits, logs, today],
  );

  const keep = (h: Habit) => filter === 'all' || h.frequency_type === filter;

  function tap(h: Habit) {
    if (!services) return;
    const mode: CheckInMode = h.goal_type === 'quantity' ? 'increment' : 'toggle';
    try {
      services.habits.checkIn(h.uuid, day, mode);
      changed();
    } catch {
      /* giorno futuro: la fascia non lo mostra, quindi non succede */
    }
  }

  function run(h: Habit, mode: CheckInMode) {
    if (!services) return;
    try {
      services.habits.checkIn(h.uuid, day, mode);
      changed();
    } catch {
      /* vedi sopra */
    }
  }

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheet) return [];
    const st = stateOf(sheet, day, logs.get(`${sheet.uuid}|${day}`) ?? null, today);
    if (st.status === 'skipped')
      return [
        {
          key: 'unskip',
          label: t('abitudini.non_saltare'),
          onPress: () => run(sheet, 'clear'),
        },
      ];
    const list: SheetAction[] = [];
    if (sheet.kind === 'quit')
      list.push({
        key: 'fail',
        label: t('abitudini.ci_sono_cascato'),
        destructive: true,
        onPress: () => run(sheet, 'fail'),
      });
    list.push({ key: 'skip', label: t('abitudini.salta_oggi'), onPress: () => run(sheet, 'skip') });
    if (st.status !== 'empty' && st.status !== 'clean')
      list.push({
        key: 'clear',
        label: t('abitudini.annulla_oggi'),
        onPress: () => run(sheet, 'clear'),
      });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, day, logs, today, t]);

  function renderRow(h: Habit) {
    const log = logs.get(`${h.uuid}|${day}`) ?? null;
    const st = stateOf(h, day, log, today);
    const meta: string[] = [];
    let period: { done: number; target: number } | undefined;
    if (h.frequency_type === 'daily') {
      const s = history.streak.get(h.uuid) ?? 0;
      if (s > 0) meta.push(t('abitudini.n_di_fila', { n: s }));
      if (h.goal_type === 'quantity' && h.unit)
        meta.push(`${h.kind === 'quit' ? '< ' : ''}${fmt(h.target_amount)} ${h.unit}`);
    } else {
      const p = periodProgress(h, day, history.doneDates.get(h.uuid) ?? []);
      period = { done: p.done, target: p.target };
      if (h.frequency_type === 'interval') {
        meta.push(t('abitudini.ogni_n_giorni', { n: p.step ?? h.interval_days }));
        if (p.daysToNext && p.done === 0)
          meta.push(t('abitudini.prossima_fra', { n: p.daysToNext }).trim());
      } else if (h.frequency_type === 'weekly') {
        meta.push(t('abitudini.n_volte_a_settimana', { n: p.target }));
      } else {
        meta.push(t('abitudini.n_volte_al_mese', { n: p.target }));
      }
    }
    const quantity = h.goal_type === 'quantity';
    return (
      <View key={h.uuid} style={{ marginHorizontal: 16, marginBottom: 10 }}>
        <HabitRow
          habit={h}
          state={st}
          th={ht}
          meta={meta.join(' · ')}
          period={period}
          amountText={quantity && !period ? `${fmt(st.amount)}/${fmt(st.target)}` : undefined}
          unitText={quantity && !period ? h.unit : undefined}
          onCheck={() => tap(h)}
          onLongPress={() => setSheet(h)}
          onOpen={() => undefined /* la pagina di dettaglio arriva con la prossima fetta */}
        />
      </View>
    );
  }

  const dailyAll = dailyFor(habits, day).filter(keep);
  const byPart = PARTS.map((p) => ({
    part: p,
    list: dailyAll.filter((h) => h.day_part === p),
  })).filter((g) => g.list.length > 0);
  const sections: { key: string; title: string; list: Habit[] }[] = (
    [
      ['weekly', t('abitudini.settimanali')],
      ['monthly', t('abitudini.mensili')],
      ['interval', t('abitudini.personalizzate')],
    ] as const
  )
    .map(([k, title]) => ({ key: k, title, list: ofKind(habits, k).filter(keep) }))
    .filter((s) => s.list.length > 0);

  const nothing = byPart.length === 0 && sections.length === 0;
  const dayLabel =
    day === today ? t('abitudini.da_fare') : day.split('-').reverse().slice(0, 2).join('/');

  return (
    <View style={{ flex: 1, backgroundColor: ht.bg }}>
      <Header title={t('abitudini.titolo')} top={insets.top} right={<SyncBadge />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <DayStrip cells={cells} selected={day} today={today} th={ht} onSelect={setDay} />
        <TodayCard
          th={ht}
          title={dayLabel}
          pct={progress.pct}
          line1={t('abitudini.n_di_n_completate', { fatte: progress.done, totale: progress.total })}
          line2={t(dayMessageKey(progress))}
          streakText={
            streakDays > 0 ? t('abitudini.n_giorni_di_fila', { n: streakDays }) : undefined
          }
        />
        <FilterChips
          th={ht}
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'all', label: t('abitudini.tutte') },
            { key: 'daily', label: t('abitudini.giornalieri') },
            { key: 'weekly', label: t('abitudini.settimanali') },
            { key: 'monthly', label: t('abitudini.mensili') },
            { key: 'interval', label: t('abitudini.personalizzate') },
          ]}
        />
        {nothing && (
          <View style={{ alignItems: 'center', paddingHorizontal: 32, marginTop: 40, gap: 6 }}>
            <Text style={{ color: ht.text, fontWeight: '800', fontSize: 17 }}>
              {habits.length === 0
                ? t('abitudini.qui_non_c_e_ancora')
                : t('abitudini.nessuna_abitudine_con_questo_filtro')}
            </Text>
            {habits.length === 0 && (
              <Text style={{ color: ht.text2, textAlign: 'center' }}>
                {t('abitudini.aggiungi_la_prima_abitudine_e')}
              </Text>
            )}
          </View>
        )}
        {byPart.map((g) => (
          <View key={g.part}>
            {byPart.length > 1 && <GroupLabel th={ht} text={t(`abitudini.part_${g.part}`)} />}
            {byPart.length === 1 && <View style={{ height: 6 }} />}
            {g.list.map(renderRow)}
          </View>
        ))}
        {sections.map((s) => (
          <View key={s.key}>
            <GroupLabel th={ht} text={s.title} />
            {s.list.map(renderRow)}
          </View>
        ))}
      </ScrollView>
      <ActionSheet
        visible={sheet !== null}
        title={sheet ? `${sheet.icon} ${sheet.name}` : ''}
        subtitle={t('abitudini.cosa_vuoi_fare')}
        cancelLabel={t('comune.annulla')}
        actions={sheetActions}
        th={ht}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}
