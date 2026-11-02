import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ActionSheet, type SheetAction } from '@/features/habits/ActionSheet';
import { HabitForm } from '@/features/habits/HabitForm';
import { HabitRow } from '@/features/habits/HabitRow';
import {
  DayStrip,
  FilterChips,
  GroupLabel,
  TodayCard,
  type DayCell,
} from '@/features/habits/HabitsParts';
import { toInput, toPatch, type HabitFormState } from '@/features/habits/formModel';
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
import { LinearGradient } from 'expo-linear-gradient';

import { mix } from '@/features/buy/buyTheme';
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
  const [form, setForm] = useState<{ open: boolean; habit: Habit | null }>({
    open: false,
    habit: null,
  });
  const [showFuture, setShowFuture] = useState(false);

  const habits = useMemo(
    () => (services ? services.habits.list() : []),
    // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere i dati
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const categories = useMemo(
    () => (services ? services.habitCategories.list() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  // le abitudini che iniziano più avanti non stanno nell'elenco: si vedono dietro «Abitudini future»
  const future = useMemo(() => habits.filter((h) => h.start_date > today), [habits, today]);
  const current = useMemo(() => habits.filter((h) => h.start_date <= today), [habits, today]);
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
      const p = dayProgress(current, d, logs, today);
      out.push({
        day: d,
        dow: t(`abitudini.dow_${isoWeekday(d)}`),
        num: Number(d.slice(8)),
        pct: p.pct,
        hasHabits: p.total > 0,
      });
    }
    return out;
  }, [current, logs, today, t]);

  const progress = useMemo(
    () => dayProgress(current, day, logs, today),
    [current, day, logs, today],
  );
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
    const tail: SheetAction[] = [
      {
        key: 'edit',
        label: t('abitudini.modifica_abitudine'),
        onPress: () => setForm({ open: true, habit: sheet }),
      },
      {
        key: 'archive',
        label: t('abitudini.archivia'),
        onPress: () => {
          services?.habits.archive(sheet.uuid, true);
          changed();
        },
      },
      {
        key: 'delete',
        label: t('abitudini.elimina_attr'),
        destructive: true,
        onPress: () => confirmDelete(sheet),
      },
    ];
    if (st.status === 'skipped')
      return [
        { key: 'unskip', label: t('abitudini.non_saltare'), onPress: () => run(sheet, 'clear') },
        ...tail,
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
    return [...list, ...tail];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, day, logs, today, t]);

  function confirmDelete(h: Habit) {
    Alert.alert(
      t('abitudini.eliminare_nome', { nome: h.name }),
      t('abitudini.sparisce_anche_tutto_lo_storico'),
      [
        { text: t('comune.annulla'), style: 'cancel' },
        {
          text: t('comune.elimina'),
          style: 'destructive',
          onPress: () => {
            services?.habits.remove(h.uuid);
            changed();
          },
        },
      ],
    );
  }

  function save(f: HabitFormState, h: Habit | null) {
    if (!services) return;
    if (h) services.habits.update(h.uuid, toPatch(h, f));
    else services.habits.create(toInput(f));
    setForm({ open: false, habit: null });
    changed();
    if (f.start_date > today)
      Alert.alert(
        t('abitudini.comparira_il', { data: f.start_date.split('-').reverse().join('/') }),
      );
  }

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
          onOpen={
            () =>
              setForm({
                open: true,
                habit: h,
              }) /* finché non c'è la pagina di dettaglio, un tocco apre la modifica */
          }
        />
      </View>
    );
  }

  const dailyAll = dailyFor(current, day).filter(keep);
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
    .map(([k, title]) => ({ key: k, title, list: ofKind(current, k).filter(keep) }))
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
        {future.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Pressable
              testID="future-toggle"
              accessibilityRole="button"
              onPress={() => setShowFuture((v) => !v)}
              style={{ marginHorizontal: 20, paddingVertical: 8 }}
            >
              <Text style={{ color: ht.accent, fontWeight: '800', fontSize: 14 }}>
                {t('abitudini.future_vedi', { n: future.length })}
              </Text>
            </Pressable>
            {showFuture && (
              <View>
                <Text
                  style={{ color: ht.text2, marginHorizontal: 20, marginBottom: 8, fontSize: 13 }}
                >
                  {t('abitudini.future_nota')}
                </Text>
                {future.map((h) => (
                  <Pressable
                    key={h.uuid}
                    testID={`future-${h.uuid}`}
                    onPress={() => setForm({ open: true, habit: h })}
                    style={{
                      marginHorizontal: 16,
                      marginBottom: 8,
                      backgroundColor: ht.surface,
                      borderRadius: 18,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      opacity: 0.8,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{h.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: ht.text, fontWeight: '800', fontSize: 16 }}>
                        {h.name}
                      </Text>
                      <Text style={{ color: ht.text2, fontSize: 13 }}>
                        {t('abitudini.future_inizia', {
                          data: h.start_date.split('-').reverse().join('/'),
                        })}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <Pressable
        testID="habit-add"
        accessibilityRole="button"
        accessibilityLabel={t('abitudini.aggiungi_abitudine')}
        onPress={() => setForm({ open: true, habit: null })}
        style={{ position: 'absolute', right: 18, bottom: 18 }}
      >
        <LinearGradient
          colors={[mix(ht.accent, '#FFFFFF', 0.82), ht.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 30, lineHeight: 33, fontWeight: '300' }}>+</Text>
        </LinearGradient>
      </Pressable>
      <HabitForm
        visible={form.open}
        habit={form.habit}
        categories={categories}
        today={today}
        th={ht}
        onClose={() => setForm({ open: false, habit: null })}
        onSave={save}
      />
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
