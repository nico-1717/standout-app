import { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { ROW_H } from './calendarGrid';
import type { Preview } from './paintGesture';

/** Acceso o spento adesso? L'anteprima del dito vince su quello che è salvato. */
function isOn(v: number | undefined, saved: boolean): boolean {
  'worklet';
  return v === 1 ? true : v === 2 ? false : saved;
}

export interface DayCellProps {
  index: number;
  day: string;
  /** evidenziato (salvato) per il progetto scelto */
  saved: boolean;
  selColor: string;
  /** il colore del testo sopra il colore del progetto */
  ink: string;
  textColor: string;
  labelColor: string;
  restColor: string;
  edgeColor: string;
  checkColor: string;
  eventColor: string | null;
  isToday: boolean;
  /** la casella è sbiadita (fuori mese o passata) */
  fade: number;
  rest: boolean;
  label: string;
  done: boolean;
  preview: Preview;
  onPress: (day: string) => void;
}

const FILL_MS = 70;

/**
 * Una casella del calendario. Il colore del progetto, il numero e l'ora cambiano da soli, sul thread dell'interfaccia,
 * guardando `preview` (dove passa il dito): per questo si può disegnare senza che React rifaccia le 42 caselle.
 * Le linee degli altri progetti non stanno qui: le disegna `CalendarLines` sopra tutta la griglia, in un tratto solo.
 */
export const DayCell = memo(function DayCell(p: DayCellProps) {
  const { preview, index, saved, ink, textColor, labelColor } = p;
  const fill = useAnimatedStyle(() => ({
    opacity: withTiming(isOn(preview.value[index], saved) ? 1 : 0, { duration: FILL_MS }),
  }));
  const num = useAnimatedStyle(() => ({
    color: isOn(preview.value[index], saved) ? ink : textColor,
  }));
  const lab = useAnimatedStyle(() => ({
    color: isOn(preview.value[index], saved) ? ink : labelColor,
  }));
  return (
    <Pressable
      testID={`cal-day-${p.day}`}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={p.day}
      onPress={() => p.onPress(p.day)}
      style={{ width: `${100 / 7}%`, height: ROW_H, padding: 2 }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 12,
          alignItems: 'center',
          paddingTop: 4,
          overflow: 'hidden',
          backgroundColor: p.rest ? p.restColor : 'transparent',
          borderWidth: p.isToday ? 1.5 : 0,
          borderColor: p.edgeColor,
          opacity: p.fade,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
            { backgroundColor: p.selColor },
            fill,
          ]}
        />
        <Animated.Text style={[{ fontWeight: p.isToday ? '800' : '600', fontSize: 14 }, num]}>
          {Number(p.day.slice(8, 10))}
        </Animated.Text>
        {p.label ? (
          <Animated.Text
            style={[
              {
                position: 'absolute',
                bottom: 2,
                fontSize: 10,
                fontVariant: ['tabular-nums'],
              },
              lab,
            ]}
          >
            {p.label}
          </Animated.Text>
        ) : null}
        {p.eventColor ? (
          <View
            testID={`cal-ev-${p.day}`}
            style={{
              position: 'absolute',
              top: 4,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: p.eventColor,
            }}
          />
        ) : null}
        {p.done ? (
          <Animated.Text
            style={[
              { position: 'absolute', top: 2, left: 6, fontSize: 10, fontWeight: '800' },
              { color: p.checkColor },
            ]}
          >
            ✓
          </Animated.Text>
        ) : null}
      </View>
    </Pressable>
  );
});
