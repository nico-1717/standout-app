import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardImage } from '@/features/flashcards/CardImage';
import { CardViewer } from '@/features/flashcards/CardViewer';
import { DocView } from '@/features/flashcards/DocView';
import { formatDuration } from '@/features/flashcards/format';
import { Icon } from '@/features/flashcards/game/GameUi';
import { kitForGame } from '@/features/flashcards/gameKit';
import { langFlag, langName } from '@/features/languages/langs';
import { Header, TextButton } from '@/ui/kit';
import { SpeakButton } from '@/ui/SpeakButton';

/** Quante carte della revisione si mostrano per volta (come il sito: «Carica altre»). */
const PAGE = 20;

/** Il colore del punteggio (s-high, s-mid, s-low del sito) e il suo gradiente nell'anello. */
const BAND = {
  high: { c: '#30D158', g: ['#66EA96', '#1FA84C'] },
  mid: { c: '#FF9F0A', g: ['#FFCB60', '#ED8900'] },
  low: { c: '#FF453A', g: ['#FF8B80', '#E12F26'] },
} as const;

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** L'anello del punteggio (.ring-wrap): si riempie piano fino al punteggio, e il numero al centro sale con lui. */
function ScoreRing({
  score,
  band,
  label,
}: {
  score: number;
  band: keyof typeof BAND;
  label: string;
}) {
  const th = useTheme();
  const b = BAND[band];
  // nei test si vede subito il punteggio finale
  const [k, setK] = useState(process.env.JEST_WORKER_ID ? 1 : 0);
  useEffect(() => {
    if (process.env.JEST_WORKER_ID) return;
    let raf = 0;
    const start = Date.now() + 250;
    const step = () => {
      const x = Math.min(1, Math.max(0, (Date.now() - start) / 1300));
      setK(1 - Math.pow(1 - x, 3));
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const now = Math.round(score * k);
  return (
    <View style={{ width: 188, height: 188, alignSelf: 'center', marginTop: 2, marginBottom: 14 }}>
      <Svg
        width={188}
        height={188}
        viewBox="0 0 120 120"
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={b.g[0]} />
            <Stop offset="1" stopColor={b.g[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={60}
          cy={60}
          r={RING_R}
          fill="none"
          stroke={b.c}
          strokeOpacity={0.14}
          strokeWidth={3.4}
        />
        {now > 0 ? (
          <Circle
            cx={60}
            cy={60}
            r={RING_R}
            fill="none"
            stroke="url(#ring)"
            strokeWidth={5.6}
            strokeLinecap="round"
            strokeDasharray={`${RING_C} ${RING_C}`}
            strokeDashoffset={RING_C * (1 - (score / 100) * k)}
          />
        ) : null}
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <View
          testID="fcr-score"
          accessible
          accessibilityLabel={`${score}%`}
          style={{ flexDirection: 'row', alignItems: 'flex-start' }}
        >
          <Text
            style={{
              color: th.text,
              fontSize: 64,
              fontWeight: '500',
              letterSpacing: -2.9,
              lineHeight: 64,
              fontVariant: ['tabular-nums'],
            }}
          >
            {score}
          </Text>
          <Text
            style={{ color: b.c, fontSize: 19, fontWeight: '700', marginTop: 8, marginLeft: 1 }}
          >
            %
          </Text>
        </View>
        <Text
          style={{
            color: th.text3,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 2.2,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const ICON = {
  back: 'm15 18-6-6 6-6',
  deck: [
    'M3 10a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z',
    'M8.5 4H19a2 2 0 0 1 2 2v10.5',
  ],
  play: 'M7 4v16l13-8z',
  retry: ['M3 12a9 9 0 1 0 2.8-6.5', 'M3 4v5h5'],
  cards: [
    'M3 10a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z',
    'M8.5 4H19a2 2 0 0 1 2 2v10.5',
  ],
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  equal: 'M5 9h14M5 15h14',
  trophy: [
    'M8 21h8M12 17v4',
    'M7 4h10v5a5 5 0 0 1-10 0Z',
    'M17 5h3v2a3 3 0 0 1-3 3',
    'M7 5H4v2a3 3 0 0 0 3 3',
  ],
  pencil: ['M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'],
  fwd: 'M9 6l6 6-6 6',
  check: 'M5 12.5 10 17l9-10',
  wrongOnly: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M15 9l-6 6M9 9l6 6'],
};

/**
 * Il risultato di una partita (fc_result.php): l'anello del punteggio con il confronto, la riga dei numeri, i tasti
 * per rigiocare, la strada dei ripassi, la revisione carta per carta (verdetto da cambiare, risposta, ascolto, matita)
 * e il visore a tutto schermo. In fondo «Continua la partita» se c'è ancora da fare. Parametro `game`.
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
  const [limit, setLimit] = useState(PAGE);
  const [, setTick] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);

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
  const band: keyof typeof BAND = score >= 80 ? 'high' : score >= 50 ? 'mid' : 'low';
  const plays = games
    .allPlays(game)
    .filter((p) => p.user_answer === 'Correct' || p.user_answer === 'Wrong');
  const compare = games.compare(game);
  const road = games.road(game);
  const showRoad = road.steps.length > 1 || (road.state === 'open' && tally.wrong > 0);
  const shown = onlyWrong ? plays.filter((p) => p.user_answer === 'Wrong') : plays;
  const resume = games.resumePosition(game);
  const total = games.totalPositions(game);
  const pagesDone = games.closedPositions(game);
  const deckIds = games.gameDecks(game);
  const firstDeck = deckIds[0] ? kit.decks().find((d) => d.uuid === deckIds[0]) : undefined;
  const learnLang = kit.vocab
    ? kit.view(game, 1, games.plays(game, 1)[0]?.card_uuid ?? '', false).questionLang
    : null;

  const retry = () => {
    const r = games.retry(game);
    if (r.kind === 'started') {
      router.replace({ pathname: '/fc-game', params: { game: r.game, position: '1' } });
    }
  };
  const history = () =>
    router.replace(
      kit.course ? { pathname: '/fc-history', params: { course: kit.course } } : '/fc-history',
    );
  const openDeck = () => {
    if (!firstDeck) return;
    router.push({
      pathname: kit.vocab ? '/lang-deck' : '/fc-deck',
      params: { id: firstDeck.uuid },
    });
  };
  const edit = (target: string, isChild: boolean) => {
    if (kit.vocab) router.push({ pathname: '/lang-word', params: { id: target } });
    else router.push({ pathname: '/fc-card', params: isChild ? { sub: target } : { id: target } });
  };

  /** Un tasto della griglia (.act-tile): pillola grigia con l'icona colorata. */
  const tile = (
    testID: string,
    label: string,
    color: string,
    icon: string | string[],
    onPress: () => void,
    badge?: number,
  ) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: '40%',
        height: 42,
        borderRadius: 21,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingHorizontal: 10,
        backgroundColor: th.surface2,
        borderWidth: 0.5,
        borderColor: th.hairline,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Icon d={icon} size={16} color={color} width={2.2} fill={icon === ICON.play} />
      <Text numberOfLines={1} style={{ color: th.text, fontSize: 12.5, fontWeight: '700' }}>
        {label}
      </Text>
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -5,
            right: -3,
            minWidth: 17,
            height: 17,
            paddingHorizontal: 5,
            borderRadius: 99,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FF3B30',
            borderWidth: 2,
            borderColor: th.surface,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
  const tiles = [
    tile('fcr-again', t('fc.res_gioca_ancora'), th.blue, ICON.play, () =>
      router.replace(
        kit.course ? { pathname: '/fc-setup', params: { course: kit.course } } : '/fc-setup',
      ),
    ),
    ...(tally.wrong > 0
      ? [tile('fcr-retry', t('fc.res_rigioca'), th.red, ICON.retry, retry, tally.wrong)]
      : []),
    ...(firstDeck ? [tile('fcr-deck', t('fc.res_apri_mazzo'), th.teal, ICON.deck, openDeck)] : []),
    ...(shown.length
      ? [tile('fcr-browse', t('fc.flashcard'), th.purple, ICON.cards, () => setViewer(0))]
      : []),
  ];
  // tre tasti: il primo largo e due sotto; quattro: due per riga
  const tileRows: ReactNode[][] =
    tiles.length === 3
      ? [[tiles[0]], [tiles[1], tiles[2]]]
      : tiles.length === 4
        ? [tiles.slice(0, 2), tiles.slice(2)]
        : [tiles];

  const stat = (
    testID: string | undefined,
    value: ReactNode,
    label: string,
    color: string,
    small = false,
  ) => (
    <View testID={testID} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}>
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: small ? 17 : 20,
          fontWeight: '600',
          letterSpacing: -0.4,
          fontVariant: ['tabular-nums'],
          lineHeight: small ? 25 : 24,
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 4,
          color: th.text3,
          fontSize: 8.5,
          fontWeight: '700',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
  const sep = (k: string) => <View key={k} style={{ width: 0.5, backgroundColor: th.hairline }} />;

  const barColor = (pct: number | null): string | null =>
    pct === null
      ? th.text3
      : pct === 100
        ? null
        : pct >= 80
          ? th.green
          : pct >= 50
            ? th.orange
            : th.red;

  // la revisione, pagina per pagina (le carte di una posizione insieme)
  const visible = shown.slice(0, limit);
  const pages: { pos: number; items: typeof visible }[] = [];
  for (const p of visible) {
    const last = pages[pages.length - 1];
    if (last && last.pos === p.position) last.items.push(p);
    else pages.push({ pos: p.position, items: [p] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      {/* l'intestazione: indietro allo storico, il titolo con la lingua o la materia, il mazzo a destra */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
        }}
      >
        <Pressable
          testID="fcr-close"
          accessibilityRole="button"
          accessibilityLabel={t('fc.js_storico')}
          onPress={history}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: th.surface,
            borderWidth: 0.5,
            borderColor: th.hairline,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <Icon d={ICON.back} size={20} color={th.blue} width={2.6} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              color: th.text3,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.1,
              textTransform: 'uppercase',
            }}
          >
            {kit.vocab && learnLang
              ? `${langFlag(learnLang)} ${langName(learnLang, 'en', false)}`
              : t('fc.res_materie_fc')}
          </Text>
          <Text
            style={{
              color: th.text,
              fontSize: 25,
              fontWeight: '800',
              letterSpacing: -0.6,
              marginTop: 1,
            }}
          >
            {t('fc.res_risultato')}
          </Text>
        </View>
        {firstDeck ? (
          <Pressable
            testID="fcr-deck-chip"
            accessibilityRole="button"
            accessibilityLabel={t('fc.res_apri_mazzo')}
            onPress={openDeck}
            style={({ pressed }) => {
              const mz = /^#[0-9a-fA-F]{6}$/.test(firstDeck.color ?? '')
                ? (firstDeck.color as string)
                : '#8E8E93';
              return {
                maxWidth: 150,
                height: 34,
                borderRadius: 99,
                paddingLeft: 10,
                paddingRight: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: `${mz}29`,
                borderWidth: 1,
                borderColor: `${mz}4D`,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              };
            }}
          >
            <Icon d={ICON.deck} size={15} color={th.text} width={2.2} />
            <Text
              numberOfLines={1}
              style={{ color: th.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }}
            >
              {firstDeck.name}
            </Text>
            {deckIds.length > 1 ? (
              <Text style={{ color: th.text, opacity: 0.8, fontSize: 11, fontWeight: '800' }}>
                +{deckIds.length - 1}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}>
        {/* il punteggio (.hero-card) con il bagliore del suo colore in alto */}
        <View
          style={{
            borderRadius: 26,
            overflow: 'hidden',
            backgroundColor: th.surface,
            borderWidth: 0.5,
            borderColor: th.hairline,
            paddingTop: 26,
            paddingHorizontal: 16,
            paddingBottom: 16,
          }}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[`${BAND[band].c}24`, 'transparent']}
            locations={[0, 0.5]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260 }}
          />
          <ScoreRing score={score} band={band} label={t('fc.res_punteggio')} />

          {compare ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
                marginTop: -2,
                marginBottom: 18,
              }}
            >
              <Pressable
                testID="fcr-compare"
                accessibilityRole="link"
                onPress={() =>
                  router.replace({ pathname: '/fc-result', params: { game: compare.uuid } })
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingVertical: 5,
                  paddingLeft: 8,
                  paddingRight: 11,
                  borderRadius: 999,
                  backgroundColor:
                    compare.delta > 0
                      ? '#34C75926'
                      : compare.delta < 0
                        ? '#FF3B3021'
                        : `${th.text}12`,
                }}
              >
                <Icon
                  d={compare.delta > 0 ? ICON.up : compare.delta < 0 ? ICON.down : ICON.equal}
                  size={13}
                  width={2.6}
                  color={compare.delta > 0 ? '#1E9E46' : compare.delta < 0 ? '#E5352B' : th.text2}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: compare.delta > 0 ? '#1E9E46' : compare.delta < 0 ? '#E5352B' : th.text2,
                  }}
                >
                  {compare.delta === 0
                    ? t('fc.res_conf_pari')
                    : t('fc.res_conf_delta', {
                        n: `${compare.delta > 0 ? '+' : '−'}${Math.abs(compare.delta)}`,
                      })}
                </Text>
              </Pressable>
              {compare.record ? (
                <View testID="fcr-record" style={{ borderRadius: 999, overflow: 'hidden' }}>
                  <LinearGradient
                    colors={['#FFE082', '#FFC107']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingVertical: 5,
                      paddingLeft: 8,
                      paddingRight: 11,
                    }}
                  >
                    <Icon d={ICON.trophy} size={13} width={2.2} color="#7A5600" />
                    <Text style={{ color: '#7A5600', fontSize: 12, fontWeight: '700' }}>
                      {t('fc.res_conf_record')}
                    </Text>
                  </LinearGradient>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* la riga dei numeri (.stats-grid): giuste, errori, valutate, pagine, durata */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: 4,
              paddingTop: 12,
              paddingBottom: 10,
              borderTopWidth: 0.5,
              borderBottomWidth: 0.5,
              borderColor: th.hairline,
            }}
          >
            {stat('fcr-correct', tally.correct, t('fc.js_corrette'), th.green)}
            {sep('a')}
            {stat('fcr-wrong', tally.wrong, t('fc.res_errori'), th.red)}
            {sep('b')}
            {stat(undefined, tally.correct + tally.wrong, t('fc.res_valutate'), th.text)}
            {sep('c')}
            {stat(
              'fcr-pages',
              <>
                {pagesDone}
                <Text style={{ color: th.text3, fontSize: 11, fontWeight: '500' }}> / {total}</Text>
              </>,
              t('fc.res_pagine'),
              th.blue,
            )}
            {sep('d')}
            {stat(
              'fcr-time',
              formatDuration(games.playedSeconds(game)),
              t('fc.res_durata'),
              th.purple,
              true,
            )}
          </View>

          {/* i tasti (.act-grid) */}
          <View style={{ marginTop: 14, gap: 8 }}>
            {tileRows.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                {r}
              </View>
            ))}
          </View>
        </View>

        {/* la strada dei ripassi (.road-card): una barra per partita, fino al 100% */}
        {showRoad ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 22,
              overflow: 'hidden',
              padding: road.state === 'conquered' ? 1.5 : 0,
              backgroundColor: road.state === 'conquered' ? '#FFC300' : th.hairline,
            }}
          >
            <View
              style={{
                padding: road.state === 'conquered' ? 14.5 : 15.5,
                margin: road.state === 'conquered' ? 0 : 0.5,
                borderRadius: 21,
                backgroundColor: th.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LinearGradient
                    colors={
                      road.state === 'conquered'
                        ? ['#FFE680', '#FFC300', '#FF9F0A']
                        : ['#FF9F0A', '#FF375F']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                  <Icon
                    d={road.state === 'conquered' ? ICON.trophy : ICON.retry}
                    size={20}
                    width={2.2}
                    color={road.state === 'conquered' ? '#7A4A00' : '#fff'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    testID="fcr-road-title"
                    style={{ color: th.text, fontWeight: '800', fontSize: 16 }}
                  >
                    {road.state === 'conquered' ? t('fc.sfc_strada_presa') : t('fc.sfc_strada')}
                  </Text>
                  <Text
                    testID="fcr-road-sub"
                    style={{ color: th.text2, fontWeight: '600', fontSize: 13, marginTop: 1 }}
                  >
                    {road.state === 'conquered'
                      ? t(
                          road.steps.length - 1 === 1
                            ? 'fc.sfc_conquistata_1'
                            : 'fc.sfc_conquistata_n',
                          { n: road.steps.length - 1 },
                        )
                      : t(
                          road.lastWrong === 1 ? 'fc.sfc_da_sistemare_1' : 'fc.sfc_da_sistemare_n',
                          { n: road.lastWrong },
                        )}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, height: 132, marginTop: 14, flexGrow: 1 }}
              >
                {road.steps.map((st, i) => {
                  const c = barColor(st.pct);
                  const h = st.pct === null ? 8 : Math.max(10, (st.pct / 100) * 82);
                  return (
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
                        minWidth: 40,
                        maxWidth: 64,
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 5,
                      }}
                    >
                      <Text
                        style={{
                          color: th.text2,
                          fontSize: 11.5,
                          fontWeight: '800',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {st.pct === null ? '–' : `${st.pct}%`}
                      </Text>
                      <View
                        style={{
                          width: '100%',
                          height: h,
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                          borderBottomLeftRadius: 4,
                          borderBottomRightRadius: 4,
                          overflow: 'hidden',
                          backgroundColor: c ?? '#FFC300',
                          boxShadow: st.here
                            ? `0 0 0 2px ${th.surface}, 0 0 0 4px ${th.text}4D`
                            : undefined,
                        }}
                      >
                        {c === null ? (
                          <LinearGradient
                            colors={['#FFE680', '#FFC300', '#FF9F0A']}
                            style={{ flex: 1 }}
                          />
                        ) : null}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: st.here ? th.text : th.text3,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {i === 0 ? t('fc.sfc_strada_partita') : t('fc.sfc_strada_rip', { n: i })}
                      </Text>
                    </Pressable>
                  );
                })}
                {road.state !== 'conquered' ? (
                  <View
                    style={{
                      flex: 1,
                      minWidth: 40,
                      maxWidth: 64,
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 5,
                    }}
                  >
                    <Text style={{ color: '#FFC300', fontSize: 11.5, fontWeight: '800' }}>
                      100%
                    </Text>
                    <View
                      style={{
                        width: '100%',
                        height: 82,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: 'rgba(255,195,0,0.8)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon d={ICON.trophy} size={20} width={2.2} color="#FFC300" />
                    </View>
                    <Text style={{ color: th.text3, fontSize: 11, fontWeight: '700' }}>
                      {t('fc.sfc_strada_meta')}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
              {road.state !== 'conquered' && tally.wrong > 0 ? (
                <Pressable
                  testID="fcr-road-cta"
                  accessibilityRole="button"
                  onPress={retry}
                  style={{ marginTop: 14, borderRadius: 15, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={['#FF9F0A', '#FF375F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      height: 50,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon d={ICON.retry} size={19} width={2.2} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '800' }}>
                      {t('fc.res_rigioca')}
                    </Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* la revisione (.sec-title) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            marginTop: 26,
            marginBottom: 12,
            marginHorizontal: 4,
          }}
        >
          <Text
            style={{
              color: th.text2,
              fontSize: 11.5,
              fontWeight: '800',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            {t('fc.res_revisione')}
          </Text>
          <View
            style={{
              paddingVertical: 3,
              paddingHorizontal: 10,
              borderRadius: 99,
              backgroundColor: th.surface2,
            }}
          >
            <Text style={{ color: th.text2, fontSize: 11, fontWeight: '800' }}>{shown.length}</Text>
          </View>
          <View style={{ flex: 1, height: 0.5, backgroundColor: th.hairline }} />
        </View>
        <Text
          style={{
            color: th.text3,
            fontSize: 12,
            fontWeight: '600',
            marginTop: -6,
            marginBottom: 12,
            marginHorizontal: 4,
          }}
        >
          {t('fc.res_tocca_carta')}
        </Text>

        {shown.length === 0 ? (
          <View
            style={{
              padding: 20,
              borderRadius: 22,
              backgroundColor: th.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: th.text2 }}>{t('fc.res_nessuna_carta')}</Text>
          </View>
        ) : null}
        {pages.map((pg) => (
          <View
            key={pg.pos}
            style={{
              backgroundColor: th.surface,
              borderRadius: 22,
              borderWidth: 0.5,
              borderColor: th.hairline,
              paddingTop: 15,
              paddingHorizontal: 16,
              paddingBottom: 12,
              marginBottom: 14,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 2,
              }}
            >
              <Text
                style={{
                  color: th.text3,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {t('fc.res_pagina_n', { n: pg.pos })}
              </Text>
              <Pressable
                testID={`fcr-jump-${pg.pos}`}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/fc-game', params: { game, position: String(pg.pos) } })
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingVertical: 6,
                  paddingHorizontal: 11,
                  borderRadius: 99,
                  backgroundColor: th.blueSoft,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                })}
              >
                <Text style={{ color: th.blue, fontSize: 12, fontWeight: '800' }}>
                  {t('fc.res_rivedi')}
                </Text>
                <Icon d={ICON.fwd} size={12} width={2.6} color={th.blue} />
              </Pressable>
            </View>
            {pg.items.map((p, k) => {
              const isChild = !!p.child_uuid;
              const target = (isChild ? p.child_uuid : p.card_uuid) ?? '';
              const wrong = p.user_answer === 'Wrong';
              const v = kit.view(game, p.position, target, isChild);
              const index = shown.indexOf(p);
              return (
                <Pressable
                  key={p.uuid}
                  testID={`fcr-open-${p.uuid}`}
                  accessibilityRole="button"
                  onPress={() => setViewer(index)}
                  style={({ pressed }) => ({
                    paddingTop: 11,
                    paddingBottom: 6,
                    marginTop: k ? 6 : 0,
                    borderTopWidth: k ? 1 : 0,
                    borderStyle: 'dashed',
                    borderTopColor: th.hairline2,
                    transform: [{ scale: pressed ? 0.988 : 1 }],
                  })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        minWidth: 24,
                        height: 24,
                        paddingHorizontal: 6,
                        borderRadius: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isChild ? '#FF95002E' : th.blueSoft,
                      }}
                    >
                      <Text
                        style={{
                          color: isChild ? th.orange : th.blue,
                          fontSize: 11.5,
                          fontWeight: '800',
                        }}
                      >
                        {isChild ? '↳' : p.position}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        minWidth: 0,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <DocView raw={v.question} size={15.5} weight="600" />
                      </View>
                      {kit.vocab && v.questionVoice ? (
                        <SpeakButton
                          testID={`fcr-speak-q-${p.uuid}`}
                          text={v.question ?? ''}
                          lang={v.questionVoice.lang}
                          once={v.questionVoice.once}
                          look="round"
                          accent={th.blue}
                        />
                      ) : null}
                    </View>
                    {/* il verdetto (.oc-pill): toccandolo si cambia */}
                    <Pressable
                      testID={`fcr-verdict-${p.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('fc.gm_cambia_verdetto')}
                      hitSlop={6}
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
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 99,
                        backgroundColor: wrong ? th.redSoft : th.greenSoft,
                        borderWidth: 1.5,
                        borderColor: wrong ? `${th.red}66` : `${th.green}66`,
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      })}
                    >
                      <Text
                        style={{
                          color: wrong ? th.red : th.green,
                          fontSize: 12.5,
                          fontWeight: '800',
                        }}
                      >
                        {wrong ? '✕' : '✓'} {t(wrong ? 'fc.res_errato' : 'fc.res_corretto')}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID={`fcr-edit-${p.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('comune.modifica')}
                      hitSlop={6}
                      onPress={() => edit(target, isChild)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon d={ICON.pencil} size={15} color={th.text3} />
                    </Pressable>
                  </View>
                  <CardImage testID={`fcr-qimg-${p.uuid}`} name={v.questionImage} height={140} />
                  {/* la risposta (.rev-a) */}
                  <View
                    style={{
                      marginTop: 10,
                      paddingTop: 11,
                      paddingHorizontal: 12,
                      paddingBottom: 10,
                      borderRadius: 14,
                      backgroundColor: th.blueSoft,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        marginBottom: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: th.blue,
                          fontSize: 10,
                          fontWeight: '800',
                          letterSpacing: 1.3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t('fc.ifc_risposta')}
                      </Text>
                      <View style={{ flex: 1, height: 0.5, backgroundColor: th.hairline }} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ flex: 1 }}>
                        <DocView testID={`fcr-answer-${p.uuid}`} raw={v.answer} size={14.5} />
                      </View>
                      {kit.vocab && v.answerVoice ? (
                        <SpeakButton
                          testID={`fcr-speak-a-${p.uuid}`}
                          text={v.answer ?? ''}
                          lang={v.answerVoice.lang}
                          once={v.answerVoice.once}
                          look="round"
                          accent={th.blue}
                        />
                      ) : null}
                    </View>
                    <CardImage testID={`fcr-aimg-${p.uuid}`} name={v.answerImage} height={140} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        {shown.length > limit ? (
          <TextButton
            testID="fcr-more"
            label={`${t('fc.res_carica_altre')} · ${t('fc.res_restano_n', { n: shown.length - limit })}`}
            onPress={() => setLimit((n) => n + PAGE)}
          />
        ) : null}
      </ScrollView>

      {/* i tondini a destra (.res-fabs): solo gli errori, e il visore */}
      <View style={{ position: 'absolute', right: 16, bottom: insets.bottom + 84, gap: 10 }}>
        <Pressable
          testID="fcr-only-wrong"
          accessibilityRole="switch"
          accessibilityLabel={t('fc.res_solo_errate')}
          accessibilityState={{ checked: onlyWrong }}
          onPress={() => setOnlyWrong(!onlyWrong)}
          style={({ pressed }) => ({
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: onlyWrong ? th.red : th.surface2,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          <Icon d={ICON.wrongOnly} size={19} color={onlyWrong ? '#fff' : th.text2} />
        </Pressable>
        {shown.length ? (
          <Pressable
            testID="fcr-viewer-fab"
            accessibilityRole="button"
            accessibilityLabel={t('fc.flashcard')}
            onPress={() => setViewer(0)}
            style={({ pressed }) => ({
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: th.purple,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.28)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
              transform: [{ scale: pressed ? 0.9 : 1 }],
            })}
          >
            <Icon d={ICON.cards} size={19} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {/* in fondo (.bottom-bar): continuare la partita, o «finita» */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 18,
          paddingBottom: insets.bottom + 12,
          alignItems: 'center',
        }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', `${th.bg}EB`]}
          locations={[0, 0.6]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {resume !== null ? (
          <Pressable
            testID="fcr-continue"
            accessibilityRole="button"
            onPress={() =>
              router.replace({ pathname: '/fc-game', params: { game, position: String(resume) } })
            }
            style={({ pressed }) => ({
              height: 40,
              borderRadius: 20,
              paddingLeft: 18,
              paddingRight: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: th.blue,
              boxShadow: `0 6px 16px -8px ${th.blue}`,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Icon d={ICON.play} size={13} color="#fff" fill />
            <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>
              {t('fc.res_continua')}
            </Text>
          </Pressable>
        ) : (
          <View
            testID="fcr-done"
            style={{
              height: 40,
              borderRadius: 20,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: th.surface2,
              borderWidth: 0.5,
              borderColor: th.hairline,
            }}
          >
            <Icon d={ICON.check} size={15} color={th.text3} width={2.6} />
            <Text style={{ color: th.text3, fontSize: 14.5, fontWeight: '700' }}>
              {t('fc.res_categoria_finita')}
            </Text>
          </View>
        )}
      </View>

      {viewer !== null ? (
        <CardViewer
          testID="fcr-viewer"
          start={viewer}
          onClose={() => setViewer(null)}
          cards={shown.map((p) => {
            const isChild = !!p.child_uuid;
            return kit.view(
              game,
              p.position,
              (isChild ? p.child_uuid : p.card_uuid) ?? '',
              isChild,
            );
          })}
        />
      ) : null}
    </View>
  );
}
