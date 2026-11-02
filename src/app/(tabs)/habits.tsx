import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ActionSheet, type SheetAction } from '@/features/habits/ActionSheet';
import { HabitDetail } from '@/features/habits/HabitDetail';
import { HabitForm } from '@/features/habits/HabitForm';
import { HabitRow } from '@/features/habits/HabitRow';
import { SwipeRow } from '@/features/habits/SwipeRow';
import {
  DayStrip,
  FilterChips,
  GroupLabel,
  TodayCard,
  type DayCell,
} from '@/features/habits/HabitsParts';
import { toInput, toPatch, type HabitFormState } from '@/features/habits/formModel';
import { allLogsOf, statCards, globalStreak } from '@/features/habits/globalStats';
import { SettingsSheet } from '@/features/habits/SettingsSheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { labelDate } from '@/features/habits/labels';
import { HabitsHeader, StatCarousel, type CardView } from '@/features/habits/overview';
import { StatsSheet } from '@/features/habits/StatsSheet';
import { TableSheet } from '@/features/habits/TableSheet';
import { NoteSheet } from '@/features/habits/NoteSheet';
import {
  addDays,
  currentStreak,
  dailyFor,
  isDue,
  dayMessageKey,
  dayProgress,
  isSuccess,
  isoWeekday,
  ofKind,
  periodProgress,
  stateOf,
  swipeAllowed,
  swipeMode,
  type CheckInMode,
  type Habit,
} from '@/features/habits/logic';
import { localToday } from '@/features/tasks/groups';
import { LinearGradient } from 'expo-linear-gradient';

import { mix } from '@/features/buy/buyTheme';
import { SyncBadge } from '@/ui/SyncBadge';

