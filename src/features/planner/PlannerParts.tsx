import { memo, useEffect, useState } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { mix } from '@/features/buy/buyTheme';

import { dayOfMonth, monthOf, weekdayOf } from './dates';
import type { EventView } from './events';
import {
  ZOOMS,
  dropMinute,
  pxPerMinute,
  layoutDay,
  majorEvery,
  snapMinutes,
  type Block,
  type Zoom,
} from './layout';
import { minutesOf, timeOf } from './model';
import { blockBackground, eventColor, longHex, type PlannerTheme } from './plannerTheme';
import type { Category, Calendar } from './repo';
import { useEventDrag } from './useEventDrag';
import { placeRange, useGridPlace } from './useGridPlace';
import { LineIcon } from './PlannerIcons';
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

/**
 * Un blocco nella griglia del giorno. La posizione e l'altezza seguono la densità viva (`ppm`, un valore condiviso)
 * sul thread dell'interfaccia, come `top: calc(var(--pxm) * minuti)` del sito: pizzicando non si ridisegna niente.
 * Cosa scrivere dentro (una riga o più, l'orario) si decide dallo scatto: con la densità più bassa di quello scatto.
 */
export function EventBlock(
  p: Look & {
    block: Block;
    ppm: SharedValue<number>;
    /** lo scatto di adesso (le etichette e la forma del blocco cambiano solo con lui) */
    zoom: Exclude<Zoom, 'agenda'>;
    gutter: number;
    width: number;
    snap: number;
    onOpen: (ev: EventView) => void;
    onToggle: (ev: EventView) => void;
    now?: number | null;
    onMove?: (ev: EventView, startMin: number) => void;
    onDragActive?: (active: boolean) => void;
    /** modalità anticipi/ritardi: il tocco sceglie l'evento invece di aprirlo */
    onShiftPick?: (ev: EventView) => void;
    shiftPicked?: boolean;
  },
) {
  const { pt, block, ppm } = p;
  // la densità di quando si è preso il blocco in mano: serve a scegliere dove cade, e non cambia durante il trascinamento
  const [dragPpm, setDragPpm] = useState(0);
  const drag = useEventDrag({
    onDrop: (dy) => {
      if (dy !== 0)
        p.onMove?.(block.ev, dropMinute(block.top, block.height, dy, dragPpm || ppm.value, p.snap));
    },
    onActive: (a) => {
      if (a) setDragPpm(ppm.value);
      p.onDragActive?.(a);
    },
  });
  const dragging = drag.dy !== null;
  const top = dragging
    ? dropMinute(block.top, block.height, drag.dy ?? 0, dragPpm || 1, p.snap)
    : block.top;
  const ev = block.ev;
  const color = eventColor(pt, ev, catOf(p, ev));
  const cal = calColor(p, ev);
  const colW = p.width / block.cols;
  // la forma si decide con la densità più bassa dello scatto: dentro lo scatto il blocco può solo crescere
  const base = Math.max(18, block.height * pxPerMinute(p.zoom) - 1);
  const tall = base >= 40 || dragging;
  const showBox = ev.type === 'task' || !!ev.habitUuid;
  const frame = useAnimatedStyle(() => ({
    transform: [{ translateY: top * ppm.value }],
    height: Math.max(18, block.height * ppm.value - 1),
  }));
  return (
    <Animated.View
      // il responder del trascinamento sta qui, sul contenitore: il Pressable sovrascrive i suoi gestori di movimento
      {...drag.panHandlers}
      style={[
        {
          position: 'absolute',
          top: 0,
          zIndex: dragging ? 20 : 0,
          // un evento già finito (oggi) si fa più leggero, come `.pl-is-past` del sito
          opacity: dragging ? 0.92 : p.now != null && block.top + block.height < p.now ? 0.52 : 1,
          left: p.gutter + colW * block.col,
          width: colW - 3,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: blockBackground(pt, color, ev.importance),
          borderWidth: p.shiftPicked ? 2 : cal ? 1.6 : 0.5,
          borderColor: p.shiftPicked
            ? pt.accent
            : cal
              ? mix(cal, blockBackground(pt, color, ev.importance), 0.45)
              : mix(color, pt.card.startsWith('#') ? pt.card : '#FFFDFA', 0.55),
        },
        frame,
      ]}
    >
      <Pressable
        testID={`ev-${ev.uid}`}
        accessibilityRole="button"
        onPress={() => (p.onShiftPick ? p.onShiftPick(ev) : p.onOpen(ev))}
        onLongPress={p.onMove && !p.onShiftPick ? drag.arm : undefined}
        onPressOut={p.onMove && !p.onShiftPick ? drag.release : undefined}
        delayLongPress={300}
        style={{
          flex: 1,
          paddingVertical: base < 28 ? 2 : 5,
          paddingHorizontal: 8,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor:
              pt.style === 'standard' ? (cal ?? color) : mix(cal ?? color, '#FFFFFF', 0.82),
          }}
        />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          {p.onShiftPick ? (
            <View
              testID={`pick-${ev.uid}`}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: p.shiftPicked ? pt.accent : pt.ink3,
                backgroundColor: p.shiftPicked ? pt.accent : 'transparent',
              }}
            >
              {p.shiftPicked ? <LineIcon name="check" color={pt.card} size={11} /> : null}
            </View>
          ) : showBox ? (
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
              fontSize: base < 28 ? 11 : 13,
              lineHeight: base < 28 ? 13 : 16,
              fontFamily: pt.sans,
              fontWeight: pt.style === 'standard' || ev.importance === 'highest' ? '600' : '400',
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
              fontSize: 10.5,
              fontWeight: '500',
              letterSpacing: 0.42,
              marginTop: 1,
              fontFamily: pt.sans,
            }}
          >
            {dragging
              ? `${timeOf(top)} – ${timeOf(top + block.height)}`
              : `${ev.start} – ${ev.end}`}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
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

