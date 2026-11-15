import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

/** I tasti tondi del sito (.pomo-btn-icon): un simbolo, nessuna parola (la parola sta nell'etichetta per il lettore di schermo). */
export function RoundButton({
  kind,
  testID,
  label,
  onPress,
  large = false,
}: {
  kind: 'play' | 'pause' | 'stop';
  testID: string;
  label: string;
  onPress: () => void;
  large?: boolean;
}) {
  const th = useTheme();
  const size = large ? 76 : 62;
  const fill = kind === 'play' ? th.brand : kind === 'stop' ? th.redSoft : th.surface2;
  const ink = kind === 'play' ? '#FFFFFF' : kind === 'stop' ? th.red : th.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fill,
        boxShadow:
          kind === 'play' ? `0 12px 26px -12px ${th.brand}` : `inset 0 0 0 0.5px ${th.hairline}`,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Svg width={large ? 30 : 24} height={large ? 30 : 24} viewBox="0 0 24 24">
        {kind === 'play' ? (
          <Path
            d="M8.4 5.2a1 1 0 0 1 1.53-.85l8.2 5.15a1 1 0 0 1 0 1.7l-8.2 5.15a1 1 0 0 1-1.53-.85z"
            fill={ink}
            transform="translate(-0.6 1)"
          />
        ) : kind === 'pause' ? (
          <Path d="M8 5v14M16 5v14" stroke={ink} strokeWidth={3.2} strokeLinecap="round" />
        ) : (
          <Path d="M7 7h10v10H7z" fill={ink} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        )}
      </Svg>
    </Pressable>
  );
}
