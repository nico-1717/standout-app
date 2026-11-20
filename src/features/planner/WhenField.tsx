import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import { parseDuration } from './durationInput';
import { Pick } from './Pick';
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

/**
 * Il «quando» del foglio, disegnato come una linea: un punto per l'inizio, uno per la fine, e sulla linea che li unisce
 * una pillola con la durata, il lucchetto e «tutto il giorno», infilata sul filo (il filo le passa in mezzo all'orologio).
 * Inizio e fine hanno la stessa forma (data + ora); la durata si scrive toccandola nella pillola.
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
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const editingRef = useRef(false);
  const startEdit = () => {
    editingRef.current = true;
    setText(String(Math.max(1, p.minutes)));
    setEditing(true);
  };
  // invio e perdita del fuoco arrivano di seguito: la durata si applica una volta sola
  const finishEdit = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    const mins = parseDuration(text);
    if (mins) p.onDuration(mins);
  };
  const minLabel = (n: number) => t('planner.n_min', { n });
  const decided = p.lock !== 'auto';
  const lockColor = decided ? pt.accentInk : pt.ink3;

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
      <Pick
        pt={pt}
        kind="date"
        testID={date.id}
        value={date.value}
        dim={date.dim}
        short
        onChange={(v) => v && date.onChange(v)}
      />
      {time ? (
        <Pick
          pt={pt}
          kind="time"
          testID={time.id}
          value={time.value}
          onChange={(v) => v && time.onChange(v)}
        />
      ) : null}
    </View>
  );

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* la linea: un punto vuoto (inizio), un punto pieno (fine) e il filo in mezzo */}
        <View style={{ width: RAIL, marginRight: GAP }} pointerEvents="none">
          <View
            style={{
              position: 'absolute',
              top: LINE_H / 2,
              bottom: LINE_H / 2,
              left: RAIL / 2 - 1,
              width: 2,
              borderRadius: 1,
              backgroundColor: pt.accent,
              opacity: 0.5,
            }}
          />
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
          <View style={{ minHeight: 40, justifyContent: 'center', marginLeft: -(RAIL + GAP + 14) }}>
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: pt.hair2,
                backgroundColor: pt.card,
                overflow: 'hidden',
              }}
            >
              {!p.allDay ? (
                <>
                  <Pressable
                    testID="sheet-duration-pill"
                    accessibilityRole="button"
                    accessibilityLabel={t('planner.durata')}
                    accessibilityState={{ expanded: editing }}
                    onPress={startEdit}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      paddingVertical: 7,
                      paddingLeft: 16,
                      paddingRight: 14,
                      backgroundColor: editing ? pt.accentSoft : 'transparent',
                    }}
                  >
                    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                      <Circle cx={12} cy={12} r={9} stroke={pt.ink3} strokeWidth={2} />
                      <Path
                        d="M12 7v5l3 2"
                        stroke={pt.ink3}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </Svg>
                    {editing ? (
                      <TextInput
                        testID="sheet-duration"
                        autoFocus
                        selectTextOnFocus
                        keyboardType="numbers-and-punctuation"
                        returnKeyType="done"
                        value={text}
                        onChangeText={setText}
                        onSubmitEditing={finishEdit}
                        onBlur={finishEdit}
                        accessibilityLabel={t('planner.durata')}
                        style={{
                          width: 54,
                          padding: 0,
                          color: pt.ink,
                          fontSize: 13,
                          fontWeight: '600',
                          fontFamily: pt.sans,
                          fontVariant: ['tabular-nums'],
                        }}
                      />
                    ) : (
                      <Text
                        style={{
                          color: pt.ink,
                          fontSize: 13,
                          fontWeight: '600',
                          fontFamily: pt.sans,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {durationLabel(p.minutes, minLabel)}
                      </Text>
                    )}
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
                      paddingVertical: 7,
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
                  paddingVertical: 7,
                  paddingLeft: 10,
                  paddingRight: 12,
                  backgroundColor: p.allDay ? pt.accentSoft : 'transparent',
                }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
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
                    fontSize: 13,
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
