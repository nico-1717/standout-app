import { Pressable, Text } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

/**
 * Il tasto del microfono (dettatura). Acceso = sta ascoltando: si colora e si legge anche dallo stato per chi usa
 * VoiceOver/TalkBack. Il colore di fondo di un tasto spento è quello della superficie, così sta bene in ogni stile.
 */
export function MicButton({
  active,
  onPress,
  label,
  testID = 'mic-button',
  size = 40,
  tint,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  testID?: string;
  size?: number;
  /** il colore del tasto acceso (di solito l'accento della pagina) */
  tint?: string;
}) {
  const th = useTheme();
  const on = tint ?? th.red;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? on : th.surface2,
      }}
    >
      <Text style={{ fontSize: size * 0.48 }}>{active ? '⏹️' : '🎙️'}</Text>
    </Pressable>
  );
}
