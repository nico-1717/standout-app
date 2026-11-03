import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { PALETTES, plannerTheme, type PaletteKey } from '@/features/planner/plannerTheme';
import { ZOOMS, type Zoom } from '@/features/planner/settings';

const ZOOM_LABEL: Record<Zoom, string> = {
  agenda: 'planner.solo_eventi',
  h3: 'planner.3_ore',
  h1: 'planner.1_ora',
  m30: 'planner.30_minuti',
  m15: 'planner.15_minuti',
  m5: 'planner.5_minuti',
};

/** Le impostazioni del planner (il pannello «Impostazioni» del sito): colore della pagina, frasi, ambiente, scatti degli orari, contrasto. */
export default function PlannerSettingsScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { uiStyle, plannerSettings: s, updatePlannerSettings: update } = useApp();
  const pt = plannerTheme(uiStyle, th, s.palette, s.contrast_level);

  const card = {
    backgroundColor: pt.card,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: pt.hair,
    padding: 14,
    gap: 12,
  } as const;
  const label = { color: pt.ink, fontSize: 16, fontFamily: pt.sans, flex: 1 } as const;
  const heading = { color: pt.ink3, fontSize: 12, letterSpacing: 1, fontFamily: pt.sans } as const;

  const toggle = (id: string, text: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={label}>{text}</Text>
      <Switch testID={id} value={value} onValueChange={onChange} />
    </View>
  );
  const stepper = (
    id: string,
    text: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
    show: (v: number) => string = String,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={label}>{text}</Text>
      <Pressable
        testID={`${id}-minus`}
        accessibilityRole="button"
        accessibilityLabel="−"
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: value <= min ? 0.3 : 1,
        }}
      >
        <Text style={{ color: pt.accentInk, fontSize: 22 }}>−</Text>
      </Pressable>
      <Text testID={`${id}-value`} style={{ color: pt.ink, minWidth: 44, textAlign: 'center' }}>
        {show(value)}
      </Text>
      <Pressable
        testID={`${id}-plus`}
        accessibilityRole="button"
        accessibilityLabel="+"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: value >= max ? 0.3 : 1,
        }}
      >
        <Text style={{ color: pt.accentInk, fontSize: 22 }}>+</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: pt.page }}>
      <View
        style={{
          paddingTop: Math.max(insets.top - 20, 12),
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ flex: 1, color: pt.ink, fontSize: 22, fontFamily: pt.serif }}>
          {t('planner.impostazioni')}
        </Text>
        <Pressable testID="ps-done" accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: pt.accentInk, fontSize: 16, fontFamily: pt.sans }}>
            {t('comune.fine')}
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        {uiStyle === 'paper' ? (
          <View style={card}>
            <Text style={heading}>{t('planner.colore_della_pagina').toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
                <Pressable
                  key={k}
                  testID={`ps-palette-${k}`}
                  accessibilityRole="radio"
                  accessibilityLabel={k}
                  accessibilityState={{ selected: s.palette === k }}
                  onPress={() => update({ palette: k })}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: PALETTES[k][0],
                    borderWidth: s.palette === k ? 3 : 0,
                    borderColor: pt.ink,
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={card}>
          <Text style={heading}>{t('planner.sulla_pagina').toUpperCase()}</Text>
          {toggle('ps-motivational', t('planner.frasi_motivazionali'), s.show_motivational, (v) =>
            update({ show_motivational: v }),
          )}
          {toggle('ps-affirmations', t('planner.affermazioni_positive'), s.show_affirmations, (v) =>
            update({ show_affirmations: v }),
          )}
          {uiStyle === 'paper'
            ? toggle('ps-ambient', t('planner.alberi_e_animali'), s.ambient_enabled, (v) =>
                update({ ambient_enabled: v }),
              )
            : null}
          {uiStyle === 'paper' && s.ambient_enabled
            ? stepper(
                'ps-ambient-opacity',
                t('planner.quanto_si_vedono'),
                s.ambient_opacity,
                0,
                10,
                (v) => update({ ambient_opacity: v }),
              )
            : null}
        </View>

        <View style={card}>
          <Text style={label}>{t('planner.scatti_degli_orari')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {ZOOMS.map((z) => (
              <Pressable
                key={z}
                testID={`ps-zoom-${z}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: s.zoom === z }}
                onPress={() => update({ zoom: z })}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor: s.zoom === z ? pt.accent : pt.accentSoft,
                }}
              >
                <Text style={{ color: s.zoom === z ? pt.onAccent : pt.ink }}>
                  {t(ZOOM_LABEL[z])}
                </Text>
              </Pressable>
            ))}
          </View>
          {stepper('ps-contrast', t('planner.quanto_marcato'), s.contrast_level, 1, 5, (v) =>
            update({ contrast_level: v }),
          )}
          {width >= 760
            ? stepper('ps-days', t('planner.giorni_affiancati'), s.days_visible, 1, 7, (v) =>
                update({ days_visible: v }),
              )
            : null}
        </View>
      </ScrollView>
    </View>
  );
}