const slotStarts = (slotMin: number) =>
  Array.from({ length: Math.ceil(1440 / slotMin) }, (_, i) => i * slotMin);
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Una riga d'ora: sta al suo minuto per mezzo della densità viva (`translateY`), senza passare da React. */
const HourRow = memo(function HourRow(p: {
  m: number;
  major: boolean;
  ppm: SharedValue<number>;
  gutter: number;
  pt: PlannerTheme;
  /** mentre si pizzica le righe che nascono o spariscono per il cambio di scatto sfumano, invece di comparire di colpo */
  fade: boolean;
}) {
  const { m, ppm, pt } = p;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: m * ppm.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      entering={p.fade ? FadeIn.duration(140).reduceMotion(ReduceMotion.System) : undefined}
      exiting={p.fade ? FadeOut.duration(110).reduceMotion(ReduceMotion.System) : undefined}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]}
    >
      <Text
        style={{
          position: 'absolute',
          left: 0,
          width: 41,
          textAlign: 'right',
          top: -8,
          color: p.major ? pt.ink : pt.ink2,
          fontSize: 11.5,
          fontWeight: p.major ? '600' : '500',
          fontFamily: pt.sans,
        }}
      >
        {hhmm(m)}
      </Text>
      <View
        style={{
          marginLeft: p.gutter,
          height: 1,
          backgroundColor: p.major ? pt.hair2 : pt.hair,
        }}
      />
    </Animated.View>
  );
});

/** La riga dell'ora corrente. */
function NowLine(p: { now: number; ppm: SharedValue<number>; gutter: number; pt: PlannerTheme }) {
  const { now, ppm, pt } = p;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: now * ppm.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: p.gutter - 3,
          right: 0,
          height: 1.2,
          backgroundColor: pt.accentInk,
          opacity: 0.7,
        },
        style,
      ]}
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
    </Animated.View>
  );
}

/**
 * La griglia di un giorno: gli orari del passo scelto a sinistra, le righe, i blocchi, la riga dell'ora corrente.
 * `ppm` è la densità (pixel per minuto), un valore condiviso che segue le dita mentre si pizzica: righe, blocchi e
 * altezza della giornata si posizionano da lei sul thread dell'interfaccia (come `--pxm` del sito). `zoom` è lo scatto
 * che ne risulta (3 h, 1 h, 30', 15', 5'): solo quando cambia si scrivono altri orari (`renderGutter` del sito).
 */
