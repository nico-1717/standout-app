import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, SectionLabel } from '@/ui/kit';

import { useAppLock } from './AppLock';

/** Impostazioni › Sicurezza: il blocco con Face ID / impronta / codice. Spento di default. */
export function LockCard() {
  const th = useTheme();
  const { t } = useTranslation();
  const { enabled, setEnabled } = useAppLock();
  const [message, setMessage] = useState<string | null>(null);

  const toggle = async (on: boolean) => {
    setMessage(null);
    const r = await setEnabled(on, t('app.blocco_motivo'));
    if (r === 'unavailable') setMessage(t('app.blocco_non_disponibile'));
    else if (r === 'failed') setMessage(t('app.blocco_non_riuscito'));
  };

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <SectionLabel>{t('app.blocco_sicurezza')}</SectionLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: th.text, fontWeight: '600' }}>{t('app.blocco_titolo')}</Text>
          <Text style={{ color: th.text2, fontSize: 12 }}>{t('app.blocco_sub')}</Text>
        </View>
        <Switch
          testID="lock-switch"
          accessibilityLabel={t('app.blocco_titolo')}
          value={enabled}
          onValueChange={(v) => void toggle(v)}
        />
      </View>
      {message ? (
        <Text testID="lock-message" style={{ color: th.red }}>
          {message}
        </Text>
      ) : null}
    </Card>
  );
}
