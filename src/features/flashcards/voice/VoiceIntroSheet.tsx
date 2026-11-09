import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { VOICE_LANGS } from '@/core/settings/localPrefs';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
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

  const row = (intent: string, desc: string) => (
    <View key={intent} style={{ gap: 2 }}>
      <Text style={{ color: ht.text, fontWeight: '700' }}>“{commandExample(lang, intent)}”</Text>
      <Text style={{ color: ht.text2, fontSize: 13 }}>{t(desc)}</Text>
    </View>
  );

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
        <Text style={{ color: ht.text }}>{t('fc.vg_intro')}</Text>
        {vocab ? <Text style={{ color: ht.text2 }}>{t('fc.vg_parole_nota')}</Text> : null}
        <Text style={{ color: ht.text2 }}>{t('fc.vg_auto_avanti')}</Text>

        <View style={{ gap: 10 }}>
          <Text style={{ color: ht.text, fontWeight: '800', fontSize: 16 }}>
            {t('fc.vg_per_rispondere')}
          </Text>
          {row('risposta', 'fc.vg_d_risposta')}
          {row('corretto', 'fc.vg_d_corretto')}
          {row('errato', 'fc.vg_d_errato')}
        </View>
        <View style={{ gap: 10 }}>
          <Text style={{ color: ht.text, fontWeight: '800', fontSize: 16 }}>
            {t('fc.vg_mentre_ascolti')}
          </Text>
          {row('ripeti', 'fc.vg_d_ripeti')}
        </View>
        <View style={{ gap: 10 }}>
          <Text style={{ color: ht.text, fontWeight: '800', fontSize: 16 }}>
            {t('fc.vg_ck_titolo')}
          </Text>
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
