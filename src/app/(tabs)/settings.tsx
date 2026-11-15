import { useRouter, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { accents, type AccentId } from '@/core/theme/tokens';
import { Card, Header, PrimaryButton } from '@/ui/kit';
import { LockCard } from '@/core/lock/LockCard';
import { HoIcon, hoTheme, type Ho, type HoIconName } from '@/features/home/HomeKit';
import { Avatar } from '@/ui/Avatar';
import { SpaceCard } from '@/features/account/SpaceCard';
import { RemindersCard } from '@/features/reminders/RemindersCard';
import { SyncBadge } from '@/ui/SyncBadge';

type NavItem = {
  id: string;
  icon: HoIconName;
  color: 'orange' | 'red' | 'indigo' | 'purple' | 'green' | 'blue' | 'teal' | 'pink';
  label: string;
  href: Href;
};
/** Le pagine che sul sito stanno nella barra laterale: qui, nel tab Impostazioni. */
const NAV: NavItem[] = [
  {
    id: 'projects',
    icon: 'folder',
    color: 'orange',
    label: 'progetti.progetti',
    href: '/projects',
  },
  { id: 'diary', icon: 'book', color: 'pink', label: 'diario.titolo', href: '/diary' },
  {
    id: 'pomodoro',
    icon: 'timer',
    color: 'red',
    label: 'pomodoro.tipo_pomodoro',
    href: '/pomodoro',
  },
  { id: 'grades', icon: 'cap', color: 'indigo', label: 'voti.voti', href: '/grades' },
  { id: 'flashcards', icon: 'cards', color: 'purple', label: 'fc.flashcard', href: '/fc-hub' },
  { id: 'buy', icon: 'list', color: 'teal', label: 'planner.to_buy', href: '/buy' },
  { id: 'pills', icon: 'pill', color: 'green', label: 'todo.tipo_pills', href: '/pills' },
];

function NavRow(p: {
  ho: Ho;
  testID: string;
  icon: HoIconName;
  color: string;
  label: string;
  first: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: p.first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: p.ho.hair,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: p.color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HoIcon name={p.icon} color="#FFFFFF" size={18} />
      </View>
      <Text style={{ flex: 1, color: p.ho.text, fontSize: 17, fontWeight: '600' }}>{p.label}</Text>
      <HoIcon name="right" color={p.ho.text3} size={18} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const th = useTheme();
  const ho = hoTheme(th);
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
    localPrefs,
    updateLocalPrefs,
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
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('comune.impostazioni')} top={insets.top} right={<SyncBadge />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
        <View
          style={{
            backgroundColor: ho.surface,
            borderRadius: 24,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Avatar
            letter={(user?.username?.[0] ?? '?').toUpperCase()}
            label={t('app.account')}
            onPress={() => router.push('/account')}
            size={52}
          />
          <Pressable
            testID="open-account"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: ho.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }}
              >
                {user?.username}
              </Text>
              {user?.email ? (
                <Text style={{ color: ho.text2, fontSize: 14, marginTop: 1 }}>{user.email}</Text>
              ) : null}
              <Text style={{ color: ho.blueInk, fontSize: 14, fontWeight: '700', marginTop: 4 }}>
                {t('app.account')}
              </Text>
            </View>
            <HoIcon name="right" color={ho.text3} size={18} />
          </Pressable>
        </View>
        <View style={{ backgroundColor: ho.surface, borderRadius: 24, overflow: 'hidden' }}>
          {NAV.map((n, i) => (
            <NavRow
              key={n.id}
              ho={ho}
              testID={`open-${n.id}`}
              icon={n.icon}
              color={ho[n.color]}
              label={t(n.label)}
              first={i === 0}
              onPress={() => router.push(n.href)}
            />
          ))}
        </View>
        <Card index={8} style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: th.text, fontWeight: '700' }}>{t('stile.titolo')}</Text>
          <Text style={{ color: th.text2, fontSize: 13 }}>{t('stile.app_nota')}</Text>
          <View style={{ gap: 8 }}>
            {(['standard', 'paper'] as const).map((s) => {
              const on = uiStyle === s;
              return (
                <Pressable
                  key={s}
                  testID={`style-${s}`}
                  onPress={() => setUiStyle(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    padding: 14,
                    borderRadius: th.radiusButton,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? th.brand : th.hairline2,
                    backgroundColor: on ? th.brandSoft : th.surface2,
                    gap: 2,
                  }}
                >
                  <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
                    {t(s === 'paper' ? 'stile.paper' : 'stile.standard')}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 13 }}>
                    {t(s === 'paper' ? 'stile.app_paper_desc' : 'stile.app_standard_desc')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <Card index={9} style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: th.text, fontWeight: '700' }}>{t('stile.alto_contrasto')}</Text>
              <Text style={{ color: th.text2, fontSize: 13 }}>
                {t('stile.alto_contrasto_desc')}
              </Text>
            </View>
            <Switch
              testID="high-contrast"
              value={localPrefs.highContrast}
              onValueChange={(v) => updateLocalPrefs({ highContrast: v })}
              accessibilityLabel={t('stile.alto_contrasto')}
            />
          </View>
        </Card>
        <Card index={9} style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: th.text, fontWeight: '700' }}>{t('stile.colore')}</Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {(Object.keys(accents) as AccentId[]).map((a) => (
              <Pressable
                hitSlop={5}
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
        <Card index={10} style={{ padding: 16, gap: 10 }}>
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
        <LockCard />
        <SpaceCard />
        <Pressable
          testID="open-sync"
          accessibilityRole="button"
          onPress={() => router.push('/sync')}
        >
          <Card index={11} style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: th.text, fontWeight: '700' }}>{t('app.sync_pagina')}</Text>
                {problems > 0 || syncInfo.status === 'error' ? (
                  <Text style={{ color: th.red, fontSize: 13 }}>
                    {problems > 0 ? t('app.attivita_ripristinata') : t('app.sync_errore')}
                  </Text>
                ) : (
                  <SyncBadge />
                )}
              </View>
              <Text style={{ color: th.text3, fontSize: 20 }}>›</Text>
            </View>
          </Card>
        </Pressable>
        <PrimaryButton label={t('notifiche.logout')} onPress={logout} danger />
      </ScrollView>
    </View>
  );
}
