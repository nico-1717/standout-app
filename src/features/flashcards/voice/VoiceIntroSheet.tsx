import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { VOICE_LANGS } from '@/core/settings/localPrefs';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { Icon } from '@/features/flashcards/game/GameUi';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { resolveVoiceLang, voiceDicts } from './dicts';
import { formatReading, parseReading, type Reading } from './reading';

/** La prima frase di un comando nella lingua scelta, per mostrarla come esempio. */
export function commandExample(lang: string, intent: string): string {
  const first = voiceDicts[lang.slice(0, 2)]?.[`cmd_${intent}`]?.split(',')[0];
  return first?.trim() ?? '';
}

/**
 * L'introduzione della partita a voce: come funziona, cosa si può dire, in che lingua e (nelle parole) cosa si legge.
 * «Ho capito, comincia» accende il microfono; con la voce già accesa il foglio serve a rileggere i comandi e a spegnerla.
 */
export function VoiceIntroSheet({
  visible,
  active,
  vocab,
  onStart,
  onStop,
  onClose,
}: {
  visible: boolean;
  active: boolean;
  vocab: boolean;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const { localPrefs, updateLocalPrefs } = useApp();
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  const lang = resolveVoiceLang(localPrefs.fcVoiceLang, i18n.language);
  const reading = parseReading(localPrefs.fcVoiceRead);
  const setReading = (patch: Partial<Reading>) =>
    updateLocalPrefs({ fcVoiceRead: formatReading({ ...reading, ...patch }) });

  const chip = (testID: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: on ? th.brand : ht.surface2,
      }}
    >
      <Text style={{ color: on ? '#fff' : ht.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  const group = (title: string, chips: ReturnType<typeof chip>[]) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: ht.text2, fontSize: 13 }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>
    </View>
  );

  /** Un comando (.vg-cmd-row del sito): il tondino colorato, la frase da dire e cosa fa. */
  const BADGE: Record<string, [string, string | string[]]> = {
    ripeti: [th.indigo, ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5']],
    risposta: [
      th.orange,
      [
        'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z',
        'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
      ],
    ],
    corretto: [th.green, 'M5 12.5 10 17l9-10'],
    errato: [th.red, 'M6 6l12 12M18 6 6 18'],
    continua: [th.blue, 'M9 6l6 6-6 6'],
    boss: [th.purple, 'M12 2.5 14.9 8.7l6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8Z'],
  };
  const row = (intent: string, desc: string) => {
    const [c, d] = BADGE[intent] ?? [th.brand, 'M5 12h14'];
    return (
      <View key={intent} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${c}24`,
          }}
        >
          <Icon d={d} size={17} color={c} width={2.2} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ color: ht.text, fontWeight: '800', fontSize: 15.5 }}>
            «{commandExample(lang, intent)}»
          </Text>
          <Text style={{ color: ht.text2, fontSize: 13 }}>{t(desc)}</Text>
        </View>
      </View>
    );
  };
  const groupLabel = (k: string) => (
    <Text
      style={{
        color: ht.text2,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.1,
        textTransform: 'uppercase',
      }}
    >
      {t(k)}
    </Text>
  );
  const box = { gap: 14, padding: 14, borderRadius: 18, backgroundColor: ht.surface2 } as const;
  const langName = (l: string) => (l === '' ? t('app.voce_lingua_app') : l);
  const yes = t('fc.vg_si');
  const no = t('fc.vg_no');

  return (
    <Sheet
      visible={visible}
      th={ht}
      testID="fcg-voice-intro"
      title={t('fc.vg_titolo')}
      onClose={onClose}
      footer={
        active ? (
          <View style={{ flex: 1 }}>
            <PrimaryButton testID="fcg-voice-keep" label={t('fc.vg_continua')} onPress={onClose} />
            <TextButton testID="fcg-voice-stop" label={t('fc.vg_termina')} onPress={onStop} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <PrimaryButton
              testID="fcg-voice-start"
              label={t('fc.vg_ho_capito')}
              onPress={onStart}
            />
          </View>
        )
      }
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        {/* la testa (.vg-sheet-head): il microfono in un tondo colorato e la spiegazione */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: th.purple,
              shadowOpacity: 0.5,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <LinearGradient
              colors={[th.purple, th.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <Icon
              d={[
                'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z',
                'M19 10v2a7 7 0 0 1-14 0v-2',
                'M12 19v3',
              ]}
              size={28}
              color="#fff"
              width={2.2}
            />
          </View>
          <Text style={{ color: ht.text, fontSize: 15.5, lineHeight: 22, textAlign: 'center' }}>
            {t('fc.vg_intro')}
          </Text>
        </View>
        {vocab ? <Text style={{ color: ht.text2 }}>{t('fc.vg_parole_nota')}</Text> : null}
        <Text style={{ color: ht.text2 }}>{t('fc.vg_auto_avanti')}</Text>

        <View style={box}>
          {groupLabel('fc.vg_per_rispondere')}
          {row('risposta', 'fc.vg_d_risposta')}
          {row('corretto', 'fc.vg_d_corretto')}
          {row('errato', 'fc.vg_d_errato')}
        </View>
        <View style={box}>
          {groupLabel('fc.vg_mentre_ascolti')}
          {row('ripeti', 'fc.vg_d_ripeti')}
        </View>
        <View style={box}>
          {groupLabel('fc.vg_ck_titolo')}
          {row('continua', 'fc.vg_d_continua')}
          {row('boss', 'fc.vg_d_boss')}
        </View>

        {group(
          t('fc.vg_lingua_comandi'),
          VOICE_LANGS.map((l) =>
            chip(`fcg-voice-lang-${l || 'app'}`, langName(l), localPrefs.fcVoiceLang === l, () =>
              updateLocalPrefs({ fcVoiceLang: l }),
            ),
          ),
        )}

        {vocab ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: ht.text, fontWeight: '800', fontSize: 16 }}>
              {t('fc.vg_legge_titolo')}
            </Text>
            {group(t('fc.vg_legge_domanda'), [
              chip('fcg-read-q-1', yes, reading.question, () => setReading({ question: true })),
              chip('fcg-read-q-0', no, !reading.question, () => setReading({ question: false })),
            ])}
            {group(t('fc.vg_legge_risposta'), [
              chip('fcg-read-a-1', t('fc.vg_una_volta'), reading.answerTimes === 1, () =>
                setReading({ answerTimes: 1 }),
              ),
              chip('fcg-read-a-2', t('fc.vg_due_volte'), reading.answerTimes === 2, () =>
                setReading({ answerTimes: 2 }),
              ),
            ])}
            {group(t('fc.vg_legge_significato'), [
              chip('fcg-read-m-1', yes, reading.meaning, () => setReading({ meaning: true })),
              chip('fcg-read-m-0', no, !reading.meaning, () => setReading({ meaning: false })),
            ])}
            {group(t('fc.vg_legge_esempi'), [
              chip('fcg-read-e-0', t('fc.vg_nessuno'), reading.examples === 0, () =>
                setReading({ examples: 0 }),
              ),
              chip('fcg-read-e-1', t('fc.vg_uno'), reading.examples === 1, () =>
                setReading({ examples: 1 }),
              ),
              chip('fcg-read-e-2', t('fc.vg_tutti'), reading.examples === 2, () =>
                setReading({ examples: 2 }),
              ),
            ])}
            <Text style={{ color: ht.text2, fontSize: 13 }}>{t('fc.vg_legge_nota')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
