import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDuration } from '@/features/flashcards/format';
import { Card, Header } from '@/ui/kit';

type Period = 7 | 30 | 90 | 0;

/**
 * Lo storico delle partite (fc_history.php), versione semplice: le partite dalla più recente, con il periodo da guardare;
 * quella lasciata a metà si riprende, le altre aprono il risultato. Si può togliere una partita.
 */
export default function HistoryScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version } = useApp();
  const [period, setPeriod] = useState<Period>(30);
  const [asking, setAsking] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [now] = useState(() => Date.now());

  const rows = useMemo(() => {
    void version;
    void tick;
    if (!services) return null;
    const all = services.games.games();
    const from = period ? new Date(now - period * 86_400_000).toISOString().slice(0, 10) : '';
    return all
      .filter((g) => !from || (g.game_date ?? '').slice(0, 10) >= from)
      .map((g) => ({
        g,
        tally: services.games.tally(g.uuid),
        pending: services.games.resumePosition(g.uuid),
        seconds: services.games.playedSeconds(g.uuid),
      }));
  }, [services, version, tick, period, now]);
  if (!services || !rows) return null;

  const periods: { v: Period; label: string }[] = [
    { v: 7, label: t('fc.sfc_per_7') },
    { v: 30, label: t('fc.sfc_per_30') },
    { v: 90, label: t('fc.sfc_per_90') },
    { v: 0, label: t('fc.sfc_per_tutto') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fc.sfc_storico')}
        right={
          <Pressable testID="fch-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.chiudi')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 40 }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {periods.map((p) => (
            <Pressable
              key={p.v}
              testID={`fch-period-${p.v}`}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p.v }}
              onPress={() => setPeriod(p.v)}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: period === p.v ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: period === p.v ? '#fff' : th.text, fontWeight: '600' }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {rows.length === 0 ? (
          <Text testID="fch-empty" style={{ color: th.text2 }}>
            {t('fc.res_nessuna_carta')}
          </Text>
        ) : null}

        {rows.map(({ g, tally, pending, seconds }) => {
          const open = pending !== null && tally.played > 0;
          return (
            <Card key={g.uuid} style={{ padding: 14, gap: 6 }}>
              <Pressable
                testID={`fch-game-${g.uuid}`}
                accessibilityRole="button"
                onPress={() =>
                  open
                    ? router.push({
                        pathname: '/fc-game',
                        params: { game: g.uuid, position: String(pending) },
                      })
                    : router.push({ pathname: '/fc-result', params: { game: g.uuid } })
                }
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: th.text, fontWeight: '700' }}>
                    {(g.game_date ?? '').slice(0, 16).replace('T', ' ')}
                  </Text>
                  <Text style={{ color: open ? th.brand : th.text, fontWeight: '800' }}>
                    {open ? t('fc.sfc_in_sospeso') : `${Math.round(tally.score)}%`}
                  </Text>
                </View>
                <Text style={{ color: th.text2, fontSize: 13 }}>
                  {t('fc.res_corretto')} {tally.correct} · {t('fc.res_errato')} {tally.wrong} ·{' '}
                  {formatDuration(seconds)}
                </Text>
              </Pressable>
              {asking === g.uuid ? (
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Pressable
                    testID={`fch-del-yes-${g.uuid}`}
                    accessibilityRole="button"
                    onPress={() => {
                      services.games.remove(g.uuid);
                      setAsking(null);
                      setTick((n) => n + 1);
                    }}
                  >
                    <Text style={{ color: th.red, fontWeight: '700' }}>{t('comune.elimina')}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setAsking(null)}>
                    <Text style={{ color: th.brand }}>{t('comune.annulla')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  testID={`fch-del-${g.uuid}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('fc.sfc_elimina_tit')}
                  onPress={() => setAsking(g.uuid)}
                >
                  <Text style={{ color: th.text2, fontSize: 13 }}>{t('comune.elimina')}</Text>
                </Pressable>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
