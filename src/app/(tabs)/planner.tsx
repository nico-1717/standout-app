import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { localToday } from '@/features/tasks/groups';
import { addDaysIso, addMonths, mondayOf, monthOf, yearOf } from '@/features/planner/dates';
import type { EventView } from '@/features/planner/events';
import type { Priority, Routine } from '@/features/planner/repo';
import { SmartBar, SmartReport, type SmartNote } from '@/features/planner/SmartBar';
import { smartEvent, smartParse } from '@/features/planner/smart';
import { PrioritiesCard, RoutineBar, routineBlocks } from '@/features/planner/DayExtras';
import Svg, { Circle, Path } from 'react-native-svg';

import { addDays, isoWeekday } from '@/features/habits/logic';
import { SearchSheet } from '@/features/planner/SearchSheet';
import { QuickAddSheet } from '@/features/planner/QuickAddSheet';
import type { Habit, HabitLog } from '@/features/habits/logic';
import type { Project } from '@/features/projects/logic';
import { PillNotices } from '@/features/planner/PillNotices';
import { EventSheet, type SheetTarget } from '@/features/planner/EventSheet';
import {
  BandEvent,
  DayGrid,
  WeekStrip,
  dayTitle,
  useNowMinutes,
} from '@/features/planner/PlannerParts';
import { plannerTheme } from '@/features/planner/plannerTheme';
import { MonthView, WeekView, monthGrid } from '@/features/planner/Views';
import { isBand, pxPerMinute } from '@/features/planner/layout';

