import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { mix } from '@/features/buy/buyTheme';

import { addDaysIso, dayOfMonth, monthOf, monthStart, mondayOf, weekdayOf } from './dates';
import type { EventView } from './events';
import { minutesOf } from './model';
import { LineIcon } from './PlannerIcons';
import { eventColor, type PlannerTheme } from './plannerTheme';
import type { Calendar, Category } from './repo';
import { isBand } from './layout';
import type { WxCtx } from './weather';
import { WxTag } from './WeatherUi';

interface Look {
  pt: PlannerTheme;
  categories: Category[];
  calendars: Calendar[];
}

const DAY_MS = 86_400_000;
/** Giorni da `a` a `b` (b dopo a = positivo). */
const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** Gli eventi che toccano un giorno (anche quelli che cominciano prima e finiscono dopo). */
export function eventsOn(events: EventView[], day: string): EventView[] {
  return events.filter((e) => e.date <= day && e.endDate >= day);
}

const WEIGHT: Record<string, number> = { highest: 0, high: 1, normal: 2, low: 3 };
const weightOf = (e: EventView) => WEIGHT[e.importance] ?? 2;

/* ------------------------------------------------------------------ */
/* Settimana: sette giorni in colonna e le ore in riga (.pl-wkview)    */
/* ------------------------------------------------------------------ */
const COLS = 21; // quanti giorni disegnati in tutto
const BEFORE = 7; // e quanti prima del giorno scelto
const VISIBLE = 7;
const GUTTER = 34;
const HEAD_H = 41;
const ROW = 44;
const CHIP_PITCH = 12;

/**
 * La settimana come tabella, come sul sito: una finestra di 21 giorni, il giorno scelto a sinistra, si scorre di giorno
 * in giorno con l'aggancio; intestazioni e colonna delle ore restano ferme. Un tocco su una casella crea un evento a
 * quell'ora, uno su un giorno apre quel giorno.
 */
