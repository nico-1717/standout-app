import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { mix } from '@/features/buy/buyTheme';

import {
  addDaysIso,
  dayOfMonth,
  daysInMonth,
  monthOf,
  monthStart,
  mondayOf,
  weekdayOf,
} from './dates';
import type { EventView } from './events';
import { CheckBox, dayTitle } from './PlannerParts';
import { blockBackground, eventColor, type PlannerTheme } from './plannerTheme';
import type { Calendar, Category } from './repo';

interface Look {
  pt: PlannerTheme;
  categories: Category[];
  calendars: Calendar[];
}

/** Gli eventi che toccano un giorno (anche quelli che cominciano prima e finiscono dopo). */
export function eventsOn(events: EventView[], day: string): EventView[] {
  return events.filter((e) => e.date <= day && e.endDate >= day);
}

/** La settimana come tabella: una riga per giorno, con quello che c'è dentro. */
export function WeekView(
  p: Look & {
    days: string[];
    events: EventView[];
    today: string;
    onPickDay: (d: string) => void;
    onOpen: (ev: EventView) => void;
    onToggle: (ev: EventView) => void;
  },
) {
  const { t } = useTranslation();
  const { pt } = p;
  return (
    <View testID="week-view" style={{ paddingHorizontal: 12, paddingTop: 8, gap: 8 }}>
      {p.days.map((d) => {
        const list = eventsOn(p.events, d);
        const isToday = d === p.today;
        return (
          <View
            key={d}
            testID={`week-day-${d}`}
            style={{
              backgroundColor: pt.card,
              borderRadius: 18,
              borderWidth: 0.5,
              borderColor: isToday ? pt.accent : pt.hair,
              padding: 10,
            }}
          >
            <Pressable
              testID={`week-open-${d}`}
              accessibilityRole="button"
              onPress={() => p.onPickDay(d)}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: list.length ? 6 : 0,
              }}
            >
              <Text
                style={{
                  color: isToday ? pt.accentInk : pt.ink,
                  fontSize: 20,
                  fontFamily: pt.serif,
                  fontWeight: pt.style === 'standard' ? '700' : '400',
                }}
              >
                {dayTitle(t, d)}
              </Text>
              {!list.length ? (
                <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>
                  {t('planner.nessun_evento_in_programma')}
                </Text>
              ) : null}
            </Pressable>
            {list.map((e) => {
              const color = eventColor(
                pt,
                e,
                p.categories.find((c) => c.uuid === e.categoryUuid),
              );
              const idx =
                Math.round(
                  (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${e.date}T00:00:00Z`)) / 86_400_000,
                ) + 1;
              const band = e.allDay || e.multiday;
              return (
                <Pressable
                  key={`${e.uid}-${d}`}
                  testID={`week-ev-${e.uid}-${d}`}
                  accessibilityRole="button"
                  onPress={() => p.onOpen(e)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    marginTop: 3,
                    borderRadius: 12,
                    backgroundColor: blockBackground(pt, color, e.importance),
                  }}
                >
                  {e.type === 'task' || e.habitUuid ? (
                    <CheckBox
                      testID={`week-box-${e.uid}-${d}`}
                      color={color}
                      done={e.done}
                      pt={pt}
                      onPress={() => p.onToggle(e)}
                    />
                  ) : null}
                  <Text style={{ width: 44, color: pt.ink2, fontSize: 11, fontFamily: pt.sans }}>
                    {band ? '' : e.start}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: e.done ? pt.ink2 : pt.ink,
                      fontSize: 13.5,
                      fontFamily: pt.sans,
                      textDecorationLine: e.done ? 'line-through' : 'none',
                    }}
                  >
                    {e.title}
                  </Text>
                  {e.multiday ? (
                    <Text style={{ color: pt.ink3, fontSize: 10.5, fontWeight: '600' }}>
                      {idx}/{e.days}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/** Le settimane che il mese occupa, da lunedì a domenica. */
export function monthGrid(anyDay: string): string[][] {
  const first = monthStart(anyDay);
  const start = mondayOf(first);
  const last = addDaysIso(first, daysInMonth(first) - 1);
  const rows: string[][] = [];
  for (let d = start; d <= last; d = addDaysIso(d, 7))
    rows.push(Array.from({ length: 7 }, (_, i) => addDaysIso(d, i)));
  return rows;
}

/** Il mese: una casella per giorno con al massimo tre eventi e «+n». */
export function MonthView(
  p: Look & { month: string; events: EventView[]; today: string; onPickDay: (d: string) => void },
) {
  const { t } = useTranslation();
  const { pt } = p;
  const rows = monthGrid(p.month);
  return (
    <View testID="month-view" style={{ paddingHorizontal: 6, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row' }}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              color: pt.ink3,
              fontSize: 10,
              letterSpacing: 1.2,
              fontFamily: pt.sans,
              paddingBottom: 4,
            }}
          >
            {t(`planner.gs_${i}`)}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: 'row' }}>
          {row.map((d) => {
            const inMonth = monthOf(d) === monthOf(p.month);
            const list = eventsOn(p.events, d);
            return (
              <Pressable
                key={d}
                testID={`month-day-${d}`}
                accessibilityRole="button"
                onPress={() => p.onPickDay(d)}
                style={{
                  flex: 1,
                  minHeight: 78,
                  padding: 2,
                  borderTopWidth: 0.5,
                  borderColor: pt.hair,
                  opacity: inMonth ? 1 : 0.4,
                }}
              >
                <View
                  style={{
                    alignSelf: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: d === p.today ? pt.accent : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: d === p.today ? pt.onAccent : pt.ink,
                      fontSize: 13,
                      fontFamily: pt.sans,
                    }}
                  >
                    {dayOfMonth(d)}
                  </Text>
                </View>
                {list.slice(0, 3).map((e) => {
                  const color = eventColor(
                    pt,
                    e,
                    p.categories.find((c) => c.uuid === e.categoryUuid),
                  );
                  return (
                    <View
                      key={e.uid}
                      style={{
                        marginTop: 2,
                        borderRadius: 5,
                        paddingHorizontal: 3,
                        paddingVertical: 1,
                        backgroundColor: mix(
                          color,
                          pt.card.startsWith('#') ? pt.card : '#FFFDFA',
                          0.45,
                        ),
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ color: pt.ink, fontSize: 9, fontFamily: pt.sans }}
                      >
                        {e.title}
                      </Text>
                    </View>
                  );
                })}
                {list.length > 3 ? (
                  <Text style={{ color: pt.ink3, fontSize: 9, textAlign: 'center', marginTop: 1 }}>
                    +{list.length - 3}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export { weekdayOf };
