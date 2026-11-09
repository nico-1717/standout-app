import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  phoneEngine,
  type FatalReason,
  type ListenerState,
  type SpeechEngine,
} from '@/core/speech/recognizer';
import { speak, stopSpeaking } from '@/core/speech/speak';
import { useTheme } from '@/core/theme/ThemeProvider';

import type { VoiceAction } from './brain';
import { buildCommands, type Phase } from './commands';
import { voiceDicts } from './dicts';
import type { Segment } from './reading';
import { VoiceSession } from './session';

export interface VoiceLayerProps {
  /** la partita a voce è accesa */
  active: boolean;
  phase: Phase;
  vocab: boolean;
  /** le forme accettate della risposta (parole) */
  expected: readonly string[];
  /** la carta in gioco */
  cardKey: string;
  /** cambia quando c'è qualcosa di nuovo da leggere */
  scriptKey: string;
  script: readonly Segment[];
  /** lingua dei comandi («it-IT», «en-US», «en-GB») */
  lang: string;
  /** la riga «puoi dire…» di questa fase */
  hint: string | null;
  onAction: (a: VoiceAction) => void;
  /** si è spento (tasto ✕, permesso negato…) */
  onStop: () => void;
  /** tocco sulla barra: riapre l'introduzione con i comandi */
  onOpen: () => void;
  engine?: SpeechEngine;
}

/**
 * La partita a voce sullo schermo: accende il microfono e la lettura finché `active`, e disegna una barra in basso con
 * lo stato (ti ascolto / sto leggendo / quello che ho sentito) e cosa si può dire adesso. La logica sta in `VoiceSession`.
 */
export function VoiceLayer(props: VoiceLayerProps) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { active, lang, vocab, scriptKey } = props;
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const session = useRef<VoiceSession | null>(null);
  const [state, setState] = useState<ListenerState>('off');
  const [heard, setHeard] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [problem, setProblem] = useState<FatalReason | null>(null);

  useEffect(() => {
    if (!active) return;
    const s = new VoiceSession({
      engine: latest.current.engine ?? phoneEngine,
      speak,
      stopSpeaking,
      commands: buildCommands(voiceDicts, lang.slice(0, 2), vocab),
      lang,
      getView: () => ({
        phase: latest.current.phase,
        vocab: latest.current.vocab,
        expected: latest.current.expected,
        card: latest.current.cardKey,
      }),
      onAction: (a) => latest.current.onAction(a),
      onState: setState,
      onHeard: setHeard,
      onSpeaking: setSpeaking,
      onFatal: (why) => {
        setProblem(why);
        latest.current.onStop();
      },
    });
    session.current = s;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la richiesta del permesso è asincrona
    setProblem(null);
    void s.start();
    s.read(latest.current.script);
    return () => {
      s.stop();
      session.current = null;
      setState('off');
      setSpeaking(false);
    };
  }, [active, lang, vocab]);

  // c'è qualcosa di nuovo da leggere (altra carta, risposta mostrata, pausa…)
  const first = useRef(true);
  useEffect(() => {
    if (!active) return;
    if (first.current) {
      first.current = false;
      return;
    }
    session.current?.read(latest.current.script);
  }, [active, scriptKey]);
  useEffect(() => {
    if (!active) first.current = true;
  }, [active]);

  const still = useReducedMotion();
  const pulse = useSharedValue(1);
  const on = active && !still && state !== 'off';
  useEffect(() => {
    if (on) {
      pulse.value = withRepeat(withTiming(1.25, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [on, pulse]);
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!active && !problem) return null;
  const text = problem
    ? t(problem === 'permission' ? 'app.voce_permesso' : 'app.voce_non_supportata')
    : speaking
      ? t('app.voce_leggo')
      : state === 'hearing' && heard
        ? `“${heard}”`
        : t('app.voce_ascolto');
  const color = problem ? th.red : speaking ? th.text2 : state === 'hearing' ? th.green : th.brand;
  return (
    <View
      testID="fcg-voice-bar"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 10,
        borderRadius: 18,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: th.surface,
        borderWidth: 1,
        borderColor: th.hairline2,
        boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
      }}
    >
      <Pressable
        testID="fcg-voice-open"
        accessibilityRole="button"
        accessibilityLabel={t('fc.vg_attiva')}
        onPress={props.onOpen}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Animated.View
          style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: color }, orb]}
        />
        <View style={{ flex: 1 }}>
          <Text
            testID="fcg-voice-status"
            numberOfLines={problem ? 4 : 1}
            style={{ color: th.text, fontWeight: '600' }}
          >
            {text}
          </Text>
          {!problem && props.hint ? (
            <Text
              testID="fcg-voice-hint"
              numberOfLines={2}
              style={{ color: th.text2, fontSize: 12, marginTop: 2 }}
            >
              {props.hint}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        testID="fcg-voice-off"
        accessibilityRole="button"
        accessibilityLabel={t('fc.vg_termina')}
        hitSlop={10}
        onPress={() => {
          setProblem(null);
          props.onStop();
        }}
      >
        <Text style={{ color: th.brand, fontSize: 18 }}>✕</Text>
      </Pressable>
    </View>
  );
}
