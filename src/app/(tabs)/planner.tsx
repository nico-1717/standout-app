import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  const { width } = useWindowDimensions();
  const { services, version, changed, uiStyle } = useApp();
  const pt = plannerTheme(uiStyle, th);
  const today = localToday();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('day');
  const [sheet, setSheet] = useState<{ key: number; target: SheetTarget } | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const zoom = 'm30' as const;

  const repo = services?.planner ?? null;
  const week = useMemo(() => {
    const m = mondayOf(date);
    return Array.from({ length: 7 }, (_, i) => addDaysIso(m, i));
  }, [date]);

  const { events, busy, calendars, categories, span } = useMemo(() => {
    void version;
    if (!repo) {
      return {
        events: [] as EventView[],
        busy: new Set<string>(),
        calendars: [],
        categories: [],
        span: [] as EventView[],
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
    };
  }, [repo, version, date, week, mode]);

  useEffect(() => {
    // all'apertura: si parte un'ora prima di adesso (o dalle 6 se non è oggi)
    const d = new Date();
    const startMin = date === today ? Math.max(0, d.getHours() * 60 + d.getMinutes() - 60) : 6 * 60;
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
  const bands = events.filter(isBand);
  const grid = events.filter((e) => !isBand(e));
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
