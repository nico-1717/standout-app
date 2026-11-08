import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, PrimaryButton, TextButton } from '@/ui/kit';

import { dayLabel, hours } from './format';
import type { MasterGoal, MasterView } from './view';

const CHART_H = 130;

function goalLine(
  g: MasterGoal,
  t: (k: string, o?: Record<string, unknown>) => string,
  lang: string,
): string {
  const parts = [t(`piano.tipo_${g.kind}`)];
  if (g.deadline)
    parts.push(dayLabel(g.deadline, lang, { day: 'numeric', month: 'short', year: 'numeric' }));
  if (g.kids) parts.push(t('piano.n_sotto', { n: g.kids }));
  if (g.done) parts.push(t('piano.fatto_breve', { h: hours(g.done) }));
  return parts.join(' · ');
}

/** «Panoramica»: ci sta tutto? Ore per settimana contro il tuo tempo, e l'elenco degli obiettivi con i progetti che non sono ancora nel piano. */
export function PlanOverview(p: {
  view: MasterView;
  lang: string;
  onOpen: (project: string) => void;
  onTime: () => void;
  onAutoplan: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const m = p.view;
  const pct = m.freeMin > 0 ? Math.min(100, Math.round((m.neededMin * 100) / m.freeMin)) : 100;
  let max = 60;
  for (const w of m.weeks)
    max = Math.max(
      max,
      Object.values(w.parts).reduce((a, b) => a + b, 0),
      w.cap,
    );
  const color = new Map(m.goals.map((g) => [g.project, g.color]));
  const goals = m.goals.filter((g) => g.status !== 'completed');

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ padding: 16, gap: 10 }}>
        {m.units === 0 ? (
          <>
            <Text
              testID="ov-empty-title"
              style={{ color: th.text, fontWeight: '800', fontSize: 20 }}
            >
              {t('piano.ov_vuoto_t')}
            </Text>
            <Text style={{ color: th.text2, lineHeight: 20 }}>{t('piano.ov_vuoto')}</Text>
          </>
        ) : (
          <>
            <Text
              testID="ov-verdict"
              style={{ color: m.fits ? th.green : th.red, fontWeight: '800', fontSize: 20 }}
            >
              {m.fits
                ? t('piano.ov_ci_sta', { h: hours(Math.max(0, m.freeMin - m.neededMin)) })
                : t('piano.ov_non_ci_sta', { h: hours(m.missingMin) })}
            </Text>
            {!m.fits && m.freeMin >= m.neededMin ? (
              <Text style={{ color: th.text2 }}>{t('piano.ov_scadenze')}</Text>
            ) : null}
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: th.surface2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: 10,
                  backgroundColor: m.fits ? th.green : th.red,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: th.text2 }}>
                {t('piano.serve')}{' '}
                <Text style={{ color: th.text, fontWeight: '700' }}>{hours(m.neededMin)}</Text>
              </Text>
              <Text style={{ color: th.text2 }}>
                {t('piano.tempo_libero')}{' '}
                <Text style={{ color: th.text, fontWeight: '700' }}>{hours(m.freeMin)}</Text>
              </Text>
            </View>
          </>
        )}
      </Card>

      {m.units > 0 ? (
        <Card style={{ padding: 16, gap: 10 }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
              {t('piano.ore_settimana')}
            </Text>
            <Text style={{ color: th.text2, fontSize: 12 }}>— {t('piano.tuo_tempo')}</Text>
          </View>
          <View
            testID="ov-weeks"
            style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 3 }}
          >
            {m.weeks.map((w) => (
              <View
                key={w.start}
                testID={`ov-week-${w.start}`}
                style={{ flex: 1, height: CHART_H, justifyContent: 'flex-end' }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: Math.round((w.cap / max) * CHART_H),
                    height: 2,
                    backgroundColor: th.text3,
                  }}
                />
                {Object.entries(w.parts).map(([root, mins]) => (
                  <View
                    key={root}
                    style={{
                      height: Math.max(1, Math.round((mins / max) * CHART_H)),
                      backgroundColor: color.get(root) ?? '#8E8E93',
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {m.weeks.map((w, i) => (
              <Text
                key={w.start}
                style={{ flex: 1, color: th.text3, fontSize: 9 }}
                numberOfLines={1}
              >
                {i === 0 || Number(w.start.slice(8, 10)) <= 7
                  ? dayLabel(w.start, p.lang, { month: 'short' })
                  : ''}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={{ padding: 6 }}>
        {goals.map((g) => (
          <Pressable
            key={g.project}
            testID={`ov-goal-${g.project}`}
            accessibilityRole="button"
            onPress={() => p.onOpen(g.project)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: g.color }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>{g.name}</Text>
              <Text style={{ color: th.text2, fontSize: 13 }}>{goalLine(g, t, p.lang)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: th.text, fontWeight: '700' }}>
                {g.minutes ? hours(g.minutes) : '–'}
              </Text>
              {g.missing > 0 ? (
                <Text style={{ color: th.red, fontSize: 12 }}>−{hours(g.missing)}</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
        {m.available.length ? (
          <>
            {goals.length ? (
              <Text
                style={{
                  color: th.text2,
                  fontSize: 12,
                  fontWeight: '700',
                  padding: 12,
                  paddingBottom: 2,
                }}
              >
                {t('piano.non_nel_piano').toUpperCase()}
              </Text>
            ) : null}
            {m.available.map((a) => (
              <Pressable
                key={a.project}
                testID={`ov-add-${a.project}`}
                accessibilityRole="button"
                onPress={() => p.onOpen(a.project)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  opacity: 0.85,
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    borderColor: a.color,
                  }}
                />
                <Text style={{ color: th.text, flex: 1, fontSize: 16 }}>{a.name}</Text>
                <Text style={{ color: th.brand, fontWeight: '700' }}>
                  {t('piano.aggiungi_al_piano')}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
        {!goals.length && !m.available.length ? (
          <Text style={{ color: th.text2, padding: 14 }}>{t('piano.ov_nessun_obiettivo')}</Text>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextButton testID="ov-time" label={t('piano.il_tuo_tempo')} onPress={p.onTime} />
        </View>
        <View style={{ flex: 1.4 }}>
          <PrimaryButton
            testID="ov-autoplan"
            label={t('piano.riempi_calendario')}
            onPress={p.onAutoplan}
          />
        </View>
      </View>
    </View>
  );
}
