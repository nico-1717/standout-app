import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Confetti, type Burst } from '@/features/habits/Confetti';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';

import {
  accuracyOf,
  accuracyTone,
  checkpointTitleKey,
  type BlockSummary,
  type Due,
} from '../gameJuice';
import { useCountUp } from './useCountUp';

export interface RecordLine {
  icon: string;
  text: string;
}

const R = 15.2;
const C = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function AccuracyRing({ value, color, track }: { value: number; color: string; track: string }) {
  const still = useReducedMotion();
  const p = useSharedValue(still ? value / 100 : 0);
  useEffect(() => {
    p.set(
      still
        ? value / 100
        : withTiming(value / 100, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, still, p]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [C * p.get(), C] }));
  return (
    <Svg
      width={120}
      height={120}
      viewBox="0 0 36 36"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Circle cx={18} cy={18} r={R} stroke={track} strokeWidth={3} fill="none" />
      <AnimatedCircle
        cx={18}
        cy={18}
        r={R}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        transform="rotate(-90 18 18)"
        animatedProps={props}
      />
    </Svg>
  );
}

/**
 * La pausa a ogni checkpoint: come è andato l'ultimo tratto (precisione, serie migliore, secondi per carta), gli eventuali
 * record, le carte «prese al volo» e, se ci sono errori, il tasto per il boss.
 */
export function CheckpointSheet({
  visible,
  due,
  count,
  summary,
  bestStreak,
  records,
  labelOf,
  bursts,
  onBurstDone,
  onContinue,
  onBoss,
}: {
  visible: boolean;
  due: Due;
  /** quanti checkpoint ha la partita */
  count: number;
  summary: BlockSummary;
  bestStreak: number;
  records: RecordLine[];
  labelOf: (target: string, isChild: boolean, position: number) => string;
  bursts: readonly Burst[];
  onBurstDone: (id: number) => void;
  onContinue: () => void;
  onBoss: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  const acc = accuracyOf(summary.correct, summary.wrong);
  const shown = useCountUp(acc);
  const secs = useCountUp(summary.perCard ?? 0, 700, 1);
  const tone = accuracyTone(acc);
  const color = tone === 'green' ? th.green : tone === 'yellow' ? '#FFD60A' : th.red;
  const misses = summary.missed.length;

  return (
    <Sheet
      visible={visible}
      th={ht}
      testID="fcg-checkpoint"
      title={t(checkpointTitleKey(acc, due.end))}
      onClose={onContinue}
      overlay={<Confetti bursts={bursts} onDone={onBurstDone} />}
      footer={
        <>
          {misses > 0 ? (
            <Pressable
              testID="fcg-ck-boss"
              accessibilityRole="button"
              onPress={onBoss}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: '#BF5AF2',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {'👑 '}
                {t('fcv.ck_boss', { n: misses })}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="fcg-ck-continue"
            accessibilityRole="button"
            onPress={onContinue}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: misses > 0 ? ht.surface2 : th.brand,
            }}
          >
            <Text style={{ color: misses > 0 ? ht.text : '#fff', fontWeight: '700', fontSize: 16 }}>
              {t(misses > 0 && !due.end ? 'fcv.ck_salta' : 'fcv.ck_continua')}
            </Text>
          </Pressable>
        </>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, alignItems: 'center' }}>
        <Text style={{ color: ht.text2, fontWeight: '700', fontSize: 12, letterSpacing: 0.6 }}>
          {t('fcv.ck_occhiello', { k: due.k, n: count }).toUpperCase()}
        </Text>
        <View
          accessible
          accessibilityLabel={`${t('fcv.ck_precisione')} ${acc}%`}
          style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ position: 'absolute' }}>
            <AccuracyRing value={acc} color={color} track={ht.hairline2} />
          </View>
          <Text
            testID="fcg-ck-acc"
            style={{
              color: ht.text,
              fontSize: 30,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {Math.round(shown)}%
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
          <View
            style={{ flex: 1, backgroundColor: ht.surface2, borderRadius: 14, padding: 12, gap: 2 }}
          >
            <Text style={{ color: ht.text2, fontSize: 12 }}>{t('fcv.ck_serie')}</Text>
            <Text
              testID="fcg-ck-streak"
              style={{ color: ht.text, fontSize: 20, fontWeight: '800' }}
            >
              {'🔥 '}
              {bestStreak}
            </Text>
          </View>
          <View
            style={{ flex: 1, backgroundColor: ht.surface2, borderRadius: 14, padding: 12, gap: 2 }}
          >
            <Text style={{ color: ht.text2, fontSize: 12 }}>{t('fcv.ck_tempo')}</Text>
            <Text testID="fcg-ck-time" style={{ color: ht.text, fontSize: 20, fontWeight: '800' }}>
              {summary.perCard === null ? '–' : `${secs.toFixed(1)}s`}
            </Text>
          </View>
        </View>
        {records.map((r, i) => (
          <View
            key={i}
            testID={`fcg-ck-record-${i}`}
            style={{
              alignSelf: 'stretch',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: 'rgba(255,214,10,.16)',
              borderRadius: 14,
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 20 }}>{r.icon}</Text>
            <Text style={{ color: ht.text, fontWeight: '700', flex: 1 }}>{r.text}</Text>
          </View>
        ))}
        {summary.nailed.length > 0 ? (
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <Text style={{ color: ht.text2, fontSize: 12, fontWeight: '700' }}>
              {t('fcv.ck_presi')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {summary.nailed.map((n) => (
                <View
                  key={`${n.isChild ? 'c' : 'p'}${n.target}`}
                  testID="fcg-ck-chip"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: 'rgba(48,209,88,.16)',
                  }}
                >
                  <Text style={{ color: ht.text, fontSize: 13 }} numberOfLines={1}>
                    {labelOf(n.target, n.isChild, n.position)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
