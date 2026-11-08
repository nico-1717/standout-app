import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SqlDb } from '@/core/db/sqldb';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, bigNumber } from '@/ui/kit';

import {
  learnedBars,
  learnedChips,
  learnedDays,
  type LearnedKind,
  type LearnedStep,
} from './learned';

/**
 * «Carte che sai» dell'Hub (fc_home.php): i due numeri (studio, lingue) che sono anche tasti, i «+N» di oggi / settimana /
 * mese e le barre per giorno, settimana o mese. Le lingue si vedono solo se c'è almeno un corso.
 */
export function LearnedCard({
  db,
  today,
  lang,
  study,
  vocab,
}: {
  db: SqlDb;
  today: string;
  /** la lingua dell'interfaccia, per il nome dei mesi */
  lang: string;
  /** quante carte di studio sai adesso */
  study: number;
  /** quante parole sai adesso; `null` = nessun corso di lingua */
  vocab: number | null;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [step, setStep] = useState<LearnedStep>('day');
  const [kind, setKind] = useState<LearnedKind | null>(null);
  const days = useMemo(() => {
    const all = new Map<string, number>();
    for (const k of ['study', 'vocab'] as const) {
      if (kind && kind !== k) continue;
      for (const [d, n] of learnedDays(db, k)) all.set(d, (all.get(d) ?? 0) + n);
    }
    return all;
  }, [db, kind]);
  const monthName = (d: Date) => d.toLocaleDateString(lang, { month: 'short' });
  const bars = learnedBars(days, step, today, monthName);
  const chips = learnedChips(days, today);
  const max = Math.max(1, ...bars.map((b) => b.v));
  const steps: [LearnedStep, string][] = [
    ['day', t('fchub.per_giorno')],
    ['week', t('fchub.per_settimana')],
    ['month', t('fchub.per_mese')],
  ];
  const tile = (k: LearnedKind, n: number, label: string) => (
    <Pressable
      key={k}
      testID={`fc-learned-tile-${k}`}
      accessibilityRole="button"
      accessibilityState={{ selected: kind === k }}
      onPress={() => setKind(kind === k ? null : k)}
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 12,
        backgroundColor: kind === k ? th.brandSoft : th.surface2,
        gap: 2,
      }}
    >
      <Text style={[{ color: th.text }, bigNumber(th, 22)]}>{n}</Text>
      <Text style={{ color: th.text2, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
  const chip = (id: string, n: number, label: string) => (
    <View
      key={id}
      testID={`fc-learned-chip-${id}`}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: n > 0 ? th.brandSoft : th.surface2,
      }}
    >
      <Text style={{ color: n > 0 ? th.brand : th.text2, fontSize: 12 }}>
        <Text style={{ fontWeight: '700' }}>+{n}</Text> {label}
      </Text>
    </View>
  );
  return (
    <View testID="fc-learned">
      <Card style={{ padding: 14, gap: 12 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: th.text, fontSize: 15, fontWeight: '700' }}>
            {t('fchub.carte_che_sai')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('fchub.imparate_per')}
            style={{
              flexDirection: 'row',
              backgroundColor: th.surface2,
              borderRadius: 10,
              padding: 2,
            }}
          >
            {steps.map(([id, label]) => (
              <Pressable
                key={id}
                testID={`fc-learned-step-${id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: step === id }}
                onPress={() => setStep(id)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: step === id ? th.surface : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: step === id ? th.text : th.text2,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {tile('study', study, t('fchub.studio'))}
          {vocab !== null
            ? tile('vocab', vocab, `${t('fchub.lingue')} · ${t('fchub.parole')}`)
            : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {chip('today', chips.today, t('fchub.oggi'))}
          {chip('week', chips.week, t('fchub.questa_settimana'))}
          {chip('month', chips.month, t('fchub.questo_mese'))}
        </View>
        <View
          testID="fc-learned-chart"
          accessible
          accessibilityLabel={bars.map((b) => `${b.label}: ${b.v}`).join(', ')}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            height: 110,
            gap: step === 'day' ? 3 : 8,
          }}
        >
          {bars.map((b, i) => (
            <View
              key={i}
              style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
            >
              <Text style={{ color: th.text2, fontSize: 10, height: 14 }}>
                {b.v > 0 ? b.v : ''}
              </Text>
              <View
                testID={`fc-learned-bar-${i}`}
                style={{
                  width: '100%',
                  height: b.v > 0 ? Math.max(6, Math.round((b.v / max) * 70)) : 2,
                  borderRadius: 4,
                  backgroundColor: b.v > 0 ? th.brand : th.surface2,
                  opacity: b.v > 0 && !b.now ? 0.5 : 1,
                }}
              />
              <Text
                style={{
                  color: b.now ? th.text : th.text3,
                  fontSize: 10,
                  fontWeight: b.now ? '700' : '400',
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {b.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ color: th.text3, fontSize: 11 }}>{t('fchub.imparate_nota')}</Text>
      </Card>
    </View>
  );
}
