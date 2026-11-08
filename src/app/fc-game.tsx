import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardImage } from '@/features/flashcards/CardImage';
import { DocView } from '@/features/flashcards/DocView';
import type { Grade, PlayRow } from '@/features/flashcards/game';
import { kitForGame, type ExampleView, type VoiceSpec } from '@/features/flashcards/gameKit';
import { gapParts, speakable } from '@/features/languages/gap';
import { Card, PrimaryButton } from '@/ui/kit';
import { SpeakButton } from '@/ui/SpeakButton';

interface Item {
  play: PlayRow;
  target: string;
  isChild: boolean;
  question: string | null;
  answer: string | null;
  questionImage: string | null;
  answerImage: string | null;
  meaning: string | null;
  examples: ExampleView[];
  word: string;
  questionVoice: VoiceSpec | null;
  answerVoice: VoiceSpec | null;
  exampleVoice: string | null;
}

/** Lo spazio vuoto di una parte nascosta: la larghezza dice a grandi linee quanto è lunga (corta, media, lunga). */
const gapBlank = (text: string): string =>
  text.length <= 4 ? '____' : text.length <= 9 ? '________' : '____________';

/** Il colore e il nome del voto che una riga ha adesso. */
function stateOf(a: string | null): 'open' | 'correct' | 'wrong' | 'seen' {
  if (a === 'Correct') return 'correct';
  if (a === 'Wrong') return 'wrong';
  if (a === 'Titolo' || a === 'Visione') return 'seen';
  return 'open';
}

/**
 * Si gioca (fc_game.php), versione semplice: un concetto alla volta. Si vede la domanda del concetto principale, si
 * scopre la risposta e si dà il voto (sbagliata, giusta, imparata); poi le sottocarte una per una. Dalle righe già
 * votate si può cambiare il verdetto. Le animazioni, la voce e l'IA arrivano dopo.
 * Parametri: `game` e `position` (da dove si parte; una posizione dietro la prima ancora aperta rimanda a quella).
 */
