import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import type { ActivityBar, ActivityStep } from './subjects';

/** Le barre delle carte risposte nel periodo (`#sfcAttivita` del sito): giorno, settimana o mese a seconda del periodo. */
export function HistoryActivity({ step, bars }: { step: ActivityStep; bars: ActivityBar[] }) {
  const th = useTheme();
  const { i18n } = useTranslation();
  const max = Math.max(1, ...bars.map((b) => b.n));
  const total = bars.reduce((n, b) => n + b.n, 0);
  if (total === 0) return null;
  const label = (d: string): string => {
    const dt = new Date(`${d}T12:00:00`);
    return step === 'month'
      ? dt.toLocaleDateString(i18n.language, { month: 'short' })
      : String(dt.getDate());
  };
  // con molte barre si scrive l'etichetta solo ogni tanto, per non sovrapporle
  const every = Math.max(1, Math.ceil(bars.length / 10));
  return (
    <View
      testID="fch-activity"
      accessible
      accessibilityLabel={bars.map((b) => `${b.d}: ${b.n}`).join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 80,
        gap: bars.length > 40 ? 1 : 3,
      }}
    >
      {bars.map((b, i) => (
        <View
          key={b.d}
          style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
        >
          <View
            testID={`fch-activity-bar-${i}`}
            style={{
              width: '100%',
              height: b.n > 0 ? Math.max(3, Math.round((b.n / max) * 58)) : 1,
              borderRadius: 2,
              backgroundColor: b.n > 0 ? th.brand : th.surface2,
            }}
          />
          <Text
            style={{ color: th.text3, fontSize: 9, height: 14, marginTop: 2 }}
            numberOfLines={1}
          >
            {i % every === 0 ? label(b.d) : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}
