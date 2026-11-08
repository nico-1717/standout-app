import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import type { MediaTable } from '@/core/media/mediaQueue';
import { keepFile } from '@/core/media/phoneFiles';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardAudio } from '@/features/flashcards/CardAudio';

/** Una registrazione più lunga di così si ferma da sola (il sito accetta file fino a 10 MB). */
export const MAX_RECORD_MS = 120_000;

/**
 * Il registratore vero: nasce solo quando si comincia (così una pagina non tiene il microfono). Chiede il permesso,
 * registra in m4a e quando si ferma — a mano o allo scadere del tempo — dà l'indirizzo del file. null = niente da tenere.
 */
function Recorder({ onDone }: { onDone: (uri: string | null) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const stopped = useRef(false);
  const { t } = useTranslation();
  const th = useTheme();

  const finish = (keep: boolean) => {
    if (stopped.current) return;
    stopped.current = true;
    void (async () => {
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = keep ? recorder.uri : null;
      } catch {
        /* non era partita: niente da tenere */
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
        () => undefined,
      );
      onDone(uri);
    })();
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error('no mic');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (stopped.current) return;
        recorder.record();
        timer = setTimeout(() => finish(true), MAX_RECORD_MS);
      } catch {
        stopped.current = true;
        onDone(null);
      }
    })();
    return () => {
      if (timer) clearTimeout(timer);
      // lasciando la pagina mentre registra, la registrazione si butta
      if (!stopped.current) {
        stopped.current = true;
        void Promise.resolve(recorder.stop()).catch(() => undefined);
      }
    };
    // parte una volta sola, quando nasce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable
      testID="audio-stop"
      accessibilityRole="button"
      onPress={() => finish(true)}
      style={{ paddingVertical: 6 }}
    >
      <Text style={{ color: th.red, fontSize: 15, fontWeight: '600' }}>
        ● {t('fc.app_ferma_registrazione')}
      </Text>
    </Pressable>
  );
}

/**
 * Il suono di un lato di una carta: si ascolta, si registra con il microfono (tocca per cominciare, tocca per fermare),
 * si toglie. Come per le foto, la registrazione resta sul telefono e parte verso il sito appena c'è rete.
 */
export function AudioField({
  table,
  uuid,
  slot,
  name,
  label,
  testID,
}: {
  table: MediaTable;
  uuid: string;
  slot: string;
  name: string | null | undefined;
  label: string;
  testID: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const { services, changed } = useApp();
  const [recording, setRecording] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!services) return null;

  const pending = services.media.pending(table, uuid, slot);
  const removed = pending?.op === 'delete';
  const localUri = pending?.op === 'put' ? pending.uri : null;
  const hasAudio = !removed && (!!localUri || !!name);

  const onDone = (uri: string | null) => {
    setRecording(false);
    if (!uri) {
      setFailed(true);
      return;
    }
    services.media.putFile(table, uuid, slot, keepFile(uri, 'm4a'), 'audio/mp4');
    services.scheduler.trigger(0);
    changed();
  };

  const action = (id: string, text: string, onPress: () => void, color = th.brand) => (
    <Pressable
      testID={`${testID}-${id}`}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={{ paddingVertical: 6 }}
    >
      <Text style={{ color, fontSize: 15, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );

  return (
    <View testID={testID} style={{ gap: 6 }}>
      <Text style={{ color: th.text2, fontSize: 13 }}>{label}</Text>
      {hasAudio ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CardAudio testID={`${testID}-play`} name={removed ? null : name} localUri={localUri} />
          <Text style={{ color: th.text2, fontSize: 13 }}>{t('fc.ifc_audio_pronto')}</Text>
        </View>
      ) : null}
      {pending ? (
        <Text testID={`${testID}-waiting`} style={{ color: th.text3, fontSize: 12 }}>
          {t('comune.app_foto_in_invio')}
        </Text>
      ) : null}
      {failed ? (
        <Text testID={`${testID}-error`} style={{ color: th.red, fontSize: 13 }}>
          {t('fc.ifc_no_microfono')}
        </Text>
      ) : null}
      {recording ? (
        <Recorder onDone={onDone} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 }}>
          {action('record', hasAudio ? t('fc.ifc_registra') : t('fc.ifc_tocca_registrare'), () => {
            setFailed(false);
            setRecording(true);
          })}
          {hasAudio
            ? action(
                'remove',
                t('fc.ibf_elimina_audio'),
                () => {
                  services.media.removeFile(table, uuid, slot);
                  services.scheduler.trigger(0);
                  changed();
                },
                th.red,
              )
            : null}
        </View>
      )}
    </View>
  );
}
