import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import { Pick, clockOf, hhmmOf } from './Pick';
import { fieldBox } from './sheetUi';
import type { PlannerTheme } from './plannerTheme';

type Lock = 'auto' | 'chiuso' | 'aperto';

/** «45 min», «1h», «1h 30»: come `durLabel` del sito. */
export function durationLabel(mins: number, minLabel: (n: number) => string): string {
  if (mins < 60) return minLabel(mins);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${String(m).padStart(2, '0')}` : `${h}h`;
}

const LINE_H = 46;
const RAIL = 22;
const GAP = 10;
/** la pillola «durata · lucchetto · tutto il giorno»: bassa, e la linea si ferma sopra e sotto perché è trasparente */
const PILL_H = 28;
const MID_H = 40;

/**
 * Il «quando» del foglio, disegnato come una linea: un punto per l'inizio, uno per la fine, e sulla linea che li unisce
 * una pillola con la durata, il lucchetto e «tutto il giorno», infilata sul filo (il filo le passa in mezzo all'orologio).
 * Inizio e fine hanno la stessa forma (data + ora); la durata è un campo ora (01:30) nella pillola.
 */
export function WhenField(p: {
  pt: PlannerTheme;
  date: string;
  endDate: string;
  start: string;
  end: string;
  allDay: boolean;
  lock: Lock;
  /** durata in minuti */
  minutes: number;
  lockLabel: string;
  onDate: (v: string) => void;
  onEndDate: (v: string) => void;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onDuration: (mins: number) => void;
  onLock: () => void;
  onAllDay: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const minLabel = (n: number) => t('planner.n_min', { n });
  const decided = p.lock !== 'auto';
  const lockColor = decided ? pt.accentInk : pt.ink3;
  // la durata come ora (01:30): ore e minuti, mai di più di un giorno; 00:00 non è una durata
  const durationValue = clockOf(
    `${String(Math.floor(Math.min(1439, p.minutes) / 60)).padStart(2, '0')}:${String(Math.min(1439, p.minutes) % 60).padStart(2, '0')}`,
  );
  const pickDuration = (d: Date) => {
    const mins = Number(hhmmOf(d).slice(0, 2)) * 60 + Number(hhmmOf(d).slice(3));
    if (mins > 0) p.onDuration(mins);
  };
  const openAndroidDuration = () =>
    DateTimePickerAndroid.open({
      value: durationValue,
      mode: 'time',
      is24Hour: true,
      onValueChange: (_, d) => d && pickDuration(d),
    });

  const line = (
    label: string,
    date: { id: string; value: string; onChange: (v: string) => void; dim?: boolean },
    time?: { id: string; value: string; onChange: (v: string) => void },
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: LINE_H,
      }}
    >
      <Text style={{ flex: 1, color: pt.ink2, fontSize: 14.5, fontFamily: pt.sans }}>{label}</Text>
      {/* data e ora in un solo riquadro: un filo in mezzo, niente spazio fra le due (`.pl-dt` del sito) */}
      <View
        style={[
          time ? fieldBox(pt) : null,
          { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
        ]}
      >
        <Pick
          pt={pt}
          kind="date"
          testID={date.id}
          value={date.value}
          dim={date.dim}
          short
          bare={!!time}
          onChange={(v) => v && date.onChange(v)}
        />
        {time ? (
          <>
            <View
              style={{
                width: 0.5,
                alignSelf: 'stretch',
                marginVertical: 7,
                backgroundColor: pt.hair2,
              }}
            />
            <Pick
              pt={pt}
              kind="time"
              bare
              testID={time.id}
              value={time.value}
              onChange={(v) => v && time.onChange(v)}
            />
          </>
        ) : null}
      </View>
    </View>
  );

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* la linea: un punto vuoto (inizio), un punto pieno (fine) e il filo in mezzo */}
        <View style={{ width: RAIL, marginRight: GAP }} pointerEvents="none">
          {[{ top: LINE_H / 2 }, { bottom: LINE_H / 2 }].map((edge, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                ...edge,
                left: RAIL / 2 - 1,
                width: 2,
                height: LINE_H / 2 + (MID_H - PILL_H) / 2,
                borderRadius: 1,
                backgroundColor: pt.accent,
                opacity: 0.5,
              }}
            />
          ))}
          <View
            style={{
              position: 'absolute',
              top: LINE_H / 2 - 6,
              left: RAIL / 2 - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: pt.accent,
              backgroundColor: pt.card,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: LINE_H / 2 - 6,
              left: RAIL / 2 - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: pt.accent,
            }}
          />
        </View>

        <View style={{ flex: 1 }}>
          {line(
            t('planner.inizio_t'),
            { id: 'sheet-date', value: p.date, onChange: p.onDate },
            p.allDay ? undefined : { id: 'sheet-start', value: p.start, onChange: p.onStart },
          )}

          {/* sulla linea: durata · lucchetto · tutto il giorno */}
          <View
            style={{ height: MID_H, justifyContent: 'center', marginLeft: -(RAIL + GAP + 11.5) }}
          >
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                height: PILL_H,
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: pt.glassEdge,
                backgroundColor: pt.glass,
                overflow: 'hidden',
              }}
            >
              {!p.allDay ? (
                <>
                  <Pressable
                    testID="sheet-duration-pill"
                    accessibilityRole="button"
                    accessibilityLabel={t('planner.durata')}
                    disabled={Platform.OS === 'ios'}
                    onPress={openAndroidDuration}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      paddingVertical: 0,
                      alignSelf: 'stretch',
                      paddingLeft: 13,
                      paddingRight: 14,
                    }}
                  >
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                      <Circle cx={12} cy={12} r={9} stroke={pt.ink3} strokeWidth={2} />
                      <Path
                        d="M12 7v5l3 2"
                        stroke={pt.ink3}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </Svg>
                    <Text
                      style={{
                        color: pt.ink,
                        fontSize: 12.5,
                        fontWeight: '600',
                        fontFamily: pt.sans,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {durationLabel(p.minutes, minLabel)}
                    </Text>
                    {/* iPhone: il selettore dell'ora di sistema sta sopra alla durata, trasparente, e prende lui il tocco */}
                    {Platform.OS === 'ios' ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          opacity: 0.011,
                        }}
                      >
                        <DateTimePicker
                          testID="sheet-duration"
                          value={durationValue}
                          mode="time"
                          display="compact"
                          themeVariant={pt.dark ? 'dark' : 'light'}
                          onValueChange={(_, d) => d && pickDuration(d)}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                  <View style={{ width: 0.5, alignSelf: 'stretch', backgroundColor: pt.hair }} />
                  <Pressable
                    testID="sheet-lock"
                    accessibilityRole="button"
                    accessibilityLabel={p.lockLabel}
                    accessibilityState={{ checked: p.lock === 'chiuso' }}
                    onPress={p.onLock}
                    hitSlop={{ top: 6, bottom: 6 }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 0,
                      alignSelf: 'stretch',
                      opacity: p.lock === 'auto' ? 0.45 : 1,
                      backgroundColor: decided ? pt.accentSoft : 'transparent',
                    }}
                  >
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M7.2 11h9.6a2.2 2.2 0 012.2 2.2v4.6a2.2 2.2 0 01-2.2 2.2H7.2A2.2 2.2 0 015 17.8v-4.6A2.2 2.2 0 017.2 11z"
                        stroke={lockColor}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d={
                          p.lock === 'aperto'
                            ? 'M8.5 11V8a3.5 3.5 0 016.9-1.2'
                            : 'M8.5 11V8a3.5 3.5 0 017 0v3'
                        }
                        stroke={lockColor}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                      />
                      {p.lock === 'auto' ? (
                        <Path
                          d="M4.6 19.4L19.4 4.6"
                          stroke={lockColor}
                          strokeWidth={1.8}
                          strokeLinecap="round"
                        />
                      ) : null}
                    </Svg>
                  </Pressable>
                  <View style={{ width: 0.5, alignSelf: 'stretch', backgroundColor: pt.hair }} />
                </>
              ) : null}
              <Pressable
                testID="sheet-allday"
                accessibilityRole="switch"
                accessibilityState={{ checked: p.allDay }}
                onPress={() => p.onAllDay(!p.allDay)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 0,
                  alignSelf: 'stretch',
                  paddingLeft: 10,
                  paddingRight: 12,
                  backgroundColor: p.allDay ? pt.accentSoft : 'transparent',
                }}
              >
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Circle
                    cx={12}
                    cy={12}
                    r={4}
                    stroke={p.allDay ? pt.accentInk : pt.ink3}
                    strokeWidth={2}
                  />
                  <Path
                    d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"
                    stroke={p.allDay ? pt.accentInk : pt.ink3}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text
                  style={{
                    color: p.allDay ? pt.accentInk : pt.ink2,
                    fontSize: 12.5,
                    fontWeight: p.allDay ? '600' : '500',
                    fontFamily: pt.sans,
                  }}
                >
                  {t('planner.tutto_il_giorno')}
                </Text>
              </Pressable>
            </View>
          </View>

          {line(
            t('planner.fine_t'),
            {
              id: 'sheet-enddate',
              value: p.endDate,
              onChange: p.onEndDate,
              dim: p.endDate === p.date,
            },
            p.allDay ? undefined : { id: 'sheet-end', value: p.end, onChange: p.onEnd },
          )}
        </View>
      </View>
    </View>
  );
}
