import { useEffect, useState } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { mix } from '@/features/buy/buyTheme';

import { dayOfMonth, monthOf, weekdayOf } from './dates';
import type { EventView } from './events';
import { dropMinute, layoutDay, pxPerMinute, snapMinutes, type Block, type Zoom } from './layout';
import { minutesOf, timeOf } from './model';
import { blockBackground, eventColor, longHex, type PlannerTheme } from './plannerTheme';
import type { Category, Calendar } from './repo';
import { useEventDrag } from './useEventDrag';
import { Text } from '@/ui/CappedText';

/** La riga d'ora corrente: si aggiorna ogni minuto (null se non è il giorno mostrato). */
export function useNowMinutes(active: boolean): number | null {
  const calc = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(calc);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(calc()), 30_000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : null;
}

interface Look {
  pt: PlannerTheme;
  categories: Category[];
  calendars: Calendar[];
}

const catOf = (look: Look, ev: EventView) =>
  look.categories.find((c) => c.uuid === ev.categoryUuid) ?? null;
const calColor = (look: Look, ev: EventView) => {
  const c = look.calendars.find((x) => x.uuid === ev.calendarUuid);
  return c && !c.is_default && c.color ? longHex(c.color, '') : null;
};

/** La casellina di un task: piena quando è fatto. */
export function CheckBox({
  color,
  done,
  pt,
  onPress,
  testID,
}: {
  color: string;
  done: boolean;
  pt: PlannerTheme;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      hitSlop={10}
      onPress={onPress}
      style={{
        width: 15,
        height: 15,
        borderRadius: 6,
        marginTop: 0.5,
        borderWidth: done ? 0 : 1.1,
        borderColor: mix(color, pt.hair2.startsWith('#') ? pt.hair2 : '#C9C2B8', 0.7),
        backgroundColor: done ? mix(color, '#FFFFFF', 0.85) : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? <Text style={{ color: pt.onAccent, fontSize: 10, lineHeight: 12 }}>✓</Text> : null}
    </Pressable>
  );
}

/** Un blocco nella griglia del giorno. */
export function EventBlock(
  p: Look & {
    block: Block;
    ppm: number;
    gutter: number;
    width: number;
    snap: number;
    onOpen: (ev: EventView) => void;
    onToggle: (ev: EventView) => void;
    onMove?: (ev: EventView, startMin: number) => void;
    onDragActive?: (active: boolean) => void;
  },
) {
  const { pt, block, ppm } = p;
  const drag = useEventDrag({
    onDrop: (dy) => {
      if (dy !== 0) p.onMove?.(block.ev, dropMinute(block.top, block.height, dy, ppm, p.snap));
    },
    onActive: (a) => p.onDragActive?.(a),
  });
  const dragging = drag.dy !== null;
  const top = dragging ? dropMinute(block.top, block.height, drag.dy ?? 0, ppm, p.snap) : block.top;
  const ev = block.ev;
  const color = eventColor(pt, ev, catOf(p, ev));
  const cal = calColor(p, ev);
  const colW = p.width / block.cols;
  const height = Math.max(18, block.height * ppm - 1);
  const tall = height >= 40 || dragging;
  const showBox = ev.type === 'task' || !!ev.habitUuid;
  return (
    <Pressable
      testID={`ev-${ev.uid}`}
      accessibilityRole="button"
      onPress={() => p.onOpen(ev)}
      onLongPress={p.onMove ? drag.arm : undefined}
      onPressOut={p.onMove ? drag.release : undefined}
      delayLongPress={300}
      {...drag.panHandlers}
      style={{
        position: 'absolute',
        zIndex: dragging ? 20 : 0,
        opacity: dragging ? 0.92 : 1,
        top: top * ppm,
        left: p.gutter + colW * block.col,
        width: colW - 3,
        height,
        borderRadius: 12,
        paddingVertical: height < 28 ? 2 : 5,
        paddingHorizontal: 8,
        overflow: 'hidden',
        backgroundColor: blockBackground(pt, color, ev.importance),
        borderWidth: cal ? 1.6 : 0.5,
        borderColor: cal
          ? mix(cal, blockBackground(pt, color, ev.importance), 0.45)
          : mix(color, pt.card.startsWith('#') ? pt.card : '#FFFDFA', 0.55),
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2.5,
          backgroundColor: mix(cal ?? color, '#FFFFFF', 0.82),
        }}
      />
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
        {showBox ? (
          <CheckBox
            testID={`box-${ev.uid}`}
            color={color}
            done={ev.done}
            pt={pt}
            onPress={() => p.onToggle(ev)}
          />
        ) : null}
        <Text
          numberOfLines={tall ? 3 : 1}
          style={{
            flex: 1,
            color: ev.done ? pt.ink2 : pt.ink,
            fontSize: height < 28 ? 11 : 12.5,
            lineHeight: height < 28 ? 13 : 16,
            fontFamily: pt.sans,
            fontWeight: ev.importance === 'highest' ? '600' : '400',
            textDecorationLine: ev.done ? 'line-through' : 'none',
          }}
        >
          {ev.title}
        </Text>
      </View>
      {tall ? (
        <Text
          style={{
            color: pt.ink2,
            fontSize: 9.5,
            letterSpacing: 0.4,
            marginTop: 1,
            fontFamily: pt.sans,
          }}
        >
          {dragging ? `${timeOf(top)}–${timeOf(top + block.height)}` : `${ev.start}–${ev.end}`}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** La fascia in alto del giorno: eventi di tutto il giorno e di più giorni («2/4»). */
export function BandEvent(
  p: Look & {
    ev: EventView;
    day: string;
    onOpen: (ev: EventView) => void;
    onToggle: (ev: EventView) => void;
  },
) {
  const { pt, ev } = p;
  const color = eventColor(pt, ev, catOf(p, ev));
  const first = ev.date === p.day;
  const idx =
    Math.round(
      (Date.parse(`${p.day}T00:00:00Z`) - Date.parse(`${ev.date}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  const showBox = ev.type === 'task' || !!ev.habitUuid;
  return (
    <Pressable
      testID={`band-${ev.uid}`}
      accessibilityRole="button"
      onPress={() => p.onOpen(ev)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 12,
        backgroundColor: blockBackground(pt, color, ev.importance),
        borderLeftWidth: first ? 2.5 : 0,
        borderLeftColor: mix(color, '#FFFFFF', 0.82),
      }}
    >
      {showBox ? (
        <CheckBox
          testID={`box-${ev.uid}`}
          color={color}
          done={ev.done}
          pt={pt}
          onPress={() => p.onToggle(ev)}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: ev.done ? pt.ink2 : pt.ink,
          fontSize: 11.5,
          fontFamily: pt.sans,
          textDecorationLine: ev.done ? 'line-through' : 'none',
        }}
      >
        {ev.title}
      </Text>
      {ev.multiday ? (
        <Text style={{ color: pt.ink3, fontSize: 10.5, fontWeight: '600' }}>
          {idx}/{ev.days}
        </Text>
      ) : null}
    </Pressable>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** La griglia di un giorno: ore a sinistra, righe, blocchi, riga dell'ora corrente. */
export function DayGrid(
  p: Look & {
    day: string;
    events: EventView[];
    zoom: Zoom;
    width: number;
    now: number | null;
    onOpen: (ev: EventView) => void;
    onToggle: (ev: EventView) => void;
    onEmptyTap: (minutes: number) => void;
    onMove?: (ev: EventView, startMin: number) => void;
    onDragActive?: (active: boolean) => void;
  },
) {
  const { pt } = p;
  const ppm = pxPerMinute(p.zoom);
  const gutter = 48;
  const blocks = layoutDay(p.events);
  const slotMin = p.zoom === 'm30' || p.zoom === 'm15' || p.zoom === 'm5' ? 30 : 60;
  const tap = (e: GestureResponderEvent) => {
    const m = e.nativeEvent.locationY / ppm;
    p.onEmptyTap(Math.max(0, Math.min(1410, Math.floor(m / slotMin) * slotMin)));
  };
  return (
    <View style={{ height: 1440 * ppm, width: p.width }}>
      <Pressable
        testID="grid-empty"
        accessibilityRole="button"
        onPress={tap}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      >
        {HOURS.map((h) => (
          <View
            key={h}
            pointerEvents="none"
            style={{ position: 'absolute', top: h * 60 * ppm, left: 0, right: 0 }}
          >
            <Text
              style={{
                position: 'absolute',
                left: 0,
                width: gutter - 8,
                textAlign: 'right',
                top: -7,
                color: pt.ink3,
                fontSize: 10,
                letterSpacing: 0.6,
                fontFamily: pt.sans,
              }}
            >
              {String(h).padStart(2, '0')}:00
            </Text>
            <View style={{ marginLeft: gutter, height: 1, backgroundColor: pt.hair }} />
            {slotMin === 30 ? (
              <View
                style={{
                  marginLeft: gutter,
                  marginTop: 30 * ppm - 1,
                  height: 1,
                  backgroundColor: pt.hair,
                  opacity: 0.5,
                }}
              />
            ) : null}
          </View>
        ))}
      </Pressable>
      {blocks.map((b) => (
        <EventBlock
          key={b.ev.uid}
          {...p}
          block={b}
          ppm={ppm}
          gutter={gutter}
          snap={snapMinutes(p.zoom)}
          width={p.width - gutter - 6}
          onOpen={p.onOpen}
          onToggle={p.onToggle}
          onMove={p.onMove}
          onDragActive={p.onDragActive}
        />
      ))}
      {p.now !== null ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: p.now * ppm,
            left: gutter - 3,
            right: 0,
            height: 1.2,
            backgroundColor: pt.accentInk,
            opacity: 0.7,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: -2,
              top: -2.5,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: pt.accentInk,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** I sette giorni della settimana, uno accanto all'altro, con un punto dove c'è qualcosa. */
export function WeekStrip(p: {
  pt: PlannerTheme;
  days: string[];
  selected: string;
  today: string;
  busy: Set<string>;
  onPick: (d: string) => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
      {p.days.map((d) => {
        const sel = d === p.selected;
        return (
          <Pressable
            key={d}
            testID={`strip-${d}`}
            accessibilityRole="button"
            onPress={() => p.onPick(d)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
          >
            <Text style={{ color: pt.ink3, fontSize: 10, letterSpacing: 1.2, fontFamily: pt.sans }}>
              {t(`planner.gs_${weekdayOf(d)}`)}
            </Text>
            <View
              style={{
                marginTop: 3,
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: sel ? pt.accent : 'transparent',
                borderWidth: d === p.today && !sel ? 1 : 0,
                borderColor: pt.accentInk,
              }}
            >
              <Text
                style={{ color: sel ? pt.onAccent : pt.ink, fontSize: 19, fontFamily: pt.serif }}
              >
                {dayOfMonth(d)}
              </Text>
            </View>
            <View
              style={{
                marginTop: 3,
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: p.busy.has(d) ? pt.accentInk : 'transparent',
                opacity: 0.6,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** «Martedì 3 novembre» */
export function dayTitle(t: (k: string) => string, iso: string): string {
  return `${t(`planner.gg_${weekdayOf(iso)}`)} ${dayOfMonth(iso)} ${t(`planner.mese_${monthOf(iso)}`)}`;
}

export { minutesOf };
