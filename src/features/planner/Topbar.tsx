import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import { addDaysIso, addMonths, dayOfMonth, monthOf, weekdayOf, yearOf } from './dates';
import { LineIcon, ToolButton } from './PlannerIcons';
import type { PlannerTheme } from './plannerTheme';
import { monthGrid } from './Views';

export type PlannerView = 'day' | 'week' | 'month';

/** Sei settimane intere (il sito le disegna sempre tutte e sei, anche quando il mese ne usa cinque). */
export function sixWeeks(date: string): string[][] {
  const weeks = monthGrid(date);
  while (weeks.length < 6) {
    const last = weeks[weeks.length - 1]![6]!;
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysIso(last, i + 1)));
  }
  return weeks;
}

/** Il sito scrive il giorno della settimana per intero, in maiuscolo («SUNDAY»). */
const upper = (s: string) => s.toLocaleUpperCase();

/** La pastiglia con il numero della settimana (.pl-week): «3 SETT.». */
function WeekPill(p: { pt: PlannerTheme; n: number; onPress: () => void }) {
  const { t } = useTranslation();
  const { pt } = p;
  return (
    <Pressable
      testID="planner-week"
      accessibilityRole="button"
      accessibilityLabel={t('planner.la_settimana')}
      onPress={p.onPress}
      style={({ pressed }) => ({
        height: 29,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8,
        paddingRight: 9,
        borderRadius: 999,
        backgroundColor: pt.pill,
        borderWidth: 0.5,
        borderColor: pt.pillRing,
        boxShadow: '0 1px 2px rgba(0,0,0,.06)',
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text
        testID="week-number"
        style={{
          color: pt.ink,
          fontSize: 19,
          lineHeight: 19,
          fontWeight: pt.style === 'standard' ? '700' : '400',
          fontFamily: pt.serif,
        }}
      >
        {p.n}
      </Text>
      <Text
        style={{
          color: pt.ink3,
          fontSize: 9.5,
          letterSpacing: 0.19,
          fontFamily: pt.sans,
        }}
      >
        {upper(t('planner.settimana_breve'))}
      </Text>
    </Pressable>
  );
}

/** «Vai a oggi» come un foglietto di calendario: il mese su una fascia rossa, il numero sotto (.pl-today). */
function TodayTile(p: { pt: PlannerTheme; month: string; day: number; onPress: () => void }) {
  const { t } = useTranslation();
  const { pt } = p;
  return (
    <Pressable
      testID="planner-today"
      accessibilityRole="button"
      accessibilityLabel={t('planner.vai_a_oggi')}
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: 32,
        height: 33,
        borderRadius: 9,
        overflow: 'hidden',
        backgroundColor: pt.pill,
        borderWidth: 0.5,
        borderColor: pt.pillRing,
        boxShadow: '0 1px 2px rgba(0,0,0,.06)',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View style={{ height: 10, backgroundColor: pt.tileRed, justifyContent: 'center' }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 6.5,
            lineHeight: 7,
            fontWeight: '700',
            letterSpacing: 0.52,
            textAlign: 'center',
          }}
        >
          {upper(p.month)}
        </Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            color: pt.ink,
            fontSize: 15,
            lineHeight: 17,
            fontWeight: '700',
            letterSpacing: -0.3,
            fontFamily: pt.serif,
          }}
        >
          {p.day}
        </Text>
      </View>
    </Pressable>
  );
}

/** Il pallino del profilo: sfumatura blu-viola con un filo bianco e l'iniziale (.standout-fab-avatar). */
function Avatar(p: { letter: string; onPress: () => void; label: string }) {
  return (
    <Pressable
      testID="planner-avatar"
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 3px 10px rgba(0,0,0,.16)',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Svg width={34} height={34}>
          <Defs>
            <LinearGradient id="plAvatar" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#5B8DEF" />
              <Stop offset="1" stopColor="#A78BFA" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={34} height={34} fill="url(#plAvatar)" />
        </Svg>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>{p.letter}</Text>
    </Pressable>
  );
}

