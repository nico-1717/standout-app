import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

/** I verdi del sito (getColorForCount): quante carte giocate in un giorno. */
export function activityShade(count: number): { bg: string; text: string } {
  if (!count) return { bg: '#ebedf0', text: '#8e8e93' };
  if (count < 15) return { bg: '#9be9a8', text: '#111111' };
  if (count < 40) return { bg: '#40c463', text: '#ffffff' };
  if (count < 80) return { bg: '#30a14e', text: '#ffffff' };
  return { bg: '#216e39', text: '#ffffff' };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Il calendario delle attività (fc_stats.php): un mese per volta, ogni giorno colorato dalle carte giocate; si tocca un
 * giorno per vedere quante carte e con che precisione. Le settimane partono da lunedì.
 */
export function ActivityCalendar(p: {
  daily: Map<string, { played: number; correct: number }>;
  /** «AAAA-MM-GG» */
  today: string;
}) {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const [year0, month0] = p.today.split('-').map(Number) as [number, number];
  const [month, setMonth] = useState({ y: year0, m: month0 - 1 });
  const [picked, setPicked] = useState<string | null>(null);

  const step = (by: number) => {
    setPicked(null);
    setMonth(({ y, m }) => {
      const n = y * 12 + m + by;
      return { y: Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });
  };

  const first = new Date(month.y, month.m, 1).getDay();
  const lead = first === 0 ? 6 : first - 1;
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const names = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Date(2026, 0, 5 + i).toLocaleDateString(i18n.language || 'it', { weekday: 'short' }),
  );
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const monthName = t(`fc.mese_${month.m + 1}`);
  const info = picked ? p.daily.get(picked) : undefined;
  const day = picked ? Number(picked.slice(8)) : 0;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          testID="cal-prev"
          accessibilityRole="button"
          accessibilityLabel={t('fc.mese_precedente')}
          hitSlop={12}
          onPress={() => step(-1)}
        >
          <Text style={{ color: th.brand, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text testID="cal-title" style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
          {monthName} {month.y}
        </Text>
        <Pressable
          testID="cal-next"
          accessibilityRole="button"
          accessibilityLabel={t('fc.mese_successivo')}
          hitSlop={12}
          onPress={() => step(1)}
        >
          <Text style={{ color: th.brand, fontSize: 22 }}>›</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {names.map((n, i) => (
          <Text
            key={i}
            style={{ width: '14.285%', textAlign: 'center', color: th.text2, fontSize: 11 }}
          >
            {n}
          </Text>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: '14.285%', height: 38 }} />;
          const iso = `${month.y}-${pad(month.m + 1)}-${pad(d)}`;
          const future = iso > p.today;
          const played = p.daily.get(iso)?.played ?? 0;
          const shade = activityShade(played);
          return (
            <View key={iso} style={{ width: '14.285%', height: 38, padding: 2 }}>
              <Pressable
                testID={`cal-day-${iso}`}
                accessibilityRole="button"
                accessibilityLabel={`${d} ${monthName}`}
                disabled={future}
                onPress={() => setPicked(iso)}
                style={{
                  flex: 1,
                  borderRadius: 7,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: future ? 'transparent' : shade.bg,
                  borderWidth: future ? 1 : iso === p.today ? 2 : 0,
                  borderColor: future ? th.hairline : th.brand,
                }}
              >
                <Text style={{ color: future ? th.text3 : shade.text, fontSize: 13 }}>{d}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ color: th.text2, fontSize: 11 }}>{t('fc.meno')}</Text>
        {[0, 1, 15, 40, 80].map((n) => (
          <View
            key={n}
            style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: activityShade(n).bg }}
          />
        ))}
        <Text style={{ color: th.text2, fontSize: 11 }}>{t('fc.piu')}</Text>
      </View>
      <Text testID="cal-info" style={{ color: th.text2, fontSize: 13 }}>
        {picked
          ? info && info.played > 0
            ? t('fc.giorno_dettaglio', {
                giorno: day,
                mese: monthName,
                carte: info.played,
                pct: Math.round((info.correct / info.played) * 100),
              })
            : t('fc.giorno_vuoto', { giorno: day, mese: monthName })
          : t('fc.tocca_un_giorno_per_i')}
      </Text>
    </View>
  );
}
