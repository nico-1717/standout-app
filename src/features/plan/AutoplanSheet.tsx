import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/features/habits/Sheet';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { dayLabel, hours } from './format';
import type { AutoplanSummary } from './repo';
import { Row, usePlanTheme } from './ui';

/**
 * «Pianifica per me»: l'anteprima di ciò che il piano farebbe (quanto ci sta, fra quali date, le ore per settimana, cosa non
 * entra) e il tasto per applicarlo. I giorni evidenziati e i blocchi messi a mano restano come sono.
 */
export function AutoplanSheet(p: {
  visible: boolean;
  summary: AutoplanSummary | null;
  names: Map<string, string>;
  lang: string;
  done: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const s = p.summary;
  return (
    <Sheet
      visible={p.visible}
      title={t('piano.pianifica_per_me')}
      th={ht}
      onClose={p.onClose}
      testID="autoplan-sheet"
      footer={
        s && s.units > 0 && !p.done ? (
          <View style={{ flex: 1 }}>
            <PrimaryButton testID="autoplan-apply" label={t('piano.applica')} onPress={p.onApply} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <TextButton testID="autoplan-close" label={t('piano.chiudi')} onPress={p.onClose} />
          </View>
        )
      }
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        {!s || s.units === 0 ? (
          <Text testID="autoplan-nothing" style={{ color: ht.text2, lineHeight: 21 }}>
            {t('piano.ap_niente')}
          </Text>
        ) : (
          <>
            {p.done ? (
              <Text
                testID="autoplan-done"
                style={{ color: ht.green, fontWeight: '800', fontSize: 18 }}
              >
                {t('piano.ap_fatto')}
              </Text>
            ) : null}
            <Text
              testID="autoplan-fit"
              style={{ color: s.fits ? ht.green : ht.red, fontWeight: '800', fontSize: 20 }}
            >
              {s.fits ? t('piano.ap_ci_sta') : t('piano.ap_non_ci_sta', { h: hours(s.missingMin) })}
            </Text>
            {s.first && s.last ? (
              <Text style={{ color: ht.text2 }}>
                {t('piano.ap_dettaglio', {
                  h: hours(s.totalMin),
                  a: dayLabel(s.first, p.lang, { day: 'numeric', month: 'short' }),
                  b: dayLabel(s.last, p.lang, { day: 'numeric', month: 'short' }),
                })}
              </Text>
            ) : null}

            {!s.fits ? (
              <>
                {s.warnings.map((w) => (
                  <Text
                    key={w.project}
                    testID={`autoplan-warn-${w.project}`}
                    style={{ color: ht.text }}
                  >
                    {p.names.get(w.project) ?? ''} · {hours(w.minutes)}
                    {w.painted > 0
                      ? ` · ${t('piano.ap_pochi_giorni', { n: p.names.get(w.project) ?? '', d: w.painted })}`
                      : ''}
                  </Text>
                ))}
                <Text style={{ color: ht.text2, fontSize: 13, lineHeight: 19 }}>
                  {t('piano.ap_come_risolvere')}
                </Text>
              </>
            ) : null}

            {Object.keys(s.weeks).length ? (
              <Row label={t('piano.ap_settimane')}>
                {Object.entries(s.weeks).map(([w, m]) => (
                  <View key={w} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: ht.text2 }}>
                      {dayLabel(w, p.lang, { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text
                      style={{ color: ht.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}
                    >
                      {hours(m)}
                    </Text>
                  </View>
                ))}
              </Row>
            ) : null}
            <Text style={{ color: ht.text2, fontSize: 13 }}>{t('piano.ap_mantiene')}</Text>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
