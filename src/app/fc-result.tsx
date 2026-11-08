import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDuration } from '@/features/flashcards/format';
import { kitForGame } from '@/features/flashcards/gameKit';
import { Card, Header, PrimaryButton, TextButton } from '@/ui/kit';

/**
 * Il risultato di una partita (fc_result.php), versione semplice: punteggio, giuste e sbagliate, durata, l'elenco delle carte
 * con il verdetto cambiabile, «Rigioca errori» e «Gioca ancora». Parametro `game`.
 */
export default function ResultScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services } = useApp();
  const params = useLocalSearchParams<{ game?: string; errors?: string }>();
  const game = params.game ?? '';
  const [onlyWrong, setOnlyWrong] = useState(params.errors === '1');
  const [, setTick] = useState(0);

  const kit = useMemo(
    () => (services && game ? kitForGame(services, game) : null),
    [services, game],
  );
  if (!services || !game || !kit) return null;
  const { games } = kit;
  const row = games.game(game);
  if (!row) {
    return (
      <View style={{ flex: 1, backgroundColor: th.bg }}>
        <Header top={insets.top} title={t('fc.res_titolo')} />
        <Text style={{ color: th.text2, padding: 24 }}>{t('fc.res_partita_non_trovata')}</Text>
      </View>
    );
  }
  const tally = games.tally(game);
  const score = Math.round(tally.score);
  const plays = games
    .allPlays(game)
    .filter((p) => p.user_answer === 'Correct' || p.user_answer === 'Wrong');
  const compare = games.compare(game);
  const road = games.road(game);
  const showRoad = road.steps.length > 1 || (road.state === 'open' && tally.wrong > 0);
  const barColor = (pct: number | null): string =>
    pct === null
      ? th.text2
      : pct === 100
        ? th.brand
        : pct >= 80
          ? th.green
          : pct >= 50
            ? th.text2
            : th.red;
  const shown = onlyWrong ? plays.filter((p) => p.user_answer === 'Wrong') : plays;

  const retry = () => {
    const r = games.retry(game);
    if (r.kind === 'started') {
      router.replace({ pathname: '/fc-game', params: { game: r.game, position: '1' } });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fc.res_titolo')}
        right={
          <Pressable testID="fcr-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.chiudi')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
      >
        <Card style={{ padding: 20, alignItems: 'center', gap: 6 }}>
          <Text style={{ color: th.text2, fontWeight: '700', fontSize: 12 }}>
            {t('fc.res_punteggio').toUpperCase()}
          </Text>
          <Text testID="fcr-score" style={{ color: th.text, fontSize: 56, fontWeight: '800' }}>
            {score}%
          </Text>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <Text testID="fcr-correct" style={{ color: th.green, fontWeight: '700' }}>
              {t('fc.res_corretto')} {tally.correct}
            </Text>
            <Text testID="fcr-wrong" style={{ color: th.red, fontWeight: '700' }}>
              {t('fc.res_errato')} {tally.wrong}
            </Text>
          </View>
          <Text testID="fcr-time" style={{ color: th.text2 }}>
            {t('fc.res_durata')} {formatDuration(games.playedSeconds(game))}
          </Text>
          {compare ? (
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Pressable
                testID="fcr-compare"
                accessibilityRole="link"
                onPress={() =>
                  router.replace({ pathname: '/fc-result', params: { game: compare.uuid } })
                }
              >
                <Text
                  style={{
                    fontWeight: '700',
                    color: compare.delta > 0 ? th.green : compare.delta < 0 ? th.red : th.text2,
                  }}
                >
                  {compare.delta > 0 ? '▲ ' : compare.delta < 0 ? '▼ ' : '＝ '}
                  {compare.delta === 0
                    ? t('fc.res_conf_pari')
                    : t('fc.res_conf_delta', {
                        n: `${compare.delta > 0 ? '+' : '−'}${Math.abs(compare.delta)}`,
                      })}
                </Text>
              </Pressable>
              {compare.record ? (
                <Text testID="fcr-record" style={{ color: th.brand, fontWeight: '700' }}>
                  🏆 {t('fc.res_conf_record')}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {showRoad ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <Text
              testID="fcr-road-title"
              style={{ color: th.text, fontWeight: '700', fontSize: 16 }}
            >
              {road.state === 'conquered' ? t('fc.sfc_strada_presa') : t('fc.sfc_strada')}
            </Text>
            <Text testID="fcr-road-sub" style={{ color: th.text2 }}>
              {road.state === 'conquered'
                ? t(road.steps.length - 1 === 1 ? 'fc.sfc_conquistata_1' : 'fc.sfc_conquistata_n', {
                    n: road.steps.length - 1,
                  })
                : t(road.lastWrong === 1 ? 'fc.sfc_da_sistemare_1' : 'fc.sfc_da_sistemare_n', {
                    n: road.lastWrong,
                  })}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 }}>
              {road.steps.map((st, i) => (
                <Pressable
                  key={st.uuid}
                  testID={`fcr-road-${i}`}
                  accessibilityRole="button"
                  onPress={() =>
                    st.here
                      ? undefined
                      : router.replace({ pathname: '/fc-result', params: { game: st.uuid } })
                  }
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                  }}
                >
                  <Text
                    style={{ color: th.text, fontSize: 11, fontWeight: st.here ? '800' : '500' }}
                  >
                    {st.pct === null ? '–' : `${st.pct}%`}
                  </Text>
                  <View
                    style={{
                      width: '70%',
                      height: st.pct === null ? 8 : Math.max(10, st.pct * 0.7),
                      borderRadius: 6,
                      backgroundColor: barColor(st.pct),
                      opacity: st.here ? 1 : 0.6,
                    }}
                  />
                  <Text style={{ color: th.text2, fontSize: 11 }}>
                    {i === 0 ? t('fc.sfc_strada_partita') : t('fc.sfc_strada_rip', { n: i })}
                  </Text>
                </Pressable>
              ))}
              {road.state !== 'conquered' ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                  }}
                >
                  <Text style={{ color: th.text, fontSize: 11 }}>100%</Text>
                  <View
                    style={{
                      width: '70%',
                      height: 70,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: th.brand,
                    }}
                  />
                  <Text style={{ color: th.text2, fontSize: 11 }}>{t('fc.sfc_strada_meta')}</Text>
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        {tally.wrong > 0 ? (
          <PrimaryButton testID="fcr-retry" label={t('fc.res_rigioca')} onPress={retry} />
        ) : null}
        <PrimaryButton
          testID="fcr-again"
          label={t('fc.res_gioca_ancora')}
          onPress={() =>
            router.replace(
              kit.course ? { pathname: '/fc-setup', params: { course: kit.course } } : '/fc-setup',
            )
          }
        />
        <TextButton
          testID="fcr-history"
          label={t('fc.js_storico')}
          onPress={() =>
            router.replace(
              kit.course
                ? { pathname: '/fc-history', params: { course: kit.course } }
                : '/fc-history',
            )
          }
        />

        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: th.text, fontWeight: '700' }}>{t('fc.res_revisione')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: th.text2 }}>{t('fc.res_solo_errate')}</Text>
            <Switch testID="fcr-only-wrong" value={onlyWrong} onValueChange={setOnlyWrong} />
          </View>
        </View>

        {shown.length === 0 ? (
          <Text style={{ color: th.text2 }}>{t('fc.res_nessuna_carta')}</Text>
        ) : (
          <Card style={{ padding: 12, gap: 10 }}>
            {shown.map((p) => {
              const isChild = !!p.child_uuid;
              const target = (isChild ? p.child_uuid : p.card_uuid) ?? '';
              const wrong = p.user_answer === 'Wrong';
              return (
                <View key={p.uuid} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: wrong ? th.red : th.green, width: 18, fontWeight: '800' }}>
                    {wrong ? '✗' : '✓'}
                  </Text>
                  <Text style={{ color: th.text, flex: 1 }} numberOfLines={2}>
                    {kit.label(game, p.position, target, isChild).slice(0, 90)}
                  </Text>
                  <Pressable
                    testID={`fcr-verdict-${p.uuid}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('fc.gm_cambia_verdetto')}
                    onPress={() => {
                      games.changeVerdict(
                        game,
                        p.position,
                        target,
                        isChild,
                        wrong ? 'correct' : 'wrong',
                      );
                      games.conclude(game);
                      setTick((n) => n + 1);
                    }}
                  >
                    <Text style={{ color: th.brand, fontSize: 13 }}>
                      {t('fc.gm_cambia_verdetto')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
