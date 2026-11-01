import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';

import { BASE_URL, useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { PrimaryButton, TextButton } from '@/ui/kit';

/** Come sul sito: finché non si accettano termini e privacy aggiornati non si va avanti. */
export default function Terms() {
  const th = useTheme();
  const { t } = useTranslation();
  const { auth, signOut } = useApp();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await auth.acceptTerms();
    } catch {
      setError(t('auth.err_rete'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 28,
        paddingTop: insets.top + 28,
      }}
    >
      <Text
        style={{
          color: th.text,
          fontSize: 21,
          fontWeight: '800',
          letterSpacing: -0.42,
          marginBottom: 12,
        }}
      >
        {t('accettatermini.titolo')}
      </Text>
      <Text style={{ color: th.text2, fontSize: 16, lineHeight: 22, marginBottom: 20 }}>
        {t('accettatermini.intro')}
      </Text>
      <TextButton
        label={t('legale.titolo_termini')}
        onPress={() => void WebBrowser.openBrowserAsync(`${BASE_URL}/legal/termini.php`)}
      />
      <TextButton
        label={t('legale.titolo_privacy')}
        onPress={() => void WebBrowser.openBrowserAsync(`${BASE_URL}/legal/privacy.php`)}
      />
      {error && <Text style={{ color: th.red, marginVertical: 8 }}>{error}</Text>}
      <PrimaryButton label={t('accettatermini.btn')} onPress={accept} busy={busy} />
      <View style={{ marginTop: 10 }}>
        <TextButton
          label={t('accettatermini.esci')}
          onPress={() => void signOut({ discardPending: true })}
        />
      </View>
    </ScrollView>
  );
}
