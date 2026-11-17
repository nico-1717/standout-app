import { LinearGradient } from 'expo-linear-gradient';
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
import Svg, { Line } from 'react-native-svg';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  base110,
  bonusApplied,
  bonusTotal,
  cfuStats,
  dispFinal,
  effGrade,
  finalRange,
  findGroup,
  groupDoneCfu,
  groupExams,
  groupQuotaProgress,
  groupTotalCfu,
  isGraded,
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
import { Ring, Stepper, TrendChart, accentOf, fmt2, trimNum } from '@/features/grades/parts';
import { StatsBody } from '@/features/grades/Stats';
import {
  AccentGrad,
  ActionPill,
  CheckMark,
  DeltaPill,
  GradeBadge,
  Seg,
  SectionHead,
  SoftButton,
  StatTile,
  ThesisScale,
  dynamicGradeStyle,
  rgba,
  toneOf,
  type GradeTone,
} from '@/features/grades/ui';
import { hoTheme } from '@/features/home/HomeKit';
import { Card, Header } from '@/ui/kit';

type Tab = 'done' | 'todo' | 'sim';

/** Il «voto» di un esame come lo disegna la medaglia: colore e testo (gradeBadge del sito). */
function badgeOf(
  d: GradeData,
  e: Exam,
  avg: number,
  tone: GradeTone,
  idoneita: string,
): {
  kind: 'pass' | 'todo' | 'lode' | 'g30' | 'g29' | 'g28' | 'dyn';
  text: string;
  style?: ReturnType<typeof dynamicGradeStyle>;
} {
  if (e.is_pass_fail) return { kind: 'pass', text: idoneita };
  if (e.status === 'todo') {
    if (e.predicted_grade != null)
      return {
        kind: 'todo',
        text: `~${e.predicted_honors ? '30L' : Math.round(e.predicted_grade)}`,
      };
    return { kind: 'todo', text: '—' };
  }
  if (e.grade == null) return { kind: 'todo', text: '—' };
  if (e.has_honors) return { kind: 'lode', text: '30L' };
  const g = Math.round(Number(e.grade));
  if (g >= 30) return { kind: 'g30', text: '30' };
  if (g === 29) return { kind: 'g29', text: '29' };
  if (g === 28) return { kind: 'g28', text: '28' };
  void d;
  return { kind: 'dyn', text: String(g), style: dynamicGradeStyle(g, avg, tone) };
}

function ExamRow({
  exam,
  d,
  tone,
  avg,
  first,
  inGroup,
  meta,
  selecting,
  picked,
  onPress,
  onLongPress,
}: {
  exam: Exam;
  d: GradeData;
  tone: GradeTone;
  avg: number;
  first: boolean;
  inGroup: boolean;
  meta: string[];
  selecting: boolean;
  picked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t } = useTranslation();
  const th = tone.th;
  const b = badgeOf(d, exam, avg, tone, t('voti.idoneita'));
  return (
    <Pressable
      testID={`grade-row-${exam.uuid}`}
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: inGroup ? 10 : 12,
        paddingHorizontal: inGroup ? 2 : 4,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: inGroup ? th.hairline2 : th.hairline,
        backgroundColor: picked ? rgba(tone.accent, 0.12) : undefined,
        borderRadius: picked ? 12 : 0,
      }}
    >
      {selecting ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: picked ? tone.accent : th.hairline2,
            backgroundColor: picked ? tone.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {picked ? (
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{ color: th.text, fontSize: inGroup ? 14.4 : 15.4, fontWeight: '600' }}
        >
          {exam.name}
        </Text>
        {meta.length ? (
          <Text style={{ color: th.text2, fontSize: 12, marginTop: 3 }}>{meta.join('  ')}</Text>
        ) : null}
      </View>
      <GradeBadge kind={b.kind} text={b.text} tone={tone} style={b.style} />
      {selecting ? null : <CheckMark done={exam.status === 'done'} tone={tone} />}
    </Pressable>
  );
}

