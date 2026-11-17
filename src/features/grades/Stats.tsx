/** La scheda «Statistiche» di voti.php: distribuzione dei voti, media per anno, CFU per stato, confronto con la classe, traguardi. */
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { effGrade, findGroup, isGraded, lodiCount, weighted, type GradeData } from './logic';
import { fmt2, trimNum } from './parts';
import { AccentGrad, rgba, type GradeTone } from './ui';

const bool = (x: unknown) => !!Number(x);

/** I CFU per stato (registrati, idoneità, da sostenere): come `renderStats` del sito, con le quote dei gruppi «a scelta». */
export function cfuByState(d: GradeData) {
  let dg = 0;
  let di = 0;
  let tc = 0;
  const chG = new Map<string, number>();
  const chI = new Map<string, number>();
  const seen = new Set<string>();
  for (const e of d.exams) {
    if (!bool(e.counts_for_graduation)) continue;
    const c = Number(e.cfu) || 0;
    const g = e.group_uuid != null ? findGroup(d, e.group_uuid) : null;
    if (g && g.group_type === 'choice') {
      if (e.status === 'done') {
        const m = bool(e.is_pass_fail) ? chI : chG;
        m.set(g.uuid, (m.get(g.uuid) ?? 0) + c);
      }
      continue;
    }
    if (e.status === 'done') {
      if (bool(e.is_pass_fail)) di += c;
      else dg += c;
    } else tc += c;
  }
  for (const e of d.exams) {
    if (e.group_uuid == null) continue;
    const g = findGroup(d, e.group_uuid);
    if (!g || g.group_type !== 'choice' || seen.has(g.uuid)) continue;
    seen.add(g.uuid);
    const quota = Number(g.cfu) || 0;
    const gOk = chG.get(g.uuid) ?? 0;
    const iOk = chI.get(g.uuid) ?? 0;
    const sum = gOk + iOk;
    if (sum > 0) {
      const cap = Math.min(sum, quota);
      const r = cap / sum;
      dg += gOk * r;
      di += iOk * r;
      if (sum < quota) tc += quota - sum;
    } else tc += quota;
  }
  return { dg, di, tc };
}

function Donut({
  segs,
  total,
  tone,
}: {
  segs: { val: number; color: string }[];
  total: number;
  tone: GradeTone;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  let off = 0;
  return (
    <Svg width={96} height={96} viewBox="0 0 104 104">
      <Circle cx={52} cy={52} r={R} fill="none" stroke={tone.surface3} strokeWidth={14} />
      {total > 0
        ? segs.map((s, i) => {
            const frac = s.val / total;
            if (frac <= 0) return null;
            const len = C * frac;
            const node = (
              <Circle
                key={i}
                cx={52}
                cy={52}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={14}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-off}
                transform="rotate(-90 52 52)"
              />
            );
            off += len;
            return node;
          })
        : null}
      <SvgText x={52} y={49} textAnchor="middle" fontSize={15} fontWeight="800" fill={tone.th.text}>
        {trimNum(total)}
      </SvgText>
      <SvgText x={52} y={64} textAnchor="middle" fontSize={9} fill={tone.th.text3}>
        CFU
      </SvgText>
    </Svg>
  );
}