export function DayGrid(
  p: Look & {
    day: string;
    events: EventView[];
    zoom: Exclude<Zoom, 'agenda'>;
    ppm: SharedValue<number>;
    width: number;
    now: number | null;
    /** solo le righe che cadono in questa fascia di minuti (la parte visibile e un bel po' attorno) */
    rows?: { from: number; to: number };
    /** si sta pizzicando: le righe del nuovo scatto sfumano dentro */
    pinching?: boolean;
    onOpen: (ev: EventView) => void;
    onToggle: (ev: EventView) => void;
    onEmptyTap: (minutes: number) => void;
    onMove?: (ev: EventView, startMin: number) => void;
    onDragActive?: (active: boolean) => void;
    /** modalità anticipi/ritardi: gli eventi si scelgono toccandoli (uid → scelto) */
    onShiftPick?: (ev: EventView) => void;
    picks?: Record<string, true>;
    /** cosa si sta posando col tocco lungo: colore, nome e (per un'abitudine) i minuti fissi */
    tool?: { color: string; name: string; icon: string | null; fixed: number | null };
    /** il dito è stato alzato dopo un tocco lungo: da quando a quando (minuti dal giorno) */
    onPlace?: (startMin: number, endMin: number) => void;
  },
) {
  const { pt, ppm } = p;
  // 48px di ore, poi la riga verticale e la colonna del giorno (come `--gutter-w` del sito)
  const gutter = 58;
  const blocks = layoutDay(p.events);
  const slotMin = ZOOMS[p.zoom].slotMin;
  const every = majorEvery(p.zoom);
  const tapSlot = Math.min(slotMin, 60);
  const tap = (e: GestureResponderEvent) => {
    const m = e.nativeEvent.locationY / (ppm.value || 1);
    p.onEmptyTap(Math.max(0, Math.min(1440 - tapSlot, Math.floor(m / tapSlot) * tapSlot)));
  };
  // tocco lungo su un punto libero: compare il blocco, il dito lo muove o lo allunga, e al rilascio si posa
  const [ghostPpm, setGhostPpm] = useState(1);
  const rangeOf = (pos: { y0: number; dy: number }, scale: number) =>
    placeRange({
      ...pos,
      ppm: scale,
      fixed: p.tool?.fixed ?? null,
      snap: snapMinutes(p.zoom),
      slot: slotMin,
    });
  const place = useGridPlace({
    onDrop: (y0, dy) => {
      const r = rangeOf({ y0, dy }, ghostPpm);
      p.onPlace?.(r.start, r.end);
    },
    onActive: (a) => {
      if (a) setGhostPpm(ppm.value || 1);
      p.onDragActive?.(a);
    },
  });
  const ghost = place.pos ? rangeOf(place.pos, ghostPpm) : null;
  const ghostColor = p.tool?.color ?? pt.accent;
  const height = useAnimatedStyle(() => ({ height: 1440 * ppm.value }));
  return (
    <Animated.View {...place.panHandlers} style={[{ width: p.width }, height]}>
      <Pressable
        testID="grid-empty"
        accessibilityRole="button"
        onPress={tap}
        onLongPress={p.onPlace ? (e) => place.arm(e.nativeEvent.locationY) : undefined}
        onPressOut={p.onPlace ? place.release : undefined}
        delayLongPress={250}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: gutter - 1,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: pt.hair,
          }}
        />
        {slotStarts(slotMin)
          .filter((m) => !p.rows || (m >= p.rows.from && m <= p.rows.to))
          .map((m) => (
            <HourRow
              key={m}
              m={m}
              major={(m / slotMin) % every === 0}
              ppm={ppm}
              gutter={gutter}
              pt={pt}
              fade={!!p.pinching}
            />
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
          width={p.width - gutter - 8}
          onOpen={p.onOpen}
          onToggle={p.onToggle}
          onMove={p.onMove}
          onDragActive={p.onDragActive}
          onShiftPick={p.onShiftPick}
          shiftPicked={!!p.picks?.[b.ev.uid]}
        />
      ))}
      {ghost ? (
        <View
          testID="place-ghost"
          pointerEvents="none"
          style={{
            position: 'absolute',
            zIndex: 30,
            top: ghost.start * ghostPpm,
            height: Math.max(18, (ghost.end - ghost.start) * ghostPpm - 1),
            left: gutter,
            width: p.width - gutter - 11,
            borderRadius: 12,
            paddingVertical: 4,
            paddingHorizontal: 9,
            overflow: 'hidden',
            opacity: 0.94,
            backgroundColor: blockBackground(pt, ghostColor, 'normal'),
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: ghostColor,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ color: pt.ink, fontSize: 13, fontWeight: '600', fontFamily: pt.sans }}
          >
            {p.tool ? `${p.tool.icon ?? ''} ${p.tool.name}`.trim() : timeOf(ghost.start)}
          </Text>
          <Text
            style={{ color: pt.ink2, fontSize: 10.5, letterSpacing: 0.42, fontFamily: pt.sans }}
          >
            {`${timeOf(ghost.start)} – ${timeOf(ghost.end)}`}
          </Text>
        </View>
      ) : null}
      {p.now !== null ? <NowLine now={p.now} ppm={ppm} gutter={gutter} pt={pt} /> : null}
    </Animated.View>
  );
}

