import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { StorageUsage } from '@/core/account/accountApi';
import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Card } from '@/ui/kit';

/** Da quando la barra diventa rossa e compare l'avviso. */
export const SPACE_WARN_AT = 90;

/** Quanto dello spazio è pieno, da 0 a 100 (senza limite: vuota). */
export const spacePercent = (s: StorageUsage): number =>
  s.quota > 0 ? Math.max(0, Math.min(100, Math.round((s.used / s.quota) * 100))) : 0;

/** «12,3 MB» nella lingua scelta. */
export function formatBytes(bytes: number, lang: string): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: i === 0 ? 0 : 1 });
  return `${nf.format(v)} ${units[i]}`;
}

/**
 * Lo spazio dei file (immagini e audio) sul sito, come sulla pagina dell'account. Si legge quando si apre la pagina;
 * senza rete la scheda sparisce, a meno che il sito abbia appena rifiutato dei file per spazio finito: allora
 * l'avviso resta, perché è l'unico modo in cui l'utente lo viene a sapere.
 */
export function SpaceCard() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const { account, services } = useApp();
  const media = services?.media ?? null;
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [refused, setRefused] = useState(() => media?.spaceRefused() ?? 0);

  useEffect(() => {
    let alive = true;
    account
      .storage()
      .then((u) => alive && setUsage(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [account]);

  if (!usage && refused === 0) return null;
  const pct = usage ? spacePercent(usage) : 100;
  const warn = pct >= SPACE_WARN_AT || refused > 0;
  const color = warn ? th.red : th.brand;
  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
        {t('app.spazio_titolo')}
      </Text>
      {usage ? (
        <>
          <Text testID="space-text" style={{ color: th.text2, fontSize: 13 }}>
            {t('app.spazio_usato', {
              usato: formatBytes(usage.used, i18n.language),
              quota: formatBytes(usage.quota, i18n.language),
            })}
          </Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: th.surface2 }}>
            <View
              testID="space-bar"
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: pct }}
              style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: color }}
            />
          </View>
        </>
      ) : null}
      {refused > 0 ? (
        <>
          <Text testID="space-refused" style={{ color: th.red, fontSize: 13 }}>
            {t('app.spazio_rifiutati', { n: refused })}
          </Text>
          <Pressable
            testID="space-ok"
            accessibilityRole="button"
            onPress={() => {
              media?.clearSpaceRefused();
              setRefused(0);
            }}
          >
            <Text style={{ color: th.brand, fontWeight: '600' }}>{t('app.spazio_ok')}</Text>
          </Pressable>
        </>
      ) : usage && pct >= 100 ? (
        <Text testID="space-full" style={{ color: th.red, fontSize: 13 }}>
          {t('app.spazio_pieno')}
        </Text>
      ) : usage && warn ? (
        <Text testID="space-warn" style={{ color: th.red, fontSize: 13 }}>
          {t('app.spazio_quasi')}
        </Text>
      ) : null}
    </Card>
  );
}
