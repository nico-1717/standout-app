import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { cardShadow } from '@/ui/kit';

import { Field, Segmented, Stepper, Swatches } from './formParts';
import type { HabitSettings } from './habitSettings';
import type { HabitsTheme } from './habitsTheme';
import type { Habit } from './logic';
import { palette } from './presets';
import { Sheet } from './Sheet';

export interface SettingsSheetProps {
  visible: boolean;
  settings: HabitSettings;
  archived: Habit[];
  th: HabitsTheme;
  onChange: (patch: Partial<HabitSettings>) => void;
  onRestore: (h: Habit) => void;
  onReorder: () => void;
  onClose: () => void;
}

type ToggleKey =
  | 'group_by_day_part'
  | 'carousel_autoplay'
  | 'confetti_enabled'
  | 'haptics_enabled'
  | 'sound_enabled';

/** «Impostazioni» (#hbSheetSettings del sito): colore, giorni in barra, finestra dei grafici, interruttori, archiviate. */
export function SettingsSheet(p: SettingsSheetProps) {
  const { t } = useTranslation();
  const { th, settings: s } = p;
  const colors = useMemo(() => palette(t), [t]);
  const toggles: { key: ToggleKey; label: string; desc: string }[] = [
    {
      key: 'group_by_day_part',
      label: t('abitudini.raggruppa_per_momento'),
      desc: t('abitudini.mattina_pomeriggio_sera_notte'),
    },
    {
      key: 'carousel_autoplay',
      label: t('abitudini.statistiche_a_scorrimento'),
      desc: t('abitudini.le_schede_in_alto_scorrono'),
    },
    {
      key: 'confetti_enabled',
      label: t('abitudini.coriandoli'),
      desc: t('abitudini.festeggia_ogni_completamento'),
    },
    {
      key: 'haptics_enabled',
      label: t('abitudini.vibrazione'),
      desc: t('abitudini.piccolo_riscontro_tattile'),
    },
    {
      key: 'sound_enabled',
      label: t('abitudini.suono'),
      desc: t('abitudini.un_tocco_sonoro_alla_spunta'),
    },
  ];

  return (
    <Sheet
      visible={p.visible}
      title={t('comune.impostazioni')}
      th={th}
      onClose={p.onClose}
      testID="settings-sheet"
    >
      {p.visible && (
        <ScrollView contentContainerStyle={styles.body}>
          <Field th={th} label={t('abitudini.colore_della_pagina')}>
            <Swatches
              colors={colors}
              value={s.accent_color}
              th={th}
              onChange={(hex) => p.onChange({ accent_color: hex })}
            />
          </Field>

          <Field th={th} label={t('abitudini.giorni_nella_barra_in_alto')}>
            <Stepper
              testID="set-days"
              value={s.visible_days}
              min={5}
              max={31}
              step={1}
              th={th}
              label={t('abitudini.giorni_l')}
              onChange={(n) => p.onChange({ visible_days: n })}
            />
          </Field>

          <Field th={th} label={t('abitudini.finestra_dei_grafici')}>
            <Segmented
              testPrefix="set-range"
              th={th}
              value={String(s.chart_range_days)}
              items={[7, 30, 90, 365].map((n) => ({ key: String(n), label: `${n}g` }))}
              onChange={(k) => p.onChange({ chart_range_days: Number(k) })}
            />
          </Field>

          <View
            style={[styles.card, { backgroundColor: th.surface }, cardShadow(th.scheme === 'dark')]}
          >
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 15.5 }}>
                  {t('abitudini.ordine_dell_elenco')}
                </Text>
                <Text style={{ color: th.text2, fontSize: 13, marginTop: 2 }}>
                  {t('abitudini.decidi_tu_quali_abitudini_stanno')}
                </Text>
              </View>
              <Pressable
                testID="open-reorder"
                accessibilityRole="button"
                onPress={p.onReorder}
                style={[styles.btn, { backgroundColor: th.surface2 }]}
              >
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>
                  {t('abitudini.riordina_b')}
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            style={[styles.card, { backgroundColor: th.surface }, cardShadow(th.scheme === 'dark')]}
          >
            {toggles.map((x, i) => (
              <View
                key={x.key}
                style={[
                  styles.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: th.hairline2,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontWeight: '700', fontSize: 15.5 }}>
                    {x.label}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 13, marginTop: 2 }}>{x.desc}</Text>
                </View>
                <Switch
                  testID={`set-${x.key}`}
                  value={s[x.key]}
                  onValueChange={(v) => p.onChange({ [x.key]: v })}
                  trackColor={{ true: th.accent, false: th.surface3 }}
                />
              </View>
            ))}
          </View>

          {p.archived.length > 0 && (
            <View
              style={[
                styles.card,
                { backgroundColor: th.surface },
                cardShadow(th.scheme === 'dark'),
              ]}
            >
              <View style={styles.row}>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 16, flex: 1 }}>
                  {t('abitudini.archiviate')}
                </Text>
                <Text style={{ color: th.text2, fontWeight: '700' }}>{p.archived.length}</Text>
              </View>
              {p.archived.map((h) => (
                <View
                  key={h.uuid}
                  style={[
                    styles.row,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: th.hairline2 },
                  ]}
                >
                  <Text
                    style={{ color: th.text, fontWeight: '700', fontSize: 15, flex: 1 }}
                    numberOfLines={1}
                  >
                    {h.icon} {h.name}
                  </Text>
                  <Pressable
                    testID={`restore-${h.uuid}`}
                    accessibilityRole="button"
                    onPress={() => p.onRestore(h)}
                    style={[styles.btn, { backgroundColor: th.surface2 }]}
                  >
                    <Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>
                      {t('abitudini.ripristina')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 30 },
  card: { borderRadius: 22, paddingHorizontal: 16, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  btn: { borderRadius: 14, paddingHorizontal: 15, paddingVertical: 9 },
});
