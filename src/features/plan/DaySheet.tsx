import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/features/habits/Sheet';
import { PrimaryButton, TextButton } from '@/ui/kit';

import type { BlockKind } from './engine';
import { dayLabel, hours } from './format';
import { HoursInput, Row, usePlanTheme } from './ui';

export interface DayRow {
  project: string;
  name: string;
  color: string;
  kind: BlockKind;
  minutes: number;
  source: 'auto' | 'manual';
  done: number;
}

/**
 * Un giorno del calendario: i blocchi di studio (si cambiano le ore a mano), le ore libere di quel giorno (e «giorno libero»),
 * e, se c'è un progetto scelto, «Aggiungi 30 min» e l'evidenziatore.
 */
export function DaySheet(p: {
  visible: boolean;
  day: string;
  lang: string;
  cap: number;
  busy: number;
  capOverridden: boolean;
  rows: DayRow[];
  /** il progetto scelto nel calendario, se c'è */
  focus: { uuid: string; name: string; painted: boolean } | null;
  onSetBlock: (project: string, minutes: number) => void;
  onAddBlock: (project: string) => void;
  onSetCap: (minutes: number | null) => void;
  onTogglePaint: () => void;
  onStart: (project: string, minutes: number) => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  return (
    <Sheet
      visible={p.visible}
      title={dayLabel(p.day, p.lang, { weekday: 'long', day: 'numeric', month: 'long' })}
      th={ht}
      onClose={p.onClose}
      testID="day-sheet"
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Row>
          <Text testID="day-cap" style={{ color: ht.text, fontWeight: '700', fontSize: 15 }}>
            {t('piano.tempo_giorno', { h: hours(p.cap) })}
          </Text>
          {p.busy > 0 ? (
            <Text testID="day-busy" style={{ color: ht.text2, fontSize: 13 }}>
              {t('piano.occupato_planner', { h: hours(p.busy) })}
            </Text>
          ) : null}
        </Row>

        {p.rows.length === 0 ? (
          <Text testID="day-empty" style={{ color: ht.text2 }}>
            {t('piano.giorno_vuoto')}
          </Text>
        ) : (
          p.rows.map((r) => (
            <View
              key={`${r.project}-${r.kind}`}
              style={{ gap: 8, backgroundColor: ht.surface, borderRadius: 18, padding: 14 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color }}
                />
                <Text style={{ color: ht.text, flex: 1, fontWeight: '700' }} numberOfLines={1}>
                  {r.name}
                  {r.kind === 'review' ? ` · ${t('piano.ripasso')}` : ''}
                </Text>
                {r.done > 0 ? (
                  <Text style={{ color: ht.green, fontSize: 12 }}>
                    {t('piano.fatto_di', { a: hours(r.done), b: hours(r.minutes) })}
                  </Text>
                ) : null}
              </View>
              {r.kind === 'study' ? (
                <HoursInput
                  testID={`day-block-${r.project}`}
                  label={t('piano.ore')}
                  unit={t('piano.ore')}
                  minutes={r.minutes}
                  max={1440}
                  minusLabel={t('piano.meno')}
                  plusLabel={t('piano.piu')}
                  onChange={(m) => p.onSetBlock(r.project, m)}
                />
              ) : (
                <Text style={{ color: ht.text2 }}>{hours(r.minutes)}</Text>
              )}
              <TextButton
                testID={`day-start-${r.project}`}
                label={t('piano.avvia', { n: r.name })}
                onPress={() => p.onStart(r.project, Math.max(1, r.minutes - r.done))}
              />
            </View>
          ))
        )}

        {p.focus ? (
          <Row>
            <PrimaryButton
              testID="day-add30"
              label={`${t('piano.aggiungi_blocco')} · ${p.focus.name}`}
              onPress={() => p.onAddBlock(p.focus!.uuid)}
            />
            <Pressable
              testID="day-paint"
              accessibilityRole="button"
              accessibilityState={{ selected: p.focus.painted }}
              onPress={p.onTogglePaint}
              style={{
                padding: 12,
                alignItems: 'center',
                borderRadius: 14,
                backgroundColor: p.focus.painted ? ht.accent : ht.surface2,
              }}
            >
              <Text style={{ color: p.focus.painted ? '#fff' : ht.text, fontWeight: '700' }}>
                {p.focus.painted ? t('piano.cancella') : t('piano.evidenzia')}
              </Text>
            </Pressable>
          </Row>
        ) : null}

        <Row label={t('piano.ore_libere_giorno')}>
          <HoursInput
            testID="day-capacity"
            label={t('piano.imposta_giorno')}
            unit={t('piano.ore')}
            minutes={p.cap + p.busy}
            max={1440}
            minusLabel={t('piano.meno')}
            plusLabel={t('piano.piu')}
            onChange={(m) => p.onSetCap(m)}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextButton
                testID="day-free"
                label={t('piano.giorno_libero')}
                onPress={() => p.onSetCap(0)}
              />
            </View>
            {p.capOverridden ? (
              <View style={{ flex: 1 }}>
                <TextButton
                  testID="day-normal"
                  label={t('piano.annulla')}
                  onPress={() => p.onSetCap(null)}
                />
              </View>
            ) : null}
          </View>
        </Row>
      </ScrollView>
    </Sheet>
  );
}
