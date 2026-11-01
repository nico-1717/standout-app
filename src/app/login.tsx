import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';

import { ApiError } from '@/core/api/httpApi';
import { BASE_URL, useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Field, PrimaryButton, TextButton } from '@/ui/kit';

/** Il messaggio per l'utente a partire dal codice d'errore del server (testi del sito). */
function loginMessage(e: unknown, t: (k: string) => string): string {
  if (e instanceof ApiError) {
    if (e.code === 'invalid_credentials') return t('auth.err_credenziali');
    if (e.code === 'too_many_attempts' || e.code === 'rate_limited')
      return t('auth.err_troppi_tentativi');
    if (e.code === 'upgrade_required') return t('app.versione_vecchia');
    return t('auth.err_generico');
  }
  return t('auth.err_rete'); // fetch senza rete lancia TypeError
}

export default function Login() {
  const th = useTheme();
  const { t } = useTranslation();
  const { auth, authState } = useApp();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = authState.status === 'signedOut' && authState.reason === 'session_closed';

  async function submit() {
    if (!id.trim() || !pw) return setError(t('auth.err_campi_login'));
    setBusy(true);
    setError(null);
    try {
      await auth.login(id.trim(), pw);
      setPw('');
    } catch (e) {
      setError(loginMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            color: th.text,
            fontSize: 34,
            fontWeight: '800',
            letterSpacing: -1,
            marginBottom: 6,
          }}
        >
          Standout
        </Text>
        <Text style={{ color: th.text2, marginBottom: 28, fontSize: 16 }}>
          {t('auth.sub_login')}
        </Text>
        {closed && (
          <Text style={{ color: th.orange, marginBottom: 12 }}>{t('app.sessione_chiusa')}</Text>
        )}
        <Field
          placeholder={t('auth.email_o_utente')}
          value={id}
          onChangeText={setId}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
        />
        <Field
          placeholder={t('auth.password')}
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error && <Text style={{ color: th.red, marginBottom: 4 }}>{error}</Text>}
        <PrimaryButton label={t('auth.accedi')} onPress={submit} busy={busy} />
        <View style={{ marginTop: 10 }}>
          <TextButton
            label={t('auth.dimenticata')}
            onPress={() =>
              void WebBrowser.openBrowserAsync(`${BASE_URL}/account/password_dimenticata.php`)
            }
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
