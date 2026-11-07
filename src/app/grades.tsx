import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme, type Theme } from '@/core/theme/ThemeProvider';
import {
  base110,
  bonusApplied,
  bonusTotal,
  cfuStats,
  dispFinal,
  finalRange,
  findGroup,
  groupDoneCfu,
  groupExams,
  groupTotalCfu,
  lodiCount,
  requiredFuture,
  simulated,
  todoVisible,
  totalExamsCount,
  trendData,
  weighted,
  type Bonus,
  type Exam,
  type GradeData,
} from '@/features/grades/logic';
import {
  Pill,
  Ring,
  Stepper,
  TrendChart,
  accentOf,
  fmt2,
  gradeLabel,
  trimNum,
} from '@/features/grades/parts';
import { Card, Header, PrimaryButton, SectionLabel, TextButton, bigNumber } from '@/ui/kit';

type Tab = 'done' | 'todo' | 'sim';

function ExamRow({
  exam,
  right,
  sub,
  th,
  selecting,
  picked,
  onPress,
  onLongPress,
}: {
  exam: Exam;
  right: string;
  sub: string;
  th: Theme;
  selecting: boolean;
  picked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      testID={`grade-row-${exam.uuid}`}
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      {selecting ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: th.brand,
            backgroundColor: picked ? th.brand : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {picked ? (
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }}>{exam.name}</Text>
        {sub ? <Text style={{ color: th.text2, fontSize: 12 }}>{sub}</Text> : null}
      </View>
      <Text style={[{ color: th.text }, bigNumber(th, 17)]}>{right}</Text>
    </Pressable>
  );
}

/** I voti (voti.php): media, voto di laurea stimato, obiettivo, andamento, esami fatti / da fare / simulatore, tesi e bonus. */
export default function GradesScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { services, version, changed, gradeSettings: st, updateGradeSettings } = useApp();

  const [tab, setTab] = useState<Tab>('done');
  const [projection, setProjection] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState(false);

  const d: GradeData | null = useMemo(() => {
    void version;
    return services ? services.grades.data(st) : null;
  }, [services, version, st]);
  if (!services || !d) return null;

  const accent = accentOf(st.accent_color, th.brand);
  const w = weighted(d);
  const cfu = cfuStats(d);
  const lodi = lodiCount(d, false);
  const doneCount = d.exams.filter((e) => e.status === 'done').length;
  const totalCount = totalExamsCount(d);
  const range = finalRange(d, w.avg, false);
  const base = d.settings.grade_base;
  const target = st.target_average;
  const empty = d.exams.length === 0;

  const refresh = () => changed();
  const togglePick = (id: string) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setPicked(n);
  };
  const endSelect = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const openExam = (e: Exam) => {
    if (selecting) togglePick(e.uuid);
    else router.push({ pathname: '/grade-exam', params: { id: e.uuid } });
  };
  const startSelect = (e: Exam) => {
    setSelecting(true);
    setPicked(new Set([e.uuid]));
  };

  const setTarget = (v: number | null, source: 'manual' | 'simulation' = 'manual') => {
    updateGradeSettings({
      target_average: v == null ? null : Math.min(31, Math.max(18, Math.round(v * 10) / 10)),
      target_source: source,
    });
  };

  const examRow = (e: Exam, mode: Tab) => {
    const g = e.group_uuid ? findGroup(d, e.group_uuid) : null;
    const bits: string[] = [t('voti.cfu_totali_breve', { cfu: trimNum(e.cfu) })];
    if (g) bits.push(g.name);
    if (mode === 'todo' && e.predicted_grade != null)
      bits.push(`${e.predicted_honors ? '30L' : e.predicted_grade} ${t('voti.previsto_par')}`);
    const right = mode === 'done' ? gradeLabel(d, e) : '';
    return (
      <ExamRow
        key={e.uuid}
        exam={e}
        th={th}
        right={right}
        sub={bits.join(' · ')}
        selecting={selecting}
        picked={picked.has(e.uuid)}
        onPress={() => openExam(e)}
        onLongPress={() => startSelect(e)}
      />
    );
  };

  /* --- elenco «fatti» e «da fare»: gli esami di gruppo stanno insieme sotto il nome del gruppo --- */
  const listFor = (mode: 'done' | 'todo') => {
    const items = mode === 'done' ? d.exams.filter((e) => e.status === 'done') : todoVisible(d);
    const seen = new Set<string>();
    const out: React.ReactNode[] = [];
    for (const e of items) {
      const g = e.group_uuid ? findGroup(d, e.group_uuid) : null;
      if (!g) {
        out.push(examRow(e, mode));
        continue;
      }
      if (seen.has(g.uuid)) continue;
      seen.add(g.uuid);
      const members = groupExams(d, g.uuid).filter((m) =>
        mode === 'done' ? m.status === 'done' : m.status === 'todo',
      );
      out.push(
        <View key={`g-${g.uuid}`} style={{ backgroundColor: th.surface2 }}>
          <Pressable
            testID={`grade-group-${g.uuid}`}
            accessibilityRole="button"
            onPress={() =>
              selecting
                ? members.forEach((m) => togglePick(m.uuid))
                : router.push({ pathname: '/grade-group', params: { id: g.uuid } })
            }
            style={{ paddingVertical: 10, paddingHorizontal: 14, gap: 2 }}
          >
            <Text style={{ color: th.text, fontWeight: '700' }}>
              {g.group_type === 'split'
                ? t('voti.gruppo_riga_suddiviso', {
                    nome: g.name,
                    cfu: trimNum(groupTotalCfu(d, g.uuid)),
                  })
                : t('voti.gruppo_riga_scelta', { nome: g.name, cfu: trimNum(g.cfu) })}
            </Text>
            <Text style={{ color: th.text2, fontSize: 12 }}>
              {t('voti.quota_gruppo', {
                sostenuti: trimNum(groupDoneCfu(d, g.uuid)),
                previsti: '',
                quota: trimNum(g.cfu),
              })}
            </Text>
          </Pressable>
          {members.map((m) => examRow(m, mode))}
        </View>,
      );
    }
    return out;
  };

  /* --- simulatore --- */
  const simList = todoVisible(d).filter((e) => !e.is_pass_fail);
  const sim = simulated(d);
  const startGrade = Math.min(30, Math.max(18, Math.round(w.avg || 27)));
  const stepPred = (e: Exam, delta: number) => {
    if (e.predicted_grade == null) {
      services.grades.setPrediction(e.uuid, startGrade, false);
    } else {
      const next = e.predicted_grade + delta;
      if (next < 18) services.grades.setPrediction(e.uuid, null, false);
      else if (next > 30) services.grades.setPrediction(e.uuid, 30, true);
      else services.grades.setPrediction(e.uuid, next, false);
    }
    refresh();
  };

  const trend = trendData(d, projection);
  const chartW = Math.min(width, 700) - 32 - 32;
  const req = target != null ? requiredFuture(d, target) : null;
  const targetText = (() => {
    if (target == null) return '';
    if (!req)
      return w.avg >= target
        ? t('voti.obiettivo_raggiunto')
        : t('voti.aggiungi_altri_esami_con_voto');
    if (!req.feasible)
      return t('voti.obiettivo_fuori_portata', {
        obiettivo: fmt2(target),
        media: fmt2(req.req),
        cfu: trimNum(req.remainingCfu),
      });
    if (req.req <= 18) return t('voti.gia_sopra_obiettivo');
    return t('voti.ti_basta_una_media', { media: fmt2(req.req), cfu: trimNum(req.remainingCfu) });
  })();

  const bonusDesc = (b: Bonus) => {
    const points = trimNum(b.points);
    switch (b.bonus_type) {
      case 'fixed':
        return t('voti.desc_fisso', { punti: points });
      case 'on_time':
        return t('voti.desc_in_corso', { punti: points });
      case 'honors_each':
        return (
          t('voti.desc_per_lode', { punti: points }) +
          (b.cap_points > 0 ? t('voti.desc_max', { max: trimNum(b.cap_points) }) : '')
        );
      case 'honors_threshold':
        return t('voti.desc_soglia', { punti: points, lodi: trimNum(b.threshold_value ?? 0) });
      default:
        return t('voti.desc_personalizzato', { punti: points });
    }
  };

  const selectedGroups = [
    ...new Set(
      d.exams.filter((e) => picked.has(e.uuid) && e.group_uuid).map((e) => e.group_uuid as string),
    ),
  ];
  const confirmDelete = () => {
    const n = picked.size;
    if (!n) return;
    const ids = [...picked];
    Alert.alert(n === 1 ? t('voti.eliminare_un_esame') : t('voti.eliminare_n_esami', { n }), '', [
      { text: t('voti.annulla'), style: 'cancel' },
      {
        text: t('voti.elimina'),
        style: 'destructive',
        onPress: () => {
          services.grades.removeExams(ids);
          endSelect();
          refresh();
        },
      },
    ]);
  };
  const confirmUngroup = () => {
    const n = selectedGroups.length;
    if (!n) return;
    Alert.alert(n === 1 ? t('voti.sciogliere_uno') : t('voti.sciogliere_molti', { n }), '', [
      { text: t('voti.annulla'), style: 'cancel' },
      {
        text: t('voti.sciogli'),
        onPress: () => {
          for (const g of selectedGroups) services.grades.dissolveGroup(g);
          endSelect();
          refresh();
        },
      },
    ]);
  };

  const stat = (value: string, label: string, testID: string) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text testID={testID} style={[{ color: th.text }, bigNumber(th, 20)]}>
        {value}
      </Text>
      <Text style={{ color: th.text2, fontSize: 11 }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('voti.voti')}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="grades-settings"
              accessibilityRole="button"
              accessibilityLabel={t('voti.impostazioni')}
              onPress={() => router.push('/grade-settings')}
            >
              <Text style={{ color: th.brand, fontSize: 18 }}>⚙︎</Text>
            </Pressable>
            <Pressable
              testID="grades-close"
              accessibilityRole="button"
              onPress={() => router.back()}
            >
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 14,
          maxWidth: 700,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {empty ? (
          <Card style={{ padding: 22, gap: 12, alignItems: 'center' }}>
            <Text style={{ color: th.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
              {t('voti.la_tua_carriera_in_chiaro')}
            </Text>
            <Text style={{ color: th.text2, textAlign: 'center' }}>
              {t('voti.aggiungi_i_tuoi_esami_e')}
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <PrimaryButton
                testID="grades-start-program"
                label={t('voti.parti_dal_tuo_corso')}
                onPress={() => router.push('/grade-settings')}
              />
            </View>
            <TextButton
              testID="grades-add-first"
              label={t('voti.aggiungi_un_esame_a_mano')}
              onPress={() => router.push('/grade-exam')}
            />
          </Card>
        ) : (
          <>
            {/* --- media e numeri --- */}
            <Card style={{ padding: 16, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Ring done={doneCount} total={totalCount} color={accent} track={th.surface2} />
                  <View style={{ position: 'absolute', alignItems: 'center' }}>
                    <Text style={[{ color: th.text }, bigNumber(th, 18)]}>
                      {doneCount}/{totalCount}
                    </Text>
                    <Text style={{ color: th.text2, fontSize: 10 }}>{t('voti.esami')}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text2, fontSize: 12 }}>{t('voti.media_ponderata')}</Text>
                  <Text testID="grades-average" style={[{ color: th.text }, bigNumber(th, 38)]}>
                    {w.n ? fmt2(w.avg) : '–'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row' }}>
                {stat(w.n ? String(base110(d, w.avg)) : '–', `/${base}`, 'grades-base')}
                {stat(`${trimNum(cfu.done)}/${trimNum(cfu.total)}`, t('voti.cfu'), 'grades-cfu')}
                {lodi > 0 ? stat(String(lodi), t('voti.lodi'), 'grades-lodi') : null}
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: th.surface2,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}
              >
                <View style={{ flex: cfu.done, backgroundColor: accent }} />
                <View style={{ flex: cfu.plan, backgroundColor: accent, opacity: 0.35 }} />
                <View style={{ flex: Math.max(0, cfu.total - cfu.done - cfu.plan) }} />
              </View>
            </Card>

            {/* --- voto di laurea stimato --- */}
            <Card style={{ padding: 16, gap: 6 }}>
              <SectionLabel>{t('voti.voto_di_laurea_stimato')}</SectionLabel>
              {w.n ? (
                <>
                  <Text testID="grades-final" style={[{ color: th.text }, bigNumber(th, 30)]}>
                    {range.min === range.max
                      ? dispFinal(d, range.min)
                      : `${dispFinal(d, range.min)} – ${dispFinal(d, range.max)}`}
                  </Text>
                  <Text style={{ color: th.text2 }}>
                    {t('voti.con_media_attuale', {
                      da: dispFinal(d, range.min),
                      a: dispFinal(d, range.max),
                      base,
                    })}
                  </Text>
                  {range.bonus ? (
                    <Text style={{ color: th.text2, fontSize: 12 }}>
                      {t('voti.punti_bonus')}: +{trimNum(range.bonus)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: th.text2 }}>{t('voti.registra_voti_per_stimare')}</Text>
              )}
            </Card>

            {/* --- obiettivo --- */}
            <Card style={{ padding: 16, gap: 10 }}>
              <SectionLabel>{t('voti.il_tuo_obiettivo')}</SectionLabel>
              {target == null && !editTarget ? (
                <>
                  <Text style={{ color: th.text2 }}>{t('voti.fissa_un_traguardo')}</Text>
                  <PrimaryButton
                    testID="grades-target-set"
                    label={t('voti.imposta_obiettivo')}
                    onPress={() => {
                      setTarget(w.n ? Math.min(30, Math.ceil(w.avg * 2) / 2) : 27);
                      setEditTarget(true);
                    }}
                  />
                </>
              ) : (
                <>
                  <View style={{ alignItems: 'center' }}>
                    <Stepper
                      big
                      th={th}
                      testID="grades-target"
                      value={target != null ? fmt2(target) : '–'}
                      onMinus={() => setTarget((target ?? 27) - 0.5)}
                      onPlus={() => setTarget((target ?? 27) + 0.5)}
                    />
                    <Text style={{ color: th.text2, fontSize: 12 }}>
                      {t('voti.obiettivo_media_origine', {
                        origine:
                          st.target_source === 'simulation'
                            ? t('voti.origine_simulazione')
                            : t('voti.origine_manuale'),
                      })}
                    </Text>
                  </View>
                  {target != null && w.n ? (
                    <Text
                      testID="grades-target-delta"
                      style={{ color: th.text, fontWeight: '700' }}
                    >
                      {t('voti.vs_obiettivo', {
                        scarto: `${w.avg - target >= 0 ? '+' : '−'}${fmt2(Math.abs(w.avg - target))}`,
                      })}
                    </Text>
                  ) : null}
                  <Text testID="grades-target-text" style={{ color: th.text2 }}>
                    {targetText}
                  </Text>
                  <TextButton
                    testID="grades-target-clear"
                    label={t('voti.rimuovi')}
                    danger
                    onPress={() => {
                      setTarget(null);
                      setEditTarget(false);
                    }}
                  />
                </>
              )}
            </Card>

            {/* --- andamento --- */}
            <Card style={{ padding: 16, gap: 8 }}>
              <SectionLabel>{t('voti.andamento')}</SectionLabel>
              {trend.real.length ? (
                <>
                  <TrendChart
                    real={trend.real}
                    proj={projection ? trend.proj : []}
                    target={target}
                    color={accent}
                    th={th}
                    width={chartW}
                  />
                  {trend.proj.length > 1 || sim.used > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Switch
                        testID="grades-projection"
                        value={projection}
                        onValueChange={setProjection}
                        trackColor={{ true: th.brand }}
                      />
                      <Text style={{ color: th.text2, flex: 1, fontSize: 13 }}>
                        {t('voti.mostra_proiezione_sui_voti_previsti')}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: th.text2 }}>{t('voti.registra_i_primi_voti')}</Text>
              )}
            </Card>
          </>
        )}

        {/* --- esami --- */}
        {!empty ? (
          <Card>
            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                  <Pill
                    testID="grades-tab-done"
                    th={th}
                    color={accent}
                    on={tab === 'done'}
                    label={t('voti.sostenuti')}
                    onPress={() => setTab('done')}
                  />
                  <Pill
                    testID="grades-tab-todo"
                    th={th}
                    color={accent}
                    on={tab === 'todo'}
                    label={t('voti.da_sostenere')}
                    onPress={() => setTab('todo')}
                  />
                  <Pill
                    testID="grades-tab-sim"
                    th={th}
                    color={accent}
                    on={tab === 'sim'}
                    label={t('voti.simulatore')}
                    onPress={() => setTab('sim')}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TextButton
                  testID="grades-add"
                  label={t('voti.aggiungi_esame')}
                  onPress={() =>
                    router.push({
                      pathname: '/grade-exam',
                      params: { status: tab === 'done' ? 'done' : 'todo' },
                    })
                  }
                />
                <TextButton
                  testID="grades-select"
                  label={selecting ? t('voti.annulla') : t('voti.seleziona')}
                  onPress={() => (selecting ? endSelect() : setSelecting(true))}
                />
              </View>
              {selecting ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: th.text2 }} testID="grades-picked">
                    {picked.size === 0
                      ? t('voti.0_selezionati')
                      : picked.size === 1
                        ? t('voti.uno_selezionato')
                        : t('voti.n_selezionati', { n: picked.size })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                    <TextButton
                      testID="grades-group"
                      label={t('voti.crea_gruppo')}
                      onPress={() => {
                        if (picked.size < 2) {
                          Alert.alert(t('voti.seleziona_almeno_due'));
                          return;
                        }
                        const ids = [...picked].join(',');
                        endSelect();
                        router.push({ pathname: '/grade-group', params: { ids } });
                      }}
                    />
                    {selectedGroups.length ? (
                      <TextButton
                        testID="grades-ungroup"
                        label={t('voti.sciogli')}
                        onPress={confirmUngroup}
                      />
                    ) : null}
                    <TextButton
                      testID="grades-delete"
                      label={t('voti.elimina')}
                      danger
                      onPress={confirmDelete}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {tab === 'done' ? (
              <View testID="grades-list-done">
                {d.exams.some((e) => e.status === 'done') ? (
                  listFor('done')
                ) : (
                  <Text style={{ color: th.text2, padding: 16 }}>
                    {t('voti.nessun_esame_sostenuto')}
                  </Text>
                )}
              </View>
            ) : null}
            {tab === 'todo' ? (
              <View testID="grades-list-todo">
                {todoVisible(d).length ? (
                  listFor('todo')
                ) : (
                  <Text style={{ color: th.text2, padding: 16 }}>
                    {t('voti.nessun_esame_da_sostenere')}
                  </Text>
                )}
              </View>
            ) : null}
            {tab === 'sim' ? (
              <View testID="grades-list-sim">
                <Text style={{ color: th.text2, paddingHorizontal: 14, paddingBottom: 8 }}>
                  {t('voti.assegna_voto_ipotetico')}
                </Text>
                {simList.length === 0 ? (
                  <Text style={{ color: th.text2, padding: 16 }}>
                    {t('voti.nessun_esame_da_simulare')}
                  </Text>
                ) : (
                  simList.map((e) => (
                    <View
                      key={e.uuid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: th.text, fontWeight: '600' }}>{e.name}</Text>
                        <Text style={{ color: th.text2, fontSize: 12 }}>
                          {t('voti.cfu_totali_breve', { cfu: trimNum(e.cfu) })}
                        </Text>
                      </View>
                      <Stepper
                        th={th}
                        testID={`grades-pred-${e.uuid}`}
                        value={
                          e.predicted_grade == null
                            ? '–'
                            : e.predicted_honors
                              ? '30L'
                              : String(e.predicted_grade)
                        }
                        onMinus={() => stepPred(e, -1)}
                        onPlus={() => stepPred(e, 1)}
                      />
                      {e.predicted_grade != null ? (
                        <Pressable
                          testID={`grades-pred-clear-${e.uuid}`}
                          accessibilityRole="button"
                          accessibilityLabel={t('voti.pulisci_voto_previsto')}
                          hitSlop={8}
                          onPress={() => {
                            services.grades.setPrediction(e.uuid, null, false);
                            refresh();
                          }}
                        >
                          <Text style={{ color: th.text3, fontSize: 16 }}>✕</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}
                {sim.used > 0 ? (
                  <View style={{ padding: 14, gap: 6 }}>
                    <Text testID="grades-sim-avg" style={{ color: th.text, fontWeight: '800' }}>
                      {t('voti.media')}: {fmt2(sim.avg)} →{' '}
                      {dispFinal(d, finalRange(d, sim.avg, true).min)} –{' '}
                      {dispFinal(d, finalRange(d, sim.avg, true).max)}
                    </Text>
                    <TextButton
                      testID="grades-sim-target"
                      label={t('voti.salva_come_obiettivo')}
                      onPress={() => {
                        setTarget(sim.avg, 'simulation');
                        setEditTarget(true);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* --- tesi e bonus --- */}
        {!empty ? (
          <Card style={{ padding: 14, gap: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <SectionLabel>{t('voti.tesi_bonus')}</SectionLabel>
              <TextButton
                testID="grades-bonus-add"
                label={t('voti.bonus')}
                onPress={() => router.push('/grade-bonus')}
              />
            </View>
            {st.thesis_max_points > 0 ? (
              <Text style={{ color: th.text2 }}>
                {t('voti.tesi_aggiunge', { min: st.thesis_min_points, max: st.thesis_max_points })}
              </Text>
            ) : null}
            {d.bonuses.length === 0 ? (
              <Text style={{ color: th.text2 }}>{t('voti.nessun_bonus')}</Text>
            ) : (
              d.bonuses.map((b) => (
                <View
                  key={b.uuid}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Pressable
                    testID={`grades-bonus-${b.uuid}`}
                    accessibilityRole="button"
                    style={{ flex: 1 }}
                    onPress={() =>
                      router.push({ pathname: '/grade-bonus', params: { id: b.uuid } })
                    }
                  >
                    <Text style={{ color: th.text, fontWeight: '600' }}>{b.name}</Text>
                    <Text style={{ color: th.text2, fontSize: 12 }}>
                      {bonusDesc(b)}
                      {b.is_enabled ? ` → +${trimNum(bonusApplied(b, lodi))}` : ''}
                    </Text>
                  </Pressable>
                  <Switch
                    testID={`grades-bonus-switch-${b.uuid}`}
                    value={!!b.is_enabled}
                    onValueChange={(v) => {
                      services.grades.updateBonus(b.uuid, { is_enabled: v });
                      refresh();
                    }}
                    trackColor={{ true: th.brand }}
                  />
                </View>
              ))
            )}
            {d.bonuses.length ? (
              <Text testID="grades-bonus-total" style={{ color: th.text2, fontSize: 12 }}>
                {t('voti.punti_bonus')}: +{trimNum(bonusTotal(d, false))}
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
