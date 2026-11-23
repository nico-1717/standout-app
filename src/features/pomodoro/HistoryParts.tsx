import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Text } from '@/ui/CappedText';
import { useTheme } from '@/core/theme/ThemeProvider';

/** I disegni dei tondi in cima al popup dello storico: gli stessi del sito (pomodoro_storico.php). */
const ICONS = {
  select:
    '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  import:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  export:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 9l5-5 5 5"/><path d="M12 4v12"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
} as const;

export type HistIcon = keyof typeof ICONS;

const svg = (name: HistIcon, color: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

/** Il tondo da 30 px del sito (.ph-icon-btn): sfondo chiaro, icona piccola; acceso diventa del colore dell'app. */
export function HistBtn(p: {
  icon: HistIcon;
  label: string;
  onPress: () => void;
  testID: string;
  active?: boolean;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ selected: !!p.active }}
      onPress={p.onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: p.active ? th.brand : th.surface2,
        transform: [{ scale: pressed ? 0.88 : 1 }],
      })}
    >
      <SvgXml
        xml={svg(p.icon, p.active ? '#FFFFFF' : th.text2)}
        width={p.icon === 'close' ? 14 : 15}
        height={p.icon === 'close' ? 14 : 15}
      />
    </Pressable>
  );
}

/** Il segmento dei filtri (.ph-filter-chip): pastiglia piena, accesa del colore dell'app. */
export function HistChip(p: { label: string; on: boolean; onPress: () => void; testID: string }) {
  const th = useTheme();
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityState={{ selected: p.on }}
      onPress={p.onPress}
      style={({ pressed }) => ({
        paddingVertical: 8,
        paddingHorizontal: 13,
        borderRadius: 20,
        backgroundColor: p.on ? th.brand : th.surface2,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Text
        numberOfLines={1}
        style={{ color: p.on ? '#FFFFFF' : th.text, fontSize: 12.5, fontWeight: '700' }}
      >
        {p.label}
      </Text>
    </Pressable>
  );
}

/** Il tondo pieno vuoto per tenere insieme una riga di tondi (spaziatura come .ph-head-btns). */
export function HistBtnRow(p: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{p.children}</View>;
}
