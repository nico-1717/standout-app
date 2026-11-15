import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/ui/CappedText';

/** Il pallino del profilo: sfumatura blu-viola con un filo bianco e l'iniziale (.standout-fab-avatar del sito). */
export function Avatar(p: {
  letter: string;
  onPress: () => void;
  label: string;
  testID?: string;
  size?: number;
}) {
  const size = p.size ?? 34;
  return (
    <Pressable
      testID={p.testID ?? 'avatar'}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 3px 10px rgba(0,0,0,.16)',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="avatarFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#5B8DEF" />
              <Stop offset="1" stopColor="#A78BFA" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size} height={size} fill="url(#avatarFill)" />
        </Svg>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.41, fontWeight: '800' }}>{p.letter}</Text>
    </Pressable>
  );
}