export function WeekGrid(
  p: Look & {
    date: string;
    today: string;
    version: number;
    now: number | null;
    load: (from: string, to: string) => EventView[];
    bottomPad: number;
    onFocus: (d: string) => void;
    onPickDay: (d: string) => void;
    onOpen: (ev: EventView) => void;
    onCreate: (date: string, startMin: number) => void;
    weather?: WxCtx;
  },
) {
  const { t } = useTranslation();
  const { pt } = p;
  const { width } = useWindowDimensions();
  const colW = (width - GUTTER) / VISIBLE;
  const [start, setStart] = useState(() => addDaysIso(p.date, -BEFORE));
  const [seen, setSeen] = useState(p.date);
  const [boxH, setBoxH] = useState(0);
  if (p.date !== seen) {
    setSeen(p.date);
    const i = diffDays(start, p.date);
    // vicino a un bordo la finestra si rifà intorno al giorno nuovo, così lo scorrimento non finisce mai
    if (i < 3 || i > COLS - VISIBLE - 3) setStart(addDaysIso(p.date, -BEFORE));
  }
  const idx = diffDays(start, p.date);
  const scroller = useRef<ScrollViewInstance>(null);
  const gutter = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ x: idx * colW, animated: false });
  }, [idx, colW]);

  const days = useMemo(() => Array.from({ length: COLS }, (_, i) => addDaysIso(start, i)), [start]);
  const { load, version } = p;
  const events = useMemo(() => {
    void version;
    return load(start, addDaysIso(start, COLS - 1));
  }, [load, version, start]);

  const { bands, byHour, adH } = useMemo(() => {
    const bands = new Map<string, EventView[]>();
    const byHour = new Map<string, EventView[]>();
    let most = 0;
    for (const d of days) {
      const day = eventsOn(events, d);
      const band = day.filter(isBand);
      bands.set(d, band);
      most = Math.max(most, band.length);
      for (const e of day) {
        if (isBand(e) || e.date !== d) continue;
        const key = `${d}|${Math.floor(minutesOf(e.start) / 60)}`;
        byHour.set(key, [...(byHour.get(key) ?? []), e]);
      }
    }
    for (const list of byHour.values())
      list.sort(
        (a, b) =>
          weightOf(a) - weightOf(b) ||
          minutesOf(b.end) - minutesOf(b.start) - (minutesOf(a.end) - minutesOf(a.start)),
      );
    return { bands, byHour, adH: most ? Math.min(3, most) * 15 + 6 : 0 };
  }, [days, events]);

  const colorOf = (e: EventView) =>
    eventColor(
      pt,
      e,
      p.categories.find((c) => c.uuid === e.categoryUuid),
    );
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(
      0,
      Math.min(COLS - VISIBLE, Math.round(e.nativeEvent.contentOffset.x / colW)),
    );
    const next = addDaysIso(start, i);
    if (next !== p.date) p.onFocus(next);
  };
  const posti = Math.max(1, Math.floor((ROW - 2) / 13));
  const width21 = COLS * colW;
  const todayIdx = diffDays(start, p.today);
  const bodyH = 24 * ROW + 18 + p.bottomPad;

  return (
    <View
      testID="week-view"
      style={{ flex: 1, backgroundColor: pt.page, flexDirection: 'row', paddingTop: 4 }}
    >
      <View style={{ width: GUTTER }}>
        <View
          style={{
            height: HEAD_H + adH,
            justifyContent: 'flex-end',
            borderBottomWidth: 0.5,
            borderBottomColor: pt.hair,
          }}
        >
          {adH ? (
            <View
              style={{
                height: adH,
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingRight: 5,
                backgroundColor: pt.card,
              }}
            >
              <Text
                style={{ color: pt.ink3, fontSize: 8, letterSpacing: 0.8, fontFamily: pt.sans }}
              >
                gg
              </Text>
            </View>
          ) : null}
        </View>
        <ScrollView
          ref={gutter}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ height: bodyH }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <View
              key={h}
              style={{
                height: ROW,
                alignItems: 'center',
                paddingTop: 2,
                borderTopWidth: 0.5,
                borderTopColor: pt.hair,
                overflow: 'hidden',
              }}
            >
              <Text
                style={{
                  color: pt.ink3,
                  fontSize: 9,
                  lineHeight: 10,
                  fontVariant: ['tabular-nums'],
                  fontFamily: pt.sans,
                }}
              >
                {String(h).padStart(2, '0')}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={scroller}
        testID="week-scroll"
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={colW}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentOffset={{ x: idx * colW, y: 0 }}
        onLayout={(e) => setBoxH(e.nativeEvent.layout.height)}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e);
        }}
        style={{ flex: 1 }}
      >
        <View style={{ width: width21, height: boxH || undefined }}>
          <View
            style={{
              height: HEAD_H,
              flexDirection: 'row',
              borderBottomWidth: adH ? 0 : 0.5,
              borderBottomColor: pt.hair,
            }}
          >
            {days.map((d) => {
              const isToday = d === p.today;
              const first = bands.get(d)?.[0];
              return (
                <Pressable
                  key={d}
                  testID={`week-head-${d}`}
                  accessibilityRole="button"
                  onPress={() => p.onPickDay(d)}
                  style={{
                    width: colW,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    borderLeftWidth: 0.5,
                    borderLeftColor: pt.hair,
                    backgroundColor: isToday ? pt.accentWash : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: pt.ink3,
                      fontSize: 8,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      fontFamily: pt.sans,
                    }}
                  >
                    {t(`planner.gg_${weekdayOf(d)}`).slice(0, 3)}
                  </Text>
                  <Text
                    style={{
                      color: isToday ? pt.accentInk : pt.ink,
                      fontSize: 15,
                      fontWeight: isToday ? '600' : '400',
                      fontVariant: ['tabular-nums'],
                      fontFamily: pt.sans,
                    }}
                  >
                    {dayOfMonth(d)}
                  </Text>
                  {p.weather?.wx.giorni[d] ? (
                    <WxTag
                      pt={pt}
                      date={d}
                      day={p.weather.wx.giorni[d]}
                      today={d === p.today}
                      nowTemp={p.weather.nowTemp}
                      single={false}
                      onPress={p.weather.onOpen}
                    />
                  ) : null}
                  {first ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: colorOf(first),
                      }}
                    />
                  ) : null}
                  {d === p.date ? (
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 2.5,
                        backgroundColor: pt.ink2,
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {adH ? (
            <View
              style={{
                height: adH,
                flexDirection: 'row',
                backgroundColor: pt.card,
                borderBottomWidth: 0.5,
                borderBottomColor: pt.hair2,
              }}
            >
              {days.map((d) => {
                const list = bands.get(d) ?? [];
                const isToday = d === p.today;
                return (
                  <View
                    key={d}
                    style={{
                      width: colW,
                      padding: 1,
                      gap: 1,
                      overflow: 'hidden',
                      borderLeftWidth: 0.5,
                      borderLeftColor: pt.hair,
                      backgroundColor: isToday ? pt.accentWash : d === p.date ? pt.page : pt.paper2,
                    }}
                  >
                    {list.slice(0, 3).map((e) => (
                      <Pressable
                        key={e.uid}
                        accessibilityRole="button"
                        onPress={() => p.onOpen(e)}
                        style={{
                          height: 14,
                          borderRadius: 3,
                          paddingHorizontal: 2,
                          backgroundColor: colorOf(e),
                          opacity: e.done ? 0.5 : 1,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: pt.ink,
                            fontSize: 8.5,
                            lineHeight: 14,
                            fontStyle: 'italic',
                            fontFamily: pt.sans,
                            textDecorationLine: e.done ? 'line-through' : 'none',
                          }}
                        >
                          {e.title || t('planner.senza_titolo_l')}
                        </Text>
                      </Pressable>
                    ))}
                    {list.length > 3 ? (
                      <Text style={{ color: pt.ink3, fontSize: 8.5, textAlign: 'center' }}>
                        +{list.length - 3}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <ScrollView
            testID="week-vscroll"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) =>
              gutter.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false })
            }
            style={{ flex: 1 }}
            contentContainerStyle={{ width: width21, height: bodyH }}
          >
            {days.map((d, i) => {
              const isToday = d === p.today;
              const chosen = d === p.date;
              return (
                <Pressable
                  key={d}
                  testID={`week-col-${d}`}
                  accessibilityRole="button"
                  onPress={(e) => {
                    const y = e?.nativeEvent?.locationY ?? 0;
                    p.onCreate(d, Math.max(0, Math.min(23, Math.floor(y / ROW))) * 60);
                  }}
                  style={{
                    position: 'absolute',
                    left: i * colW,
                    width: colW,
                    top: 0,
                    height: 24 * ROW,
                    borderLeftWidth: 0.5,
                    borderLeftColor: pt.hair,
                    backgroundColor:
                      isToday && chosen
                        ? pt.accentSoft
                        : isToday
                          ? pt.accentWash
                          : chosen
                            ? pt.paper2
                            : 'transparent',
                  }}
                />
              );
            })}
            {Array.from({ length: 24 }, (_, h) => (
              <View
                key={h}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  width: width21,
                  top: h * ROW,
                  height: 0.5,
                  backgroundColor: pt.hair,
                }}
              />
            ))}
            {days.map((d, i) =>
              Array.from({ length: 24 }, (_, h) => {
                const list = byHour.get(`${d}|${h}`);
                if (!list) return null;
                const shown = list.length > posti ? list.slice(0, posti - 1) : list;
                const more = list.length - shown.length;
                return (
                  <View
                    key={`${d}-${h}`}
                    style={{
                      position: 'absolute',
                      left: i * colW + 1,
                      width: colW - 1,
                      top: h * ROW + 1,
                      gap: 1,
                      paddingRight: 1,
                    }}
                  >
                    {shown.map((e) => (
                      <Pressable
                        key={e.uid}
                        testID={`week-ev-${e.uid}`}
                        accessibilityRole="button"
                        onPress={() => p.onOpen(e)}
                        style={{
                          height: CHIP_PITCH - 1,
                          borderRadius: 3,
                          paddingHorizontal: 2,
                          backgroundColor: colorOf(e),
                          opacity: e.done ? 0.5 : 1,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: pt.ink,
                            fontSize: 8.5,
                            lineHeight: CHIP_PITCH - 1,
                            fontFamily: pt.sans,
                            textDecorationLine: e.done ? 'line-through' : 'none',
                          }}
                        >
                          {e.title || t('planner.senza_titolo')}
                        </Text>
                      </Pressable>
                    ))}
                    {more ? (
                      <Pressable onPress={() => p.onPickDay(d)}>
                        <Text
                          style={{
                            color: pt.ink3,
                            fontSize: 8.5,
                            lineHeight: 11,
                            textAlign: 'center',
                          }}
                        >
                          +{more}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              }),
            )}
            {p.now !== null ? (
              <>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: width21,
                    top: (p.now / 60) * ROW,
                    height: 1,
                    backgroundColor: pt.accentInk,
                    opacity: 0.18,
                  }}
                />
                {todayIdx >= 0 && todayIdx < COLS ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: todayIdx * colW,
                      width: colW,
                      top: (p.now / 60) * ROW,
                      height: 1.4,
                      backgroundColor: pt.accentInk,
                      opacity: 0.75,
                    }}
                  >
                    <View
                      style={{
                        position: 'absolute',
                        left: -3,
                        top: -2.3,
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: pt.accentInk,
                      }}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Mese: caselle arrotondate, barre degli eventi lunghi, elenco       */
/* ------------------------------------------------------------------ */
/** Le sei settimane che il mese occupa (e quelle intorno), da lunedì a domenica: sempre 6 righe, come il sito. */
export function monthGrid(anyDay: string): string[][] {
  const start = mondayOf(monthStart(anyDay));
  return Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => addDaysIso(start, r * 7 + c)),
  );
}

interface Bar {
  ev: EventView;
  col: number;
  len: number;
  opens: boolean;
  closes: boolean;
}

/** Su che corsia sta ogni barra degli eventi di più giorni in una settimana (al massimo 3, come sul sito). */
function lanesOfWeek(events: EventView[], first: string): { lanes: Bar[][]; barred: Set<string> } {
  const last = addDaysIso(first, 6);
  const seen = new Set<string>();
  const pieces: Bar[] = [];
  for (const e of events) {
    if (e.days < 2 || seen.has(e.uid)) continue;
    if (e.endDate < first || e.date > last) continue;
    seen.add(e.uid);
    const from = e.date > first ? e.date : first;
    const to = e.endDate < last ? e.endDate : last;
    pieces.push({
      ev: e,
      col: diffDays(first, from),
      len: diffDays(from, to) + 1,
      opens: from === e.date,
      closes: to === e.endDate,
    });
  }
  pieces.sort((a, b) => a.col - b.col || b.len - a.len || a.ev.uid.localeCompare(b.ev.uid));
  const lanes: Bar[][] = [];
  const barred = new Set<string>();
  for (const bar of pieces) {
    const free = lanes.find((l) =>
      l.every((q) => !(bar.col < q.col + q.len && q.col < bar.col + bar.len)),
    );
    if (free) {
      free.push(bar);
      barred.add(bar.ev.uid);
    } else if (lanes.length < 3) {
      lanes.push([bar]);
      barred.add(bar.ev.uid);
    }
  }
  return { lanes, barred };
}

/** Il mese come sul sito (.pl-mgrid): sei righe di caselle tonde, il giorno di oggi in un cerchio, la maniglia che tira su l'elenco. */
export function MonthView(
  p: Look & {
    month: string;
    events: EventView[];
    today: string;
    diary: Record<string, boolean>;
    bottomPad: number;
    pullHidden: boolean;
    onPickDay: (d: string) => void;
    onOpenDiary: (d: string) => void;
    onPull: () => void;
  },
) {
  const { t } = useTranslation();
  const { pt } = p;
  const rows = monthGrid(p.month);
  const [gridW, setGridW] = useState(0);
  const cellW = gridW ? (gridW - 18) / 7 : 0;
  const colorOf = (e: EventView) =>
    eventColor(
      pt,
      e,
      p.categories.find((c) => c.uuid === e.categoryUuid),
    );
  const tint = (e: EventView) => mix(colorOf(e), pt.card, 0.34);

  return (
    <View testID="month-view" style={{ flex: 1, backgroundColor: pt.page }}>
      <View
        style={{ flex: 1, paddingHorizontal: 8, paddingBottom: p.bottomPad }}
        onLayout={(e) => setGridW(e.nativeEvent.layout.width - 16)}
      >
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Text
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                color: pt.ink3,
                fontSize: 8.5,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                fontFamily: pt.sans,
                paddingTop: 11,
                paddingBottom: 6,
              }}
            >
              {t(`planner.gs_${i}`)}
            </Text>
          ))}
        </View>
        {rows.map((row) => {
          const wk = eventsOn(p.events, row[0]!).concat(
            ...row.slice(1).map((d) => eventsOn(p.events, d)),
          );
          const { lanes, barred } = lanesOfWeek(wk, row[0]!);
          return (
            <View key={row[0]} style={{ flex: 1, flexDirection: 'row', gap: 3, paddingBottom: 3 }}>
              {row.map((d) => {
                const inMonth = monthOf(d) === monthOf(p.month);
                const isToday = d === p.today;
                const past = d < p.today;
                const list = eventsOn(p.events, d)
                  .filter((e) => !(e.days > 1 && barred.has(e.uid)))
                  .sort(
                    (a, b) =>
                      weightOf(a) - weightOf(b) ||
                      Number(b.allDay) - Number(a.allDay) ||
                      minutesOf(a.start) - minutesOf(b.start),
                  );
                return (
                  <Pressable
                    key={d}
                    testID={`month-day-${d}`}
                    accessibilityRole="button"
                    onPress={() => p.onPickDay(d)}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      backgroundColor: inMonth ? pt.card : pt.paper2,
                      borderWidth: 0.5,
                      borderColor: pt.hair,
                      paddingTop: 3,
                      paddingHorizontal: 3,
                      paddingBottom: 2,
                      gap: 2,
                      overflow: 'hidden',
                      opacity: past ? 0.45 : inMonth ? 1 : 0.6,
                    }}
                  >
                    <View
                      style={{
                        alignSelf: 'center',
                        minWidth: isToday ? 17 : 15,
                        height: isToday ? 17 : 15,
                        borderRadius: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isToday ? pt.accent : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          color: isToday ? pt.onAccent : pt.ink2,
                          fontSize: 15,
                          lineHeight: isToday ? 17 : 15,
                          fontWeight: isToday ? '700' : pt.style === 'standard' ? '600' : '400',
                          fontFamily: pt.serif,
                        }}
                      >
                        {dayOfMonth(d)}
                      </Text>
                    </View>
                    {lanes.length ? <View style={{ height: lanes.length * 15 - 2 }} /> : null}
                    {list.slice(0, 3).map((e) => (
                      <View
                        key={e.uid}
                        style={{
                          borderRadius: 4,
                          paddingHorizontal: 3,
                          paddingVertical: 1,
                          backgroundColor: tint(e),
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: pt.ink,
                            fontSize: 8,
                            lineHeight: 11,
                            fontFamily: pt.sans,
                          }}
                        >
                          {e.title}
                        </Text>
                      </View>
                    ))}
                    {list.length > 3 ? (
                      <Text
                        style={{
                          color: pt.ink3,
                          fontSize: 7.5,
                          textAlign: 'center',
                          fontFamily: pt.sans,
                        }}
                      >
                        +{list.length - 3}
                      </Text>
                    ) : null}
                    {p.diary[d] ? (
                      <View style={{ marginTop: 'auto', alignItems: 'flex-end' }}>
                        <Pressable
                          testID={`month-diary-${d}`}
                          accessibilityRole="button"
                          accessibilityLabel={t('planner.leggi_il_diario_di_questo')}
                          hitSlop={6}
                          onPress={() => p.onOpenDiary(d)}
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: 3.5,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: pt.accentWash,
                          }}
                        >
                          <LineIcon name="book" color={pt.accentInk} size={7} />
                        </Pressable>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              {cellW
                ? lanes.map((lane, k) =>
                    lane.map((b) => {
                      const left = b.col * (cellW + 3) + (b.opens ? 2 : 1);
                      const width =
                        b.len * cellW + (b.len - 1) * 3 - (b.opens ? 2 : 1) - (b.closes ? 2 : 1);
                      return (
                        <View
                          key={`${b.ev.uid}-${k}`}
                          pointerEvents="none"
                          style={{
                            position: 'absolute',
                            top: 18 + k * 15,
                            left,
                            width,
                            height: 13,
                            paddingHorizontal: 3,
                            justifyContent: 'center',
                            borderRadius: 4,
                            borderTopLeftRadius: b.opens ? 5 : 4,
                            borderBottomLeftRadius: b.opens ? 5 : 4,
                            borderTopRightRadius: b.closes ? 5 : 4,
                            borderBottomRightRadius: b.closes ? 5 : 4,
                            backgroundColor: tint(b.ev),
                            opacity: row[6]! < p.today ? 0.45 : 1,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{ color: pt.ink, fontSize: 8, fontFamily: pt.sans }}
                          >
                            {b.opens ? b.ev.title : `… ${b.ev.title}`}
                          </Text>
                        </View>
                      );
                    }),
                  )
                : null}
            </View>
          );
        })}
      </View>
      <Pressable
        testID="month-pull"
        accessibilityRole="button"
        accessibilityLabel={t('planner.mostra_l_elenco_degli_eventi')}
        onPress={p.onPull}
        disabled={p.pullHidden}
        style={{
          opacity: p.pullHidden ? 0 : 1,
          position: 'absolute',
          left: '50%',
          marginLeft: -32,
          bottom: p.bottomPad / 2 - 17,
          width: 64,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LineIcon name="chevUp" color={pt.ink3} size={30} />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* L'elenco che sale dal basso nella vista mese (.pl-magenda)          */
/* ------------------------------------------------------------------ */
export function MonthAgenda(
  p: Look & {
    from: string;
    today: string;
    version: number;
    height: number;
    load: (from: string, to: string) => EventView[];
    onOpen: (ev: EventView) => void;
    onGoDay: (d: string) => void;
    onClose: () => void;
  },
) {
  const { t } = useTranslation();
  const { pt } = p;
  const [rise] = useState(() => new Animated.Value(p.height));
  useEffect(() => {
    Animated.timing(rise, {
      toValue: 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rise]);

  const { load, version, from } = p;
  const days = useMemo(() => {
    void version;
    const all = load(from, addDaysIso(from, 29));
    const out: { date: string; list: EventView[] }[] = [];
    for (let i = 0; i < 30; i++) {
      const date = addDaysIso(from, i);
      const list = eventsOn(all, date).sort(
        (a, b) => Number(isBand(b)) - Number(isBand(a)) || minutesOf(a.start) - minutesOf(b.start),
      );
      if (list.length) out.push({ date, list });
    }
    return out;
  }, [load, version, from]);

  const label = (d: string) =>
    d === p.today
      ? t('comune.oggi')
      : d === addDaysIso(p.today, 1)
        ? t('comune.domani')
        : d === addDaysIso(p.today, -1)
          ? t('planner.ieri_t')
          : t(`planner.gg_${weekdayOf(d)}`);
  const short = (d: string) => `${dayOfMonth(d)}/${monthOf(d)}`;

  const header = (d: string, first: boolean) => (
    <View
      key={`h-${d}`}
      style={{
        paddingTop: first ? 6 : 14,
        paddingBottom: 8,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: pt.hair,
      }}
    >
      <Pressable
        testID={`agenda-go-${d}`}
        accessibilityRole="button"
        accessibilityLabel={t('planner.vai_a', { giorno: `${label(d)} ${short(d)}` })}
        onPress={() => p.onGoDay(d)}
        style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}
      >
        <Text
          style={{
            color: d < p.today ? pt.ink3 : pt.accentInk,
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontFamily: pt.sans,
          }}
        >
          {label(d)}
        </Text>
        <Text style={{ color: pt.ink3, fontSize: 11, fontFamily: pt.sans }}>{short(d)}</Text>
      </Pressable>
    </View>
  );

  return (
    <Animated.View
      testID="month-agenda"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: p.height,
        backgroundColor: pt.card,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        boxShadow: '0 -10px 40px rgba(0,0,0,.28)',
        transform: [{ translateY: rise }],
        zIndex: 52,
      }}
    >
      <Pressable
        testID="agenda-close"
        accessibilityRole="button"
        accessibilityLabel={t('planner.chiudi_l_elenco')}
        onPress={p.onClose}
        style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 10 }}
      >
        <LineIcon name="chevDown" color={pt.ink3} size={30} />
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {days.length ? (
          days.map(({ date, list }, di) => (
            <View key={date}>
              {header(date, di === 0)}
              {list.map((e) => {
                const cat = p.categories.find((c) => c.uuid === e.categoryUuid);
                const color = eventColor(pt, e, cat);
                const idx = diffDays(e.date, date) + 1;
                return (
                  <Pressable
                    key={`${e.uid}-${date}`}
                    testID={`agenda-ev-${e.uid}`}
                    accessibilityRole="button"
                    onPress={() => p.onOpen(e)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 10,
                      paddingVertical: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        marginTop: 5,
                        backgroundColor: color,
                      }}
                    />
                    {e.allDay ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: pt.paper2,
                        }}
                      >
                        <Text style={{ color: pt.ink2, fontSize: 11, fontFamily: pt.sans }}>
                          {t('planner.tutto_il_giorno_l')}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          minWidth: 82,
                          color: pt.ink2,
                          fontSize: 11.5,
                          fontVariant: ['tabular-nums'],
                          fontFamily: pt.sans,
                        }}
                      >
                        {e.start} – {e.end}
                        {e.days > 1 ? ` (${idx}/${e.days})` : ''}
                      </Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: e.done ? pt.ink3 : pt.ink,
                          fontSize: 14.5,
                          lineHeight: 19,
                          fontFamily: pt.sans,
                          textDecorationLine: e.done ? 'line-through' : 'none',
                        }}
                      >
                        {e.title}
                      </Text>
                      {cat ? (
                        <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>
                          {cat.name}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        ) : (
          <View>
            {header(p.from, true)}
            <Text
              style={{
                color: pt.ink3,
                fontSize: 14,
                fontStyle: 'italic',
                fontFamily: pt.serif,
                paddingTop: 4,
                paddingBottom: 10,
              }}
            >
              {t('planner.niente_in_programma_nei_prossimi')}
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

export { weekdayOf };
