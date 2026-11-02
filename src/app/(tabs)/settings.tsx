import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, Header, PrimaryButton } from '@/ui/kit';
import { SyncBadge } from '@/ui/SyncBadge';

export default function SettingsScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { authState, services, syncInfo, signOut, version, uiStyle, setUiStyle } = useApp();
  const user = authState.status === 'signedIn' ? authState.user : null;
  const problems = services
    ? (services.db.all<{ n: number }>(
        'SELECT COUNT(*) AS n FROM sync_problems WHERE dismissed = 0',
      )[0]?.n ?? 0)
    : 0;
  void version;

  async function logout() {
    const r = await signOut();
    if (r.blocked > 0) {
      // Ci sono modifiche non ancora inviate: uscire le farebbe perdere, quindi si chiede conferma.
      Alert.alert(t('notifiche.logout'), t('app.logout_perdita', { n: r.blocked }), [
        { text: t('comune.annulla'), style: 'cancel' },
        {
          text: t('app.logout_comunque'),
          style: 'destructive',
          onPress: () => void signOut({ discardPending: true }),
        },
      ]);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('comune.impostazioni')} top={insets.top} right={<SyncBadge />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>{user?.username}</Text>
          {user?.email ? <Text style={{ color: th.text2, marginTop: 2 }}>{user.email}</Text> : null}
        </Card>
        <Card style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: th.text, fontWeight: '700' }}>{t('stile.titolo')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['standard', 'paper'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setUiStyle(s)}
                accessibilityRole="radio"
                accessibilityState={{ selected: uiStyle === s }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: uiStyle === s ? th.brand : th.bg,
                }}
              >
                <Text style={{ color: uiStyle === s ? '#fff' : th.text, fontWeight: '600' }}>
                  {t(s === 'paper' ? 'stile.paper' : 'stile.standard')}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
        {(problems > 0 || syncInfo.status === 'error') && (
          <Card style={{ padding: 16 }}>
            <Text style={{ color: th.text, fontWeight: '700' }}>{t('app.problemi_titolo')}</Text>
            <Text style={{ color: th.text2, marginTop: 4 }}>
              {problems > 0 ? t('app.attivita_ripristinata') : t('app.sync_errore')}
            </Text>
          </Card>
        )}
        <PrimaryButton label={t('notifiche.logout')} onPress={logout} danger />
      </ScrollView>
    </View>
  );
}
