import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/features/habits/Sheet';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { hours, weekdayName } from './format';
import type { ResolvedSettings, StoredSettings } from './repo';
import { Choices, HoursInput, Row, Stepper, usePlanTheme } from './ui';

/**
 * «Il tuo tempo»: ore libere nei giorni feriali e nel weekend (di base quelle misurate dai tuoi pomodori), giorno di riposo,
 * giorni cuscinetto prima di un esame, blocco minimo, quante cose al giorno e i ripassi (settings_save del sito).
 */
export function TimeSheet(p: {
  visible: boolean;
  settings: ResolvedSettings;
  lang: string;
  onSave: (s: StoredSettings) => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<StoredSettings>(p.settings.stored);
  const [wasOpen, setWasOpen] = useState(p.visible);
  if (p.visible !== wasOpen) {
    setWasOpen(p.visible);
    if (p.visible) setDraft(p.settings.stored);
  }
  const set = (patch: Partial<StoredSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const m = p.settings.measured;
  const weekday = draft.weekdayMin ?? m.weekday;
  const weekend = draft.weekendMin ?? m.weekend;
  const measuredLine = m.enough ? t('piano.misurato_da', { n: m.days }) : t('piano.misurato_poco');

  return (
    <Sheet
      visible={p.visible}
      title={t('piano.il_tuo_tempo')}
      th={ht}
      onClose={p.onClose}
      testID="time-sheet"
      footer={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextButton testID="time-cancel" label={t('piano.chiudi')} onPress={p.onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              testID="time-save"
              label={t('piano.salva')}
              onPress={() => p.onSave(draft)}
            />
          </View>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text testID="time-measured" style={{ color: ht.text2, fontSize: 13, lineHeight: 18 }}>
          {measuredLine}
        </Text>

        <Row>
          <HoursInput
            testID="time-weekday"
            label={t('piano.feriali')}
            unit={t('piano.ore')}
            minutes={weekday}
            max={1440}
            minusLabel={t('piano.meno')}
            plusLabel={t('piano.piu')}
            onChange={(v) => set({ weekdayMin: v })}
          />
          <HoursInput
            testID="time-weekend"
            label={t('piano.festivi')}
            unit={t('piano.ore')}
            minutes={weekend}
            max={1440}
            minusLabel={t('piano.meno')}
            plusLabel={t('piano.piu')}
            onChange={(v) => set({ weekendMin: v })}
          />
          {draft.weekdayMin !== null || draft.weekendMin !== null ? (
            <TextButton
              testID="time-use-measured"
              label={t('piano.usa_misurato', { h: `${hours(m.weekday)} / ${hours(m.weekend)}` })}
              onPress={() => set({ weekdayMin: null, weekendMin: null })}
            />
          ) : null}
        </Row>

        <Row label={t('piano.giorno_riposo')}>
          <Choices
            testID="time-rest"
            value={draft.restDow}
            onChange={(restDow) => set({ restDow })}
            options={[
              { value: 0, label: t('piano.nessun_riposo') },
              ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({
                value: d,
                label: weekdayName(d, p.lang, 'short'),
              })),
            ]}
          />
        </Row>

        <Row hint={t('piano.giorni_cuscinetto_h')}>
          <Stepper
            testID="time-buffer"
            label={t('piano.giorni_cuscinetto')}
            value={draft.bufferDays}
            step={1}
            min={0}
            max={14}
            format={(v) => `${v} ${t('piano.giorni')}`}
            onChange={(bufferDays) => set({ bufferDays })}
          />
        </Row>

        <Row hint={t('piano.blocco_minimo_h')}>
          <Stepper
            testID="time-floor"
            label={t('piano.blocco_minimo')}
            value={draft.floorMin}
            step={5}
            min={5}
            max={120}
            format={(v) => `${v} min`}
            onChange={(floorMin) => set({ floorMin })}
          />
        </Row>

        <Row hint={t('piano.materie_giorno_h')}>
          <Stepper
            testID="time-subjects"
            label={t('piano.materie_giorno')}
            value={draft.maxSubjects}
            step={1}
            min={1}
            max={8}
            format={(v) => String(v)}
            onChange={(maxSubjects) => set({ maxSubjects })}
          />
        </Row>

        <Row hint={t('piano.ripassi_h')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: ht.text, flex: 1, fontSize: 15 }}>{t('piano.ripassi')}</Text>
            <Switch
              testID="time-reviews"
              value={draft.reviews}
              onValueChange={(reviews) => set({ reviews })}
              trackColor={{ true: ht.accent }}
            />
          </View>
        </Row>
      </ScrollView>
    </Sheet>
  );
}
