import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import type { HistoryChain } from './history';
import { Text } from '@/ui/CappedText';

/** L'oro del sito (`#C98A00` di giorno, `#FFD60A` di notte). */
export const GOLD = { light: '#C98A00', dark: '#FFD60A' } as const;
export function useGold(): string {
  return useTheme().scheme === 'dark' ? GOLD.dark : GOLD.light;
}

/** Una barra per passo, alta quanto la precisione, e in fondo il traguardo tratteggiato (la «salita in piccolo» del sito). */
export function MiniClimb({ chain }: { chain: HistoryChain }) {
  const th = useTheme();
  const gold = useGold();
  const steps = chain.climb.filter((v): v is number => v !== null);
  if (steps.length < 2) return null;
  return (
    <View
      testID="fch-mini-climb"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14, marginLeft: 4 }}
    >
      {steps.map((v, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: `${Math.max(12, v)}%`,
            borderRadius: 1.5,
            backgroundColor: v >= 80 ? th.green : v >= 50 ? th.orange : th.red,
          }}
        />
      ))}
      <View
        style={{
          width: 4,
          height: '100%',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: gold,
        }}
      />
    </View>
  );
}

/** «La strada fino al 100%» nel dettaglio: un gradino per la partita e uno per ogni ripasso, poi il traguardo. */
export function HistoryRoad({ chain, testID }: { chain: HistoryChain; testID: string }) {
  const th = useTheme();
  const { t } = useTranslation();
  const gold = useGold();
  const { climb, state } = chain;
  if (state === 'perfetta' || climb.length === 0 || (climb.length === 1 && state !== 'aperta'))
    return null;
  const won = state === 'conquistata';
  const barColor = (v: number | null): string =>
    v === null ? th.text3 : v === 100 ? gold : v >= 80 ? th.green : v >= 50 ? th.orange : th.red;
  return (
    <View testID={testID} style={{ gap: 8, marginTop: 6 }}>
      <Text style={{ color: won ? gold : th.text, fontWeight: '700' }}>
        {won ? t('fc.sfc_strada_presa') : t('fc.sfc_strada')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96 }}>
        {climb.map((v, i) => (
          <View
            key={i}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
          >
            <Text style={{ color: th.text, fontSize: 11 }}>{v === null ? '–' : `${v}%`}</Text>
            <View
              style={{
                width: '70%',
                height: v === null ? 8 : Math.max(10, v * 0.6),
                borderRadius: 6,
                backgroundColor: barColor(v),
              }}
            />
            <Text style={{ color: th.text2, fontSize: 11 }}>
              {i === 0 ? t('fc.sfc_strada_partita') : t('fc.sfc_strada_rip', { n: i })}
            </Text>
          </View>
        ))}
        {!won ? (
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
          >
            <Text style={{ color: th.text, fontSize: 11 }}>100%</Text>
            <View
              style={{
                width: '70%',
                height: 60,
                borderRadius: 6,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: gold,
              }}
            />
            <Text style={{ color: th.text2, fontSize: 11 }}>{t('fc.sfc_strada_meta')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
