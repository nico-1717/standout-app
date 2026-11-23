import { Pressable, StyleSheet, View } from 'react-native';
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
        alignSelf: 'center',
        gap: 2,
        padding: 4,
        borderRadius: 999,
        backgroundColor: dark ? 'rgba(44,44,46,.94)' : 'rgba(255,255,255,.92)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: th.hairline2,
        boxShadow: '0 6px 18px -8px rgba(0,0,0,.24)',
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
      <View
        style={{
          width: StyleSheet.hairlineWidth,
          height: 16,
          marginHorizontal: 5,
          backgroundColor: th.hairline2,
        }}
      />
      <Pressable
        testID="cal-events"
        accessibilityRole="button"
        accessibilityState={{ selected: p.showEvents }}
        accessibilityLabel={t('piano.eventi_btn')}
        onPress={p.onEvents}
        style={[round(false), p.showEvents ? { backgroundColor: 'rgba(255,159,10,.24)' } : null]}
      >
        <PjIcon name="events" color={p.showEvents ? '#FF9F0A' : th.text} size={18} width={1.8} />
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
        accessibilityLabel={t('piano.pianifica_breve')}
        onPress={p.onAutoplan}
        style={[round(false), { marginLeft: 2, backgroundColor: th.blueSoft }]}
      >
        <PjIcon name="spark" color={th.brand} size={18} width={1.9} />
      </Pressable>
    </View>
  );
}