/** Il calendarietto del mese in piccolo (.pl-mini-static): la settimana in corso è evidenziata. */
function MiniMonth(p: {
  pt: PlannerTheme;
  date: string;
  today: string;
  week: string[];
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const weeks = sixWeeks(p.date);
  const month = monthOf(p.date);
  return (
    <Pressable
      testID="planner-mini"
      accessibilityRole="button"
      accessibilityLabel={t('planner.calendario_del_mese')}
      onPress={p.onPress}
      style={{
        width: 94,
        height: 75,
        paddingTop: 4,
        paddingBottom: 3,
        paddingHorizontal: 5,
        borderRadius: 9,
        backgroundColor: pt.pill,
        borderWidth: 0.5,
        borderColor: pt.pillRing,
        boxShadow: '0 1px 2px rgba(0,0,0,.06)',
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        {weeks[0]!.map((d) => (
          <Text
            key={d}
            style={{
              width: 12,
              textAlign: 'center',
              color: pt.ink2,
              opacity: 0.7,
              fontSize: 7,
              lineHeight: 9.3,
              fontFamily: pt.sans,
            }}
          >
            {t(`planner.gs_${weekdayOf(d)}`)}
          </Text>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0]} style={{ flexDirection: 'row', marginTop: 0.4 }}>
          {w.map((d) => {
            const inWeek = p.week.includes(d);
            const out = monthOf(d) !== month;
            return (
              <Text
                key={d}
                style={{
                  width: 12,
                  height: 9.3,
                  textAlign: 'center',
                  borderRadius: 2,
                  overflow: 'hidden',
                  fontSize: 7,
                  lineHeight: 9.3,
                  fontWeight: d === p.today ? '600' : '400',
                  color: pt.ink2,
                  opacity: out ? 0.35 : 1,
                  backgroundColor: inWeek ? pt.accentSoft : 'transparent',
                  fontFamily: pt.sans,
                }}
              >
                {dayOfMonth(d)}
              </Text>
            );
          })}
        </View>
      ))}
    </Pressable>
  );
}

/** Il calendario a comparsa del mese (.pl-mini): si tocca un giorno e ci si va. */
export function MonthPopup(p: {
  pt: PlannerTheme;
  top: number;
  date: string;
  today: string;
  onPick: (d: string) => void;
  onMonth: (delta: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const weeks = sixWeeks(p.date);
  const month = monthOf(p.date);
  const week = weeks.find((w) => w.includes(p.date)) ?? [];
  const arrow = (delta: number, name: 'left' | 'right') => (
    <Pressable
      testID={delta < 0 ? 'mini-prev' : 'mini-next'}
      accessibilityRole="button"
      accessibilityLabel={t(delta < 0 ? 'planner.giorno_precedente' : 'planner.giorno_successivo')}
      onPress={() => p.onMonth(delta)}
      hitSlop={8}
      style={{ width: 30, height: 24, alignItems: 'center', justifyContent: 'center' }}
    >
      <LineIcon name={name} color={pt.ink2} size={18} />
    </Pressable>
  );
  return (
    <View
      testID="month-popup"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('comune.chiudi')}
        onPress={p.onClose}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: p.top,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 12,
          borderRadius: 22,
          backgroundColor: pt.pill,
          borderWidth: 0.5,
          borderColor: pt.fieldRing,
          boxShadow: '0 18px 40px -12px rgba(0,0,0,.45)',
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          {arrow(-1, 'left')}
          <Text style={{ color: pt.ink, fontSize: 15, fontFamily: pt.serif }}>
            {t(`planner.mese_${month}`)} {yearOf(p.date)}
          </Text>
          {arrow(1, 'right')}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {weeks[0]!.map((d) => (
            <Text
              key={d}
              style={{
                flex: 1,
                textAlign: 'center',
                color: pt.ink3,
                fontSize: 12,
                fontFamily: pt.sans,
              }}
            >
              {t(`planner.gs_${weekdayOf(d)}`)}
            </Text>
          ))}
        </View>
        {weeks.map((w) => (
          <View key={w[0]} style={{ flexDirection: 'row', marginTop: 2 }}>
            {w.map((d) => {
              const inWeek = week.includes(d);
              const isToday = d === p.today;
              const out = monthOf(d) !== month;
              return (
                <Pressable
                  key={d}
                  testID={`mini-${d}`}
                  accessibilityRole="button"
                  onPress={() => p.onPick(d)}
                  style={{
                    flex: 1,
                    height: 31,
                    marginHorizontal: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    backgroundColor: inWeek ? pt.accentWash : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: inWeek ? pt.accentInk : out ? pt.ink3 : pt.ink,
                      opacity: out && !inWeek ? 0.45 : 1,
                      fontSize: 17,
                      fontWeight: isToday ? '700' : '400',
                      fontFamily: pt.sans,
                    }}
                  >
                    {dayOfMonth(d)}
                  </Text>
                  {isToday ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: pt.accentInk,
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Il menu delle viste (.pl-viewmenu): Mese, Settimana, Giorno. */
export function ViewMenu(p: {
  pt: PlannerTheme;
  left: number;
  top: number;
  view: PlannerView;
  onPick: (v: PlannerView) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const items: { id: PlannerView; label: string }[] = [
    { id: 'month', label: t('planner.mese') },
    { id: 'week', label: t('planner.settimana_2') },
    { id: 'day', label: t('planner.giorno') },
  ];
  return (
    <View
      testID="view-menu"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('comune.chiudi')}
        onPress={p.onClose}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View
        accessibilityRole="menu"
        style={{
          position: 'absolute',
          left: p.left,
          top: p.top,
          minWidth: 68,
          padding: 4,
          gap: 2,
          borderRadius: 18,
          backgroundColor: pt.pill,
          borderWidth: 0.5,
          borderColor: pt.fieldRing,
          boxShadow: '0 14px 34px -10px rgba(0,0,0,.5)',
        }}
      >
        {items.map((i) => {
          const on = i.id === p.view;
          return (
            <Pressable
              key={i.id}
              testID={`mode-${i.id}`}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: on }}
              onPress={() => p.onPick(i.id)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: on ? pt.accentSoft : 'transparent',
              }}
            >
              <Text
                style={{
                  color: on ? pt.accentInk : pt.ink,
                  fontSize: 15,
                  fontWeight: on ? '600' : '400',
                  fontFamily: pt.sans,
                }}
              >
                {i.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** La fila dei mesi (.pl-months-bar): tre anni di mesi, quello di adesso in colore; scorre di lato. */
function MonthChips(p: { pt: PlannerTheme; date: string; onPick: (date: string) => void }) {
  const { t } = useTranslation();
  const { pt } = p;
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const base = `${p.date.slice(0, 7)}-01`;
  const items = Array.from({ length: 37 }, (_, i) => {
    const d = addMonths(base, i - 18);
    const sameYear = yearOf(d) === yearOf(base);
    return {
      d,
      on: i === 18,
      label:
        t(`planner.mese_${monthOf(d)}`).slice(0, 3) +
        (sameYear ? '' : ` ${String(yearOf(d)).slice(2)}`),
    };
  });
  return (
    <ScrollView
      ref={scroller}
      testID="months-bar"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 8 }}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
    >
      {items.map((i) => (
        <Pressable
          key={i.d}
          testID={`month-chip-${i.d.slice(0, 7)}`}
          accessibilityRole="button"
          onPress={() => p.onPick(i.d)}
          onLayout={
            i.on
              ? (e) =>
                  scroller.current?.scrollTo({
                    x: e.nativeEvent.layout.x - width / 2 + e.nativeEvent.layout.width / 2,
                    animated: false,
                  })
              : undefined
          }
          style={{
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: i.on ? pt.accentSoft : pt.field,
          }}
        >
          <Text
            style={{
              color: i.on ? pt.accentInk : pt.ink2,
              fontSize: 12.5,
              fontWeight: i.on ? '500' : '400',
              fontFamily: pt.sans,
            }}
          >
            {i.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * La barra in alto del planner, come quella del sito: riga 1 (settimana, oggi, vista · impostazioni, profilo),
 * l'affermazione, riga 2 (cerca e filtro sopra il numero del giorno · mese e anno · calendarietto).
 */
export function PlannerTopbar(p: {
  pt: PlannerTheme;
  inset: number;
  date: string;
  today: string;
  weekNo: number;
  week: string[];
  view: PlannerView;
  viewLabel: string;
  letter: string;
  affirmation: string | null;
  ambient?: ReactNode;
  onViewPress: (x: number) => void;
  onToday: () => void;
  onWeek: () => void;
  onSettings: () => void;
  onAvatar: () => void;
  onSearch: () => void;
  onFilter: () => void;
  onMini: () => void;
  /** nella vista mese: il nome del mese apre/chiude la fila dei mesi, un mese scelto porta lì */
  monthsOpen?: boolean;
  onMonthName?: () => void;
  onMonthPick?: (date: string) => void;
  onHeight?: (h: number) => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const [viewX, setViewX] = useState(0);
  const inMonth = p.view === 'month';
  const month = t(`planner.mese_${monthOf(p.today)}`);
  const standard = pt.style === 'standard';
  return (
    <View
      testID="planner-topbar"
      onLayout={(e) => p.onHeight?.(e.nativeEvent.layout.height)}
      style={{
        paddingTop: p.inset + 8,
        paddingHorizontal: 14,
        paddingBottom: 9,
        backgroundColor: pt.bar,
        borderBottomWidth: 0.5,
        borderBottomColor: pt.hair,
        overflow: 'hidden',
      }}
    >
      {p.ambient}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 34, gap: 5 }}>
        <WeekPill pt={pt} n={p.weekNo} onPress={p.onWeek} />
        <TodayTile
          pt={pt}
          month={month.slice(0, 3)}
          day={dayOfMonth(p.today)}
          onPress={p.onToday}
        />
        <Pressable
          testID="planner-view"
          accessibilityRole="button"
          accessibilityLabel={t('planner.passa_alla_vista_mese')}
          onLayout={(e) => setViewX(e.nativeEvent.layout.x)}
          onPress={() => p.onViewPress(viewX + 14)}
          style={({ pressed }) => ({
            height: 32,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: pt.pill,
            borderWidth: 0.5,
            borderColor: pt.pillRing,
            boxShadow: '0 1px 2px rgba(0,0,0,.06)',
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <LineIcon name="calendar" color={pt.ink} size={16} />
          <Text
            testID="view-label"
            style={{ color: pt.ink, fontSize: 13, fontWeight: '600', fontFamily: pt.sans }}
          >
            {p.viewLabel}
          </Text>
          <LineIcon name="chevDown" color={pt.ink2} size={12} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <ToolButton
          pt={pt}
          testID="planner-settings"
          label={t('planner.impostazioni')}
          onPress={p.onSettings}
        >
          <LineIcon name="gear" color={pt.ink} size={16} />
        </ToolButton>
        <Avatar letter={p.letter} label={t('app.account')} onPress={p.onAvatar} />
      </View>

      {p.affirmation ? (
        <Text
          testID="week-affirmation"
          numberOfLines={2}
          style={{
            color: pt.ink2,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: '500',
            fontStyle: standard ? 'normal' : 'italic',
            fontFamily: pt.serif,
            textAlign: 'center',
            marginTop: 8,
            marginHorizontal: 2,
            marginBottom: 2,
          }}
        >
          {p.affirmation}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          marginTop: inMonth ? 8 : 9,
          minHeight: inMonth ? 44 : 78,
          gap: 10,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            <ToolButton
              pt={pt}
              testID="planner-search"
              label={t('planner.cerca')}
              onPress={p.onSearch}
            >
              <LineIcon name="search" color={pt.ink} size={16} />
            </ToolButton>
            <ToolButton
              pt={pt}
              testID="planner-manage"
              label={`${t('planner.calendari')} · ${t('planner.categorie')}`}
              onPress={p.onFilter}
            >
              <LineIcon name="filter" color={pt.ink} size={16} />
            </ToolButton>
          </View>
          {inMonth ? null : (
            <Pressable
              testID="planner-day"
              accessibilityRole="button"
              onPress={p.onToday}
              style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}
            >
              <Text
                testID="day-title"
                style={{
                  color: pt.ink,
                  fontSize: 43,
                  lineHeight: 39,
                  fontWeight: standard ? '700' : '400',
                  letterSpacing: -1.5,
                  fontFamily: pt.serif,
                }}
              >
                {dayOfMonth(p.date)}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: pt.ink2,
                  fontSize: 13,
                  fontWeight: '600',
                  letterSpacing: 0.13,
                  paddingBottom: 3,
                  flexShrink: 1,
                  fontFamily: pt.sans,
                }}
              >
                {upper(t(`planner.gg_${weekdayOf(p.date)}`))}
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable
          testID="planner-month-name"
          accessibilityRole="button"
          disabled={!inMonth}
          onPress={p.onMonthName}
          style={{
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            paddingTop: 1,
            marginRight: inMonth ? 10 : 0,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: pt.ink,
              fontSize: 22,
              lineHeight: 23,
              fontWeight: standard ? '700' : '400',
              letterSpacing: -0.44,
              fontFamily: pt.serif,
            }}
          >
            {t(`planner.mese_${monthOf(p.date)}`)}
          </Text>
          <Text
            style={{
              color: pt.ink3,
              fontSize: 10,
              letterSpacing: standard ? 0.1 : 2,
              fontFamily: pt.sans,
            }}
          >
            {yearOf(p.date)}
          </Text>
        </Pressable>
        {inMonth ? null : (
          <MiniMonth pt={pt} date={p.date} today={p.today} week={p.week} onPress={p.onMini} />
        )}
      </View>
      {inMonth && p.monthsOpen ? (
        <MonthChips pt={pt} date={p.date} onPick={(d) => p.onMonthPick?.(d)} />
      ) : null}
    </View>
  );
}