/** Il planner: vista giorno (con le ore), settimana (un elenco per giorno) e mese (una griglia). */
export default function PlannerScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { services, version, changed, uiStyle, plannerSettings } = useApp();
  const pt = plannerTheme(uiStyle, th, plannerSettings.palette, plannerSettings.contrast_level);
  const today = localToday();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('day');
  const [note, setNote] = useState<SmartNote | null>(null);
  const [unclear, setUnclear] = useState(false);
  const [searching, setSearching] = useState(false);
  // «Abitudini e progetti»: i dati si leggono solo all'apertura del foglio
  const [quick, setQuick] = useState<{
    start: string;
    habits: Habit[];
    logs: HabitLog[];
    projects: Project[];
  } | null>(null);
  const [sheet, setSheet] = useState<{ key: number; target: SheetTarget } | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const zoom = plannerSettings.zoom;

  const repo = services?.planner ?? null;
  const pillsRepo = services?.pills ?? null;
  const week = useMemo(() => {
    const m = mondayOf(date);
    return Array.from({ length: 7 }, (_, i) => addDaysIso(m, i));
  }, [date]);

  const { events, busy, calendars, categories, span, priorities, routines, weekNo } =
    useMemo(() => {
      void version;
      if (!repo) {
        return {
          events: [] as EventView[],
          busy: new Set<string>(),
          calendars: [],
          categories: [],
          span: [] as EventView[],
          priorities: [] as Priority[],
          routines: [] as Routine[],
          weekNo: 1,
        };
      }
      const grid = monthGrid(date);
      const from = mode === 'month' ? grid[0]![0]! : week[0]!;
      const to = mode === 'month' ? grid[grid.length - 1]![6]! : week[6]!;
      const inSpan = repo.visibleEventsInRange(from, to);
      const days = new Set<string>();
      for (const e of inSpan)
        for (let d = e.date; d <= e.endDate && d <= to; d = addDaysIso(d, 1)) days.add(d);
      return {
        events: mode === 'day' ? repo.visibleEventsInRange(date, date) : [],
        busy: days,
        calendars: repo.calendars(),
        categories: repo.categories(),
        span: inSpan,
        priorities: repo.priorities(date),
        routines: repo.routines(),
        weekNo: repo.weekNumber(week[0]!, plannerSettings),
      };
    }, [repo, version, date, week, mode, plannerSettings]);

  // le pastiglie la cui ora è passata e nessuno ha risposto (solo nella vista giorno, come sul sito)
  const dueDoses = useMemo(() => {
    void version;
    return pillsRepo ? pillsRepo.due() : [];
  }, [pillsRepo, version]);

  useEffect(() => {
    // all'apertura: si parte un'ora prima di adesso (o dalle 6 se non è oggi)
    const d = new Date();
    const startMin =
      date === today
        ? Math.max(0, d.getHours() * 60 + d.getMinutes() - 60)
        : plannerSettings.day_start_hour * 60;
    scroller.current?.scrollTo({ y: startMin * pxPerMinute(zoom), animated: false });
    // solo quando cambia il giorno mostrato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const now = useNowMinutes(date === today);
  const open = useCallback(
    (ev: EventView) => setSheet({ key: Date.now(), target: { mode: 'edit', view: ev } }),
    [],
  );
  const toggle = useCallback(
    (ev: EventView) => {
      repo?.toggleDone(ev);
      changed();
    },
    [repo, changed],
  );

  if (!repo) return null;
  const smartSubmit = (text: string): boolean => {
    const parsed = smartParse(text, { today, focusDate: date });
    if (!parsed.title) {
      setUnclear(true);
      return false;
    }
    setUnclear(false);
    const input = smartEvent(parsed, repo.eventsInRange(parsed.date, parsed.date));
    const uuid = repo.create(input);
    changed();
    setMode('day');
    setDate(parsed.date);
    const d = new Date(`${parsed.date}T12:00:00Z`);
    setNote({
      key: Date.now(),
      parsed,
      start: input.start ?? '',
      end: input.end ?? '',
      when: `${dayTitle(t, parsed.date)} ${d.getUTCDate()} ${t(`planner.mese_${d.getUTCMonth() + 1}`).toLowerCase()}`,
      onOpen: () => {
        const view = repo.eventsInRange(parsed.date, parsed.date).find((v) => v.uuid === uuid);
        if (view) open(view);
      },
    });
    return true;
  };
  const blocks = routineBlocks(events, routines);
  const closed = new Set(blocks.filter((b) => b.collapsed).map((b) => b.group));
  const shown = events.filter((e) => !(e.routineGroup && closed.has(e.routineGroup)));
  const bands = shown.filter(isBand);
  const grid = shown.filter((e) => !isBand(e));
  const step = (delta: number) =>
    setDate(
      mode === 'day'
        ? addDaysIso(date, delta)
        : mode === 'week'
          ? addDaysIso(date, 7 * delta)
          : addMonths(date, delta),
    );
  const arrow = (label: string, delta: number, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => step(delta)}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: pt.ink2, fontSize: 26 }}>{delta < 0 ? '‹' : '›'}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: pt.page }}>
      <View
        style={{
          paddingTop: insets.top + 6,
          backgroundColor: pt.page,
          borderBottomWidth: 0.5,
          borderBottomColor: pt.hair,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
          {arrow(t('planner.giorno_precedente'), -1, 'day-prev')}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              testID="day-title"
              numberOfLines={1}
              style={{
                color: pt.ink,
                fontSize: 24,
                fontFamily: pt.serif,
                fontWeight: pt.style === 'standard' ? '700' : '400',
              }}
            >
              {mode === 'month' ? t(`planner.mese_${monthOf(date)}`) : dayTitle(t, date)}
            </Text>
            <Text style={{ color: pt.ink3, fontSize: 11, letterSpacing: 1.6, fontFamily: pt.sans }}>
              {mode === 'month'
                ? yearOf(date)
                : `${t(`planner.mese_${monthOf(date)}`).toUpperCase()} ${yearOf(date)}`}
            </Text>
          </View>
          {arrow(t('planner.giorno_successivo'), 1, 'day-next')}
          <Pressable
            testID="planner-week"
            accessibilityRole="button"
            accessibilityLabel={t('planner.la_settimana')}
            onPress={() => router.push({ pathname: '/planner-week', params: { date } })}
            style={{ minWidth: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: pt.ink3, fontSize: 9, letterSpacing: 1, fontFamily: pt.sans }}>
              {t('planner.settimana_breve').toUpperCase()}
            </Text>
            <Text
              testID="week-number"
              style={{ color: pt.accentInk, fontSize: 17, fontFamily: pt.serif }}
            >
              {weekNo}
            </Text>
          </Pressable>
          <Pressable
            testID="planner-search"
            accessibilityRole="button"
            accessibilityLabel={t('planner.cerca')}
            onPress={() => setSearching(true)}
            style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={10.5} cy={10.5} r={6.5} stroke={pt.ink2} strokeWidth={2} />
              <Path d="M15.5 15.5L20 20" stroke={pt.ink2} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <Pressable
            testID="planner-manage"
            accessibilityRole="button"
            accessibilityLabel={`${t('planner.calendari')} · ${t('planner.categorie')}`}
            onPress={() => router.push('/planner-manage')}
            style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: pt.ink2, fontSize: 20 }}>☰</Text>
          </Pressable>
          <Pressable
            testID="planner-settings"
            accessibilityRole="button"
            accessibilityLabel={t('planner.impostazioni')}
            onPress={() => router.push('/planner-settings')}
            style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: pt.ink2, fontSize: 20 }}>⚙</Text>
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignSelf: 'center',
            gap: 4,
            marginBottom: 6,
            padding: 3,
            borderRadius: 999,
            backgroundColor: pt.accentSoft,
          }}
        >
          {(['day', 'week', 'month'] as const).map((m) => (
            <Pressable
              key={m}
              testID={`mode-${m}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === m }}
              onPress={() => setMode(m)}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: mode === m ? pt.accent : 'transparent',
              }}
            >
              <Text
                style={{
                  color: mode === m ? pt.onAccent : pt.accentInk,
                  fontSize: 12.5,
                  fontFamily: pt.sans,
                }}
              >
                {t(
                  m === 'day'
                    ? 'planner.giorno'
                    : m === 'week'
                      ? 'planner.settimana'
                      : 'planner.mese',
                )}
              </Text>
            </Pressable>
          ))}
        </View>
        <SmartBar pt={pt} onSubmit={smartSubmit} />
        {unclear ? (
          <Text
            testID="smart-unclear"
            style={{ color: pt.ink2, fontSize: 12, textAlign: 'center', marginBottom: 6 }}
          >
            {t('planner.non_ho_capito_cosa_scrivere')}
          </Text>
        ) : null}
        {mode === 'day' ? (
          <WeekStrip
            pt={pt}
            days={week}
            selected={date}
            today={today}
            busy={busy}
            onPick={setDate}
          />
        ) : null}
        {date !== today ? (
          <Pressable
            testID="day-today"
            accessibilityRole="button"
            onPress={() => setDate(today)}
            style={{
              alignSelf: 'center',
              paddingVertical: 5,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: pt.accentSoft,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: pt.accentInk, fontSize: 12, fontFamily: pt.sans }}>
              {t('planner.vai_a_oggi')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {mode !== 'day' ? (
        <ScrollView testID="span-scroll" contentContainerStyle={{ paddingBottom: 120 }}>
          {mode === 'week' ? (
            <WeekView
              pt={pt}
              categories={categories}
              calendars={calendars}
              days={week}
              events={span}
              today={today}
              onPickDay={(d) => {
                setDate(d);
                setMode('day');
              }}
              onOpen={open}
              onToggle={toggle}
            />
          ) : (
            <MonthView
              pt={pt}
              categories={categories}
              calendars={calendars}
              month={date}
              events={span}
              today={today}
              onPickDay={(d) => {
                setDate(d);
                setMode('day');
              }}
            />
          )}
        </ScrollView>
      ) : (
        <ScrollView
          ref={scroller}
          testID="day-scroll"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <PrioritiesCard
            pt={pt}
            date={date}
            items={priorities}
            onSave={(pos, text, done) => {
              repo.setPriority(date, pos, text, done);
              changed();
            }}
          />
          <View style={{ gap: 4, paddingHorizontal: 10, paddingTop: 8 }}>
            {blocks.map((b) => (
              <RoutineBar
                key={b.group}
                pt={pt}
                block={b}
                onToggle={(x) => {
                  repo.setRoutineCollapsed(x.group, !x.collapsed);
                  changed();
                }}
                onDelete={() =>
                  Alert.alert(
                    t('planner.elimino_tutta_la_routine'),
                    t('planner.tutti_i_passaggi_di_questo'),
                    [
                      { text: t('comune.annulla'), style: 'cancel' },
                      {
                        text: t('planner.elimina'),
                        style: 'destructive',
                        onPress: () => {
                          repo.removeRoutineBlock(b.group);
                          changed();
                        },
                      },
                    ],
                  )
                }
              />
            ))}
            <Pressable
              testID="open-quick"
              accessibilityRole="button"
              onPress={() => {
                if (!services) return;
                const now = new Date();
                const next = Math.min(
                  23 * 60 + 30,
                  Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30,
                );
                const start =
                  date === today
                    ? `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
                    : '09:00';
                const monday = addDays(date, -(isoWeekday(date) - 1));
                setQuick({
                  start,
                  habits: services.habits.list(),
                  logs: services.habits.logsBetween(monday, addDays(monday, 6)),
                  projects: services.projects.all(),
                });
              }}
              style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
            >
              <Text style={{ color: pt.accentInk, fontSize: 13, fontFamily: pt.sans }}>
                {t('planner.app_aggiungi_rapido')} ›
              </Text>
            </Pressable>
            <Pressable
              testID="open-routines"
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/planner-routines', params: { date } })}
              style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
            >
              <Text style={{ color: pt.accentInk, fontSize: 13, fontFamily: pt.sans }}>
                {t('planner.routine')} ›
              </Text>
            </Pressable>
          </View>
          {bands.length ? (
            <View style={{ gap: 4, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 }}>
              {bands.map((e) => (
                <BandEvent
                  key={e.uid}
                  pt={pt}
                  categories={categories}
                  calendars={calendars}
                  ev={e}
                  day={date}
                  onOpen={open}
                  onToggle={toggle}
                />
              ))}
            </View>
          ) : null}
          <DayGrid
            pt={pt}
            categories={categories}
            calendars={calendars}
            day={date}
            events={grid}
            zoom={zoom}
            width={width}
            now={now}
            onOpen={open}
            onToggle={toggle}
            onEmptyTap={(minutes) => {
              const h = String(Math.floor(minutes / 60)).padStart(2, '0');
              const m = String(minutes % 60).padStart(2, '0');
              setSheet({ key: Date.now(), target: { mode: 'new', date, start: `${h}:${m}` } });
            }}
          />
          {!events.length ? (
            <Text
              testID="day-empty"
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 160,
                alignSelf: 'center',
                color: pt.ink3,
                fontSize: 14,
                fontFamily: pt.sans,
              }}
            >
              {t('planner.questo_giorno_e_vuoto')}
            </Text>
          ) : null}
        </ScrollView>
      )}

      <Pressable
        testID="planner-add"
        accessibilityRole="button"
        accessibilityLabel={t('planner.nuovo_evento')}
        onPress={() => {
          const d = new Date();
          const start =
            date === today
              ? `${String(Math.min(23, d.getHours() + (d.getMinutes() > 30 ? 1 : 0))).padStart(2, '0')}:${d.getMinutes() > 0 && d.getMinutes() <= 30 ? '30' : '00'}`
              : '09:00';
          setSheet({ key: Date.now(), target: { mode: 'new', date, start } });
        }}
        style={{
          position: 'absolute',
          right: 18,
          bottom: 18,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: pt.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        }}
      >
        <Text style={{ color: pt.onAccent, fontSize: 30, lineHeight: 32 }}>+</Text>
      </Pressable>

      {mode === 'day' ? (
        <PillNotices
          doses={dueDoses}
          today={today}
          pt={pt}
          bottom={18}
          onAnswer={(uuid, status) => {
            pillsRepo?.setStatus(uuid, status);
            changed();
          }}
        />
      ) : null}

      <SmartReport pt={pt} note={note} onHide={() => setNote(null)} />

      <QuickAddSheet
        visible={quick !== null}
        pt={pt}
        date={date}
        habits={quick?.habits ?? []}
        logs={quick?.logs ?? []}
        projects={quick?.projects ?? []}
        defaultStart={quick?.start ?? '09:00'}
        onClose={() => setQuick(null)}
        onPlace={(item, start, minutes) => {
          repo.placeLinked(item, date, start, minutes);
          setQuick(null);
          changed();
        }}
      />

      <SearchSheet
        visible={searching}
        repo={repo}
        pt={pt}
        today={today}
        categories={categories}
        onClose={() => setSearching(false)}
        onPick={(d, start) => {
          setSearching(false);
          setMode('day');
          setDate(d);
          // se l'evento ha un'ora, la griglia scorre fin lì (un'ora prima, come sul sito)
          if (start) {
            const [hh, mm] = start.split(':').map(Number);
            const startMin = Math.max(0, hh! * 60 + mm! - 60);
            setTimeout(
              () => scroller.current?.scrollTo({ y: startMin * pxPerMinute(zoom), animated: true }),
              320,
            );
          }
        }}
      />
      {sheet ? (
        <EventSheet
          key={sheet.key}
          pt={pt}
          repo={repo}
          calendars={calendars}
          categories={categories}
          target={sheet.target}
          onClose={() => setSheet(null)}
          onChanged={changed}
        />
      ) : null}
    </View>
  );
}
