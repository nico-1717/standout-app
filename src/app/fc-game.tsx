import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardAudio } from '@/features/flashcards/CardAudio';
import { CardImage } from '@/features/flashcards/CardImage';
import { DocView } from '@/features/flashcards/DocView';
import type { Grade, PlayRow } from '@/features/flashcards/game';
import {
  NEW_STATE,
  blockBestStreak,
  checkpointCount,
  checkpointDue,
  checkpointsDone,
  countsForFastest,
  finalStretch,
  levelToast,
  passedMilestone,
  readJuice,
  stepKey,
  stepOf,
  summarizeBlock,
  writeJuice,
  type BlockSummary,
  type Due,
  type JuiceState,
} from '@/features/flashcards/gameJuice';
import { kitForGame, type ExampleView, type VoiceSpec } from '@/features/flashcards/gameKit';
import { playSound, type SoundName } from '@/features/flashcards/gameSounds';
import { BossSheet, type BossControl } from '@/features/flashcards/juice/BossSheet';
import { bossCards, type BossCard } from '@/features/flashcards/juice/bossCards';
import { CheckpointSheet, type RecordLine } from '@/features/flashcards/juice/CheckpointSheet';
import { ErrorsSheet } from '@/features/flashcards/juice/ErrorsSheet';
import { GameSettingsSheet } from '@/features/flashcards/juice/GameSettingsSheet';
import { ToastHost, useToasts } from '@/features/flashcards/juice/GameToasts';
import { ROAD_ACCENT, RoadTrack } from '@/features/flashcards/juice/RoadTrack';
import { StreakPill } from '@/features/flashcards/juice/StreakPill';
import { useGameConfetti } from '@/features/flashcards/juice/useGameConfetti';
import type { VoiceAction } from '@/features/flashcards/voice/brain';
import { commandExample, VoiceIntroSheet } from '@/features/flashcards/voice/VoiceIntroSheet';
import { VoiceLayer } from '@/features/flashcards/voice/VoiceLayer';
import type { Phase } from '@/features/flashcards/voice/commands';
import { answerVariants } from '@/features/flashcards/voice/commands';
import { resolveVoiceLang } from '@/features/flashcards/voice/dicts';
import {
  DEFAULT_READING,
  answerSegments,
  parseReading,
  plainSpeech,
  questionSegments,
  type ReadableCard,
  type Segment,
} from '@/features/flashcards/voice/reading';
import {
  AnswerSlot,
  CardTitle,
  ChronoPill,
  CornerFab,
  ExampleLine,
  GameCard,
  GapBlank,
  GradeRow,
  HintBox,
  Icon,
  IconBtn,
  ICONS,
  LevelBadge,
  NavPill,
  RevealVeil,
  SectionTitle,
  WideButton,
} from '@/features/flashcards/game/GameUi';
import {
  comeBack,
  FLY_MS,
  flyAway,
  SwipeCard,
  SwipeOverlay,
  useSwipeState,
} from '@/features/flashcards/game/SwipeCard';
import { Confetti } from '@/features/habits/Confetti';
import { readAloud, stopReading, warmVoices } from '@/core/speech/speak';
import { langFlag, langName } from '@/features/languages/langs';
import { gapParts, speakable } from '@/features/languages/gap';
import { Card, PrimaryButton, TextButton } from '@/ui/kit';
import { haptic } from '@/ui/motion';
import { SpeakButton } from '@/ui/SpeakButton';

interface Item {
  play: PlayRow;
  target: string;
  isChild: boolean;
  question: string | null;
  answer: string | null;
  questionLang?: string | null;
  answerLang?: string | null;
  questionImage: string | null;
  answerImage: string | null;
  questionAudio: string | null;
  answerAudio: string | null;
  meaning: string | null;
  examples: ExampleView[];
  word: string;
  questionVoice: VoiceSpec | null;
  answerVoice: VoiceSpec | null;
  exampleVoice: string | null;
}

/** Un checkpoint che aspetta di essere letto: il tratto, il riassunto, i record e dove si va dopo. */
interface CkState {
  due: Due;
  count: number;
  summary: BlockSummary;
  bestStreak: number;
  records: RecordLine[];
  /** la posizione a cui si va quando si chiude */
  next: number;
  phase: 'sheet' | 'boss';
  cards: BossCard[];
}

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
/**
 * La lettura automatica fuori dalla partita a voce («Automatica» nelle impostazioni): la domanda quando compare, la
 * risposta quando la si scopre.
 */
