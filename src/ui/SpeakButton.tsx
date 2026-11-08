import { useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { speak, stopSpeaking } from '@/core/speech/speak';
import { useTheme } from '@/core/theme/ThemeProvider';

/**
 * Il tasto «ascolta» (fcv.ascolta): dice `text` nella lingua `lang` («en-GB») con la voce del telefono.
 * `once` = una volta sola (frasi e traduzioni); senza, la parola si dice due volte, la seconda più lenta.
 * Un secondo tocco mentre parla lo ferma.
 */
export function SpeakButton({
  text,
  lang,
  once = false,
  testID,
  size = 20,
}: {
  text: string;
  lang: string;
  once?: boolean;
  testID?: string;
  size?: number;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [on, setOn] = useState(false);
  if (!text.trim()) return null;
  const color = on ? th.brand : th.text2;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('fcv.ascolta')}
      accessibilityState={{ selected: on }}
      hitSlop={10}
      onPress={() => {
        if (on) {
          stopSpeaking();
          setOn(false);
          return;
        }
        setOn(true);
        void speak(text, lang, { once, done: () => setOn(false) });
      }}
      style={{ padding: 4 }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M11 5 6 9H2v6h4l5 4z" />
        <Path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <Path d="M18.8 5.2a9.5 9.5 0 0 1 0 13.6" />
      </Svg>
    </Pressable>
  );
}
