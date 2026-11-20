import { useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { PriorityStrip, PrioritySheet } from '@/features/planner/DayBar';
import { ShiftSheet, SideFabs } from '@/features/planner/SideFabs';
import { DayPager } from '@/features/planner/DayPager';
import { useDaySwipe } from '@/features/planner/useDaySwipe';
import { MonthPopup, PlannerTopbar, ViewMenu } from '@/features/planner/Topbar';
import { smartEvent, smartParse } from '@/features/planner/smart';
import { RoutineBar, routineBlocks } from '@/features/planner/DayExtras';
import { LineIcon } from '@/features/planner/PlannerIcons';

import { addDays, dayProgress, isoWeekday } from '@/features/habits/logic';
import { SearchSheet } from '@/features/planner/SearchSheet';
import { QuickAddSheet } from '@/features/planner/QuickAddSheet';
import type { Habit, HabitLog } from '@/features/habits/logic';
import type { Project } from '@/features/projects/logic';
import { PillNotices } from '@/features/planner/PillNotices';
import { EventSheet, type SheetTarget } from '@/features/planner/EventSheet';
import {
  AgendaList,
  BandEvent,
  PinchedDayGrid,
  dayTitle,
  useNowMinutes,
} from '@/features/planner/PlannerParts';
import { minutesOf } from '@/features/planner/model';
import { weekPhraseId } from '@/features/planner/phrases';
import { MonthScene } from '@/features/planner/ambient/MonthScene';
import { WeatherScene } from '@/features/planner/ambient/WeatherScene';
import { wxSceneInput } from '@/features/planner/ambient/wxScene';
import { ambientOpacity } from '@/features/planner/ambient/scene';
import { plannerTheme } from '@/features/planner/plannerTheme';
import { MonthAgenda, MonthView, WeekGrid, monthGrid } from '@/features/planner/Views';
import { isBand } from '@/features/planner/layout';
import { usePinchZoom } from '@/features/planner/usePinchZoom';
import { WxPopup } from '@/features/planner/WeatherUi';
import { useWeather } from '@/features/planner/useWeather';
import type { WxCtx } from '@/features/planner/weather';
import { ZoomDial } from '@/features/planner/ZoomDial';

const BAND = 400;
const bandOf = (y: number) => Math.floor(y / BAND) * BAND;
/** Le righe da disegnare per una pagina scesa a `band`: la finestra più un buon margine, sopra e sotto. */
const rowsAround = (band: number) => ({ from: band - 1000, to: band + 1800 });

/** Il planner: vista giorno (con le ore), settimana (un elenco per giorno) e mese (una griglia). */
export default function PlannerScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height: screenH } = useWindowDimensions();
  const {
    services,
    version,
    changed,
    uiStyle,
    plannerSettings,
    updatePlannerSettings,
    authState,
    account,
  } = useApp();
  const userId = authState?.status === 'signedIn' ? authState.user.id : 0;
  const userName = authState?.status === 'signedIn' ? authState.user.username : '';
  const pt = plannerTheme(uiStyle, th, plannerSettings.palette, plannerSettings.contrast_level);
  const today = localToday();
  const weather = useWeather();
  const [wxDate, setWxDate] = useState<string | null>(null);
  // il meteo si ricarica ogni volta che si apre il planner (al massimo ogni 10 minuti)
  const loadWeather = weather.load;
  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('day');
  const [note, setNote] = useState<SmartNote | null>(null);
  const [unclear, setUnclear] = useState(false);
  const [searching, setSearching] = useState(false);
  const [viewMenu, setViewMenu] = useState<number | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [prioOpen, setPrioOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [agendaFrom, setAgendaFrom] = useState<string | null>(null);
  const [topH, setTopH] = useState(0);
  const [barH, setBarH] = useState(0);
  // «Abitudini e progetti»: i dati si leggono solo all'apertura del foglio
  const [quick, setQuick] = useState<{
    start: string;
    habits: Habit[];
    logs: HabitLog[];
    projects: Project[];
  } | null>(null);
  const [sheet, setSheet] = useState<{ key: number; target: SheetTarget } | null>(null);
  // i progetti a cui si può collegare un evento: letti una volta per foglio aperto
  const sheetKey = sheet?.key;
  const sheetProjects = useMemo(
    () => (sheetKey === undefined ? [] : (services?.projects?.all() ?? [])),
    [sheetKey, services],
  );
  const scroller = useRef<ScrollViewInstance>(null);
  const zoom = plannerSettings.zoom;
  // la giornata scorre dentro `day-scroll`: dove sta (in cima alla finestra e quanto è scesa) e dove comincia la
  // griglia nel contenuto, per tenere fermo l'orario sotto le dita mentre si pizzica
  const scrollY = useRef(0);
  // quanto è scesa la pagina, a gradini: le righe delle ore si disegnano solo attorno alla parte visibile
  const [bandY, setBandY] = useState(0);
  const viewTop = useRef(0);
  const viewH = useRef(0);
  const gridTop = useRef(0);
  const pinch = usePinchZoom(zoom, {
    anchorAt: (pageY, ppm) => {
      const y = pageY - viewTop.current;
      const min = ppm ? (scrollY.current - gridTop.current + y) / ppm : 0;
      return { min: Math.max(0, Math.min(1439, min)), y };
    },
    restore: (a, ppm) => {
      const max = Math.max(0, gridTop.current + 1440 * ppm - viewH.current);
      const y = Math.max(0, Math.min(max, gridTop.current + a.min * ppm - a.y));
      scroller.current?.scrollTo({ y, animated: false });
    },
    save: (z) => updatePlannerSettings?.({ zoom: z }),
  });
  const { step, pinching } = pinch;
  const agendaView = step === 'agenda';

  const repo = services?.planner ?? null;
  const weekStart = useMemo(() => mondayOf(date), [date]);
  // la frase e l'affermazione della settimana: stesse del sito (si calcolano, non si salvano)
  const quote = t(`planner.fr_${weekPhraseId('quotes', weekStart, userId)}`);
  const affirmation = t(`planner.fr_${weekPhraseId('affirmations', weekStart, userId)}`);
  const pillsRepo = services?.pills ?? null;
  const week = useMemo(() => {
    const m = mondayOf(date);
    return Array.from({ length: 7 }, (_, i) => addDaysIso(m, i));
  }, [date]);

  const { events, calendars, categories, span, priorities, routines, weekNo } = useMemo(() => {
    void version;
    if (!repo) {
      return {
        events: [] as EventView[],
        calendars: [],
        categories: [],
        span: [] as EventView[],
        priorities: [] as Priority[],
        routines: [] as Routine[],
        weekNo: 1,
      };
    }
    const grid = monthGrid(date);
    const inSpan =
      mode === 'month'
        ? repo.visibleEventsInRange(grid[0]![0]!, grid[grid.length - 1]![6]!)
        : ([] as EventView[]);
    return {
      events: mode === 'day' ? repo.visibleEventsInRange(date, date) : [],
      calendars: repo.calendars(),
      categories: repo.categories(),
      span: inSpan,
      priorities: repo.priorities(date),
      routines: repo.routines(),
      weekNo: repo.weekNumber(week[0]!, plannerSettings),
    };
  }, [repo, version, date, week, mode, plannerSettings]);

  // la settimana e l'elenco del mese chiedono da sé gli eventi che servono
  const load = useCallback(
    (from: string, to: string) => (repo ? repo.visibleEventsInRange(from, to) : []),
    [repo],
  );
  // i giorni del mese che hanno qualcosa scritto nel diario (il segnalibro nella casella)
  const diaryDays = useMemo(() => {
    void version;
    const out: Record<string, boolean> = {};
    if (mode !== 'month' || !services?.diary) return out;
    for (const delta of [-1, 0, 1]) {
      const m = addMonths(date, delta).slice(0, 7);
      for (const [d, v] of Object.entries(services.diary.month(m).days))
        if (v.has_text || v.has_lists) out[d] = true;
    }
    return out;
  }, [services, version, date, mode]);

  // le pastiglie la cui ora è passata e nessuno ha risposto (solo nella vista giorno, come sul sito)
  const dueDoses = useMemo(() => {
    void version;
    return pillsRepo ? pillsRepo.due() : [];
  }, [pillsRepo, version]);

  // l'anello delle abitudini di oggi e i progetti preferiti (i due tastini sul bordo destro)
  const { ringProgress, hasFavorites } = useMemo(() => {
    void version;
    if (!services) return { ringProgress: 0, hasFavorites: false };
    const habits = services.habits?.list() ?? [];
    const logs = new Map<string, HabitLog>();
    for (const l of services.habits?.logsBetween(date, date) ?? [])
      logs.set(`${l.habit_uuid}|${l.log_date}`, l);
    return {
      ringProgress: dayProgress(habits, date, logs, today).pct,
      hasFavorites: (services.projects?.all() ?? []).some((x) => x.is_favorite),
    };
  }, [services, version, date, today]);

  // un cambio di giorno fatto strisciando tiene la pagina all'altezza a cui era (come sul sito)
  const keepScroll = useRef(false);
  const swipeY = useRef<number | null>(null);
  // la pagina vicina che diventa quella di adesso riparte dall'altezza di prima, prima che si veda
  useLayoutEffect(() => {
    if (swipeY.current === null) return;
    scroller.current?.scrollTo({ y: swipeY.current, animated: false });
    swipeY.current = null;
  }, [date]);
  useEffect(() => {
    if (keepScroll.current) {
      keepScroll.current = false;
      return;
    }
    // all'apertura: si parte un'ora prima di adesso (o dalle 6 se non è oggi)
    const d = new Date();
    const startMin =
      date === today
        ? Math.max(0, d.getHours() * 60 + d.getMinutes() - 60)
        : plannerSettings.day_start_hour * 60;
    scroller.current?.scrollTo({ y: startMin * pinch.getPpm(), animated: false });
    // solo quando cambia il giorno mostrato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const swipeHandlers = useDaySwipe((delta) =>
    setDate((d) => (mode === 'day' ? addDaysIso(d, delta) : addMonths(d, delta))),
  );
  const now = useNowMinutes(true);
  const open = useCallback(
    (ev: EventView) => setSheet({ key: Date.now(), target: { mode: 'edit', view: ev } }),
    [],
  );
  // un evento tenuto in mano e trascinato: la pagina non scorre finché non lo si lascia
  const [dragging, setDragging] = useState(false);
  const moveEvent = useCallback(
    (ev: EventView, startMin: number) => {
      if (repo?.moveTo(ev, startMin)) changed();
    },
    [repo, changed],
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
    const book = services?.book ?? null;
    const parsed = smartParse(text, { today, focusDate: date, contacts: book?.contacts() });
    if (!parsed.title) {
      setUnclear(true);
      return false;
    }
    setUnclear(false);
    const input = smartEvent(parsed, repo.eventsInRange(parsed.date, parsed.date));
    const uuid = repo.create(input);
    if (book && parsed.guests.length)
      book.setGuests(
        uuid,
        parsed.guests.map((g) => ({ email: g.email, name: g.name })),
      );
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
  const openQuick = () => {
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
  };
  // anticipi e ritardi: gli eventi del giorno che devono ancora cominciare (di un altro giorno: tutti) si spostano
  const shiftDay = (minutes: number) => {
    const from = date === today ? (now ?? 0) : 0;
    let moved = false;
    for (const e of grid) {
      const start = minutesOf(e.start);
      if (start >= from && repo.moveTo(e, start + minutes)) moved = true;
    }
    setShiftOpen(false);
    if (moved) changed();
  };
  const viewLabel = t(
    mode === 'day' ? 'planner.giorno' : mode === 'week' ? 'planner.settimana_2' : 'planner.mese',
  );
  const wxCtx: WxCtx | undefined =
    weather.wx?.enabled === true
      ? {
          wx: weather.wx,
          nowTemp: weather.wx.adesso?.temp ?? null,
          onOpen: setWxDate,
        }
      : undefined;
  // la scena racconta il tempo di *un* giorno: vale dove se ne guarda uno (non nel mese)
  const wxScene = mode === 'month' ? null : wxSceneInput(weather.wx, date, today, new Date());
  const barTop = topH + barH;
  const agendaH = Math.round(screenH * 0.58);

  // gli eventi di un giorno, divisi come per quello scelto (la pagina vicina, durante lo scorrimento, ne disegna uno suo)
  const partsOf = (d: string) => {
    if (d === date) return { events, blocks, shown, bands, grid };
    const ev = repo.visibleEventsInRange(d, d);
    const bl = routineBlocks(ev, routines);
    const shut = new Set(bl.filter((b) => b.collapsed).map((b) => b.group));
    const sh = ev.filter((e) => !(e.routineGroup && shut.has(e.routineGroup)));
    return {
      events: ev,
      blocks: bl,
      shown: sh,
      bands: sh.filter(isBand),
      grid: sh.filter((e) => !isBand(e)),
    };
  };
  const renderDay = (d: string, cur: boolean, startY: number) => {
    const dp = partsOf(d);
    return (
      <ScrollView
        ref={cur ? scroller : undefined}
        testID={cur ? 'day-scroll' : `day-scroll-${d}`}
        scrollEnabled={cur && !dragging && !pinching}
        pointerEvents={cur ? 'auto' : 'none'}
        contentOffset={cur ? undefined : { x: 0, y: startY }}
        scrollEventThrottle={16}
        onScroll={
          cur
            ? (e) => {
                const y = e.nativeEvent.contentOffset.y;
                scrollY.current = y;
                setBandY(bandOf(y));
              }
            : undefined
        }
        onLayout={
          cur
            ? (e) => {
                viewH.current = e.nativeEvent.layout.height;
                scroller.current?.measureInWindow?.((_x, y) => {
                  viewTop.current = y;
                });
              }
            : undefined
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {dp.blocks.length ? (
          <View style={{ gap: 4, paddingHorizontal: 10, paddingTop: 8 }}>
            {dp.blocks.map((b) => (
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
          </View>
        ) : null}
        {dp.bands.length && !agendaView ? (
          <View style={{ gap: 4, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 }}>
            {dp.bands.map((e) => (
              <BandEvent
                key={e.uid}
                pt={pt}
                categories={categories}
                calendars={calendars}
                ev={e}
                day={d}
                onOpen={open}
                onToggle={toggle}
              />
            ))}
          </View>
        ) : null}
        {agendaView ? (
          <AgendaList
            pt={pt}
            categories={categories}
            calendars={calendars}
            day={d}
            events={dp.shown}
            onOpen={open}
            onToggle={toggle}
          />
        ) : (
          <View onLayout={cur ? (e) => (gridTop.current = e.nativeEvent.layout.y) : undefined}>
            <PinchedDayGrid
              rows={rowsAround(cur ? bandY : bandOf(startY))}
              pinch={pinch}
              saved={zoom}
              current={cur}
              pt={pt}
              categories={categories}
              calendars={calendars}
              day={d}
              events={dp.grid}
              zoom={step}
              width={width}
              now={d === today ? now : null}
              onOpen={open}
              onToggle={toggle}
              onMove={moveEvent}
              onDragActive={setDragging}
              onEmptyTap={(minutes) => {
                const h = String(Math.floor(minutes / 60)).padStart(2, '0');
                const m = String(minutes % 60).padStart(2, '0');
                setSheet({
                  key: Date.now(),
                  target: { mode: 'new', date: d, start: `${h}:${m}` },
                });
              }}
            />
          </View>
        )}
        {!dp.events.length && !agendaView ? (
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
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: pt.page }}>
      <View style={{ display: agendaFrom ? 'none' : 'flex' }}>
        <PlannerTopbar
          pt={pt}
          inset={insets.top}
          date={date}
          today={today}
          weekNo={weekNo}
          week={week}
          view={mode}
          viewLabel={viewLabel}
          letter={(userName || '?').slice(0, 1).toUpperCase()}
          affirmation={plannerSettings.show_affirmations ? affirmation : null}
          weather={wxCtx}
          ambient={
            uiStyle === 'paper' && plannerSettings.ambient_enabled ? (
              <>
                <MonthScene
                  month={monthOf(date)}
                  opacity={ambientOpacity(plannerSettings.ambient_opacity)}
                  page={pt.page}
                  sky={!pt.dark}
                  bare={wxScene !== null}
                />
                {wxScene ? <WeatherScene input={wxScene} /> : null}
              </>
            ) : null
          }
          onHeight={setTopH}
          onViewPress={(x) => setViewMenu(x)}
          onToday={() => setDate(today)}
          onWeek={() => router.push({ pathname: '/planner-week', params: { date } })}
          onSettings={() => router.push('/planner-settings')}
          onAvatar={() => router.push('/account')}
          onSearch={() => setSearching(true)}
          onFilter={() => router.push('/planner-manage')}
          onMini={() => setMonthOpen(true)}
          monthsOpen={monthsOpen}
          onMonthName={() => setMonthsOpen((v) => !v)}
          onMonthPick={(d) => {
            const delta = yearOf(d) * 12 + monthOf(d) - (yearOf(date) * 12 + monthOf(date));
            setDate(addMonths(date, delta));
            setMonthsOpen(false);
          }}
        />
      </View>
      {mode === 'day' ? (
        <View
          testID="day-bar"
          onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
          style={{ paddingHorizontal: 12, paddingBottom: 6, backgroundColor: pt.page }}
        >
          <SmartBar pt={pt} onSubmit={smartSubmit} />
          {unclear ? (
            <Text
              testID="smart-unclear"
              style={{ color: pt.ink2, fontSize: 12, textAlign: 'center', marginTop: 4 }}
            >
              {t('planner.non_ho_capito_cosa_scrivere')}
            </Text>
          ) : null}
          <PriorityStrip
            pt={pt}
            items={priorities}
            onToggle={(pos, text, done) => {
              repo.setPriority(date, pos, text, done);
              changed();
            }}
            onOpen={() => setPrioOpen(true)}
            onLists={() => router.push({ pathname: '/planner-week', params: { date } })}
          />
        </View>
      ) : null}

      <View
        style={{
          flex: 1,
          marginBottom: agendaFrom ? agendaH : 0,
          paddingTop: agendaFrom ? insets.top + 6 : 0,
        }}
        {...(mode === 'month' ? swipeHandlers : {})}
      >
        {mode === 'week' ? (
          <WeekGrid
            pt={pt}
            categories={categories}
            calendars={calendars}
            date={date}
            today={today}
            version={version}
            now={now}
            load={load}
            bottomPad={60}
            weather={wxCtx}
            onFocus={setDate}
            onPickDay={(d) => {
              setDate(d);
              setMode('day');
            }}
            onOpen={open}
            onCreate={(d, startMin) => {
              const h = String(Math.floor(startMin / 60)).padStart(2, '0');
              const m = String(startMin % 60).padStart(2, '0');
              setSheet({ key: Date.now(), target: { mode: 'new', date: d, start: `${h}:${m}` } });
            }}
          />
        ) : mode === 'month' ? (
          <MonthView
            pt={pt}
            categories={categories}
            calendars={calendars}
            month={date}
            events={span}
            today={today}
            diary={diaryDays}
            bottomPad={agendaFrom ? 6 : 96}
            pullHidden={!!agendaFrom}
            onPickDay={(d) => {
              if (agendaFrom) {
                setAgendaFrom(null);
                return;
              }
              setDate(d);
              setMode('day');
            }}
            onOpenDiary={(d) => router.push({ pathname: '/diary', params: { data: d } })}
            onPull={() => {
              const first = `${date.slice(0, 7)}-01`;
              setAgendaFrom(today.slice(0, 7) === date.slice(0, 7) ? today : first);
            }}
          />
        ) : (
          <DayPager
            date={date}
            width={width}
            enabled={!dragging && !pinching && !agendaFrom}
            panHandlers={pinch.panHandlers}
            scrollY={() => scrollY.current}
            onStep={(delta, y) => {
              keepScroll.current = true;
              swipeY.current = y;
              setDate((d) => addDaysIso(d, delta));
            }}
            render={renderDay}
          />
        )}
      </View>

      {plannerSettings.show_motivational && mode !== 'month' ? (
        <Text
          testID="week-quote"
          numberOfLines={3}
          style={{
            color: pt.ink2,
            fontSize: 14,
            lineHeight: 19,
            fontStyle: pt.style === 'standard' ? 'normal' : 'italic',
            fontFamily: pt.serif,
            textAlign: 'center',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderTopWidth: 0.5,
            borderTopColor: pt.hair,
            backgroundColor: pt.page,
          }}
        >
          {quote}
        </Text>
      ) : null}

      {mode === 'day' && (pinching || agendaView) ? (
        <ZoomDial
          pt={pt}
          step={step}
          top={barTop + 6}
          right={56}
          onPick={(z) =>
            pinch.choose(z, {
              min: Math.max(
                0,
                Math.min(
                  1439,
                  pinch.getPpm()
                    ? (scrollY.current - gridTop.current + viewH.current / 2) / pinch.getPpm()
                    : 540,
                ),
              ),
              y: viewH.current / 2,
            })
          }
        />
      ) : null}

      {mode === 'day' ? (
        <SideFabs
          pt={pt}
          top={barTop + 6}
          open={plannerSettings.fabs_open}
          progress={ringProgress}
          hasFavorites={hasFavorites}
          shiftOn={shiftOpen}
          onToggle={() => updatePlannerSettings?.({ fabs_open: !plannerSettings.fabs_open })}
          onRing={openQuick}
          onRoutine={() => router.push({ pathname: '/planner-routines', params: { date } })}
          onCategory={() => router.push('/planner-manage')}
          onFavorites={openQuick}
          onShift={() => setShiftOpen(true)}
        />
      ) : null}

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
        style={({ pressed }) => ({
          position: 'absolute',
          right: 14,
          bottom: mode === 'month' ? 14 : 54,
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: pt.accent,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow:
            pt.style === 'paper'
              ? '0 6px 18px rgba(76,70,63,.22)'
              : `0 6px 20px ${pt.dark ? 'rgba(10,132,255,.45)' : 'rgba(0,122,255,.38)'}`,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <LineIcon name="plus" color={pt.onAccent} size={26} />
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
          onAnswerAll={(uuids) => {
            pillsRepo?.markAll(uuids, 'on_time');
            changed();
          }}
          onReview={() => router.navigate('/pills')}
        />
      ) : null}

      {mode === 'month' && agendaFrom ? (
        <MonthAgenda
          pt={pt}
          categories={categories}
          calendars={calendars}
          from={agendaFrom}
          today={today}
          version={version}
          height={agendaH}
          load={load}
          onOpen={open}
          onGoDay={(d) => {
            setAgendaFrom(null);
            setDate(d);
            setMode('day');
          }}
          onClose={() => setAgendaFrom(null)}
        />
      ) : null}

      <SmartReport pt={pt} note={note} onHide={() => setNote(null)} />

      {viewMenu !== null ? (
        <ViewMenu
          pt={pt}
          left={viewMenu}
          top={insets.top + 47}
          view={mode}
          onPick={(v) => {
            setMode(v);
            setViewMenu(null);
            setMonthsOpen(false);
            setAgendaFrom(null);
          }}
          onClose={() => setViewMenu(null)}
        />
      ) : null}
      {monthOpen ? (
        <MonthPopup
          pt={pt}
          top={topH + 6}
          date={date}
          today={today}
          onPick={(d) => {
            setDate(d);
            setMonthOpen(false);
          }}
          onMonth={(delta) => setDate(addMonths(date, delta))}
          onClose={() => setMonthOpen(false)}
        />
      ) : null}
      {prioOpen ? (
        <PrioritySheet
          pt={pt}
          date={date}
          items={priorities}
          onSave={(pos, text, done) => {
            repo.setPriority(date, pos, text, done);
            changed();
          }}
          onClose={() => setPrioOpen(false)}
        />
      ) : null}
      {shiftOpen ? (
        <ShiftSheet pt={pt} events={grid} onApply={shiftDay} onClose={() => setShiftOpen(false)} />
      ) : null}

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

      {wxDate && weather.wx?.enabled ? (
        <WxPopup
          pt={pt}
          wx={weather.wx}
          date={wxDate}
          today={today}
          title={(d) => dayTitle(t, d)}
          onDate={setWxDate}
          places={weather.places}
          onPreview={(pl) => weather.preview(pl.lat, pl.lon, pl.nome)}
          onOff={() => {
            setWxDate(null);
            void weather.disable();
          }}
          onClose={() => setWxDate(null)}
        />
      ) : null}

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
              () => scroller.current?.scrollTo({ y: startMin * pinch.getPpm(), animated: true }),
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
          book={services?.book}
          places={account}
          lang={i18n.language}
          calendars={calendars}
          categories={categories}
          projects={sheetProjects}
          onCreateProject={(name) => {
            const id = services?.projects.create({ name }) ?? null;
            if (id) changed();
            return id;
          }}
          target={sheet.target}
          onClose={() => setSheet(null)}
          onChanged={changed}
        />
      ) : null}
    </View>
  );
}
