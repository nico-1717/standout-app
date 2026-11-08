import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { keepFile } from '@/core/media/phoneFiles';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardAudio } from '@/features/flashcards/CardAudio';

import { Recorder } from './AudioField';

/**
 * Il suono di una carta che ancora non c'è (la pagina «Inserisci»): si registra e si ascolta, e il file resta sul
 * telefono finché la carta non viene creata; allora parte con la coda dei file. `uri` = la registrazione scelta.
 */
export function DraftAudioField({
  uri,
  onChange,
  label,
  testID,
}: {
  uri: string | null | undefined;
  onChange: (uri: string | null) => void;
  label: string;
  testID: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [failed, setFailed] = useState(false);

  if (recording)
    return (
      <Recorder
        onDone={(file) => {
          setRecording(false);
          if (!file) setFailed(true);
          else onChange(keepFile(file, 'm4a'));
        }}
      />
    );

  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
      {uri ? (
        <>
          <CardAudio testID={`${testID}-play`} name={null} localUri={uri} />
          <Pressable
            testID={`${testID}-remove`}
            accessibilityRole="button"
            accessibilityLabel={`${t('fc.ibf_elimina_audio')}: ${label}`}
            onPress={() => onChange(null)}
            hitSlop={8}
          >
            <Text style={{ color: th.red, fontSize: 13 }}>✕</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          testID={`${testID}-record`}
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            setRecording(true);
          }}
          hitSlop={6}
        >
          <Text style={{ color: th.brand, fontSize: 13 }}>🎙 {label}</Text>
        </Pressable>
      )}
      {failed ? (
        <Text testID={`${testID}-error`} style={{ color: th.red, fontSize: 12 }}>
          {t('fc.ifc_no_microfono')}
        </Text>
      ) : null}
    </View>
  );
}
