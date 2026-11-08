import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { cardAudioUrl } from './media';

/** Il lettore vero: nasce solo quando si tocca il tasto, così una lista di carte non apre un lettore per carta. */
function Playing({ uri, onEnd }: { uri: string; onEnd: () => void }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    // con l'interruttore del silenzioso su iPhone una registrazione deve comunque sentirsi
    void setAudioModeAsync({ playsInSilentMode: true })
      .catch(() => undefined)
      .then(() => player.play());
  }, [player]);
  useEffect(() => {
    if (status.didJustFinish) onEnd();
  }, [status.didJustFinish, onEnd]);
  return null;
}

/**
 * Il tasto «ascolta» di un audio registrato su una carta (cartella `flashcard_audio` del sito). Un secondo tocco mentre
 * suona lo ferma. Senza un nome valido non disegna niente. L'audio si scarica da internet (non è ancora nella coda dei file).
 */
export function CardAudio({
  name,
  localUri,
  testID,
  size = 22,
}: {
  name: string | null | undefined;
  /** una registrazione ancora sul telefono, non ancora sul sito: suona questa */
  localUri?: string | null;
  testID?: string;
  size?: number;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [on, setOn] = useState(false);
  const uri = localUri || cardAudioUrl(name);
  if (!uri) return null;
  const color = on ? th.brand : th.text2;
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t('fcv.ascolta')}
        accessibilityState={{ selected: on }}
        hitSlop={10}
        onPress={() => setOn(!on)}
        style={{ padding: 4 }}
      >
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={on ? color : 'none'}
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {on ? <Rect x={6} y={6} width={12} height={12} rx={2} /> : <Path d="M7 4.5v15l12-7.5z" />}
        </Svg>
      </Pressable>
      {on ? <Playing uri={uri} onEnd={() => setOn(false)} /> : null}
    </>
  );
}