/** Spezza una frase tradotta e mette in grassetto i numeri che erano fra «⟦» e «⟧». */
function BoldText({ text, color, bold }: { text: string; color: string; bold: string }) {
  const parts = text.split(/⟦|⟧/);
  return (
    <Text style={{ color, fontSize: 13.6, lineHeight: 19 }}>
      {parts.map((p, i) =>
        i % 2 ? (
          <Text key={i} style={{ color: bold, fontWeight: '800' }}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

const bonusIcon = (type: string) =>
  type === 'on_time'
    ? '⏱️'
    : type === 'honors_each'
      ? '🌟'
      : type === 'honors_threshold'
        ? '🏅'
        : type === 'fixed'
          ? '➕'
          : '🎁';

/** I voti (voti.php): media, voto di laurea stimato, obiettivo, andamento, esami fatti / da fare / simulatore, statistiche, tesi e bonus. */
export default function GradesScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    services,
    version,
    changed,
    gradeSettings: st,
    updateGradeSettings,
    authState,
  } = useApp();
  const userName = authState.status === 'signedIn' ? authState.user.username : '';
  const ho = hoTheme(th);

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
  const tone = toneOf(th, accent);
  const w = weighted(d);
  const cfu = cfuStats(d);
  const lodi = lodiCount(d, false);
  const doneCount = d.exams.filter((e) => e.status === 'done').length;
  const todoCount = todoVisible(d).length;
  const totalCount = totalExamsCount(d);
  const range = finalRange(d, w.avg, false);
  const base = d.settings.grade_base;
  const target = st.target_average;
  const empty = d.exams.length === 0;
  const narrow = width < 400;
  const heroDark = th.scheme === 'dark';

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

  const fmtDay = (iso: string) => {
    const dt = new Date(`${iso.slice(0, 10)}T00:00:00`);
    return Number.isNaN(dt.getTime())
      ? iso
      : dt.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const examRow = (e: Exam, first: boolean, inGroup: boolean) => {
    const g = e.group_uuid ? findGroup(d, e.group_uuid) : null;
    const meta: string[] = [`${trimNum(e.cfu)} CFU`];
    if (e.study_year) meta.push(`· ${t('voti.anno_n', { n: e.study_year })}`);
    if (e.exam_date && e.status === 'done') meta.push(`· ${fmtDay(e.exam_date)}`);
    if (!inGroup && g) meta.push(`⇄ ${g.name}`);
    if (e.national_avg != null && isGraded(e)) {
      const diff = effGrade(d, e) - Number(e.national_avg);
      meta.push(`${diff >= 0 ? '▲' : '▼'} ${fmt2(Math.abs(diff))}`);
    } else if (e.national_avg != null) {
      meta.push(`${t('voti.media').toLowerCase()} ${fmt2(Number(e.national_avg))}`);
    }
    if (e.status === 'todo' && e.predicted_grade != null)
      meta.push(`${e.predicted_honors ? '30L' : e.predicted_grade} ${t('voti.previsto_par')}`);
    return (
      <ExamRow
        key={e.uuid}
        exam={e}
        d={d}
        tone={tone}
        avg={w.avg}
        first={first}
        inGroup={inGroup}
        meta={meta}
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
        out.push(examRow(e, out.length === 0, false));
        continue;
      }
      if (seen.has(g.uuid)) continue;
      seen.add(g.uuid);
      const members = groupExams(d, g.uuid).filter((m) =>
        mode === 'done' ? m.status === 'done' : m.status === 'todo',
      );
      const split = g.group_type === 'split';
      const q = groupQuotaProgress(d, g.uuid);
      const quotaLabel = split
        ? t('voti.cfu_totali_breve', { cfu: trimNum(groupTotalCfu(d, g.uuid)) })
        : `${trimNum(q?.done ?? groupDoneCfu(d, g.uuid))}${q && q.pred > 0 ? `+${trimNum(q.pred)}` : ''}/${trimNum(g.cfu)} CFU`;
      out.push(
        <View
          key={`g-${g.uuid}`}
          style={{
            paddingTop: 10,
            paddingHorizontal: 4,
            paddingBottom: 12,
            borderTopWidth: out.length === 0 ? 0 : 1,
            borderTopColor: th.hairline,
          }}
        >
          <View
            style={{
              backgroundColor: th.surface2,
              borderRadius: 14,
              paddingVertical: 4,
              paddingHorizontal: 10,
              overflow: 'hidden',
            }}
          >
            <Pressable
              testID={`grade-group-${g.uuid}`}
              accessibilityRole="button"
              onPress={() =>
                selecting
                  ? members.forEach((m) => togglePick(m.uuid))
                  : router.push({ pathname: '/grade-group', params: { id: g.uuid } })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 9,
                paddingHorizontal: 2,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: th.text, fontWeight: '800', fontSize: 13.8 }}
              >
                {g.name}
              </Text>
              <View
                style={{
                  paddingVertical: 2,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: split ? rgba(tone.accent, 0.16) : th.purpleSoft,
                }}
              >
                <Text
                  style={{
                    color: split ? tone.accent : th.purple,
                    fontWeight: '800',
                    fontSize: 10.2,
                  }}
                >
                  {split ? t('voti.suddiviso') : t('voti.a_scelta_maiusc')}
                </Text>
              </View>
              <Text style={{ color: th.text2, fontSize: 10.9, fontWeight: '700' }}>
                {quotaLabel}
              </Text>
            </Pressable>
            {members.map((m, i) => examRow(m, i === 0, true))}
          </View>
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
  const chartW = Math.min(width, 640) - 28 - 36;
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

  /* --- numeri della testata --- */
  const avgText = w.n ? fmt2(w.avg) : '–';
  const [avgInt, avgDec] = w.n ? [avgText.split('.')[0]!, `.${avgText.split('.')[1]!}`] : ['–', ''];
  const cfuTotal = Math.max(1, cfu.total);
  const rangeStr = w.n
    ? range.min === range.max
      ? dispFinal(d, range.min)
      : `${dispFinal(d, range.min)}–${dispFinal(d, range.max)}`
    : '–';
  const delta = target != null && w.n ? w.avg - target : null;
  const bold = th.text;
  const roundBtn = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: th.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxShadow: heroDark
      ? '0 1px 1.5px rgba(0,0,0,.5), 0 5px 12px -4px rgba(0,0,0,.6)'
      : '0 1px 1.5px rgba(0,0,0,.08), 0 5px 12px -4px rgba(0,0,0,.13)',
  };

  const tesiMin = st.thesis_min_points;
  const tesiMax = st.thesis_max_points;
  const bonusSum = bonusTotal(d, false);
  const bw = (v: string) => `⟦${v}⟧`;
  const thesisSentence =
    t('voti.tesi_aggiunge', { min: bw(`+${trimNum(tesiMin)}`), max: bw(`+${trimNum(tesiMax)}`) }) +
    ' ' +
    (w.n
      ? t('voti.con_media_attuale', {
          da: bw(dispFinal(d, range.min)),
          a: bw(dispFinal(d, range.max)),
          base,
        })
      : t('voti.registra_voti_per_stimare'));

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('voti.voti')}
        account={{
          letter: (userName[0] ?? '?').toUpperCase(),
          label: t('app.account'),
          onPress: () => router.push('/account'),
        }}
        right={
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 1 }}>
            {st.program_label ? (
              <Pressable
                testID="grades-degree"
                accessibilityRole="button"
                onPress={() => router.push('/grade-settings')}
                style={{
                  flexShrink: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  maxWidth: Math.round(width * 0.3),
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: th.surface,
                  boxShadow: roundBtn.boxShadow,
                }}
              >
                <AccentGrad tone={tone} style={{ width: 9, height: 9, borderRadius: 5 }} />
                <Text
                  numberOfLines={1}
                  style={{ flexShrink: 1, color: th.text, fontSize: 13.1, fontWeight: '700' }}
                >
                  {st.program_label}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="grades-settings"
              accessibilityRole="button"
              accessibilityLabel={t('voti.impostazioni')}
              onPress={() => router.push('/grade-settings')}
              style={roundBtn}
            >
              <Text style={{ color: accent, fontSize: 18 }}>⚙︎</Text>
            </Pressable>
            <Pressable
              testID="grades-close"
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              onPress={() => router.back()}
              style={roundBtn}
            >
              <Text style={{ color: accent, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: 14,
          paddingBottom: insets.bottom + 40,
          gap: 14,
          maxWidth: 640,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {empty ? (
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 12, gap: 10 }}>
            <AccentGrad
              tone={tone}
              style={{
                width: 76,
                height: 76,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
                boxShadow: ho.shadow,
              }}
            >
              <Text style={{ fontSize: 34 }}>🎓</Text>
            </AccentGrad>
            <Text
              style={{
                color: th.text,
                fontSize: 21.6,
                fontWeight: '800',
                letterSpacing: -0.43,
                textAlign: 'center',
              }}
            >
              {t('voti.la_tua_carriera_in_chiaro')}
            </Text>
            <Text style={{ color: th.text2, fontSize: 14.7, lineHeight: 21, textAlign: 'center' }}>
              {t('voti.aggiungi_i_tuoi_esami_e')}
            </Text>
            <View style={{ marginTop: 12 }}>
              <SoftButton
                testID="grades-start-program"
                label={t('voti.parti_dal_tuo_corso')}
                tone={tone}
                onPress={() => router.push('/grade-settings')}
              />
            </View>
            <SoftButton
              testID="grades-add-first"
              label={t('voti.aggiungi_un_esame_a_mano')}
              tone={tone}
              variant="ghost"
              onPress={() => router.push('/grade-exam')}
            />
          </View>
        ) : (
          <>
            {/* --- testata: media, numeri, voto di laurea, CFU --- */}
            <View
              style={{
                backgroundColor: th.surface,
                borderRadius: 26,
                paddingTop: 22,
                paddingHorizontal: 20,
                paddingBottom: 20,
                overflow: 'hidden',
                boxShadow: heroDark
                  ? '0 2px 6px rgba(0,0,0,.5), 0 24px 56px -12px rgba(0,0,0,.7)'
                  : '0 2px 4px rgba(0,0,0,.05), 0 20px 48px -12px rgba(0,0,0,.16)',
              }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[rgba(accent, 0.1), rgba(accent, 0)]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.65 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: narrow ? 14 : 20 }}>
                <View
                  style={{
                    width: narrow ? 112 : 132,
                    height: narrow ? 112 : 132,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ring
                    done={doneCount}
                    total={totalCount}
                    color={accent}
                    track={tone.surface3}
                    size={narrow ? 112 : 132}
                    stroke={12}
                  />
                  <View style={{ position: 'absolute', alignItems: 'center' }}>
                    <Text
                      style={{
                        color: th.text,
                        fontSize: 24,
                        fontWeight: '800',
                        letterSpacing: -0.7,
                      }}
                    >
                      {doneCount}
                      <Text style={{ color: th.text2, fontSize: 14.4, fontWeight: '700' }}>
                        /{totalCount}
                      </Text>
                    </Text>
                    <Text
                      style={{
                        color: th.text2,
                        fontSize: 9.6,
                        fontWeight: '800',
                        letterSpacing: 0.7,
                        textTransform: 'uppercase',
                        marginTop: 2,
                      }}
                    >
                      {t('voti.esami')}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: th.text2,
                      fontSize: 10.9,
                      fontWeight: '800',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      marginBottom: 2,
                    }}
                  >
                    {t('voti.media_ponderata')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text
                      testID="grades-average"
                      style={{
                        color: th.text,
                        fontSize: narrow ? 48 : 56,
                        fontWeight: '800',
                        letterSpacing: -2.2,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {avgInt}
                      <Text
                        style={{
                          color: th.text2,
                          fontSize: narrow ? 28.8 : 33.6,
                          letterSpacing: -1.5,
                        }}
                      >
                        {avgDec}
                      </Text>
                    </Text>
                  </View>
                  {delta != null ? (
                    <View style={{ marginTop: 8 }}>
                      <DeltaPill
                        th={th}
                        mood={Math.abs(delta) < 0.005 ? 'flat' : delta > 0 ? 'up' : 'down'}
                        text={
                          Math.abs(delta) < 0.005
                            ? t('voti.obiettivo_centrato')
                            : t('voti.vs_obiettivo', {
                                scarto: `${delta > 0 ? '▲ +' : '▼ '}${fmt2(Math.abs(delta))}`,
                              })
                        }
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <StatTile
                  th={th}
                  testID="grades-base"
                  value={w.n ? String(base110(d, w.avg)) : '–'}
                  small={`/${base}`}
                  label={t('voti.base_laurea')}
                />
                <StatTile
                  th={th}
                  testID="grades-cfu"
                  value={trimNum(cfu.done)}
                  label={t('voti.cfu_dati')}
                />
                {lodi > 0 ? (
                  <StatTile
                    th={th}
                    testID="grades-lodi"
                    value={String(lodi)}
                    label={t('voti.lodi')}
                  />
                ) : null}
              </View>

              <View
                style={{
                  marginTop: 14,
                  backgroundColor: th.surface2,
                  borderRadius: 15,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text
                    style={{
                      color: th.text2,
                      fontSize: 10.9,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('voti.voto_di_laurea_stimato')}
                  </Text>
                  {tesiMax > 0 ? (
                    <Text style={{ color: th.text2, fontSize: 10.9, fontWeight: '700' }}>
                      {t('voti.tesi_da_a', { min: trimNum(tesiMin), max: trimNum(tesiMax) })}
                    </Text>
                  ) : null}
                </View>
                {w.n ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                      <Text
                        testID="grades-final"
                        style={{
                          color: accent,
                          fontSize: 20.8,
                          fontWeight: '800',
                          letterSpacing: -0.4,
                        }}
                      >
                        {rangeStr}
                      </Text>
                      <Text style={{ color: th.text2, fontSize: 20.8, fontWeight: '700' }}>
                        /{base}
                      </Text>
                    </View>
                    {range.bonus ? (
                      <Text style={{ color: th.text2, fontSize: 11.5, marginTop: 2 }}>
                        {t('voti.punti_bonus')}: +{trimNum(range.bonus)}
                      </Text>
                    ) : null}
                    <ThesisScale d={d} range={{ min: range.min, max: range.max }} tone={tone} />
                  </>
                ) : (
                  <Text style={{ color: th.text2, marginTop: 4 }}>
                    {t('voti.registra_voti_per_stimare')}
                  </Text>
                )}
              </View>

              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', gap: 14, marginBottom: 7, flexWrap: 'wrap' }}>
                  {[
                    { k: 'done', c: accent, o: 1, l: t('voti.registrati'), v: cfu.done },
                    { k: 'plan', c: accent, o: 0.34, l: t('voti.pianificati'), v: cfu.plan },
                    { k: 'left', c: tone.surface3, o: 1, l: t('voti.totale'), v: cfu.total },
                  ].map((it) => (
                    <View key={it.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          backgroundColor: it.c,
                          opacity: it.o,
                        }}
                      />
                      <Text style={{ color: th.text2, fontSize: 11.5, fontWeight: '600' }}>
                        {it.l}{' '}
                        <Text style={{ color: th.text, fontWeight: '800' }}>{trimNum(it.v)}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
                <View
                  style={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: tone.surface3,
                    overflow: 'hidden',
                    flexDirection: 'row',
                  }}
                >
                  <AccentGrad tone={tone} style={{ width: `${(cfu.done / cfuTotal) * 100}%` }} />
                  <View
                    style={{
                      width: `${(cfu.plan / cfuTotal) * 100}%`,
                      backgroundColor: accent,
                      opacity: 0.32,
                    }}
                  />
                </View>
              </View>
            </View>

            {/* --- obiettivo --- */}
            <Card style={{ padding: 18 }}>
              <SectionHead icon="🎯" bg={accent} th={th} title={t('voti.obiettivo')} />
              {target == null && !editTarget ? (
                <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4, gap: 14 }}>
                  <AccentGrad
                    tone={tone}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: ho.shadow,
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>🎯</Text>
                  </AccentGrad>
                  <Text
                    style={{
                      color: th.text2,
                      fontSize: 14.7,
                      lineHeight: 21,
                      textAlign: 'center',
                      maxWidth: 340,
                    }}
                  >
                    {t('voti.fissa_un_traguardo')}
                  </Text>
                  <SoftButton
                    testID="grades-target-set"
                    label={t('voti.imposta_obiettivo')}
                    tone={tone}
                    onPress={() => {
                      setTarget(w.n ? Math.min(30, Math.ceil(w.avg * 2) / 2) : 27);
                      setEditTarget(true);
                    }}
                  />
                </View>
              ) : (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <View>
                      <Text
                        testID="grades-target-value"
                        style={{
                          color: th.text,
                          fontSize: 35,
                          fontWeight: '800',
                          letterSpacing: -0.7,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {target != null ? fmt2(target) : '–'}
                      </Text>
                      <Text style={{ color: th.text3, fontSize: 12.5 }}>
                        {t('voti.obiettivo_media_origine', {
                          origine:
                            st.target_source === 'simulation'
                              ? t('voti.origine_simulazione')
                              : t('voti.origine_manuale'),
                        })}
                      </Text>
                    </View>
                    {target != null && w.n ? (
                      <DeltaPill
                        th={th}
                        testID="grades-target-delta"
                        mood={w.avg >= target - 0.0001 ? 'up' : 'down'}
                        text={`${w.avg - target >= 0 ? '+' : ''}${fmt2(w.avg - target)}`}
                      />
                    ) : null}
                  </View>
                  <View
                    style={{
                      height: 9,
                      backgroundColor: tone.surface3,
                      borderRadius: 5,
                      overflow: 'hidden',
                      marginTop: 12,
                      marginBottom: 10,
                    }}
                  >
                    <AccentGrad
                      tone={tone}
                      style={{
                        height: '100%',
                        borderRadius: 5,
                        width: `${
                          target != null && target > 18
                            ? Math.max(0, Math.min(100, ((w.avg - 18) / (target - 18)) * 100))
                            : 100
                        }%`,
                      }}
                    />
                  </View>
                  <Text
                    testID="grades-target-text"
                    style={{ color: th.text2, fontSize: 14.1, lineHeight: 20 }}
                  >
                    {targetText}
                  </Text>
                  {target != null && w.n ? (
                    <View style={{ marginTop: 32, opacity: 0.6 }}>
                      <Text
                        style={{
                          color: th.text2,
                          fontSize: 10.4,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          marginBottom: 6,
                          letterSpacing: 0.5,
                        }}
                      >
                        {t('voti.voto_di_laurea_ambito')}
                      </Text>
                      <View style={{ marginTop: -26 }}>
                        <ThesisScale d={d} range={finalRange(d, target, false)} tone={tone} />
                      </View>
                    </View>
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 10,
                    }}
                  >
                    <Stepper
                      hideValue
                      th={th}
                      accent={accent}
                      testID="grades-target"
                      value={target != null ? fmt2(target) : '–'}
                      onMinus={() => setTarget((target ?? 27) - 0.5)}
                      onPlus={() => setTarget((target ?? 27) + 0.5)}
                    />
                    <SoftButton
                      testID="grades-target-clear"
                      label={t('voti.rimuovi')}
                      tone={tone}
                      variant="danger"
                      onPress={() => {
                        setTarget(null);
                        setEditTarget(false);
                      }}
                    />
                  </View>
                </>
              )}
            </Card>

            {/* --- andamento --- */}
            <Card style={{ padding: 18 }}>
              <SectionHead icon="📈" bg={th.teal} th={th} title={t('voti.andamento')} />
              {trend.real.length ? (
                <>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 6 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: accent }}
                      />
                      <Text style={{ color: th.text2, fontSize: 12.2, fontWeight: '700' }}>
                        {t('voti.media')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Svg width={16} height={3}>
                        <Line
                          x1={0}
                          x2={16}
                          y1={1.5}
                          y2={1.5}
                          stroke={th.text3}
                          strokeWidth={2}
                          strokeDasharray="5 4"
                        />
                      </Svg>
                      <Text style={{ color: th.text2, fontSize: 12.2, fontWeight: '700' }}>
                        {t('voti.obiettivo')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Svg width={16} height={3}>
                        <Line
                          x1={0}
                          x2={16}
                          y1={1.5}
                          y2={1.5}
                          stroke={accent}
                          strokeWidth={3}
                          strokeDasharray="5 4"
                        />
                      </Svg>
                      <Text style={{ color: th.text2, fontSize: 12.2, fontWeight: '700' }}>
                        {t('voti.proiezione')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 5,
                          backgroundColor: accent,
                          borderWidth: 2,
                          borderColor: th.surface,
                        }}
                      />
                      <Text style={{ color: th.text2, fontSize: 12.2, fontWeight: '700' }}>
                        {t('voti.voto_esame')}
                      </Text>
                    </View>
                  </View>
                  <TrendChart
                    real={trend.real}
                    proj={projection ? trend.proj : []}
                    target={target}
                    color={accent}
                    gold={tone.gold}
                    th={th}
                    width={chartW}
                  />
                  {trend.proj.length > 1 || sim.used > 0 ? (
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}
                    >
                      <Switch
                        testID="grades-projection"
                        value={projection}
                        onValueChange={setProjection}
                        trackColor={{ true: th.green }}
                        style={{ transform: [{ scale: 0.82 }] }}
                      />
                      <Text style={{ color: th.text2, flex: 1, fontSize: 12.8, fontWeight: '600' }}>
                        {t('voti.mostra_proiezione_sui_voti_previsti')}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: th.text2, textAlign: 'center', paddingVertical: 26 }}>
                  {t('voti.registra_i_primi_voti')}
                </Text>
              )}
            </Card>
          </>
        )}

        {/* --- esami --- */}
        {!empty ? (
          <Card style={{ padding: 18 }}>
            <SectionHead
              icon="📚"
              bg={th.blue}
              th={th}
              title={t('voti.esami')}
              right={
                tab === 'sim' && sim.used > 0 ? (
                  <ActionPill
                    testID="grades-sim-target"
                    tone={tone}
                    label={t('voti.salva_come_obiettivo')}
                    onPress={() => {
                      setTarget(sim.avg, 'simulation');
                      setEditTarget(true);
                    }}
                  />
                ) : tab === 'sim' ? null : (
                  <ActionPill
                    testID="grades-select"
                    tone={tone}
                    soft
                    label={selecting ? t('voti.annulla') : t('voti.seleziona')}
                    onPress={() => (selecting ? endSelect() : setSelecting(true))}
                  />
                )
              }
            />
            <Seg
              tone={tone}
              value={tab}
              onChange={(k) => {
                if (k !== 'todo' && selecting) endSelect();
                setTab(k as Tab);
              }}
              items={[
                {
                  key: 'done',
                  label: t('voti.sostenuti'),
                  count: doneCount,
                  testID: 'grades-tab-done',
                },
                {
                  key: 'todo',
                  label: t('voti.da_sostenere'),
                  count: todoCount,
                  testID: 'grades-tab-todo',
                },
                { key: 'sim', label: t('voti.simulatore'), testID: 'grades-tab-sim' },
              ]}
            />

            {tab === 'done' ? (
              <View testID="grades-list-done">
                {d.exams.some((e) => e.status === 'done') ? (
                  listFor('done')
                ) : (
                  <Text style={{ color: th.text2, padding: 16, textAlign: 'center' }}>
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
                  <Text style={{ color: th.text2, padding: 16, textAlign: 'center' }}>
                    {t('voti.nessun_esame_da_sostenere')}
                  </Text>
                )}
              </View>
            ) : null}
            {tab === 'sim' ? (
              <View testID="grades-list-sim">
                <Text style={{ color: th.text3, fontSize: 12, lineHeight: 16, marginBottom: 10 }}>
                  {t('voti.assegna_voto_ipotetico')}
                </Text>
                {sim.used > 0 ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      backgroundColor: th.surface2,
                      borderRadius: 16,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      marginBottom: 12,
                    }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          color: th.text2,
                          fontSize: 9.9,
                          fontWeight: '800',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t('voti.media')}
                      </Text>
                      <Text
                        style={{
                          color: th.text,
                          fontSize: 27,
                          fontWeight: '800',
                          letterSpacing: -0.8,
                        }}
                      >
                        {w.n ? fmt2(w.avg) : '–'}
                      </Text>
                    </View>
                    <Text style={{ color: th.text3, fontSize: 21 }}>→</Text>
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          color: th.text2,
                          fontSize: 9.9,
                          fontWeight: '800',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t('voti.simulata')}
                      </Text>
                      <Text
                        testID="grades-sim-avg"
                        style={{
                          color: accent,
                          fontSize: 27,
                          fontWeight: '800',
                          letterSpacing: -0.8,
                        }}
                      >
                        {fmt2(sim.avg)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        marginLeft: 'auto',
                        color:
                          !w.n || Math.abs(sim.avg - w.avg) < 0.005
                            ? th.text2
                            : sim.avg > w.avg
                              ? th.green
                              : th.red,
                        fontSize: 13.1,
                        fontWeight: '800',
                      }}
                    >
                      {w.n ? `${sim.avg - w.avg >= 0 ? '+' : ''}${fmt2(sim.avg - w.avg)}` : ''}
                    </Text>
                  </View>
                ) : null}
                {simList.length === 0 ? (
                  <Text style={{ color: th.text2, padding: 16, textAlign: 'center' }}>
                    {t('voti.nessun_esame_da_simulare')}
                  </Text>
                ) : (
                  simList.map((e, i) => (
                    <View
                      key={e.uuid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        paddingHorizontal: 2,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: th.hairline,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ flex: 1, color: th.text, fontSize: 14, fontWeight: '600' }}
                      >
                        {e.name} <Text style={{ color: th.text2 }}>· {trimNum(e.cfu)} CFU</Text>
                      </Text>
                      <Stepper
                        th={th}
                        accent={accent}
                        gold={tone.gold}
                        lode={!!e.predicted_honors}
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
              </View>
            ) : null}

            {tab !== 'sim' ? (
              <>
                {selecting ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 16,
                      backgroundColor: th.surface2,
                    }}
                  >
                    <Text
                      testID="grades-picked"
                      style={{
                        flex: 1,
                        color: th.text,
                        fontSize: 13.1,
                        fontWeight: '800',
                        paddingLeft: 4,
                      }}
                    >
                      {picked.size === 0
                        ? t('voti.0_selezionati')
                        : picked.size === 1
                          ? t('voti.uno_selezionato')
                          : t('voti.n_selezionati', { n: picked.size })}
                    </Text>
                    <Pressable
                      testID="grades-group"
                      accessibilityRole="button"
                      onPress={() => {
                        if (picked.size < 2) {
                          Alert.alert(t('voti.seleziona_almeno_due'));
                          return;
                        }
                        const ids = [...picked].join(',');
                        endSelect();
                        router.push({ pathname: '/grade-group', params: { ids } });
                      }}
                      style={{
                        backgroundColor: th.purple,
                        borderRadius: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 13,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.8 }}>
                        {t('voti.crea_gruppo')}
                      </Text>
                    </Pressable>
                    {selectedGroups.length ? (
                      <Pressable
                        testID="grades-ungroup"
                        accessibilityRole="button"
                        onPress={confirmUngroup}
                        style={{
                          backgroundColor: th.surface,
                          borderRadius: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 13,
                        }}
                      >
                        <Text style={{ color: th.text2, fontWeight: '800', fontSize: 12.8 }}>
                          {t('voti.sciogli')}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      testID="grades-delete"
                      accessibilityRole="button"
                      onPress={confirmDelete}
                      style={{
                        backgroundColor: th.redSoft,
                        borderRadius: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 13,
                      }}
                    >
                      <Text style={{ color: th.red, fontWeight: '800', fontSize: 12.8 }}>
                        {t('voti.elimina')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable
                  testID="grades-add"
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/grade-exam',
                      params: { status: tab === 'done' ? 'done' : 'todo' },
                    })
                  }
                  style={({ pressed }) => ({
                    marginTop: 12,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: th.hairline2,
                    borderRadius: 15,
                    padding: 13,
                    alignItems: 'center',
                    backgroundColor: pressed ? rgba(accent, 0.12) : 'transparent',
                  })}
                >
                  <Text style={{ color: accent, fontWeight: '700', fontSize: 14.4 }}>
                    {t('voti.aggiungi_esame')}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </Card>
        ) : null}

        {/* --- statistiche --- */}
        {!empty ? (
          <Card style={{ padding: 18 }}>
            <SectionHead icon="📊" bg={th.orange} th={th} title={t('voti.statistiche')} />
            <StatsBody d={d} tone={tone} target={target} />
          </Card>
        ) : null}

        {/* --- tesi e bonus --- */}
        {!empty ? (
          <Card style={{ padding: 18 }}>
            <SectionHead
              icon="🎓"
              bg={tone.gold}
              th={th}
              title={t('voti.tesi_bonus')}
              right={
                <ActionPill
                  testID="grades-bonus-add"
                  tone={tone}
                  label={t('voti.bonus')}
                  onPress={() => router.push('/grade-bonus')}
                />
              }
            />
            <View testID="grades-thesis">
              <BoldText text={thesisSentence} color={th.text2} bold={bold} />
              <View style={{ marginTop: 4 }}>
                <ThesisScale
                  d={d}
                  range={w.n ? { min: range.min, max: range.max } : null}
                  tone={tone}
                />
              </View>
            </View>
            {d.bonuses.length === 0 ? (
              <Text
                style={{
                  color: th.text2,
                  textAlign: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  marginTop: 16,
                  fontSize: 14.7,
                  lineHeight: 21,
                }}
              >
                {t('voti.nessun_bonus')}
              </Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                {d.bonuses.map((b, i) => {
                  const applied = bonusApplied(b, lodi);
                  return (
                    <View
                      key={b.uuid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 13,
                        paddingHorizontal: 2,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: th.hairline,
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: th.surface2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 16.8 }}>{bonusIcon(b.bonus_type)}</Text>
                      </View>
                      <Pressable
                        testID={`grades-bonus-${b.uuid}`}
                        accessibilityRole="button"
                        style={{ flex: 1, minWidth: 0 }}
                        onPress={() =>
                          router.push({ pathname: '/grade-bonus', params: { id: b.uuid } })
                        }
                      >
                        <Text
                          numberOfLines={1}
                          style={{ color: th.text, fontWeight: '700', fontSize: 14.7 }}
                        >
                          {b.name}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={{ color: th.text2, fontSize: 11.8, marginTop: 1 }}
                        >
                          {bonusDesc(b)}
                        </Text>
                      </Pressable>
                      <Text
                        style={{
                          color: applied > 0 ? th.green : th.text3,
                          fontWeight: '800',
                          fontSize: 15.2,
                        }}
                      >
                        {applied > 0 ? `+${trimNum(applied)}` : '—'}
                      </Text>
                      <Switch
                        testID={`grades-bonus-switch-${b.uuid}`}
                        value={!!b.is_enabled}
                        onValueChange={(v) => {
                          services.grades.updateBonus(b.uuid, { is_enabled: v });
                          refresh();
                        }}
                        trackColor={{ true: th.green }}
                      />
                    </View>
                  );
                })}
                <Text
                  testID="grades-bonus-total"
                  style={{ color: th.text2, fontSize: 12, textAlign: 'right', marginTop: 4 }}
                >
                  {t('voti.punti_bonus')}: +{trimNum(bonusSum)}
                </Text>
              </View>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