function AutoReader({ on, id, parts }: { on: boolean; id: string; parts: Segment[] }) {
  const latest = useRef(parts);
  useEffect(() => {
    latest.current = parts;
  });
  useEffect(() => {
    if (on) readAloud(latest.current);
  }, [on, id]);
  useEffect(() => () => stopReading(), []);
  return null;
}

export default function GameScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, localPrefs } = useApp();
  const params = useLocalSearchParams<{ game?: string; position?: string; nc?: string }>();
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
  // carte aggiunte al mazzo dopo l'avvio: alla ripresa si chiede se giocare anche quelle (nc=1 = già risposto)
  const [added, setAdded] = useState<string[]>(() =>
    kit && game && params.nc !== '1' ? kit.games.newCards(game) : [],
  );
  const [shown, setShown] = useState(false);
  const [tapped, setTapped] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const toasts = useToasts();
  const fx = useGameConfetti();
  const [ck, setCk] = useState<CkState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errorsRange, setErrorsRange] = useState<[number, number] | null>(null);
  // la partita a voce: accesa o no, il foglio che la spiega, i comandi del boss e a che punto è il suo giro
  const [voiceOn, setVoiceOn] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const bossControl = useRef<BossControl | null>(null);
  const [bossAt, setBossAt] = useState<{ phase: 'q' | 'a' | 'over'; index: number }>({
    phase: 'q',
    index: 0,
  });
  const onBossPhase = useCallback(
    (phase: 'q' | 'a' | 'over', index: number) =>
      setBossAt((b) => (b.phase === phase && b.index === index ? b : { phase, index })),
    [],
  );
  const onBossControl = useCallback((c: BossControl | null) => {
    bossControl.current = c;
  }, []);
  // tutte le risposte della partita (per i dischi con gli errori): si rileggono a ogni voto, non a ogni disegno
  const allPlays = useMemo(
    () => (kit && game ? kit.games.allPlays(game) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kit, game, tick, pos],
  );
  const perPosition = useMemo(
    () => (kit && game ? kit.games.cardsPerPosition(game) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kit, game, added.length],
  );

  // lo swipe e il volo della carta a ogni voto
  const sw = useSwipeState();
  const busy = useRef(false);
  const win = useWindowDimensions();
  // le voci del telefono si caricano subito: la prima lettura non aspetta
  useEffect(() => warmVoices(), []);
  // il tempo già giocato quando si apre (l'orologio poi sale da solo)
  const [playedBase] = useState(() => (kit && game ? kit.games.playedSeconds(game) : 0));

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

  if (added.length > 0) {
    const answer = (yes: boolean) => {
      if (yes) games.acceptNewCards(game);
      else games.declineNewCards(game);
      setAdded([]);
    };
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, justifyContent: 'center', padding: 24 }}>
        <Text
          testID="fcg-nc-title"
          style={{ color: th.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}
        >
          {t(added.length === 1 ? 'fc.nc_h_1' : 'fc.nc_h_n', { n: added.length })}
        </Text>
        <Text style={{ color: th.text2, textAlign: 'center', marginVertical: 10 }}>
          {t('fc.nc_sub')}
        </Text>
        <Card style={{ padding: 12, gap: 6, marginBottom: 16 }}>
          {added.slice(0, 5).map((c) => (
            <Text key={c} style={{ color: th.text }} numberOfLines={1}>
              {kit.preview(c).slice(0, 70) || '—'}
            </Text>
          ))}
          {added.length > 5 ? <Text style={{ color: th.text2 }}>+{added.length - 5}</Text> : null}
        </Card>
        <PrimaryButton testID="fcg-nc-yes" label={t('fc.nc_si')} onPress={() => answer(true)} />
        <TextButton testID="fcg-nc-no" label={t('fc.nc_no')} onPress={() => answer(false)} />
      </View>
    );
  }

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

  const sound = (name: SoundName, run = 0) => {
    if (localPrefs.fcSounds) playSound(name, run);
  };

  /** Il checkpoint di un tratto appena finito: il riassunto, i record battuti, la festa. */
  const openCheckpoint = (due: Due, js: JuiceState, next: number) => {
    const plays = games.allPlays(game);
    const summary = summarizeBlock(plays, due.from, due.to);
    const records: RecordLine[] = [];
    if (countsForFastest(summary) && summary.perCard !== null) {
      const r = games.bumpRecord('veloce', summary.perCard, game, true);
      if (r.changed && !r.first) {
        records.push({ icon: '⏱️', text: t('fcv.ck_record_veloce', { s: summary.perCard }) });
      }
    }
    const mastered = games.mastered();
    if (mastered > 0) {
      const r = games.bumpRecord('padroneggiate', mastered, game);
      if (passedMilestone(r.before, mastered) !== null) {
        records.push({
          icon: '⭐',
          text: t(kit.vocab ? 'fcv.ck_padroneggiate' : 'fcv.ck_padroneggiate_carte', {
            n: mastered,
          }),
        });
      }
    }
    const combo = games.saveCombo(game);
    if (combo.changed) {
      records.push({ icon: '🔥', text: t('fcv.ck_record_serie', { n: combo.value }) });
    }
    const acc =
      summary.correct + summary.wrong ? summary.correct / (summary.correct + summary.wrong) : 0;
    writeJuice(services.db, game, { ...js, ckDone: due.k });
    setCk({
      due,
      count: checkpointCount(total, js.ckEvery, due.k),
      summary,
      bestStreak: blockBestStreak(plays, due.from, due.to),
      records,
      next,
      phase: 'sheet',
      cards: bossCards(kit, game, summary.missed),
    });
    sound('checkpoint');
    haptic.success();
    if (acc >= 0.8 || records.length) fx.fire(acc === 1 ? 150 : 90);
  };

  /** Si chiude la pausa (o il boss) e si prosegue dove si era. */
  const proceed = () => {
    if (!ck) return;
    const next = ck.next;
    setCk(null);
    fx.clear();
    go(next);
  };

  const grade = (it: Item, g: Grade) => {
    const every = localPrefs.fcCheckpoint;
    const stored = readJuice(services.db, game);
    let js = stored ?? NEW_STATE;
    if (!stored || js.ckEvery !== every) {
      js = { ...js, ckEvery: every, ckDone: checkpointsDone(games.frontier(game), every) };
    }
    const before = games.levelOfCard(it.target, it.isChild);
    const prev = streak.current;
    const r = games.grade(game, pos, it.target, it.isChild, g);
    const after = games.levelOfCard(it.target, it.isChild);
    const now = games.streak(game);

    if (g === 'wrong') {
      sound('wrong');
      haptic.warning();
      if (prev >= 3) {
        // la serie si è spezzata: si salva se è un record
        games.saveCombo(game);
        toasts.push({ kind: 'lost', icon: '💔', title: t('fcv.gj_persa', { n: prev }) });
      }
    } else {
      const n = now.current;
      if (stepOf(n) > stepOf(prev)) {
        sound('step');
        haptic.success();
        toasts.push({
          kind: 'step',
          icon: '🔥',
          title: t(stepKey(stepOf(n))),
          sub: t('fcv.gj_di_fila', { n }),
        });
      } else {
        sound('right', n);
        haptic.tap();
      }
      if (record >= 3 && n > record && !js.recordHit) {
        js = { ...js, recordHit: true };
        toasts.push({ kind: 'record', icon: '🏆', title: t('fcv.gj_record_combo', { n }) });
      }
    }

    const lt = levelToast(before, after);
    if (lt) {
      toasts.push({ kind: lt.up ? 'up' : 'down', icon: lt.up ? '⬆️' : '⬇️', title: t(lt.key) });
      if (lt.up) sound('level');
      if (lt.up && after === 'la_sai') fx.fire(60);
    }

    const front = games.frontier(game);
    const fs = finalStretch(total, front);
    if (fs.on && !js.finalShown) {
      js = { ...js, finalShown: true };
      toasts.push({ kind: 'final', icon: '🏁', title: t('fcv.gj_finale', { n: fs.left }) });
    }

    setShown(false);
    const done = r.ok && r.unanswered === 0;
    const due = done ? checkpointDue(front, total, every, js.ckDone) : null;
    if (due) {
      // la pausa passa davanti: si va avanti quando si chiude
      openCheckpoint(due, js, r.next);
      return;
    }
    writeJuice(services.db, game, js);
    if (done) go(r.next);
    else refresh();
  };

  /** Un voto con la sua animazione (gradeFeedback del sito): la carta vola via, poi arriva quella dopo. */
  const vote = (it: Item, g: Grade, flown = false) => {
    if (busy.current) return;
    busy.current = true;
    if (!flown) flyAway(sw, g, win.width, win.height);
    const done = () => {
      busy.current = false;
      grade(it, g);
      comeBack(sw);
    };
    if (FLY_MS) setTimeout(done, FLY_MS);
    else done();
  };

  /** Significato ed esempi (.fcv-hints): sempre («aperto»), a un tocco, o solo dopo la risposta; vista la risposta, tutti. */
  const hintBlock = (it: Item) => {
    const blocks: ReactNode[] = [];
    const isOpen = (key: 'meaning' | 'examples') => {
      const mode = kit.hints[key];
      return (
        shown || mode === 'aperto' || tapped.has(`${it.play.uuid}:${key}`)
          ? 'open'
          : mode === 'tocco'
            ? 'tap'
            : 'hidden'
      ) as 'open' | 'tap' | 'hidden';
    };
    const opener = (key: string) => () => setTapped(new Set([...tapped, `${it.play.uuid}:${key}`]));
    if (it.meaning && isOpen('meaning') !== 'hidden') {
      blocks.push(
        <HintBox
          key="m"
          testID="fcg-hint-meaning"
          label={t('fcv.indizio_significato')}
          open={isOpen('meaning') === 'open'}
          onOpen={opener('meaning')}
        >
          <Text style={{ color: th.text2, fontSize: 16, lineHeight: 24, fontStyle: 'italic' }}>
            {it.meaning}
          </Text>
        </HintBox>,
      );
    }
    if (it.examples.length && isOpen('examples') !== 'hidden') {
      blocks.push(
        <HintBox
          key="e"
          testID="fcg-hint-examples"
          label={t('fcv.indizio_esempio')}
          open={isOpen('examples') === 'open'}
          onOpen={opener('examples')}
        >
          <View style={{ gap: 9, marginTop: 2 }}>
            {it.examples.map((e, n) => (
              <ExampleLine key={n}>
                <Text
                  testID={`fcg-example-${n}`}
                  style={{ flex: 1, color: th.text, fontSize: 16, lineHeight: 24 }}
                >
                  {gapParts(e.text, it.word, e.gap).map((part, k) =>
                    !part.hidden ? (
                      part.text
                    ) : shown ? (
                      <Text key={k} style={{ color: th.purple, fontWeight: '800' }}>
                        {part.text}
                      </Text>
                    ) : (
                      <GapBlank key={k} word={part.text} />
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
                    look="round"
                    accent={th.purple}
                  />
                ) : null}
              </ExampleLine>
            ))}
          </View>
        </HintBox>,
      );
    }
    return blocks.length ? <View style={{ gap: 10, marginTop: 16 }}>{blocks}</View> : null;
  };

  // ---- la partita a voce: in che fase si è, cosa leggere, cosa si può dire, cosa fa ogni comando ----
  const voiceLang = resolveVoiceLang(localPrefs.fcVoiceLang, i18n.language);
  const reading = parseReading(kit.vocab ? localPrefs.fcVoiceRead : DEFAULT_READING);
  const say = (intent: string) => commandExample(voiceLang, intent);
  const bossCard = ck?.phase === 'boss' ? ck.cards[bossAt.index] : undefined;
  const segment = (text: string | null | undefined, lang: string | null): Segment[] => {
    const plain = plainSpeech(text);
    return plain && lang ? [{ text: plain, lang, once: true }] : [];
  };
  let voicePhase: Phase = 'idle';
  let voiceKey = 'idle';
  let voiceScript: Segment[] = [];
  let voiceHint: string | null = null;
  const sayRightWrong = () =>
    t('fc.vg_di_corretta_sbagliata', { corretta: say('corretto'), sbagliata: say('errato') });
  if (ck?.phase === 'sheet') {
    voicePhase = 'ck';
    voiceKey = `ck:${ck.due.k}`;
    const n = ck.summary.missed.length;
    const prec = Math.round(
      (ck.summary.correct / Math.max(1, ck.summary.correct + ck.summary.wrong)) * 100,
    );
    voiceScript = segment(
      t(n ? 'fc.vg_ck_errori' : 'fc.vg_ck_perfetto', { k: ck.due.k, prec, n }),
      voiceLang,
    );
    voiceHint = ck.cards.length
      ? t('fc.vg_di_continua_boss', { continua: say('continua'), boss: say('boss') })
      : t('fc.vg_di_continua', { continua: say('continua') });
  } else if (ck) {
    // il boss: una carta alla volta; a giro finito basta dire «continua»
    if (bossAt.phase === 'over' || !bossCard) {
      voicePhase = 'ck';
      voiceKey = 'boss:over';
      voiceHint = t('fc.vg_di_continua', { continua: say('continua') });
    } else if (bossAt.phase === 'q') {
      voicePhase = 'boss-q';
      voiceKey = `boss:${bossAt.index}:q`;
      voiceScript = segment(bossCard.prompt, bossCard.promptLang ?? (kit.vocab ? null : voiceLang));
      voiceHint = t('fc.vg_di_risposta', { risposta: say('risposta') });
    } else {
      voicePhase = 'boss-a';
      voiceKey = `boss:${bossAt.index}:a`;
      voiceScript = segment(bossCard.reveal, bossCard.revealLang ?? (kit.vocab ? null : voiceLang));
      voiceHint = sayRightWrong();
    }
  } else if (current) {
    voicePhase = shown ? 'answer' : 'question';
    voiceKey = `${current.play.uuid}:${shown ? 'a' : 'q'}`;
    // un mazzo di studio non ha una lingua per carta: si legge nella lingua dei comandi
    const fallback: VoiceSpec = { lang: voiceLang, once: true };
    const readable: ReadableCard = kit.vocab
      ? current
      : {
          ...current,
          questionVoice: current.questionVoice ?? fallback,
          answerVoice: current.answerVoice ?? fallback,
        };
    voiceScript = shown ? answerSegments(readable, reading) : questionSegments(readable, reading);
    voiceHint = shown ? sayRightWrong() : t('fc.vg_di_risposta', { risposta: say('risposta') });
  }

  const onVoice = (a: VoiceAction) => {
    if (ck) {
      if (ck.phase === 'sheet') {
        if (a.kind === 'continue') proceed();
        else if (a.kind === 'boss' && ck.cards.length) setCk({ ...ck, phase: 'boss' });
      } else if (a.kind === 'reveal' || a.kind === 'reveal-read') bossControl.current?.reveal();
      else if (a.kind === 'grade') bossControl.current?.answer(a.correct);
      else if (a.kind === 'continue') proceed();
      return;
    }
    if (!current) return;
    if (a.kind === 'reveal' || a.kind === 'reveal-read') setShown(true);
    else if (a.kind === 'grade') vote(current, a.correct ? 'correct' : 'wrong');
  };

  const label = (it: Item) => t(it.isChild ? 'fc.gm_sottoconcetto' : 'fc.gm_concetto_principale');

  const front = games.frontier(game);
  const wrongRows = allPlays.filter((p) => p.user_answer === 'Wrong');
  const everyNow = localPrefs.fcCheckpoint;
  const errorRows =
    errorsRange === null
      ? []
      : wrongRows
          .filter((p) => p.position >= errorsRange[0] && p.position <= errorsRange[1])
          .map((p) => {
            const isChild = !!p.child_uuid;
            const target = (isChild ? p.child_uuid : p.card_uuid) ?? '';
            return {
              key: p.uuid,
              position: p.position,
              label: kit.label(game, p.position, target, isChild),
            };
          });

  const accent = games.accentAt(game, pos) ?? ROAD_ACCENT;
  const ui = i18n.language === 'it' ? 'it' : 'en';
  const sideTag = (it: Item, side: 'q' | 'a') => {
    const code = side === 'q' ? it.questionLang : it.answerLang;
    return kit.vocab && code
      ? { flag: langFlag(code), label: langName(code, ui, false) }
      : { flag: null, label: t(side === 'q' ? 'fc.ifc_domanda' : 'fc.ifc_risposta') };
  };
  const big = (it: Item) => kit.vocab && !it.isChild;
  const openEdit = (it: Item) => {
    games.saveCombo(game);
    if (kit.vocab) router.push({ pathname: '/lang-word', params: { id: it.target } });
    else
      router.push({
        pathname: '/fc-card',
        params: it.isChild ? { sub: it.target } : { id: it.target },
      });
  };
  const allAnswered = items.length > 0 && !current;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      {/* l'intestazione (.app-header): la strada, poi anello, contatore e i tasti tondi */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
          zIndex: 10,
        }}
      >
        <RoadTrack
          model={{ tot: total, pos, front, done: games.tally(game).played, cp: perPosition }}
          every={everyNow}
          wrong={wrongRows.map((p) => p.position)}
          accent={accent}
          onErrors={(a, b) => setErrorsRange([a, b])}
          title={
            <View
              testID="fcg-progress"
              accessible
              accessibilityLabel={t('fc.gm_posizione', { n: pos, tot: total })}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: th.text,
                  fontSize: 26,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {pos}
                <Text style={{ color: th.text2, fontSize: 16, fontWeight: '600' }}> / {total}</Text>
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: th.text2,
                  fontSize: 11.5,
                  marginTop: 2,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {t('fc.gm_n_concetti', { conteggio: '' }).replace(/\s*$/, ' ')}
                <Text style={{ color: th.text, fontWeight: '700' }}>
                  {closed}/{total}
                </Text>
              </Text>
            </View>
          }
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ChronoPill base={playedBase} color={accent} label={t('fc.gm_durata')} />
              <IconBtn
                testID="fcg-gear"
                label={t('fcv.gs_titolo')}
                onPress={() => setSettingsOpen(true)}
              >
                <Icon d={ICONS.gear} color={th.text2} />
              </IconBtn>
              <IconBtn
                testID="fcg-voice"
                label={t('fc.vg_titolo')}
                on={voiceOn}
                accent={accent}
                onPress={() => setIntroOpen(true)}
              >
                <Icon d={ICONS.mic} color={voiceOn ? '#fff' : th.text2} />
              </IconBtn>
            </View>
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 30,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {record >= 3 && streak.current > record ? (
          <Text
            testID="fcg-record"
            style={{ color: th.green, fontWeight: '700', textAlign: 'center', marginBottom: 14 }}
          >
            {t('fcv.gj_record_combo', { n: streak.current })}
          </Text>
        ) : null}

        {/* il padre sopra i suoi sottoconcetti (.card-title-header) */}
        {father && current?.isChild ? (
          <View
            style={{
              paddingTop: 10,
              paddingHorizontal: 4,
              paddingBottom: 14,
              marginBottom: 14,
              borderBottomWidth: 1.5,
              borderBottomColor: th.hairline,
            }}
          >
            <DocView testID="fcg-father" raw={father.question} size={18} />
          </View>
        ) : null}

        {current ? (
          <SwipeCard
            s={sw}
            enabled={shown}
            onCross={() => haptic.tap()}
            onCommit={(good) => vote(current, good ? 'correct' : 'wrong', true)}
          >
            <GameCard
              gold={kit.isFavorite(current.target)}
              top={streak.current >= 2 ? <StreakPill n={streak.current} /> : null}
            >
              <CornerFab
                testID="fcg-favorite"
                label={t('fc.gm_preferiti')}
                side="left"
                gold={kit.isFavorite(current.target)}
                onPress={() => {
                  kit.setFavorite(current.target, current.isChild, !kit.isFavorite(current.target));
                  haptic.tap();
                  refresh();
                }}
              >
                <Icon
                  d={ICONS.star}
                  size={16}
                  color={kit.isFavorite(current.target) ? '#fff' : th.text2}
                  fill={kit.isFavorite(current.target)}
                  width={2}
                />
              </CornerFab>
              <CornerFab
                testID="fcg-edit"
                label={t('comune.modifica')}
                side="right"
                onPress={() => openEdit(current)}
              >
                <Icon d={ICONS.pencil} size={16} color={th.text2} />
              </CornerFab>
              <LevelBadge
                level={games.levelOfCard(current.target, current.isChild)}
                label={t(`fcv.liv_${games.levelOfCard(current.target, current.isChild)}`)}
              />
              {items.length > 1 ? (
                <CardTitle label={label(current)} child={current.isChild} />
              ) : (
                <View style={{ height: 38 }} />
              )}

              {/* la domanda (.q-section) */}
              <SectionTitle {...sideTag(current, 'q')} />
              <CardImage testID="fcg-question-image" name={current.questionImage} zoom />
              <CardAudio testID="fcg-question-audio" name={current.questionAudio} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DocView
                    testID="fcg-question"
                    raw={current.question}
                    size={big(current) ? 28 : 19}
                    weight={big(current) ? '700' : undefined}
                  />
                </View>
                {current.questionVoice && localPrefs.fcReadMode !== 'no' ? (
                  <SpeakButton
                    testID="fcg-speak-question"
                    text={current.question ?? ''}
                    lang={current.questionVoice.lang}
                    once={current.questionVoice.once}
                    look="square"
                    accent={accent}
                  />
                ) : null}
              </View>

              {/* il posto della risposta (.fcv-slot): velato finché non lo si tocca */}
              <View style={{ marginTop: 16 }}>
                {shown ? (
                  <AnswerSlot
                    testID="fcg-answer-slot"
                    label={<SectionTitle {...sideTag(current, 'a')} tight />}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <DocView
                          testID="fcg-answer"
                          raw={current.answer}
                          size={big(current) ? 30 : 17}
                          weight={big(current) ? '800' : undefined}
                        />
                      </View>
                      {current.answerVoice && localPrefs.fcReadMode !== 'no' ? (
                        <SpeakButton
                          testID="fcg-speak-answer"
                          text={current.answer ?? ''}
                          lang={current.answerVoice.lang}
                          once={current.answerVoice.once}
                          look="square"
                          accent={accent}
                        />
                      ) : null}
                    </View>
                    <CardImage testID="fcg-answer-image" name={current.answerImage} zoom />
                    <CardAudio testID="fcg-answer-audio" name={current.answerAudio} />
                  </AnswerSlot>
                ) : (
                  <RevealVeil
                    testID="fcg-reveal"
                    label={<SectionTitle {...sideTag(current, 'a')} tight />}
                    text={t('fc.gm_tocca_rivela')}
                    a11y={t('fc.gm_mostra_risposta')}
                    onPress={() => {
                      haptic.tap();
                      setShown(true);
                    }}
                  />
                )}
              </View>

              {kit.vocab ? hintBlock(current) : null}

              {shown ? (
                <GradeRow
                  wrongLabel={t('fc.vg_sbagliato')}
                  rightLabel={t('fc.res_corretto')}
                  learntLabel={t('fc.gm_imparato')}
                  learnt={false}
                  onWrong={() => vote(current, 'wrong')}
                  onRight={() => vote(current, 'correct')}
                  onLearnt={() => vote(current, 'learnt')}
                />
              ) : null}
            </GameCard>
          </SwipeCard>
        ) : father ? (
          <GameCard gold={false}>
            <DocView testID="fcg-question" raw={father.question} size={19} />
            {father.play.user_answer !== 'Titolo' ? (
              <View style={{ marginTop: 16 }}>
                <AnswerSlot label={<SectionTitle {...sideTag(father, 'a')} tight />}>
                  <DocView testID="fcg-answer" raw={father.answer} size={17} />
                </AnswerSlot>
              </View>
            ) : null}
          </GameCard>
        ) : null}

        {/* le carte già votate di questa posizione: il verdetto si può cambiare */}
        {items.length > 1 || allAnswered ? (
          <View style={{ gap: 8, marginTop: 16 }}>
            {items.map((it) => {
              const st = stateOf(it.play.user_answer);
              const voted = st === 'correct' || st === 'wrong';
              if (!voted && st !== 'seen') return null;
              return (
                <View
                  key={it.play.uuid}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: th.surface,
                    borderWidth: 0.5,
                    borderColor: th.hairline,
                  }}
                >
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
                          st === 'correct' ? 'wrong' : 'correct',
                        );
                        refresh();
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 11,
                        backgroundColor: st === 'correct' ? th.greenSoft : th.redSoft,
                      }}
                    >
                      <Text
                        style={{
                          color: st === 'correct' ? th.green : th.red,
                          fontSize: 13.5,
                          fontWeight: '800',
                        }}
                      >
                        {st === 'correct' ? '✓' : '✕'}{' '}
                        {t(st === 'correct' ? 'fc.lbl_corretto' : 'fc.lbl_errato')}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: th.text2, fontSize: 13 }}>{t('fc.gm_solo_vista')}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* «‹ Indietro» e, a posizione finita, «Avanti ›» (.nav-row) */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 10,
            marginTop: 22,
            marginBottom: 4,
          }}
        >
          {pos > 1 ? (
            <NavPill testID="fcg-back" label={t('comune.indietro')} onPress={() => go(pos - 1)} />
          ) : null}
          {allAnswered ? (
            <NavPill
              testID="fcg-next"
              label={t('fc.gm_avanti')}
              forward
              onPress={() => go(pos + 1)}
            />
          ) : null}
        </View>

        {/* «Concludi» (#end-game-section) con la conferma arancione (.card-warn) */}
        <View
          style={{
            marginTop: 26,
            paddingTop: 18,
            borderTopWidth: 0.5,
            borderTopColor: th.hairline,
          }}
        >
          {confirming ? (
            <View
              style={{ backgroundColor: th.orangeSoft, borderRadius: 18, padding: 16, gap: 10 }}
            >
              <Text style={{ color: th.orange, fontSize: 14.5, fontWeight: '700' }}>
                {t('fc.gm_conferma_concludi')}
              </Text>
              <WideButton
                testID="fcg-conclude-yes"
                label={t('fc.gm_si_risultati')}
                tone="red"
                onPress={finish}
              />
              <NavPill
                testID="fcg-conclude-no"
                label={t('fc.gm_no_continua')}
                onPress={() => setConfirming(false)}
              />
            </View>
          ) : (
            <WideButton
              testID="fcg-conclude"
              label={t('fc.gm_concludi')}
              onPress={() => setConfirming(true)}
            />
          )}
          <Pressable
            testID="fcg-close"
            accessibilityRole="button"
            accessibilityLabel={t('comune.chiudi')}
            onPress={() => {
              games.saveCombo(game);
              router.back();
            }}
            style={{ alignSelf: 'center', marginTop: 18, padding: 8 }}
          >
            <Text style={{ color: th.text3, fontSize: 14, fontWeight: '600' }}>
              {t('comune.chiudi')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <SwipeOverlay s={sw} />
      <AutoReader
        on={localPrefs.fcReadMode === 'auto' && !voiceOn && !ck}
        id={voiceKey}
        parts={voiceScript}
      />
      <ToastHost toast={toasts.toast} top={insets.top + 56} />
      {/* con una pausa aperta i coriandoli li disegna il suo foglio, non questo strato */}
      {ck ? null : <Confetti bursts={fx.bursts} onDone={fx.done} />}

      {ck ? (
        <>
          <CheckpointSheet
            visible={ck.phase === 'sheet'}
            due={ck.due}
            count={ck.count}
            summary={ck.summary}
            bestStreak={ck.bestStreak}
            records={ck.records}
            labelOf={(target, isChild, position) => kit.label(game, position, target, isChild)}
            bursts={fx.bursts}
            onBurstDone={fx.done}
            onContinue={proceed}
            onBoss={() => {
              sound('tap');
              setCk({ ...ck, phase: 'boss' });
            }}
          />
          <BossSheet
            visible={ck.phase === 'boss'}
            cards={ck.cards}
            vocab={kit.vocab}
            bursts={fx.bursts}
            onBurstDone={fx.done}
            onRight={(got) => {
              sound('right', got + 2);
              haptic.tap();
            }}
            onWrong={() => {
              sound('wrong');
              haptic.warning();
            }}
            onFinish={(got, n) => {
              if (got === n) {
                sound('boss');
                haptic.success();
                fx.fire(170);
              } else sound('checkpoint');
            }}
            onClose={proceed}
            onPhase={onBossPhase}
            onControl={onBossControl}
          />
        </>
      ) : null}
      <VoiceLayer
        active={voiceOn}
        phase={voicePhase}
        vocab={kit.vocab}
        expected={kit.vocab && current && !shown ? answerVariants(current.answer ?? '') : []}
        cardKey={current?.play.uuid ?? ck?.due.k.toString() ?? ''}
        scriptKey={voiceKey}
        script={voiceScript}
        lang={voiceLang}
        hint={voiceHint}
        onAction={onVoice}
        onStop={() => setVoiceOn(false)}
        onOpen={() => setIntroOpen(true)}
      />
      <VoiceIntroSheet
        visible={introOpen}
        active={voiceOn}
        vocab={kit.vocab}
        onStart={() => {
          setIntroOpen(false);
          setVoiceOn(true);
        }}
        onStop={() => {
          setIntroOpen(false);
          setVoiceOn(false);
        }}
        onClose={() => setIntroOpen(false)}
      />
      <ErrorsSheet
        visible={errorsRange !== null}
        from={errorsRange?.[0] ?? 0}
        to={errorsRange?.[1] ?? 0}
        rows={errorRows}
        onClose={() => setErrorsRange(null)}
      />
      <GameSettingsSheet
        visible={settingsOpen}
        vocab={kit.vocab}
        onClose={() => setSettingsOpen(false)}
      />
    </View>
  );
}
