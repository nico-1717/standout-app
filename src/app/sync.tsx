import { useRouter } from 'expo-router';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import {
  dismissAllProblems,
  dismissProblem,
  groupOf,
  listProblems,
  reasonKey,
} from '@/core/sync/problems';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, Header, PrimaryButton } from '@/ui/kit';
import { SyncBadge } from '@/ui/SyncBadge';

/**
 * «Sincronizzazione»: lo stato, «Sincronizza ora» e le modifiche che il server ha rifiutato. Quando il server
 * rifiuta una modifica il telefono torna com'è sul server (vedi core/sync/engine): qui l'utente lo vede e può
 * dire «ho capito», così non resta un avviso che non sparisce.
 */
export default function SyncScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, syncInfo, version, changed } = useApp();
  void version;
  const problems = services ? listProblems(services.db) : [];
  const when = (iso: string | number | null) =>
    iso === null
      ? t('app.sync_mai')
      : new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        title={t('app.sync_pagina')}
        top={insets.top}
        right={
          <Pressable
            testID="sync-done"
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Text style={{ color: th.brand, fontSize: 16, fontWeight: '600' }}>
              {t('comune.fine')}
            </Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}
      >
        <Card index={0} style={{ padding: 16, gap: 10 }}>
          <SyncBadge />
          <Text style={{ color: th.text2, fontSize: 13 }}>
            {t('app.sync_ultima', { quando: when(syncInfo.lastSyncAt) })}
          </Text>
          <PrimaryButton
            testID="sync-now"
            label={t('app.sync_ora')}
            busy={syncInfo.status === 'syncing'}
            onPress={() => services?.scheduler.trigger(0)}
          />
        </Card>

        {problems.length === 0 ? (
          <Card index={1} style={{ padding: 16 }}>
            <Text testID="sync-clean" style={{ color: th.text2, fontSize: 15, lineHeight: 21 }}>
              {t('app.sync_nessun_problema')}
            </Text>
          </Card>
        ) : (
          <>
            <Text style={{ color: th.text2, fontSize: 14, lineHeight: 20 }}>
              {t('app.sync_problemi_intro')}
            </Text>
            {problems.map((p, i) => (
              <Card key={p.id} index={i + 1} style={{ padding: 16, gap: 6 }}>
                <View testID={`problem-${p.id}`} style={{ gap: 6 }}>
                  <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
                    {t(`app.sync_g_${groupOf(p.tbl)}`)}
                  </Text>
                  <Text style={{ color: th.text, fontSize: 15, lineHeight: 21 }}>
                    {t(reasonKey(p.code))}
                  </Text>
                  {p.message ? (
                    <Text style={{ color: th.text2, fontSize: 13 }}>{p.message}</Text>
                  ) : null}
                  {p.field ? (
                    <Text style={{ color: th.text3, fontSize: 12 }}>
                      {t('app.sync_campo', { campo: p.field })}
                    </Text>
                  ) : null}
                  <Text style={{ color: th.text3, fontSize: 12 }}>{when(p.created_at)}</Text>
                  <Pressable
                    testID={`problem-ok-${p.id}`}
                    accessibilityRole="button"
                    onPress={() => {
                      if (!services) return;
                      dismissProblem(services.db, p.id);
                      changed();
                    }}
                    style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
                  >
                    <Text style={{ color: th.brand, fontSize: 15, fontWeight: '600' }}>
                      {t('app.sync_capito')}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ))}
            {problems.length > 1 ? (
              <PrimaryButton
                testID="problems-ok-all"
                label={t('app.sync_capito_tutti')}
                onPress={() => {
                  if (!services) return;
                  dismissAllProblems(services.db);
                  changed();
                }}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
