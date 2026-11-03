import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { accents, type AccentId } from '@/core/theme/tokens';
import { Card, Header, PrimaryButton } from '@/ui/kit';
import { RemindersCard } from '@/features/reminders/RemindersCard';
import { SyncBadge } from '@/ui/SyncBadge';

export default function SettingsScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    authState,
    services,
    syncInfo,
    signOut,
    version,
    uiStyle,
    setUiStyle,
    settings,
    updateSettings,
  } = useApp();
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
        <Pressable
          testID="open-account"
          accessibilityRole="button"
          onPress={() => router.push('/account')}
        >
          <Card style={{ padding: 16 }}>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
              {user?.username}
            </Text>
            {user?.email ? (
              <Text style={{ color: th.text2, marginTop: 2 }}>{user.email}</Text>
            ) : null}
            <Text style={{ color: th.brand, marginTop: 8 }}>{t('app.account')} ›</Text>
          </Card>
        </Pressable>
        <Pressable
          testID="open-diary"
          accessibilityRole="button"
          onPress={() => router.push('/diary')}
        >
          <Card style={{ padding: 16 }}>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
              {t('diario.titolo')}
            </Text>
            <Text style={{ color: th.brand, marginTop: 8 }}>{t('diario.apri_il_diario')} ›</Text>
          </Card>
        </Pressable>
        <Pressable
          testID="open-projects"
          accessibilityRole="button"
          onPress={() => router.push('/projects')}
        >
          <Card style={{ padding: 16 }}>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
              {t('progetti.progetti')}
            </Text>
            <Text style={{ color: th.brand, marginTop: 8 }}>{t('planner.apri')} ›</Text>
          </Card>
        </Pressable>
        <Pressable
          testID="open-pomodoro"
          accessibilityRole="button"
          onPress={() => router.push('/pomodoro')}
        >
          <Card style={{ padding: 16 }}>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
              {t('pomodoro.tipo_pomodoro')}
            </Text>
            <Text style={{ color: th.brand, marginTop: 8 }}>{t('planner.apri')} ›</Text>
          </Card>
        </Pressable>
        <Pressable testID="open-buy" accessibilityRole="button" onPress={() => router.push('/buy')}>
          <Card style={{ padding: 16 }}>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
              {t('planner.to_buy')}
            </Text>
            <Text style={{ color: th.brand, marginTop: 8 }}>{t('planner.apri')} ›</Text>
          </Card>
        </Pressable>
        <Pressable
          testID="open-pills"
          accessibilityRole="button"
          onPress={() => router.push('/pills')}
        >
          <Card style={{ padding: 16 }}>
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
              {t('todo.tipo_pills')}
            </Text>
            <Text style={{ color: th.brand, marginTop: 8 }}>{t('planner.apri')} ›</Text>
          </Card>
        </Pressable>
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
        <Card style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: th.text, fontWeight: '700' }}>{t('stile.colore')}</Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {(Object.keys(accents) as AccentId[]).map((a) => (
              <Pressable
                key={a}
                onPress={() => updateSettings({ accent: a })}
                accessibilityRole="radio"
                accessibilityLabel={t(`stile.colore_${a}`)}
                accessibilityState={{ selected: settings.accent === a }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: accents[a][th.scheme === 'dark' ? 'd' : 'l'],
                  borderWidth: settings.accent === a ? 3 : 0,
                  borderColor: th.text,
                }}
              />
            ))}
          </View>
        </Card>
        <Card style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: th.text, fontWeight: '700' }}>{t('comune.lingua')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                ['it', 'Italiano'],
                ['en', 'English'],
                [null, t('comune.automatico')],
              ] as const
            ).map(([code, label]) => (
              <Pressable
                key={String(code)}
                onPress={() => updateSettings({ lang: code })}
                accessibilityRole="radio"
                accessibilityState={{ selected: settings.lang === code }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: settings.lang === code ? th.brand : th.bg,
                }}
              >
                <Text
                  style={{ color: settings.lang === code ? '#fff' : th.text, fontWeight: '600' }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
        <RemindersCard />
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