/** Come sul sito: tutte, da fare, oppure una fascia della giornata (compare solo se c'è un'abitudine in quella fascia). */
type Filter = 'all' | 'todo' | `part:${Habit['day_part']}`;
/** L'ordine dei gruppi del sito (prima la mattina, «tutto il giorno» per ultimo). */
const PARTS: Habit['day_part'][] = ['morning', 'afternoon', 'evening', 'night', 'any'];
const PART_ICON: Record<Habit['day_part'], string> = {
  any: '🕐',
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌆',
  night: '🌙',
};

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export default function HabitsScreen() {
  const th = useTheme();
  const { services, version, changed, habitSettings: SETTINGS, updateHabitSettings } = useApp();
  const ht = useMemo(
    () => habitsTheme(th.scheme, SETTINGS.accent_color),
    [th.scheme, SETTINGS.accent_color],
  );
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const today = localToday();
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<Habit | null>(null);
  const [form, setForm] = useState<{ open: boolean; habit: Habit | null }>({
    open: false,
    habit: null,
  });
  const [showFuture, setShowFuture] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'stats' | 'table' | 'settings' | null>(null);
  const [noteFor, setNoteFor] = useState<{ habit: Habit; day: string } | null>(null);

  const habits = useMemo(
    () => (services ? services.habits.list() : []),
    // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere i dati
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const archivedList = useMemo(
    () => (services ? services.habits.list({ archived: true }) : []),
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
  const detail = detailId ? (habits.find((h) => h.uuid === detailId) ?? null) : null;
  const detailLogs = useMemo(
    () => (services && detailId ? services.habits.logsOf(detailId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, detailId, version],
  );
  const noteTarget = useMemo(() => {
    if (!noteFor || !services) return null;
    const l = services.habits.log(noteFor.habit.uuid, noteFor.day);
    return { ...noteFor, note: l?.note ?? '', mood: l?.mood ?? null };
  }, [noteFor, services]);
  // tutti i check-in: servono alla fascia dei giorni, al carosello e ai fogli «Statistiche» e «Tabella»
  const logList = useMemo(
    () => (services ? services.habits.logsBetween('0000-01-01', '9999-12-31') : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const logs = useMemo(() => allLogsOf(logList), [logList]);

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
    for (let i = SETTINGS.visible_days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const p = dayProgress(current, d, logs, today);
      out.push({
        day: d,
        dow: t(`abitudini.dowm_${isoWeekday(d)}`),
        num: Number(d.slice(8)),
        pct: p.pct,
        hasHabits: p.total > 0,
      });
    }
    return out;
  }, [current, logs, today, t, SETTINGS.visible_days]);

  const progress = useMemo(
    () => dayProgress(current, day, logs, today),
    [current, day, logs, today],
  );
  const streakDays = useMemo(() => globalStreak(current, logs, today), [current, logs, today]);
  const skipped = useMemo(
    () =>
      dailyFor(current, day).filter(
        (h) => stateOf(h, day, logs.get(`${h.uuid}|${day}`) ?? null, today).status === 'skipped',
      ).length,
    [current, day, logs, today],
  );
  const cards = useMemo<CardView[]>(
    () =>
      statCards(
        current,
        logs,
        day,
        today,
        t(`abitudini.mese_${Number(today.slice(5, 7))}`).toLowerCase(),
      ).map((c) => ({
        key: c.key,
        color: c.color,
        emoji: c.emoji,
        kicker: c.kickerIsDay ? labelDate(c.kicker, today, t) : t(c.kicker),
        value: c.value,
        suffix: c.suffix,
        sub: t(c.sub.key, c.sub.params),
        spark: c.spark,
        ring: c.ring,
      })),
    [current, logs, day, today, t],
  );

  /** Il filtro vale per le giornaliere (come il sito); «da fare» toglie quelle già riuscite. */
  const keepDaily = (h: Habit) => {
    if (filter === 'all') return true;
    if (filter === 'todo')
      return !isSuccess(h, stateOf(h, day, logs.get(`${h.uuid}|${day}`) ?? null, today));
    return h.day_part === filter.slice(5);
  };
  const keepOther = (h: Habit) =>
    filter === 'all' || filter === 'todo' || h.day_part === filter.slice(5);

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
        <SwipeRow
          th={ht}
          testID={`swipe-${h.uuid}`}
          color={h.color}
          doneLabel={h.kind === 'quit' ? t('abitudini.ci_sono_cascato') : t('abitudini.fatto')}
          undoLabel={t('comune.annulla')}
          allowRight={swipeAllowed(h, st, 1)}
          allowLeft={swipeAllowed(h, st, -1)}
          onSwipe={(dir) => run(h, swipeMode(h, dir))}
        >
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
            onOpen={() => setDetailId(h.uuid)}
          />
        </SwipeRow>
      </View>
    );
  }

  const items = dailyFor(current, day).filter(keepDaily);
  const weekly = ofKind(current, 'weekly').filter(keepOther);
  const monthly = ofKind(current, 'monthly').filter(keepOther);
  // le «ogni N giorni» si vedono nei loro giorni, o finché il turno non è stato fatto (regola del sito)
  const interval = ofKind(current, 'interval')
    .filter(keepOther)
    .filter(
      (h) =>
        isDue(h, day) ||
        !isSuccess(h, stateOf(h, day, logs.get(`${h.uuid}|${day}`) ?? null, today)),
    );
  const others = weekly.length + monthly.length + interval.length;
  const byPart = SETTINGS.group_by_day_part
    ? PARTS.map((p) => ({ part: p, list: items.filter((h) => h.day_part === p) })).filter(
        (g) => g.list.length > 0,
      )
    : [];
  const sections = (
    [
      ['weekly', t('abitudini.settimanali'), weekly],
      ['monthly', t('abitudini.mensili'), monthly],
      ['interval', t('abitudini.personalizzate'), interval],
    ] as const
  ).filter((s) => s[2].length > 0);

  const nothing = items.length === 0 && others === 0;
  const chips = [
    `✅ ${progress.done}/${progress.total}`,
    `🔥 ${t('abitudini.n_di_fila', { n: streakDays })}`,
    ...(skipped ? [`⏭ ${t('abitudini.n_saltate', { n: skipped })}`] : []),
  ];
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('abitudini.tutte') },
    { key: 'todo', label: t('abitudini.da_fare') },
    ...PARTS.filter(
      (p) => p !== 'any' && current.some((h) => !h.is_archived && h.day_part === p),
    ).map((p) => ({
      key: `part:${p}` as Filter,
      label: `${PART_ICON[p]} ${t(`abitudini.part_${p}`)}`,
    })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: ht.bg }}>
      <HabitsHeader
        th={ht}
        top={insets.top}
        eyebrow={labelDate(day, today, t)}
        title={t('abitudini.titolo')}
        right={<SyncBadge />}
        onTable={() => setPanel('table')}
        onStats={() => setPanel('stats')}
        onSettings={() => setPanel('settings')}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <DayStrip cells={cells} selected={day} today={today} th={ht} onSelect={setDay} />
        <StatCarousel
          th={ht}
          cards={cards}
          autoplay={SETTINGS.carousel_autoplay}
          intervalS={SETTINGS.carousel_interval_s}
        />
        <TodayCard
          th={ht}
          title={labelDate(day, today, t)}
          pct={progress.pct}
          sub={t(dayMessageKey(progress))}
          chips={chips}
        />
        <Text
          testID="list-title"
          style={{
            color: ht.text,
            fontWeight: '800',
            fontSize: 20,
            marginHorizontal: 20,
            marginTop: 18,
          }}
        >
          {t('abitudini.n_di_n_completate', { fatte: progress.done, totale: progress.total })}
        </Text>
        <FilterChips th={ht} value={filter} onChange={setFilter} items={filters} />
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
        {SETTINGS.group_by_day_part ? (
          byPart.map((g) => (
            <View key={g.part}>
              <GroupLabel th={ht} text={`${PART_ICON[g.part]} ${t(`abitudini.part_${g.part}`)}`} />
              {g.list.map(renderRow)}
            </View>
          ))
        ) : (
          <View>
            {items.length > 0 && others > 0 && (
              <GroupLabel th={ht} text={t('abitudini.giornalieri')} />
            )}
            {items.map(renderRow)}
          </View>
        )}
        {sections.map(([key, title, list]) => (
          <View key={key}>
            <GroupLabel th={ht} text={title} />
            {list.map(renderRow)}
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
      <StatsSheet
        visible={panel === 'stats'}
        habits={current}
        logs={logList}
        categories={categories}
        today={today}
        range={SETTINGS.chart_range_days}
        th={ht}
        onClose={() => setPanel(null)}
      />
      <SettingsSheet
        visible={panel === 'settings'}
        settings={SETTINGS}
        archived={archivedList}
        th={ht}
        onChange={updateHabitSettings}
        onRestore={(h) => {
          services?.habits.archive(h.uuid, false);
          changed();
        }}
        onClose={() => setPanel(null)}
      />
      <TableSheet
        visible={panel === 'table'}
        habits={current}
        logs={logList}
        today={today}
        th={ht}
        onClose={() => setPanel(null)}
        onToggle={(h, d) => {
          if (d > today || !services) return;
          services.habits.checkIn(h.uuid, d, 'toggle');
          changed();
        }}
      />
      <HabitDetail
        habit={detail}
        logs={detailLogs}
        today={today}
        selectedDay={day}
        th={ht}
        onClose={() => setDetailId(null)}
        onEdit={(h) => {
          setDetailId(null);
          setForm({ open: true, habit: h });
        }}
        onToggle={(h, d) => {
          if (d > today || !services) return;
          services.habits.checkIn(h.uuid, d, 'toggle');
          changed();
        }}
        onNote={(h, d) => {
          if (d <= today) setNoteFor({ habit: h, day: d });
        }}
      />
      <NoteSheet
        target={noteTarget}
        today={today}
        th={ht}
        onClose={() => setNoteFor(null)}
        onSave={(h, d, note, mood) => {
          services?.habits.setNote(h.uuid, d, { note: note || null, mood });
          setNoteFor(null);
          changed();
        }}
      />
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
