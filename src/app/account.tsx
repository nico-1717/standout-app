import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { FieldsError, type Device } from '@/core/account/accountApi';
import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { AiUsageCard } from '@/features/account/AiUsageCard';
import { Card, Field, Header, PrimaryButton, TextButton } from '@/ui/kit';

import { legalUrl } from './register';

type Note = { kind: 'ok' | 'ko'; text: string } | null;

/** «standout-i-miei-dati-2026-11-02.zip»: la data è quella di oggi sul telefono. */
export function exportName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `standout-i-miei-dati-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.zip`;
}

function Message({ note, id }: { note: Note; id: string }) {
  const th = useTheme();
  if (!note) return null;
  return (
    <Text testID={id} style={{ color: note.kind === 'ok' ? th.green : th.red, lineHeight: 20 }}>
      {note.text}
    </Text>
  );
}

export default function AccountScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authState, auth, account, signOut } = useApp();
  const user = authState.status === 'signedIn' ? authState.user : null;

  // email non ancora confermata
  const [verifyNote, setVerifyNote] = useState<Note>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  // cambio password
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwNote, setPwNote] = useState<Note>(null);

  // i miei dati
  const [exBusy, setExBusy] = useState(false);
  const [exNote, setExNote] = useState<Note>(null);

  // dispositivi
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [devNote, setDevNote] = useState<Note>(null);

  // elimina account
  const [ack, setAck] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delNote, setDelNote] = useState<Note>(null);

  // `reload` cambia quando serve rileggere l'elenco (dopo aver chiuso un dispositivo o cambiato la password)
  const [reload, setReload] = useState(0);
  const loadDevices = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    account
      .devices()
      .then((list) => {
        if (!alive) return;
        setDevices(list);
        setDevNote(null);
      })
      .catch(() => {
        if (alive) setDevNote({ kind: 'ko', text: t('privacydati.err_generico') });
      });
    return () => {
      alive = false;
    };
  }, [account, t, reload]);

  async function resend() {
    setVerifyBusy(true);
    const stato = await account.resendVerification().catch(() => 'errore');
    setVerifyBusy(false);
    const key =
      stato === 'inviata' || stato === 'gia_verificata'
        ? 'verifica_email.avviso_inviata'
        : stato === 'attendi'
          ? 'verifica_email.avviso_attendi'
          : 'verifica_email.avviso_errore';
    setVerifyNote({ kind: stato === 'inviata' ? 'ok' : 'ko', text: t(key) });
  }

  async function changePassword() {
    if (!user) return;
    setPwBusy(true);
    setPwErrors({});
    setPwNote(null);
    try {
      await account.changePassword(cur, next, again);
      // Il server ha chiuso TUTTE le sessioni, anche questa: si entra di nuovo con la password nuova.
      // I dati su questo telefono restano (è lo stesso account).
      await auth.login(user.username, next);
      setCur('');
      setNext('');
      setAgain('');
      setPwNote({ kind: 'ok', text: t('app.password_cambiata_qui') });
      loadDevices();
    } catch (e) {
      if (e instanceof FieldsError) setPwErrors(e.fields);
      else if (e && typeof e === 'object' && 'code' in e && e.code === 'rate_limited')
        setPwNote({ kind: 'ko', text: t('privacydati.err_troppe') });
      else setPwNote({ kind: 'ko', text: t('privacydati.err_generico') });
    } finally {
      setPwBusy(false);
    }
  }

  async function download() {
    setExBusy(true);
    setExNote(null);
    try {
      const bytes = await account.exportData();
      const file = new File(Paths.cache, exportName());
      file.create({ overwrite: true });
      file.write(bytes);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/zip' });
    } catch {
      setExNote({ kind: 'ko', text: t('app.scarica_errore') });
    } finally {
      setExBusy(false);
    }
  }

  async function revoke(d: Device) {
    try {
      await account.revokeDevice(d.id);
      loadDevices();
    } catch {
      setDevNote({ kind: 'ko', text: t('privacydati.err_generico') });
    }
  }

  function everywhere() {
    Alert.alert(t('app.esci_ovunque'), t('app.esci_ovunque_p'), [
      { text: t('comune.annulla'), style: 'cancel' },
      {
        text: t('app.esci_ovunque'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await account.logoutEverywhere();
            } catch {
              setDevNote({ kind: 'ko', text: t('privacydati.err_generico') });
              return;
            }
            await signOut({ discardPending: true });
          })();
        },
      },
    ]);
  }

  async function deleteAccount() {
    setDelBusy(true);
    setDelNote(null);
    try {
      await account.deleteAccount(delPw);
      await signOut({ discardPending: true });
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
      setDelNote({
        kind: 'ko',
        text:
          e instanceof FieldsError
            ? (Object.values(e.fields)[0] ?? t('privacydati.err_password'))
            : code === 'rate_limited'
              ? t('privacydati.err_troppe')
              : t('privacydati.err_generico'),
      });
    } finally {
      setDelBusy(false);
    }
  }

  const fieldErr = (k: string) =>
    pwErrors[k] ? (
      <Text testID={`pw-error-${k}`} style={{ color: th.red, marginTop: -4 }}>
        {pwErrors[k]}
      </Text>
    ) : null;

  const h = (s: string) => (
    <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>{s}</Text>
  );
  const p = (s: string) => <Text style={{ color: th.text2, lineHeight: 20 }}>{s}</Text>;

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={t('app.account')}
        top={insets.top}
        right={<TextButton label={t('comune.chiudi')} onPress={() => router.back()} />}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ padding: 16, gap: 8 }}>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>{user?.username}</Text>
          {user?.email ? <Text style={{ color: th.text2 }}>{user.email}</Text> : null}
          {user && !user.email_verified ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text testID="verify-banner" style={{ color: th.orange }}>
                {t('verifica_email.avviso_testo')}
              </Text>
              <PrimaryButton
                testID="verify-resend"
                label={t('verifica_email.avviso_bottone')}
                onPress={resend}
                disabled={verifyBusy}
              />
              <Message note={verifyNote} id="verify-note" />
            </View>
          ) : null}
        </Card>

        <AiUsageCard />

        <Card style={{ padding: 16, gap: 10 }}>
          {h(t('privacydati.cambia_t'))}
          {p(t('privacydati.cambia_p'))}
          <Field
            testID="pw-current"
            placeholder={t('privacydati.cambia_attuale')}
            value={cur}
            onChangeText={setCur}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          {fieldErr('attuale')}
          <Field
            testID="pw-new"
            placeholder={t('privacydati.cambia_nuova')}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          {fieldErr('nuova')}
          <Field
            testID="pw-again"
            placeholder={t('privacydati.cambia_conferma')}
            value={again}
            onChangeText={setAgain}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          {fieldErr('conferma')}
          <PrimaryButton
            testID="pw-save"
            label={pwBusy ? t('privacydati.cambia_attesa') : t('privacydati.cambia_btn')}
            onPress={changePassword}
            disabled={pwBusy}
          />
          <Message note={pwNote} id="pw-note" />
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          {h(t('privacydati.scarica_t'))}
          {p(t('privacydati.scarica_p'))}
          <PrimaryButton
            testID="export-btn"
            label={exBusy ? t('privacydati.scarica_attesa') : t('privacydati.scarica_btn')}
            onPress={download}
            disabled={exBusy}
          />
          <Message note={exNote} id="export-note" />
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          {h(t('app.dispositivi'))}
          {(devices ?? []).map((d) => (
            <View
              key={d.id}
              testID={`device-${d.id}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontWeight: '600' }}>
                  {d.name}
                  {d.current ? `  ·  ${t('app.questo_dispositivo')}` : ''}
                </Text>
                {d.last_used_at ? (
                  <Text style={{ color: th.text3, fontSize: 12 }}>
                    {t('app.ultimo_uso', { quando: d.last_used_at.slice(0, 16).replace('T', ' ') })}
                  </Text>
                ) : null}
              </View>
              {d.current ? null : (
                <Pressable
                  testID={`device-revoke-${d.id}`}
                  accessibilityRole="button"
                  onPress={() => void revoke(d)}
                  hitSlop={8}
                >
                  <Text style={{ color: th.red, fontWeight: '600' }}>
                    {t('app.esci_dispositivo')}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
          <Message note={devNote} id="devices-note" />
          <TextButton
            testID="logout-all"
            label={t('app.esci_ovunque')}
            onPress={everywhere}
            danger
          />
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <Pressable
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(legalUrl('privacy'))}
          >
            <Text style={{ color: th.brand }}>{t('legale.titolo_privacy')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(legalUrl('termini'))}
          >
            <Text style={{ color: th.brand }}>{t('legale.titolo_termini')}</Text>
          </Pressable>
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: th.red, fontWeight: '700', fontSize: 16 }}>
            {t('privacydati.elimina_t')}
          </Text>
          {p(t('privacydati.elimina_p'))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch testID="delete-ack" value={ack} onValueChange={setAck} />
            <Text style={{ color: th.text, flex: 1 }}>{t('privacydati.elimina_ack')}</Text>
          </View>
          <Field
            testID="delete-password"
            placeholder={t('privacydati.elimina_pw')}
            value={delPw}
            onChangeText={setDelPw}
            secureTextEntry
            autoCapitalize="none"
          />
          <PrimaryButton
            testID="delete-btn"
            label={delBusy ? t('privacydati.elimina_attesa') : t('privacydati.elimina_btn')}
            onPress={deleteAccount}
            danger
            disabled={delBusy || !ack || delPw.length === 0}
          />
          <Message note={delNote} id="delete-note" />
        </Card>
      </ScrollView>
    </View>
  );
}
