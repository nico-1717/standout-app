import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  BONUS_TYPES,
  bonusApplied,
  lodiCount,
  type Bonus,
  type BonusType,
} from '@/features/grades/logic';
import { Pill, trimNum } from '@/features/grades/parts';
import { Card, Field, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

const TYPE_KEY: Record<BonusType, string> = {
  fixed: 'voti.bonus_fisso',
  on_time: 'voti.laurea_in_corso',
  honors_each: 'voti.punti_per_ogni_lode',
  honors_threshold: 'voti.soglia_di_lodi',
  custom: 'voti.personalizzato',
};

const toNum = (s: string): number | null => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function BonusForm({ bonus }: { bonus: Bonus | null }) {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, changed, gradeSettings } = useApp();

  const [name, setName] = useState(bonus?.name ?? '');
  const [type, setType] = useState<BonusType>(bonus?.bonus_type ?? 'fixed');
  const [points, setPoints] = useState(bonus ? trimNum(bonus.points) : '1');
  const [threshold, setThreshold] = useState(
    bonus?.threshold_value != null ? String(bonus.threshold_value) : '3',
  );
  const [cap, setCap] = useState(bonus && bonus.cap_points > 0 ? String(bonus.cap_points) : '0');
  const [enabled, setEnabled] = useState(bonus ? !!bonus.is_enabled : true);
  if (!services) return null;

  const pts = Math.min(20, Math.max(-20, toNum(points) ?? 0));
  const thr = Math.min(100, Math.max(0, Math.round(toNum(threshold) ?? 0)));
  const lodi = lodiCount(services.grades.data(gradeSettings), false);
  const preview = (() => {
    switch (type) {
      case 'fixed':
        return t('voti.prev_fisso', { punti: trimNum(pts) });
      case 'on_time':
        return t('voti.prev_in_corso', { punti: trimNum(pts) });
      case 'honors_each':
        return t('voti.prev_per_lode', {
          punti: trimNum(pts),
          lodi,
          totale: trimNum(
            bonusApplied(
              {
                uuid: '',
                name: '',
                bonus_type: 'honors_each',
                points: pts,
                threshold_value: null,
                cap_points: toNum(cap) ?? 0,
                is_enabled: 1,
                sort_key: '',
              },
              lodi,
            ),
          ),
        });
      case 'honors_threshold':
        return t('voti.prev_soglia', { punti: trimNum(pts), soglia: thr, lodi });
      default:
        return t('voti.prev_personalizzato', { punti: trimNum(pts) });
    }
  })();

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('voti.dai_un_nome_al_bonus'));
      return;
    }
    const input = {
      name: name.trim(),
      bonus_type: type,
      points: pts,
      threshold_value: type === 'honors_threshold' ? thr : null,
      cap_points: type === 'honors_each' ? Math.min(40, Math.max(0, toNum(cap) ?? 0)) : 0,
      is_enabled: enabled,
    };
    if (bonus) services.grades.updateBonus(bonus.uuid, input);
    else services.grades.addBonus(input);
    changed();
    router.back();
  };
  const remove = () => {
    if (!bonus) return;
    Alert.alert(t('voti.eliminare_questo_bonus'), '', [
      { text: t('voti.annulla'), style: 'cancel' },
      {
        text: t('voti.elimina'),
        style: 'destructive',
        onPress: () => {
          services.grades.removeBonus(bonus.uuid);
          changed();
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('voti.bonus_punti')}
        right={
          <Pressable
            testID="bonus-close"
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
        <Card style={{ padding: 16, gap: 12 }}>
          <Field
            testID="bonus-name"
            value={name}
            onChangeText={setName}
            placeholder={t('voti.es_laurea_in_corso')}
          />
          <SectionLabel>{t('voti.tipo')}</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BONUS_TYPES.map((b) => (
              <Pill
                key={b}
                testID={`bonus-type-${b}`}
                th={th}
                on={type === b}
                label={t(TYPE_KEY[b])}
                onPress={() => setType(b)}
              />
            ))}
          </View>
          <SectionLabel>{t('voti.punti')}</SectionLabel>
          <Field
            testID="bonus-points"
            value={points}
            onChangeText={setPoints}
            keyboardType="numbers-and-punctuation"
          />
          {type === 'honors_threshold' ? (
            <>
              <SectionLabel>{t('voti.lodi_necessarie')}</SectionLabel>
              <Field
                testID="bonus-threshold"
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="number-pad"
              />
            </>
          ) : null}
          {type === 'honors_each' ? (
            <>
              <SectionLabel>{t('voti.massimo_punti_0_nessun_limite')}</SectionLabel>
              <Field
                testID="bonus-cap"
                value={cap}
                onChangeText={setCap}
                keyboardType="decimal-pad"
              />
            </>
          ) : null}
          <Text testID="bonus-preview" style={{ color: th.text2 }}>
            {preview}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: th.text, flex: 1, fontWeight: '600' }}>{t('voti.bonus')}</Text>
            <Switch
              testID="bonus-enabled"
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: th.brand }}
            />
          </View>
        </Card>
        <PrimaryButton testID="bonus-save" label={t('voti.salva')} onPress={save} />
        {bonus ? (
          <TextButton testID="bonus-delete" label={t('voti.elimina')} danger onPress={remove} />
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function GradeBonusScreen() {
  const { services } = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  if (!services) return null;
  const bonus = params.id
    ? (services.grades.bonuses().find((b) => b.uuid === params.id) ?? null)
    : null;
  return <BonusForm key={bonus?.uuid ?? 'new'} bonus={bonus} />;
}