export default function GameScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services } = useApp();
  const params = useLocalSearchParams<{ game?: string; position?: string }>();
  const game = params.game ?? '';

  // lo studio o il corso di lingua di questa partita
  const kit = useMemo(
    () => (services && game ? kitForGame(services, game) : null),
    [services, game],
  );
  const [pos, setPos] = useState<number | null>(() => {
    if (!kit || !game) return null;
    const want = Math.max(1, Number(params.position) || 1);
    const p = kit.games.effectivePosition(game, want);
    return kit.games.ensurePosition(game, p) ? p : null;
  });
  const [shown, setShown] = useState(false);
  const [tapped, setTapped] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  if (!services || !game || !kit) return null;
  const { games } = kit;

  const finish = () => {
    games.conclude(game);
    router.replace({ pathname: '/fc-result', params: { game } });
  };

  const go = (want: number) => {
    const p = games.effectivePosition(game, want);
    if (!games.ensurePosition(game, p)) {
      finish();
      return;
    }
    setPos(p);
    setShown(false);
  };

  // la partita non c'è o è già finita: si va al risultato
  if (pos === null) {
    if (!games.game(game)) return null;
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: th.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
          {t('fc.gm_partita_finita')}
        </Text>
        <PrimaryButton testID="fcg-to-result" label={t('fc.res_risultato')} onPress={finish} />
      </View>
    );
  }

  const items: Item[] = games.plays(game, pos).map((p) => {
    const isChild = !!p.child_uuid;
    const target = (isChild ? p.child_uuid : p.card_uuid) ?? '';
    const v = kit.view(game, pos, target, isChild);
    return { play: p, target, isChild, ...v };
  });
  const father = items.find((i) => !i.isChild);
  const current = items.find((i) => stateOf(i.play.user_answer) === 'open') ?? null;
  const total = games.totalPositions(game);
  const closed = games.closedPositions(game);

  const streak = games.streak(game);
  const record = kit.records().combo ?? 0;

  const grade = (it: Item, g: Grade) => {
    const r = games.grade(game, pos, it.target, it.isChild, g);
    // la serie si è spezzata: si salva se è un record
    if (g === 'wrong' && streak.current >= 3) games.saveCombo(game);
    setShown(false);
    if (r.ok && r.unanswered === 0) go(r.next);
    else refresh();
  };

  const verdictBtn = (
    testID: string,
    label: string,
    color: string,
    onPress: () => void,
    filled = true,
  ) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: filled ? color : 'transparent',
        borderWidth: filled ? 0 : 1.5,
        borderColor: color,
      }}
    >
      <Text style={{ color: filled ? '#fff' : color, fontWeight: '700', fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );

  /** Significato ed esempi come aiuto: sempre («aperto»), a un tocco, o solo dopo la risposta. */
  const hintBlock = (it: Item) => {
    const lines: { key: 'meaning' | 'examples'; node: ReactNode }[] = [];
    if (it.meaning) lines.push({ key: 'meaning', node: it.meaning });
    if (it.examples.length) {
      lines.push({
        key: 'examples',
        node: it.examples.map((e, n) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              testID={`fcg-example-${n}`}
              style={{ flex: 1, color: th.text2, fontSize: 14, fontStyle: 'italic' }}
            >
              {gapParts(e.text, it.word, e.gap).map((part, k) =>
                !part.hidden ? (
                  part.text
                ) : shown ? (
                  <Text key={k} style={{ color: th.brand, fontWeight: '700' }}>
                    {part.text}
                  </Text>
                ) : (
                  <Text key={k}>{gapBlank(part.text)}</Text>
                ),
              )}
            </Text>
            {/* l'ascolto compare solo con la risposta: prima la voce direbbe proprio la parola da indovinare */}
            {shown && it.exampleVoice ? (
              <SpeakButton
                testID={`fcg-speak-example-${n}`}
                text={speakable(e.text, it.word)}
                lang={it.exampleVoice}
                once
                size={18}
              />
            ) : null}
          </View>
        )),
      });
    }
    return (
      <View style={{ gap: 6 }}>
        {lines.map((l) => {
          const mode = kit.hints[l.key];
          const id = `${it.play.uuid}:${l.key}`;
          const open = mode === 'aperto' || (mode === 'dopo' && shown) || tapped.has(id);
          return open ? (
            l.key === 'examples' ? (
              <View key={l.key} testID="fcg-hint-examples" style={{ gap: 4 }}>
                {l.node}
              </View>
            ) : (
              <Text key={l.key} testID="fcg-hint-meaning" style={{ color: th.text2, fontSize: 14 }}>
                {l.node}
              </Text>
            )
          ) : mode === 'tocco' ? (
            <Pressable
              key={l.key}
              testID={`fcg-hint-${l.key}-show`}
              accessibilityRole="button"
              onPress={() => setTapped(new Set([...tapped, id]))}
            >
              <Text style={{ color: th.brand, fontSize: 14 }}>
                {t(l.key === 'meaning' ? 'fcv.indizio_significato' : 'fcv.indizio_esempio')}
              </Text>
            </Pressable>
          ) : null;
        })}
      </View>
    );
  };

  const label = (it: Item) => t(it.isChild ? 'fc.gm_sottoconcetto' : 'fc.gm_concetto_principale');
  const mark = (s: ReturnType<typeof stateOf>) =>
    s === 'correct' ? '✓' : s === 'wrong' ? '✗' : s === 'seen' ? '•' : '○';
  const markColor = (s: ReturnType<typeof stateOf>) =>
    s === 'correct' ? th.green : s === 'wrong' ? th.red : th.text2;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          testID="fcg-close"
          accessibilityRole="button"
          accessibilityLabel={t('comune.chiudi')}
          onPress={() => {
            games.saveCombo(game);
            router.back();
          }}
          hitSlop={10}
        >
          <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
        </Pressable>
        <Text testID="fcg-progress" style={{ color: th.text2, fontWeight: '600' }}>
          {t('fc.gm_posizione', { n: pos, tot: total })}
          {streak.current >= 2 ? `  🔥 ${streak.current}` : ''}
        </Text>
        <Pressable
          testID="fcg-conclude"
          accessibilityRole="button"
          onPress={() => setConfirming(true)}
          hitSlop={10}
        >
          <Text style={{ color: th.brand, fontSize: 15, fontWeight: '600' }}>
            {t('fc.gm_concludi')}
          </Text>
        </Pressable>
      </View>
      <View
        style={{ height: 4, marginHorizontal: 16, borderRadius: 2, backgroundColor: th.surface2 }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: th.brand,
            width: `${total > 0 ? Math.min(100, (closed / total) * 100) : 0}%`,
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
      >
        {record >= 3 && streak.current > record ? (
          <Text
            testID="fcg-record"
            style={{ color: th.green, fontWeight: '700', textAlign: 'center' }}
          >
            {t('fcv.gj_record_combo', { n: streak.current })}
          </Text>
        ) : null}

        {confirming ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }}>
              {t('fc.gm_conferma_concludi')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {verdictBtn(
                'fcg-conclude-no',
                t('fc.gm_no_continua'),
                th.brand,
                () => setConfirming(false),
                false,
              )}
              {verdictBtn('fcg-conclude-yes', t('fc.gm_si_risultati'), th.brand, finish)}
            </View>
          </Card>
        ) : null}

        {father && (!current || current.isChild) ? (
          <Card style={{ padding: 16, gap: 6 }}>
            <Text style={{ color: th.text2, fontSize: 12, fontWeight: '700' }}>
              {t('fc.gm_concetto_principale').toUpperCase()}
            </Text>
            <DocView testID="fcg-father" raw={father.question} size={18} />
          </Card>
        ) : null}

        {current ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <Text style={{ color: th.text2, fontSize: 12, fontWeight: '700' }}>
              {label(current).toUpperCase()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <DocView testID="fcg-question" raw={current.question} size={19} />
              </View>
              {current.questionVoice ? (
                <SpeakButton
                  testID="fcg-speak-question"
                  text={current.question ?? ''}
                  lang={current.questionVoice.lang}
                  once={current.questionVoice.once}
                />
              ) : null}
            </View>
            <CardImage testID="fcg-question-image" name={current.questionImage} />
            {kit.vocab ? hintBlock(current) : null}
            {shown ? (
              <View style={{ gap: 12 }}>
                <View style={{ height: 1, backgroundColor: th.hairline2 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <DocView testID="fcg-answer" raw={current.answer} size={17} />
                  </View>
                  {current.answerVoice ? (
                    <SpeakButton
                      testID="fcg-speak-answer"
                      text={current.answer ?? ''}
                      lang={current.answerVoice.lang}
                      once={current.answerVoice.once}
                    />
                  ) : null}
                </View>
                <CardImage testID="fcg-answer-image" name={current.answerImage} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {verdictBtn('fcg-wrong', t('fc.vg_sbagliato'), th.red, () =>
                    grade(current, 'wrong'),
                  )}
                  {verdictBtn('fcg-correct', t('fc.res_corretto'), th.green, () =>
                    grade(current, 'correct'),
                  )}
                  {verdictBtn('fcg-learnt', t('fc.gm_imparato'), th.brand, () =>
                    grade(current, 'learnt'),
                  )}
                </View>
              </View>
            ) : (
              <Pressable
                testID="fcg-reveal"
                accessibilityRole="button"
                onPress={() => setShown(true)}
                style={{
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: th.surface2,
                }}
              >
                <Text style={{ color: th.text, fontWeight: '700' }}>
                  {t('fc.gm_mostra_risposta')}
                </Text>
                <Text style={{ color: th.text2, fontSize: 12, marginTop: 2 }}>
                  {t('fc.gm_tocca_rivela')}
                </Text>
              </Pressable>
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: th.text }}>{t('fc.gm_preferiti')}</Text>
              <Switch
                testID="fcg-favorite"
                value={kit.isFavorite(current.target)}
                onValueChange={(v) => {
                  kit.setFavorite(current.target, current.isChild, v);
                  refresh();
                }}
              />
            </View>
          </Card>
        ) : father ? (
          <Card style={{ padding: 16, gap: 12 }}>
            {father.play.user_answer !== 'Titolo' ? (
              <DocView testID="fcg-answer" raw={father.answer} size={17} />
            ) : null}
            <PrimaryButton
              testID="fcg-next"
              label={t('fc.gm_avanti')}
              onPress={() => go(pos + 1)}
            />
          </Card>
        ) : null}

        {items.length > 1 || (items.length === 1 && !current) ? (
          <Card style={{ padding: 12, gap: 6 }}>
            {items.map((it) => {
              const s = stateOf(it.play.user_answer);
              const voted = s === 'correct' || s === 'wrong';
              return (
                <View
                  key={it.play.uuid}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <Text style={{ color: markColor(s), width: 18, fontWeight: '800' }}>
                    {mark(s)}
                  </Text>
                  <Text style={{ color: th.text, flex: 1 }} numberOfLines={1}>
                    {(it.question ?? '').replace(/\s+/g, ' ').slice(0, 60) || label(it)}
                  </Text>
                  {voted ? (
                    <Pressable
                      testID={`fcg-verdict-${it.play.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('fc.gm_cambia_verdetto')}
                      onPress={() => {
                        games.changeVerdict(
                          game,
                          pos,
                          it.target,
                          it.isChild,
                          s === 'correct' ? 'wrong' : 'correct',
                        );
                        refresh();
                      }}
                    >
                      <Text style={{ color: th.brand, fontSize: 13 }}>
                        {t('fc.gm_cambia_verdetto')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
