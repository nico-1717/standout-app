import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { SvgXml } from 'react-native-svg';
import { haptic } from '@/ui/motion';

export type Tool = 'paint' | 'erase' | 'look';

/** Le icone della barra: le Tabler (contorno, tratto 2) che ho mostrato nella proposta. */
const TB = {
  brush: [
    'M3 21v-4a4 4 0 1 1 4 4h-4',
    'M21 3a16 16 0 0 0 -12.8 10.2',
    'M21 3a16 16 0 0 1 -10.2 12.8',
    'M10.6 9a9 9 0 0 1 4.4 4.4',
  ],
  eraser: [
    'M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3',
    'M18 13.3l-6.3 -6.3',
  ],
  eye: [
    'M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0',
    'M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6',
  ],
  events: [
    'M11 21h-5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v3.5',
    'M16 3v4',
    'M8 3v4',
    'M4 11h11',
    'M17.8 20.817l-2.172 1.138a.392 .392 0 0 1 -.568 -.41l.415 -2.411l-1.757 -1.707a.389 .389 0 0 1 .217 -.665l2.428 -.352l1.086 -2.193a.392 .392 0 0 1 .702 0l1.086 2.193l2.428 .352a.39 .39 0 0 1 .217 .665l-1.757 1.707l.414 2.41a.39 .39 0 0 1 -.567 .411l-2.172 -1.138',
  ],
  undo: ['M9 14l-4 -4l4 -4', 'M5 10h11a4 4 0 1 1 0 8h-1'],
  spark: [
    'M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6',
  ],
} as const;
type DockIcon = keyof typeof TB;

function Ico(p: { name: DockIcon; color: string; size?: number }) {
  const size = p.size ?? 20;
  const body = TB[p.name].map((d) => `<path d="${d}"/>`).join('');
  return (
    <SvgXml
      xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${p.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`}
      width={size}
      height={size}
    />
  );
}

const TOOLS: { id: Tool; icon: DockIcon; key: string }[] = [
  { id: 'paint', icon: 'brush', key: 'piano.evidenzia' },
  { id: 'erase', icon: 'eraser', key: 'piano.cancella' },
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
            <Ico name={x.icon} color={p.tool === x.id ? th.text : th.text2} />
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
        <Ico name="events" color={p.showEvents ? '#FF9F0A' : th.text} />
      </Pressable>
      <Pressable
        testID="cal-undo"
        accessibilityRole="button"
        accessibilityLabel={t('piano.annulla')}
        disabled={!p.canUndo}
        onPress={p.onUndo}
        style={[round(false), { opacity: p.canUndo ? 1 : 0.28 }]}
      >
        <Ico name="undo" color={th.text} />
      </Pressable>
      <Pressable
        testID="cal-autoplan"
        accessibilityRole="button"
        accessibilityLabel={t('piano.pianifica_breve')}
        onPress={p.onAutoplan}
        style={[round(false), { marginLeft: 2, backgroundColor: th.blueSoft }]}
      >
        <Ico name="spark" color={th.brand} />
      </Pressable>
    </View>
  );
}
