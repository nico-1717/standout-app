import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import type { Exam } from '@/features/grades/logic';
import { findGroup, groupExams } from '@/features/grades/logic';
import { Pill, Stepper, trimNum } from '@/features/grades/parts';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, Field, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

const toNum = (s: string): number | null => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function ExamForm({ exam, initialStatus }: { exam: Exam | null; initialStatus: 'todo' | 'done' }) {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, changed, gradeSettings } = useApp();

  const [name, setName] = useState(exam?.name ?? '');
  const [cfu, setCfu] = useState(exam ? trimNum(exam.cfu) : '6');
  const [year, setYear] = useState<number | null>(exam?.study_year ?? null);
  const [status, setStatus] = useState<'todo' | 'done'>(exam?.status ?? initialStatus);
  const [passFail, setPassFail] = useState(!!exam?.is_pass_fail);
  const [grade, setGrade] = useState<number>(exam?.grade ?? 27);
  const [honors, setHonors] = useState(!!exam?.has_honors);
  const [pred, setPred] = useState<number | null>(exam?.predicted_grade ?? null);
  const [predHonors, setPredHonors] = useState(!!exam?.predicted_honors);
  const [date, setDate] = useState(exam?.exam_date ?? '');
  const [ssd, setSsd] = useState(exam?.ssd ?? '');
  const [avg, setAvg] = useState(exam?.national_avg != null ? String(exam.national_avg) : '');
  if (!services) return null;
  const group = exam?.group_uuid
    ? findGroup(services.grades.data(gradeSettings), exam.group_uuid)
    : null;

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('voti.inserisci_nome_esame'));
      return;
    }
    const done = status === 'done';
    const input = {
      name: name.trim(),
      cfu: toNum(cfu) ?? 0,
      status,
      study_year: year,
      is_pass_fail: passFail,
      grade: done && !passFail ? (honors ? 30 : grade) : null,
      has_honors: done && !passFail && honors,
      exam_date: done ? date || today() : null,
      predicted_grade: !done && !passFail ? (predHonors ? 30 : pred) : null,
      predicted_honors: !done && !passFail && pred != null && predHonors,
      ssd: ssd.trim() || null,
      national_avg: toNum(avg),
    };
    const id = exam ? exam.uuid : services.grades.addExam(input);
    if (exam) services.grades.updateExam(exam.uuid, input);
    changed();
    // un gruppo «a scelta» pieno: si chiede se togliere gli altri esami dal «da sostenere»
    const g = exam?.group_uuid;
    if (g && done) {
      const d = services.grades.data(gradeSettings);
      const grp = findGroup(d, g);
      const members = groupExams(d, g);
      const doneSum = members.filter((m) => m.status === 'done').reduce((s, m) => s + m.cfu, 0);
      const others = members.filter((m) => m.status === 'todo' && m.uuid !== id);
      if (grp && grp.group_type !== 'split' && doneSum >= grp.cfu - 0.0005 && others.length) {
        Alert.alert(
          t('voti.quota_raggiunta_chiedi', {
            gruppo: grp.name,
            cfu: trimNum(grp.cfu),
            altri: others.length,
          }),
          '',
          [
            { text: t('voti.annulla'), style: 'cancel', onPress: () => router.back() },
            {
              text: t('voti.rimuovi'),
              style: 'destructive',
              onPress: () => {
                services.grades.clearGroupTodo(g, id);
                changed();
                router.back();
              },
            },
          ],
        );
        return;
      }
    }
    router.back();
  };

  const remove = () => {
    if (!exam) return;
    Alert.alert(t('voti.eliminare_esame_nome', { nome: exam.name }), '', [
      { text: t('voti.annulla'), style: 'cancel' },
      {
        text: t('voti.elimina'),
        style: 'destructive',
        onPress: () => {
          services.grades.removeExams([exam.uuid]);
          changed();
          router.back();
        },
      },
    ]);
  };

  const label = (s: string) => (
    <Text style={{ color: th.text2, fontSize: 12, marginBottom: 4 }}>{s}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={exam ? t('voti.modifica_esame') : t('voti.nuovo_esame')}
        right={
          <Pressable
            testID="exam-close"
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
          <View>
            {label(t('voti.nome_esame'))}
            <Field
              testID="exam-name"
              value={name}
              onChangeText={setName}
              placeholder={t('voti.es_analisi_matematica')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              {label(t('voti.cfu'))}
              <Field
                testID="exam-cfu"
                value={cfu}
                onChangeText={setCfu}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              {label(t('voti.ssd_es_mat_05'))}
              <Field
                testID="exam-ssd"
                value={ssd}
                onChangeText={setSsd}
                autoCapitalize="characters"
              />
            </View>
          </View>
          <View>
            {label(t('voti.anno'))}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pill
                testID="exam-year-none"
                th={th}
                on={year == null}
                label="–"
                onPress={() => setYear(null)}
              />
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <Pill
                  key={y}
                  testID={`exam-year-${y}`}
                  th={th}
                  on={year === y}
                  label={String(y)}
                  onPress={() => setYear(y)}
                />
              ))}
            </View>
          </View>
          <View>
            {label(t('voti.stato'))}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pill
                testID="exam-status-done"
                th={th}
                on={status === 'done'}
                label={t('voti.sostenuto')}
                onPress={() => setStatus('done')}
              />
              <Pill
                testID="exam-status-todo"
                th={th}
                on={status === 'todo'}
                label={t('voti.da_sostenere')}
                onPress={() => setStatus('todo')}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: th.text, flex: 1, fontWeight: '600' }}>{t('voti.idoneita')}</Text>
            <Switch
              testID="exam-passfail"
              value={passFail}
              onValueChange={setPassFail}
              trackColor={{ true: th.brand }}
            />
          </View>
        </Card>

        {!passFail && status === 'done' ? (
          <Card style={{ padding: 16, gap: 12, alignItems: 'center' }}>
            <SectionLabel>{t('voti.voto_conseguito')}</SectionLabel>
            <Stepper
              big
              th={th}
              testID="exam-grade"
              value={honors ? '30L' : String(grade)}
              onMinus={() => {
                setHonors(false);
                setGrade(Math.max(18, grade - 1));
              }}
              onPlus={() => {
                if (grade >= 30) setHonors(true);
                else setGrade(grade + 1);
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ color: th.text }}>{t('voti.30_e_lode')}</Text>
              <Switch
                testID="exam-honors"
                value={honors}
                onValueChange={(v) => {
                  setHonors(v);
                  if (v) setGrade(30);
                }}
                trackColor={{ true: th.brand }}
              />
            </View>
            <View style={{ alignSelf: 'stretch' }}>
              {label(t('voti.data'))}
              <DateTimeField
                kind="date"
                testID="exam-date"
                value={date}
                fallback={today()}
                onChange={setDate}
                placeholder={t('voti.data')}
                clearable
              />
            </View>
          </Card>
        ) : null}

        {!passFail && status === 'todo' ? (
          <Card style={{ padding: 16, gap: 12, alignItems: 'center' }}>
            <SectionLabel>{t('voti.voto_previsto_simulazione')}</SectionLabel>
            <Stepper
              big
              th={th}
              testID="exam-pred"
              value={pred == null ? '–' : predHonors ? '30L' : String(pred)}
              onMinus={() => {
                setPredHonors(false);
                setPred(pred == null || pred <= 18 ? null : pred - 1);
              }}
              onPlus={() => {
                if (pred == null) setPred(27);
                else if (pred >= 30) setPredHonors(true);
                else setPred(pred + 1);
              }}
            />
            {pred != null ? (
              <TextButton
                testID="exam-pred-clear"
                label={t('voti.pulisci_voto_previsto')}
                onPress={() => {
                  setPred(null);
                  setPredHonors(false);
                }}
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={{ padding: 16, gap: 8 }}>
          <SectionLabel>{t('voti.avanzate_facoltative')}</SectionLabel>
          {label(t('voti.media_classe'))}
          <Field
            testID="exam-avg"
            value={avg}
            onChangeText={setAvg}
            keyboardType="decimal-pad"
            placeholder="18 – 30"
          />
          <Text style={{ color: th.text3, fontSize: 12 }}>{t('voti.medie_classe_stime')}</Text>
          {group ? (
            <Text style={{ color: th.text2, marginTop: 6 }}>
              {t('voti.gruppo')}: {group.name}
            </Text>
          ) : null}
        </Card>

        <PrimaryButton testID="exam-save" label={t('voti.salva')} onPress={save} />
        {exam ? (
          <TextButton testID="exam-delete" label={t('voti.elimina')} danger onPress={remove} />
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function GradeExamScreen() {
  const { services, gradeSettings } = useApp();
  const params = useLocalSearchParams<{ id?: string; status?: string }>();
  if (!services) return null;
  void gradeSettings;
  const exam = params.id ? services.grades.exam(params.id) : null;
  return (
    <ExamForm
      key={exam?.uuid ?? 'new'}
      exam={exam}
      initialStatus={params.status === 'done' ? 'done' : 'todo'}
    />
  );
}