function Block({
  title,
  children,
  th,
}: {
  title: string;
  children: React.ReactNode;
  th: GradeTone['th'];
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: th.text2, fontSize: 13.1, fontWeight: '800', marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function StatsBody({
  d,
  tone,
  target,
}: {
  d: GradeData;
  tone: GradeTone;
  target: number | null;
}) {
  const { t } = useTranslation();
  const th = tone.th;
  const graded = d.exams.filter(isGraded);
  const avg = weighted(d).avg;

  if (!graded.length)
    return (
      <View testID="grades-stats-empty" style={{ alignItems: 'center', paddingVertical: 16 }}>
        <AccentGrad
          tone={tone}
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 26 }}>📊</Text>
        </AccentGrad>
        <Text style={{ color: th.text2, fontSize: 14.7, textAlign: 'center', lineHeight: 21 }}>
          {t('voti.statistiche_dopo_i_primi_voti')}
        </Text>
      </View>
    );

  /* distribuzione */
  const counts: Record<number, number> = {};
  for (let g = 18; g <= 30; g++) counts[g] = 0;
  let lode30 = 0;
  for (const e of graded) {
    let gv = bool(e.has_honors) ? 30 : Math.round(Number(e.grade));
    gv = Math.max(18, Math.min(30, gv));
    counts[gv] = (counts[gv] ?? 0) + 1;
    if (gv === 30 && bool(e.has_honors)) lode30++;
  }
  const maxC = Math.max(1, ...Object.values(counts));
  const BAR_MAX = 80;

  const barColor = (g: number, c: number): string | null => {
    if (g === 29) return tone.gold;
    if (g === 28) return tone.silver;
    if (g === 30) return tone.gold;
    if (c <= 0) return null;
    let alpha = 0.15;
    if (g >= avg + 1) {
      const maxG = Math.max(27, avg + 2);
      alpha = 0.85 + 0.15 * Math.min(1, (g - avg) / (maxG - avg));
    } else {
      const range = Math.max(1, avg - 18);
      alpha = 0.15 + 0.7 * ((g - 18) / range);
    }
    return rgba(tone.accent, alpha);
  };

  /* media per anno */
  const years = new Map<number, { sum: number; cfu: number }>();
  for (const e of graded) {
    const y = e.study_year ?? 0;
    const c = Number(e.cfu) || 0;
    const cur = years.get(y) ?? { sum: 0, cfu: 0 };
    cur.sum += effGrade(d, e) * c;
    cur.cfu += c;
    years.set(y, cur);
  }
  const yearKeys = [...years.keys()].filter((k) => k !== 0).sort((a, b) => a - b);

  const { dg, di, tc } = cfuByState(d);

  /* confronto con la classe */
  let mine = 0;
  let natl = 0;
  let cc = 0;
  let n = 0;
  for (const e of graded) {
    if (e.national_avg == null) continue;
    const c = Number(e.cfu) || 0;
    mine += effGrade(d, e) * c;
    natl += Number(e.national_avg) * c;
    cc += c;
    n++;
  }

  /* traguardi */
  const lt = lodiCount(d, false);
  const reached = target != null && avg >= target;
  const miles = [
    { em: '⭐', lbl: t('voti.primo_esame'), got: graded.length >= 1 },
    { em: '🔥', lbl: t('voti.tre_esami'), got: graded.length >= 3 },
    { em: '👑', lbl: t('voti.prima_lode'), got: lt >= 1 },
    { em: '💎', lbl: t('voti.media_28_piu'), got: avg >= 28 },
    { em: '🎯', lbl: t('voti.obiettivo'), got: reached },
  ];

  const legendRow = (color: string, label: string, val: number) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: th.text, fontSize: 12.8, fontWeight: '600', flex: 1 }}>{label}</Text>
      <Text style={{ color: th.text2, fontSize: 12.8, fontWeight: '700' }}>{trimNum(val)}</Text>
    </View>
  );

  return (
    <View testID="grades-stats">
      <Block title={t('voti.distribuzione_voti')} th={th}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: BAR_MAX + 34 }}
        >
          {Array.from({ length: 13 }, (_, i) => 18 + i).map((g) => {
            const c = counts[g] ?? 0;
            const h = Math.max(3, Math.round((c / maxC) * BAR_MAX));
            const bg = barColor(g, c);
            const plainPct = c > 0 && g === 30 ? (c - lode30) / c : 1;
            return (
              <View key={g} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                <View
                  style={{
                    width: '100%',
                    maxWidth: 20,
                    height: h + 16,
                    justifyContent: 'flex-end',
                  }}
                >
                  {c > 0 ? (
                    <Text
                      style={{
                        textAlign: 'center',
                        color: th.text2,
                        fontSize: 10.5,
                        fontWeight: '800',
                        height: 16,
                      }}
                    >
                      {c}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      height: h,
                      borderTopLeftRadius: 5,
                      borderTopRightRadius: 5,
                      borderBottomLeftRadius: 2,
                      borderBottomRightRadius: 2,
                      overflow: 'hidden',
                      backgroundColor: bg ?? undefined,
                    }}
                  >
                    {bg == null ? (
                      <AccentGrad tone={tone} style={{ flex: 1 }} />
                    ) : g === 30 && lode30 > 0 ? (
                      <>
                        <View style={{ flex: 1 - plainPct, backgroundColor: '#FFD700' }} />
                        <View style={{ flex: plainPct, backgroundColor: tone.gold }} />
                      </>
                    ) : null}
                  </View>
                </View>
                <Text
                  style={{
                    color: th.text3,
                    fontSize: 9,
                    fontWeight: '700',
                    letterSpacing: -0.3,
                    marginTop: 4,
                  }}
                >
                  {g}
                </Text>
              </View>
            );
          })}
        </View>
        {lode30 > 0 ? (
          <Text style={{ textAlign: 'center', fontSize: 12, color: th.text3, marginTop: 6 }}>
            {t('voti.di_cui_con_lode', { n: lode30 })}
          </Text>
        ) : null}
      </Block>

      {yearKeys.length ? (
        <Block title={t('voti.media_per_anno')} th={th}>
          {yearKeys.map((k) => {
            const y = years.get(k)!;
            const ya = y.cfu > 0 ? y.sum / y.cfu : 0;
            const wp = Math.max(2, Math.round(((ya - 18) / 12) * 100));
            return (
              <View
                key={k}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}
              >
                <Text style={{ width: 56, color: th.text2, fontSize: 12.2, fontWeight: '700' }}>
                  {t('voti.anno_n', { n: k })}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 22,
                    borderRadius: 7,
                    backgroundColor: th.surface2,
                    overflow: 'hidden',
                    justifyContent: 'center',
                  }}
                >
                  <AccentGrad
                    tone={tone}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, wp)}%`,
                      minWidth: 2,
                      borderRadius: 7,
                    }}
                  />
                  <Text
                    style={{
                      position: 'absolute',
                      right: 8,
                      color: th.text,
                      fontSize: 11.8,
                      fontWeight: '800',
                    }}
                  >
                    {fmt2(ya)}
                  </Text>
                </View>
              </View>
            );
          })}
        </Block>
      ) : null}

      <Block title={t('voti.cfu_per_stato')} th={th}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Donut
            tone={tone}
            total={dg + di + tc}
            segs={[
              { val: dg, color: tone.accent },
              { val: di, color: th.green },
              { val: tc, color: tone.surface3 },
            ]}
          />
          <View style={{ flex: 1, gap: 6 }}>
            {legendRow(tone.accent, t('voti.voti_registrati'), dg)}
            {legendRow(th.green, t('voti.idoneita'), di)}
            {legendRow(tone.surface3, t('voti.da_sostenere'), tc)}
          </View>
        </View>
      </Block>

      {n > 0 && cc > 0
        ? (() => {
            const mA = mine / cc;
            const nA = natl / cc;
            const diff = mA - nA;
            return (
              <Block title={t('voti.confronto_media_classe')} th={th}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: th.surface2,
                    borderRadius: 15,
                    padding: 14,
                  }}
                >
                  <Text
                    style={{
                      color: diff >= 0 ? th.green : th.red,
                      fontSize: 30,
                      fontWeight: '800',
                      letterSpacing: -0.9,
                    }}
                  >
                    {diff >= 0 ? '+' : ''}
                    {fmt2(diff)}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: th.text2,
                      fontSize: 13.1,
                      fontWeight: '600',
                      lineHeight: 18,
                    }}
                  >
                    {t('voti.confronto_frase', {
                      verso: t(diff >= 0 ? 'voti.sopra' : 'voti.sotto'),
                      media: fmt2(nA),
                      esami: n,
                    }).replace(/<\/?b>/g, '')}
                  </Text>
                </View>
              </Block>
            );
          })()
        : null}

      <Block title={t('voti.traguardi')} th={th}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {miles.map((m) => {
            const inner = (
              <>
                <Text style={{ fontSize: 16 }}>{m.em}</Text>
                <Text
                  style={{
                    color: m.got ? '#fff' : th.text,
                    fontSize: 12.5,
                    fontWeight: '700',
                  }}
                >
                  {m.lbl}
                </Text>
              </>
            );
            const box = {
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
            };
            return m.got ? (
              <LinearGradient
                key={m.lbl}
                testID={`grades-badge-got-${m.em}`}
                colors={[tone.accent, tone.accent2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={box}
              >
                {inner}
              </LinearGradient>
            ) : (
              <View key={m.lbl} style={[box, { backgroundColor: th.surface2 }]}>
                {inner}
              </View>
            );
          })}
        </View>
      </Block>
    </View>
  );
}
