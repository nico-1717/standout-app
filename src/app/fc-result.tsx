import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDuration } from '@/features/flashcards/format';
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
  const params = useLocalSearchParams<{ game?: string }>();
  const game = params.game ?? '';
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [, setTick] = useState(0);

  if (!services || !game) return null;
  const { games, flashcards } = services;
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
        </Card>

        {tally.wrong > 0 ? (
          <PrimaryButton testID="fcr-retry" label={t('fc.res_rigioca')} onPress={retry} />
        ) : null}
        <PrimaryButton
          testID="fcr-again"
          label={t('fc.res_gioca_ancora')}
          onPress={() => router.replace('/fc-setup')}
        />
        <TextButton
          testID="fcr-history"
          label={t('fc.js_storico')}
          onPress={() => router.replace('/fc-history')}
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
              const card = isChild ? flashcards.subcard(target) : flashcards.card(target);
              const wrong = p.user_answer === 'Wrong';
              return (
                <View key={p.uuid} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: wrong ? th.red : th.green, width: 18, fontWeight: '800' }}>
                    {wrong ? '✗' : '✓'}
                  </Text>
                  <Text style={{ color: th.text, flex: 1 }} numberOfLines={2}>
                    {(card?.question_desc ?? '').replace(/\s+/g, ' ').slice(0, 90)}
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