/**
 * La vista a lista («solo eventi»): la giornata diventa un elenco di carte, una sotto l'altra, tutto il giorno
 * compreso (`.pl-agenda` del sito: spazio 7, carte alte almeno 40).
 */
export function AgendaList(
  p: Look & {
    day: string;
    events: EventView[];
    onOpen: (ev: EventView) => void;
    onToggle: (ev: EventView) => void;
  },
) {
  const { t } = useTranslation();
  const { pt } = p;
  const sorted = [...p.events].sort((a, b) => {
    const A = a.allDay || a.multiday ? -1 : minutesOf(a.start);
    const B = b.allDay || b.multiday ? -1 : minutesOf(b.start);
    return A - B;
  });
  return (
    <View
      testID="agenda-list"
      style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 7, minHeight: 360 }}
    >
      {sorted.map((ev) => {
        const color = eventColor(pt, ev, catOf(p, ev));
        const cal = calColor(p, ev);
        const showBox = ev.type === 'task' || !!ev.habitUuid;
        const timed = !(ev.allDay || ev.multiday);
        return (
          <Pressable
            key={ev.uid}
            testID={`ev-${ev.uid}`}
            accessibilityRole="button"
            onPress={() => p.onOpen(ev)}
            style={{
              minHeight: 40,
              paddingVertical: 9,
              paddingHorizontal: 11,
              borderRadius: 12,
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
                width: 3,
                backgroundColor:
                  pt.style === 'standard' ? (cal ?? color) : mix(cal ?? color, '#FFFFFF', 0.82),
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
                numberOfLines={3}
                style={{
                  flex: 1,
                  color: ev.done ? pt.ink2 : pt.ink,
                  fontSize: 13,
                  lineHeight: 16,
                  fontFamily: pt.sans,
                  fontWeight:
                    pt.style === 'standard' || ev.importance === 'highest' ? '600' : '400',
                  textDecorationLine: ev.done ? 'line-through' : 'none',
                }}
              >
                {ev.title}
              </Text>
            </View>
            {timed ? (
              <Text
                style={{
                  color: pt.ink2,
                  fontSize: 10.5,
                  fontWeight: '500',
                  letterSpacing: 0.42,
                  marginTop: 1,
                  fontFamily: pt.sans,
                }}
              >
                {ev.start} – {ev.end}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {!sorted.length ? (
        <Text
          testID="agenda-empty"
          style={{
            color: pt.ink3,
            fontSize: 14,
            fontFamily: pt.serif,
            fontStyle: 'italic',
            textAlign: 'center',
            paddingTop: 60,
          }}
        >
          {t('planner.nessun_evento_in_programma')}
        </Text>
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
