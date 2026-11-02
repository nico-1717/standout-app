import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';

import { FieldsError } from '@/core/account/accountApi';
import { BASE_URL, useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Field, PrimaryButton, TextButton } from '@/ui/kit';

/** Le pagine legali si aprono dal sito, nella lingua dell'utente (sono il testo ufficiale, uno solo). */
export const legalUrl = (page: 'privacy' | 'termini') => `${BASE_URL}/legal/${page}.php`;

/** «Ho almeno 14 anni e accetto {termini} e {privacy}»: i due pezzi diventano link. */
function AcceptText({ onTerms, onPrivacy }: { onTerms: () => void; onPrivacy: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const parts = t('auth.accetto', { termini: '\u0001', privacy: '\u0002' }).split(
    /(\u0001|\u0002)/,
  );
  return (
    <Text style={{ color: th.text2, flex: 1, lineHeight: 20 }}>
      {parts.map((p, i) =>
        p === '\u0001' ? (
          <Text key={i} style={{ color: th.brand }} onPress={onTerms} accessibilityRole="link">
            {t('legale.titolo_termini')}
          </Text>
        ) : p === '\u0002' ? (
          <Text key={i} style={{ color: th.brand }} onPress={onPrivacy} accessibilityRole="link">
            {t('legale.titolo_privacy')}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

export default function Register() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { auth } = useApp();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErrors({});
    setGeneral(null);
    try {
      await auth.register({
        username: username.trim(),
        email: email.trim(),
        password: pw,
        passwordConfirm: pw2,
        accept,
      });
      setPw('');
      setPw2('');
    } catch (e) {
      if (e instanceof FieldsError) setErrors(e.fields);
      else if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'rate_limited')
        setGeneral(t('auth.err_troppi_tentativi'));
      else if (e instanceof Error && 'status' in e) setGeneral(t('auth.err_registrazione'));
      else setGeneral(t('auth.err_rete')); // fetch senza rete lancia TypeError
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <Text testID={`reg-error-${k}`} style={{ color: th.red, marginBottom: 8, marginTop: -4 }}>
        {errors[k]}
      </Text>
    ) : null;

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
            fontSize: 30,
            fontWeight: '800',
            letterSpacing: -0.8,
            marginBottom: 6,
          }}
        >
          {t('auth.crea_account_titolo')}
        </Text>
        <Text style={{ color: th.text2, marginBottom: 24, fontSize: 16 }}>
          {t('auth.sub_registrati')}
        </Text>
        <Field
          testID="reg-username"
          placeholder={t('auth.nome_utente')}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
        />
        {err('username')}
        <Field
          testID="reg-email"
          placeholder={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        {err('email')}
        <Field
          testID="reg-password"
          placeholder={t('auth.password')}
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {err('password')}
        <Field
          testID="reg-password2"
          placeholder={t('auth.ripeti_password')}
          value={pw2}
          onChangeText={setPw2}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {err('password_confirm')}
        <View
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginVertical: 10 }}
        >
          <Pressable
            testID="reg-accept"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accept }}
            onPress={() => setAccept(!accept)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              borderWidth: 1.6,
              borderColor: accept ? th.brand : th.text3,
              backgroundColor: accept ? th.brand : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {accept ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
          </Pressable>
          <AcceptText
            onTerms={() => void WebBrowser.openBrowserAsync(legalUrl('termini'))}
            onPrivacy={() => void WebBrowser.openBrowserAsync(legalUrl('privacy'))}
          />
        </View>
        {err('accetto')}
        {general && <Text style={{ color: th.red, marginBottom: 8 }}>{general}</Text>}
        <PrimaryButton label={t('auth.crea_account')} onPress={submit} busy={busy} />
        <View style={{ marginTop: 10 }}>
          <TextButton
            label={`${t('auth.hai_account')} ${t('auth.accedi')}`}
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
