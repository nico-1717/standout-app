/**
 * I pezzi grafici della pagina di una categoria, ricalcati da fc_view.php / fc_view.css del sito:
 * icone a tratto, bottoni tondi, pillola-testata, etichetta del livello.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Theme } from '@/core/theme/ThemeProvider';
import { rgba, shade } from '@/features/grades/ui';

import { LEVEL_COLORS, type Level } from './levels';

const PATHS = {
  gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4.5v15l12.5-7.5z',
  search: 'M21 21l-4.3-4.3',
  home: 'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  chev: 'M9 6l6 6-6 6',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  check: 'M20 6L9 17l-5-5',
  sort: 'M7 4v16M3 8l4-4 4 4M17 20V4m-4 12l4 4 4-4',
  note: 'M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 3v5h6',
  close: 'M18 6L6 18M6 6l12 12',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  card: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16',
  pencil: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
} as const;

export type GlyphName = keyof typeof PATHS;

/** Un'icona a tratto 24×24 come quelle del sito. */
export function Glyph({
  name,
  size = 18,
  color,
  stroke = 2,
  fill,
}: {
  name: GlyphName;
  size?: number;
  color: string;
  stroke?: number;
  fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'search' ? (
        <Circle cx={11} cy={11} r={7} fill="none" stroke={color} strokeWidth={stroke} />
      ) : null}
      {name === 'gear' ? (
        <Circle cx={12} cy={12} r={3} fill="none" stroke={color} strokeWidth={stroke} />
      ) : null}
      <Path
        d={PATHS[name]}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill ?? 'none'}
      />
    </Svg>
  );
}

/** I tre colori di una categoria: chiaro, vero e scuro (la sfumatura della pillola e dei tasti). */
export const catTones = (color: string) => ({
  light: shade(color, 14),
  color,
  dark: shade(color, -18),
  soft: rgba(color, 0.13),
  line: rgba(color, 0.4),
});
export type CatTones = ReturnType<typeof catTones>;

/** Il tasto tondo dell'intestazione (38 px, come `.icon-btn`). `tone` lo colora a sfumatura. */
export function RoundBtn({
  th,
  glyph,
  onPress,
  testID,
  label,
  tone,
  active,
  children,
}: {
  th: Theme;
  glyph?: GlyphName;
  onPress: () => void;
  testID: string;
  label: string;
  tone?: { from: string; to: string; shadow: string };
  active?: boolean;
  children?: ReactNode;
}) {
  const ink = tone ? '#fff' : active ? th.brand : th.text;
  const body = children ?? (glyph ? <Glyph name={glyph} color={ink} size={18} /> : null);
  const base: ViewStyle = {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 19,
        transform: [{ scale: pressed ? 0.9 : 1 }],
        boxShadow: tone
          ? `0 6px 14px -6px ${tone.shadow}`
          : th.scheme === 'dark'
            ? undefined
            : '0 1px 3px rgba(0,0,0,.12)',
      })}
    >
      {tone ? (
        <LinearGradient colors={[tone.from, tone.to]} style={base}>
          {body}
        </LinearGradient>
      ) : (
        <View
          style={[
            base,
            {
              backgroundColor: active ? th.brandSoft : th.surface,
              borderWidth: 0.5,
              borderColor: th.hairline,
            },
          ]}
        >
          {body}
        </View>
      )}
    </Pressable>
  );
}

/** Una pillola di testo (filtri e ordine), come `.tb-select` / `.fcv-liv-chip`. */
export function Chip({
  th,
  label,
  on,
  onPress,
  testID,
  dot,
  tone,
  style,
}: {
  th: Theme;
  label: string;
  on?: boolean;
  onPress: () => void;
  testID: string;
  dot?: string;
  tone: CatTones;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 13,
          borderRadius: 99,
          backgroundColor: on ? (dot ?? tone.color) : th.surface2,
        },
        style,
      ]}
    >
      {dot ? (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: on ? '#fff' : dot,
          }}
        />
      ) : null}
      <Text style={{ color: on ? '#fff' : th.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** L'etichetta del livello in cima a una carta (`.fcv-liv`). */
export function LevelPill({
  level,
  label,
  testID,
}: {
  level: Level;
  label: string;
  testID: string;
}) {
  const c = LEVEL_COLORS[level];
  const gold = level === 'la_sai';
  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 22,
        paddingLeft: 7,
        paddingRight: 9,
        borderRadius: 11,
        backgroundColor: gold ? undefined : rgba(c, 0.15),
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: gold ? '#1C1C1E' : c,
        }}
      />
      <Text
        style={{
          color: gold ? '#1C1C1E' : c,
          fontSize: 10.5,
          fontWeight: '800',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
  return (
    <View testID={testID} style={{ borderRadius: 11, overflow: 'hidden' }}>
      {gold ? (
        <LinearGradient
          colors={['#FFE066', '#FFC300', '#FF9F0A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </View>
  );
}
