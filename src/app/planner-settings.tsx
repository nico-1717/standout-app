import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Fold, PlSlider } from '@/features/planner/SettingsParts';
import { PALETTES, plannerTheme, type PaletteKey } from '@/features/planner/plannerTheme';
import { ZOOMS, type Zoom } from '@/features/planner/settings';
import {
  Field,
  RowSB,
  SelectField,
  SheetGlyph,
  SheetPanel,
  Swatch,
  Toggle,
  TxtBtn,
} from '@/features/planner/sheetUi';
import { Text } from '@/ui/CappedText';

const ZOOM_LABEL: Record<Zoom, string> = {
  agenda: 'planner.solo_eventi',
  h3: 'planner.3_ore',
  h1: 'planner.1_ora',
  m30: 'planner.30_minuti',
  m15: 'planner.15_minuti',
  m5: 'planner.5_minuti',
};

/**
 * Il popup «Impostazioni» del planner, com'è sul sito (plSheetOv + openSettings): il foglio dal basso con la maniglia, il
 * titolo con «Chiudi», il colore della pagina, le sezioni che si aprono (categorie, routine) e «Sulla pagina» con le righe
 * etichetta a sinistra e controllo a destra (interruttori, cursori, menu degli scatti).
 */
export default function PlannerSettingsScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    services,
    version,
    uiStyle,
    plannerSettings: s,
    updatePlannerSettings: update,
  } = useApp();
  const pt = plannerTheme(uiStyle, th, s.palette, s.contrast_level);
  const repo = services?.planner ?? null;
  const lists = useMemo(() => {
    void version;
    const byName = <T extends { name: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.name.localeCompare(b.name));
    return repo
      ? { cats: byName(repo.categories()), routines: byName(repo.routines()) }
      : { cats: [], routines: [] };
  }, [repo, version]);

  const close = () => router.back();
  const row = (label: string, onPress: () => void, color: string, testID: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: pt.hair,
      }}
    >
      <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: color }} />
      <Text style={{ flex: 1, color: pt.ink, fontSize: 14.5, fontFamily: pt.sans }}>{label}</Text>
      <SheetGlyph name="chevron" color={pt.ink3} size={14} />
    </Pressable>
  );
  const add = (label: string, onPress: () => void, testID: string) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        padding: 11,
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: pt.hair2,
      }}
    >
      <Text style={{ color: pt.accentInk, fontSize: 16, fontFamily: pt.sans }}>+</Text>
      <Text style={{ color: pt.accentInk, fontSize: 14, fontFamily: pt.sans }}>{label}</Text>
    </Pressable>
  );

  return (
    <SheetPanel
      pt={pt}
      tall
      onBackdrop={close}
      onClose={close}
      head={
        <>
          <Text style={{ color: pt.ink, fontSize: 20, fontFamily: pt.serif }}>
            {t('planner.impostazioni')}
          </Text>
          <TxtBtn pt={pt} testID="ps-done" label={t('comune.chiudi')} onPress={close} />
        </>
      }
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {uiStyle === 'paper' ? (
          <Field pt={pt} label={t('planner.colore_della_pagina')}>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
              {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
                <Swatch
                  key={k}
                  pt={pt}
                  testID={`ps-palette-${k}`}
                  color={PALETTES[k][0]}
                  on={s.palette === k}
                  onPress={() => update({ palette: k })}
                />
              ))}
            </View>
          </Field>
        ) : null}

        <Fold
          pt={pt}
          testID="ps-fold-categories"
          title={t('planner.categorie')}
          count={lists.cats.length}
        >
          {lists.cats.map((c) =>
            row(c.name, () => router.push('/planner-manage'), c.color, `ps-cat-${c.uuid}`),
          )}
          {add(t('planner.nuova_categoria'), () => router.push('/planner-manage'), 'ps-cat-add')}
        </Fold>

        <Fold
          pt={pt}
          testID="ps-fold-routines"
          title={t('planner.routine_t')}
          count={lists.routines.length}
        >
          {lists.routines.map((r) =>
            row(r.name, () => router.push('/planner-routines'), r.color, `ps-routine-${r.uuid}`),
          )}
          {add(
            t('planner.nuova_routine'),
            () => router.push('/planner-routines'),
            'ps-routine-add',
          )}
        </Fold>

        <Field pt={pt} label={t('planner.sulla_pagina')}>
          <RowSB pt={pt} label={t('planner.frasi_motivazionali')}>
            <Toggle
              pt={pt}
              testID="ps-motivational"
              on={s.show_motivational}
              onChange={(v) => update({ show_motivational: v })}
            />
          </RowSB>
          <RowSB pt={pt} label={t('planner.affermazioni_positive')}>
            <Toggle
              pt={pt}
              testID="ps-affirmations"
              on={s.show_affirmations}
              onChange={(v) => update({ show_affirmations: v })}
            />
          </RowSB>
          {uiStyle === 'paper' ? (
            <RowSB pt={pt} label={t('planner.alberi_e_animali')}>
              <Toggle
                pt={pt}
                testID="ps-ambient"
                on={s.ambient_enabled}
                onChange={(v) => update({ ambient_enabled: v })}
              />
            </RowSB>
          ) : null}
          {uiStyle === 'paper' && s.ambient_enabled ? (
            <RowSB pt={pt} label={t('planner.quanto_si_vedono')}>
              <PlSlider
                pt={pt}
                testID="ps-ambient-opacity"
                label={t('planner.quanto_si_vedono')}
                min={0}
                max={10}
                value={s.ambient_opacity}
                onChange={(v) => update({ ambient_opacity: v })}
              />
            </RowSB>
          ) : null}
          <RowSB pt={pt} label={t('planner.scatti_degli_orari')}>
            <SelectField
              pt={pt}
              testID="ps-zoom"
              title={t('planner.scatti_degli_orari')}
              value={s.zoom}
              options={ZOOMS.map((z) => ({ id: z, label: t(ZOOM_LABEL[z]) }))}
              onChange={(z) => update({ zoom: z })}
            />
          </RowSB>
          <RowSB pt={pt} label={t('planner.quanto_marcato')} last={width < 760}>
            <PlSlider
              pt={pt}
              testID="ps-contrast"
              label={t('planner.quanto_marcato')}
              min={1}
              max={5}
              value={s.contrast_level}
              onChange={(v) => update({ contrast_level: v })}
            />
          </RowSB>
          {width >= 760 ? (
            <RowSB pt={pt} label={t('planner.giorni_affiancati')} last>
              <PlSlider
                pt={pt}
                testID="ps-days"
                label={t('planner.giorni_affiancati')}
                min={1}
                max={7}
                value={s.days_visible}
                onChange={(v) => update({ days_visible: v })}
              />
            </RowSB>
          ) : null}
        </Field>
      </ScrollView>
    </SheetPanel>
  );
}
