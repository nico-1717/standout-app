import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { applyProgram, faculties, programList } from '@/features/grades/catalog';
import type { GradeSettings } from '@/features/grades/logic';
import { Pill, trimNum } from '@/features/grades/parts';
import { Card, Field, Header, SectionLabel } from '@/ui/kit';

const HONORS = [30, 30.5, 31, 32];

function NumField({
  label,
  value,
  testID,
  onCommit,
  decimal,
}: {
  label: string;
  value: number;
  testID: string;
  onCommit: (v: number) => void;
  decimal?: boolean;
}) {
  const th = useTheme();
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: th.text2, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <Field
        testID={testID}
        value={text ?? trimNum(value)}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        onChangeText={setText}
        onEndEditing={() => {
          const n = parseFloat((text ?? '').replace(',', '.'));
          if (text != null && Number.isFinite(n)) onCommit(n);
          setText(null);
        }}
      />
    </View>
  );
}

/** Corso, colori e regole di calcolo (le impostazioni di voti.php). */
export default function GradeSettingsScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, changed, gradeSettings: st, updateGradeSettings } = useApp();
  const [filter, setFilter] = useState('');
  const [loaded, setLoaded] = useState<string | null>(null);
  if (!services) return null;

  const rows = programList(filter, i18n.language);
  const facs = Object.entries(faculties());
  const set = (patch: Partial<GradeSettings>) => updateGradeSettings(patch);

  const load = (key: string, label: string, mode: 'replace' | 'append') => {
    applyProgram(services.grades, set, key, mode, t('voti.laurea_in_corso'));
    changed();
    setLoaded(label);
  };
  const pick = (key: string, label: string) => {
    if (services.grades.exams().length === 0) {
      load(key, label, 'replace');
      return;
    }
    Alert.alert(t('voti.sostituire_esami', { corso: label }), '', [
      { text: t('voti.annulla'), style: 'cancel' },
      { text: t('voti.aggiungi_esame'), onPress: () => load(key, label, 'append') },
      { text: t('voti.rimuovi'), style: 'destructive', onPress: () => load(key, label, 'replace') },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('voti.impostazioni')}
        right={
          <Pressable
            testID="gset-close"
            accessibilityRole="button"
            accessibilityLabel={t('comune.chiudi')}
            onPress={() => router.back()}
          >
            <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ padding: 16, gap: 10 }}>
          <SectionLabel>{t('voti.corso_di_laurea')}</SectionLabel>
          <Text testID="gset-current" style={{ color: th.text, fontWeight: '700' }}>
            {st.program_label || t('voti.nessun_corso')}
          </Text>
          {loaded ? (
            <Text testID="gset-loaded" style={{ color: th.green }}>
              {t('voti.corso_caricato', { corso: loaded })}
            </Text>
          ) : null}
          <Text style={{ color: th.text2, fontSize: 12 }}>
            {t('voti.precompiliamo_esami_cfu_e_colori')}
          </Text>
          <Field
            testID="gset-search"
            value={filter}
            onChangeText={setFilter}
            placeholder={t('voti.cerca_corso_o_facolta')}
          />
          {rows.length === 0 ? (
            <Text style={{ color: th.text2 }}>{t('voti.nessun_corso_trovato')}</Text>
          ) : (
            rows.slice(0, 40).map((r) => (
              <Pressable
                key={r.key}
                testID={`gset-program-${r.key}`}
                accessibilityRole="button"
                onPress={() => pick(r.key, r.label)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: r.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text>{r.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontWeight: '600' }}>{r.label}</Text>
                  <Text style={{ color: th.text2, fontSize: 12 }}>
                    {r.facultyLabel} · {r.cfu} {t('voti.cfu')} · {r.examCount} {t('voti.esami')}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <SectionLabel>{t('voti.corso_colori_e_regole_di')}</SectionLabel>
          <Text style={{ color: th.text2, fontSize: 12 }}>
            {t('voti.nome_corso_personalizzato')}
          </Text>
          <Field
            testID="gset-label"
            defaultValue={st.program_label ?? ''}
            onEndEditing={(e) => {
              const v = e.nativeEvent.text.trim();
              set({
                program_label: v || null,
                program_key: v === st.program_label ? st.program_key : null,
              });
            }}
          />
          <Text style={{ color: th.text2, fontSize: 12 }}>{t('voti.colore_facolta')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {facs.map(([key, f]) => (
              <Pressable
                key={key}
                testID={`gset-fac-${key}`}
                accessibilityRole="button"
                accessibilityLabel={f.label}
                accessibilityState={{ selected: st.accent_color === f.color }}
                onPress={() => set({ faculty_key: key, accent_color: f.color })}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: f.color,
                  borderWidth: st.accent_color === f.color ? 3 : 0,
                  borderColor: th.text,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <NumField
              testID="gset-cfu"
              label={t('voti.cfu_totali')}
              value={st.total_cfu}
              onCommit={(v) => set({ total_cfu: v })}
            />
            <NumField
              testID="gset-base"
              label={t('voti.base_laurea')}
              value={st.grade_base}
              onCommit={(v) => set({ grade_base: v })}
            />
          </View>
          <Text style={{ color: th.text2, fontSize: 12 }}>
            {t('voti.valore_della_lode_nella_media')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {HONORS.map((h) => (
              <Pill
                key={h}
                testID={`gset-honors-${h}`}
                th={th}
                on={st.honors_value === h}
                label={trimNum(h)}
                onPress={() => set({ honors_value: h })}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <NumField
              decimal
              testID="gset-thesis-min"
              label={t('voti.tesi_min')}
              value={st.thesis_min_points}
              onCommit={(v) => set({ thesis_min_points: v })}
            />
            <NumField
              decimal
              testID="gset-thesis-max"
              label={t('voti.tesi_max')}
              value={st.thesis_max_points}
              onCommit={(v) => set({ thesis_max_points: v })}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: th.text, flex: 1, fontWeight: '600' }}>
              {t('voti.arrotonda_la_base_per_eccesso')}
            </Text>
            <Switch
              testID="gset-round"
              value={st.round_half_up}
              onValueChange={(v) => set({ round_half_up: v })}
              trackColor={{ true: th.brand }}
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
