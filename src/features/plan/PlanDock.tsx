import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PjIcon, type PjIconName } from '@/features/projects/PjIcons';
import { haptic } from '@/ui/motion';

export type Tool = 'paint' | 'erase' | 'look';

const TOOLS: { id: Tool; icon: PjIconName; key: string }[] = [
  { id: 'paint', icon: 'brush', key: 'piano.evidenzia' },
  { id: 'erase', icon: 'erase', key: 'piano.cancella' },
  { id: 'look', icon: 'eye', key: 'piano.guarda' },
];

/**
 * La barra del calendario come sul sito (`.pp-dock`): una pastiglia di vetro con i tre strumenti in un selettore
 * (evidenzia, cancella, guarda), gli eventi importanti, annulla, e «Pianifica per me». Il sito la sfuoca con il
 * backdrop-filter; qui senza libreria nativa in più il vetro è una tinta quasi piena.
 */
export function PlanDock(p: {
  tool: Tool;
  onTool: (t: Tool) => void;
  showEvents: boolean;
  onEvents: () => void;
  canUndo: boolean;
  onUndo: () => void;
  onAutoplan: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const dark = th.scheme === 'dark';
  const round = (on: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: on ? th.surface : 'transparent',
  });
  return (
    <View
      testID="cal-dock"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 5,
        borderRadius: 999,
        maxWidth: 440,
        width: '100%',
        backgroundColor: dark ? 'rgba(44,44,46,.94)' : 'rgba(255,255,255,.92)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: th.hairline2,
        boxShadow: '0 8px 24px -8px rgba(0,0,0,.30)',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          padding: 2,
          borderRadius: 999,
          backgroundColor: dark ? 'rgba(235,235,245,.10)' : 'rgba(28,28,30,.07)',
        }}
      >
        {TOOLS.map((x) => (
          <Pressable
            key={x.id}
            testID={`cal-tool-${x.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: p.tool === x.id }}
            accessibilityLabel={t(x.key)}
            onPress={() => {
              haptic.select();
              p.onTool(x.id);
            }}
            style={round(p.tool === x.id)}
          >
            <PjIcon
              name={x.icon}
              color={p.tool === x.id ? th.text : th.text2}
              size={18}
              width={2}
            />
          </Pressable>
        ))}
      </View>
      <Pressable
        testID="cal-events"
        accessibilityRole="button"
        accessibilityState={{ selected: p.showEvents }}
        accessibilityLabel={t('piano.eventi_btn')}
        onPress={p.onEvents}
        style={round(p.showEvents)}
      >
        <PjIcon name="events" color={p.showEvents ? th.brand : th.text} size={18} width={1.8} />
      </Pressable>
      <Pressable
        testID="cal-undo"
        accessibilityRole="button"
        accessibilityLabel={t('piano.annulla')}
        disabled={!p.canUndo}
        onPress={p.onUndo}
        style={[round(false), { opacity: p.canUndo ? 1 : 0.28 }]}
      >
        <PjIcon name="undo" color={th.text} size={18} width={2} />
      </Pressable>
      <Pressable
        testID="cal-autoplan"
        accessibilityRole="button"
        onPress={p.onAutoplan}
        style={{
          flex: 1,
          minWidth: 0,
          height: 36,
          borderRadius: 18,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: th.brand,
        }}
      >
        <PjIcon name="spark" color="#FFFFFF" size={16} width={1.9} />
        <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
          {t('piano.pianifica_breve')}
        </Text>
      </Pressable>
    </View>
  );
}
