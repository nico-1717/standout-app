import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Theme } from '@/core/theme/ThemeProvider';

import type { Costs, Forecast } from './cost';

/**
 * Il pannello «Costo» della pagina Voti (voti.php › `disegnaCosto`): tre riquadri con la stessa forma, nome a sinistra,
 * un dato al centro e il prezzo a destra. Prima quanto manca (preventivo), poi quanto costa un credito per fascia,
 * poi gli esami già dati uno per uno.
 */
export function CostPane({
  th,
  costs,
  ahead,
}: {
  th: Theme;
  costs: Costs;
  ahead: Forecast | null;
}) {
  const { t } = useTranslation();
  if (!costs.exams.length && !costs.bands.length && !ahead) {
    return (
      <Text
        testID="grades-cost-empty"
        style={{ color: th.text2, padding: 20, textAlign: 'center' }}
      >
        {t('voti.costo_vuoto')}
      </Text>
    );
  }
  return (
    <View testID="grades-list-costo" style={{ gap: 12 }}>
      {ahead ? (
        <Box th={th} title={t('voti.ti_restano')}>
          <Text
            testID="grades-cost-total"
            style={{
              color: th.text,
              fontSize: 32,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {`~${ahead.total}🍅`}
          </Text>
          <Text style={{ color: th.text3, fontSize: 12.5, lineHeight: 18, marginBottom: 10 }}>
            {t('voti.preventivo_spiega')}
          </Text>
          {ahead.rows.map((r, i) => (
            <Line
              key={`${r.name}-${i}`}
              th={th}
              name={r.name}
              mid={`${r.cfu} CFU`}
              price={`~${r.pomodori}🍅`}
            />
          ))}
        </Box>
      ) : null}
      {costs.bands.length ? (
        <Box th={th} title={t('voti.per_fascia')}>
          {costs.bands.map((b) => (
            <Line
              key={b.cfu}
              th={th}
              name={`${b.cfu} CFU`}
              mid={String(b.esami)}
              price={`${b.perCfu}🍅/CFU${b.avgGrade !== null ? ` · ${b.avgGrade}` : ''}`}
            />
          ))}
        </Box>
      ) : null}
      {costs.exams.length ? (
        <Box th={th} title={t('voti.gia_fatti')}>
          {costs.exams.map((e, i) => (
            <Line
              key={`${e.name}-${i}`}
              th={th}
              name={e.name}
              mid={e.grade !== null ? `${e.grade}${e.honors ? 'L' : ''}` : '—'}
              price={`${e.pomodori}🍅 · ${e.hours}h`}
            />
          ))}
        </Box>
      ) : null}
    </View>
  );
}

function Box({ th, title, children }: { th: Theme; title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: th.surface2,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 6,
      }}
    >
      <Text
        style={{
          color: th.text3,
          fontSize: 11.5,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Line({ th, name, mid, price }: { th: Theme; name: string; mid: string; price: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        borderTopWidth: 0.5,
        borderTopColor: th.hairline,
      }}
    >
      <Text numberOfLines={1} style={{ flex: 1, color: th.text, fontSize: 14.5 }}>
        {name}
      </Text>
      <Text style={{ color: th.text3, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{mid}</Text>
      <Text
        style={{ color: th.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}
      >
        {price}
      </Text>
    </View>
  );
}
