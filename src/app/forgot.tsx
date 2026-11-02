import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpApi';
import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Field, PrimaryButton, TextButton } from '@/ui/kit';

/** «Password dimenticata»: il server manda il link per email (si apre sul sito) e risponde sempre uguale. */
export default function Forgot() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { auth } = useApp();
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!id.trim()) return setError(t('password_reset.err_vuoto'));
    setBusy(true);
    setError(null);
    try {
      await auth.forgot(id.trim());
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'rate_limited')
        setError(t('password_reset.err_troppe'));
      else if (e instanceof ApiError) setError(t('password_reset.err_generico'));
      else setError(t('auth.err_rete'));
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
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.7,
            marginBottom: 8,
          }}
        >
          {t('password_reset.titolo_richiesta')}
        </Text>
        <Text style={{ color: th.text2, marginBottom: 22, fontSize: 16, lineHeight: 22 }}>
          {t('password_reset.richiesta_p')}
        </Text>
        {done ? (
          <Text
            testID="forgot-done"
            style={{ color: th.text, fontSize: 16, lineHeight: 22, marginBottom: 12 }}
          >
            {t('password_reset.inviata')}
          </Text>
        ) : (
          <>
            <Field
              testID="forgot-id"
              placeholder={t('password_reset.campo')}
              value={id}
              onChangeText={setId}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="send"
              onSubmitEditing={submit}
            />
            {error && <Text style={{ color: th.red, marginBottom: 4 }}>{error}</Text>}
            <PrimaryButton label={t('password_reset.invia')} onPress={submit} busy={busy} />
          </>
        )}
        <TextButton label={t('auth.accedi')} onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
