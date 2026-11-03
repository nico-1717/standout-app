import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  groupAllPredicted,
  groupExams,
  groupIsComplete,
  possibleCfuSums,
  proposedOverallGrade,
  type Exam,
  type ExamGroup,
} from '@/features/grades/logic';
import { Pill, Stepper, trimNum } from '@/features/grades/parts';
import { Card, Field, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

function GroupForm({
  group,
  initialIds,
  candidates,
}: {
  group: ExamGroup | null;
  initialIds: string[];
  candidates: Exam[];
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, changed, gradeSettings } = useApp();

  const [name, setName] = useState(group?.name ?? '');
  const [type, setType] = useState<'choice' | 'split'>(group?.group_type ?? 'choice');
  const [ids, setIds] = useState<Set<string>>(new Set(initialIds));
  const [quota, setQuota] = useState<number | null>(group ? group.cfu : null);
  const [overall, setOverall] = useState<number | null>(null);
  const [overallHonors, setOverallHonors] = useState(false);
  if (!services) return null;

  const d = services.grades.data(gradeSettings);
  const chosen = candidates.filter((e) => ids.has(e.uuid));
  const sums = possibleCfuSums(chosen.map((e) => e.cfu));
  const total = chosen.reduce((s, e) => s + e.cfu, 0);
  const effQuota =
    type === 'split'
      ? total
      : quota != null && sums.includes(quota)
        ? quota
        : (sums[sums.length - 1] ?? 0);

  const members = group ? groupExams(d, group.uuid) : [];
  const complete = !!group && type === 'split' && groupIsComplete(d, group.uuid);
  const predicted = !!group && type === 'split' && !complete && groupAllPredicted(d, group.uuid);
  const proposed = proposedOverallGrade(d, members, predicted);
  const shownOverall =
    overall ??
    (complete ? group!.overall_grade : predicted ? group!.overall_predicted_grade : null) ??
    proposed;

  const toggle = (id: string) => {
    const n = new Set(ids);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setIds(n);
  };

  const save = () => {
    if (ids.size < 2) {
      Alert.alert(t('voti.servono_almeno_due_esami'));
      return;
    }
    const nm = name.trim() || t('voti.gruppo_a_scelta_senza_nome');
    if (group) {
      services.grades.updateGroup(group.uuid, {
        name: nm,
        group_type: type,
        cfu: effQuota,
        exams: [...ids],
        ...(complete
          ? { overall_grade: shownOverall, overall_honors: overallHonors }
          : predicted
            ? { overall_predicted_grade: shownOverall, overall_predicted_honors: overallHonors }
            : {}),
      });
    } else {
      services.grades.createGroup({ name: nm, type, exams: [...ids], cfu: effQuota });
    }
    changed();
    router.back();
  };

  const dissolve = () => {
    if (!group) return;
    Alert.alert(t('voti.sciogliere_il_gruppo'), '', [
      { text: t('voti.annulla'), style: 'cancel' },
      {
        text: t('voti.sciogli_gruppo'),
        onPress: () => {
          services.grades.dissolveGroup(group.uuid);
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
        title={group ? t('voti.modifica_gruppo') : t('voti.crea_gruppo')}
        right={
          <Pressable testID="group-close" accessibilityRole="button" onPress={() => router.back()}>
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
            testID="group-name"
            value={name}
            onChangeText={setName}
            placeholder={t('voti.nome_gruppo')}
          />
          <SectionLabel>{t('voti.tipologia_gruppo')}</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pill
              testID="group-type-choice"
              th={th}
              on={type === 'choice'}
              label={t('voti.a_scelta_maiusc')}
              onPress={() => setType('choice')}
            />
            <Pill
              testID="group-type-split"
              th={th}
              on={type === 'split'}
              label={t('voti.esame_suddiviso_maiusc')}
              onPress={() => setType('split')}
            />
          </View>
          <Text style={{ color: th.text2, fontSize: 13 }}>
            {type === 'choice' ? t('voti.esami_alternativi') : t('voti.parti_formano_un_esame')}
          </Text>
        </Card>

        <Card style={{ padding: 16, gap: 8 }}>
          <SectionLabel>{t('voti.esami_nel_gruppo', { n: ids.size })}</SectionLabel>
          {candidates.length === 0 ? (
            <Text style={{ color: th.text2 }}>{t('voti.nessun_esame_disponibile')}</Text>
          ) : (
            candidates.map((e) => (
              <Pressable
                key={e.uuid}
                testID={`group-pick-${e.uuid}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ids.has(e.uuid) }}
                onPress={() => toggle(e.uuid)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: th.brand,
                    backgroundColor: ids.has(e.uuid) ? th.brand : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {ids.has(e.uuid) ? (
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
                  ) : null}
                </View>
                <Text style={{ color: th.text, flex: 1 }}>{e.name}</Text>
                <Text style={{ color: th.text2 }}>{trimNum(e.cfu)}</Text>
              </Pressable>
            ))
          )}
        </Card>

        <Card style={{ padding: 16, gap: 8 }}>
          <SectionLabel>
            {type === 'split' ? t('voti.cfu_totali_gruppo') : t('voti.scegli_cfu_totali_gruppo')}
          </SectionLabel>
          {type === 'split' ? (
            <Text testID="group-total" style={{ color: th.text, fontSize: 22, fontWeight: '800' }}>
              {trimNum(total)}
            </Text>
          ) : sums.length === 0 ? (
            <Text style={{ color: th.text2 }}>{t('voti.seleziona_almeno_un_esame')}</Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {sums.map((s) => (
                <Pill
                  key={s}
                  testID={`group-quota-${s}`}
                  th={th}
                  on={effQuota === s}
                  label={trimNum(s)}
                  onPress={() => setQuota(s)}
                />
              ))}
            </View>
          )}
        </Card>

        {complete || predicted ? (
          <Card style={{ padding: 16, gap: 10, alignItems: 'center' }}>
            <SectionLabel>{t('voti.voto_complessivo_gruppo')}</SectionLabel>
            <Stepper
              th={th}
              testID="group-overall"
              value={shownOverall == null ? '–' : overallHonors ? '30L' : String(shownOverall)}
              onMinus={() => {
                setOverallHonors(false);
                setOverall(Math.max(18, (shownOverall ?? 27) - 1));
              }}
              onPlus={() => {
                const cur = shownOverall ?? 27;
                if (cur >= 30) setOverallHonors(true);
                else setOverall(cur + 1);
              }}
            />
            {proposed != null && shownOverall === proposed ? (
              <Text style={{ color: th.text2, fontSize: 12 }}>{t('voti.proposto_par')}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: th.text }}>{t('voti.30_e_lode')}</Text>
              <Switch
                testID="group-overall-honors"
                value={overallHonors}
                onValueChange={(v) => {
                  setOverallHonors(v);
                  if (v) setOverall(30);
                }}
                trackColor={{ true: th.brand }}
              />
            </View>
          </Card>
        ) : null}

        <PrimaryButton testID="group-save" label={t('voti.salva')} onPress={save} />
        {group ? (
          <TextButton testID="group-dissolve" label={t('voti.sciogli')} danger onPress={dissolve} />
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function GradeGroupScreen() {
  const { services, gradeSettings } = useApp();
  const params = useLocalSearchParams<{ id?: string; ids?: string }>();
  if (!services) return null;
  void gradeSettings;
  const group = params.id ? services.grades.group(params.id) : null;
  const all = services.grades.exams();
  const initial = group
    ? all.filter((e) => e.group_uuid === group.uuid).map((e) => e.uuid)
    : (params.ids ?? '').split(',').filter(Boolean);
  // chi è già in un altro gruppo non si può prendere (come sul sito)
  const candidates = all.filter(
    (e) => !e.group_uuid || (group && e.group_uuid === group.uuid) || initial.includes(e.uuid),
  );
  return (
    <GroupForm
      key={group?.uuid ?? 'new'}
      group={group}
      initialIds={initial}
      candidates={candidates}
    />
  );
}
