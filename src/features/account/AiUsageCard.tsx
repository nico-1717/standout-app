import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AiMeter, AiUsage } from '@/core/account/accountApi';
import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Card } from '@/ui/kit';

/** Quanto di una barra è pieno, da 0 a 100 (senza limite: vuota). */
export const meterPercent = (m: AiMeter): number =>
  m.limit ? Math.max(0, Math.min(100, Math.round((m.used / m.limit) * 100))) : 0;

/** «1 maggio» nella lingua scelta, dal `AAAA-MM-GG` del server. */
function resetDay(iso: string, lang: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(lang, { day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
}

/**
 * Le barre dei consumi dell'IA del mese (audio, immagini, testo), come sotto l'avatar sul sito. Si leggono dal sito
 * quando si apre la pagina; senza rete o senza piano la scheda non compare.
 */
export function AiUsageCard() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const { account } = useApp();
  const [usage, setUsage] = useState<AiUsage | null>(null);

  useEffect(() => {
    let alive = true;
    account
      .aiUsage()
      .then((u) => alive && setUsage(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [account]);

  if (!usage) return null;
  const rows: { id: 'audio' | 'images' | 'tokens'; label: string; color: string }[] = [
    { id: 'audio', label: t('dashboard.caratteri_audio'), color: '#AF52DE' },
    { id: 'images', label: t('dashboard.immagini_generate'), color: '#FF2D55' },
    { id: 'tokens', label: t('dashboard.token_testuali'), color: '#34C759' },
  ];
  const nf = new Intl.NumberFormat(i18n.language);
  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
          {t('home.ai_titolo')}
        </Text>
        <Text testID="ai-plan" style={{ color: th.text2 }}>
          {usage.name}
        </Text>
      </View>
      {rows.map((r) => {
        const m = usage[r.id];
        return (
          <View key={r.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: th.text2, fontSize: 13 }}>{r.label}</Text>
              <Text testID={`ai-${r.id}-text`} style={{ color: th.text2, fontSize: 13 }}>
                {nf.format(m.used)} / {m.limit === null ? t('home.illimitato') : nf.format(m.limit)}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: th.surface2 }}>
              <View
                testID={`ai-${r.id}-bar`}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: meterPercent(m) }}
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${meterPercent(m)}%`,
                  backgroundColor: r.color,
                }}
              />
            </View>
          </View>
        );
      })}
      <Text style={{ color: th.text3, fontSize: 12 }}>
        {t('home.ai_reset', { data: resetDay(usage.resets, i18n.language) })}
      </Text>
    </Card>
  );
}
