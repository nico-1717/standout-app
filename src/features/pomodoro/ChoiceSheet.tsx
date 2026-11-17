import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';

import { titleStyle } from '@/ui/kit';

export type ChoiceIcon = 'play' | 'pause' | 'stop' | 'trash' | 'back' | 'down';

/** Le icone dei tasti della scelta (IC_PLAY, IC_PAUSA, IC_STOP, IC_CESTINO, IC_INDIETRO di pomodoro.php). */
function Icon({ name, color }: { name: ChoiceIcon; color: string }) {
  const line = {
    stroke: color,
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      {name === 'play' ? (
        <Path
          d="M8 5.14v13.72a1 1 0 0 0 1.53.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z"
          fill={color}
        />
      ) : null}
      {name === 'pause' ? (
        <>
          <Rect x={6} y={5} width={4} height={14} rx={1.2} fill={color} />
          <Rect x={14} y={5} width={4} height={14} rx={1.2} fill={color} />
        </>
      ) : null}
      {name === 'stop' ? <Rect x={6} y={6} width={12} height={12} rx={2.4} fill={color} /> : null}
      {name === 'trash' ? (
        <>
          <Path d="M4 7h16" {...line} />
          <Path d="M9 7V5h6v2" {...line} />
          <Path d="M6 7l1 13h10l1-13" {...line} />
        </>
      ) : null}
      {name === 'down' ? (
        <>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...line} />
          <Path d="M7 10l5 5 5-5" {...line} />
          <Path d="M12 15V3" {...line} />
        </>
      ) : null}
      {name === 'back' ? <Path d="m15 18-6-6 6-6" {...line} strokeWidth={2.6} /> : null}
    </Svg>
  );
}

export interface ChoiceOption {
  /** va nel testID: `<testID>-<key>` */
  key: string;
  label: string;
  icon: ChoiceIcon;
  primary?: boolean;
}

/**
 * La scelta a popup del Pomodoro (`showChoice` di pomodoro.php): un titolo, due righe di spiegazione e tasti a tutta
 * larghezza, il primo in evidenza. Toccare fuori la chiude senza decidere (`onChoose(null)`): il timer resta com'è.
 */
export function ChoiceSheet(p: {
  title: string;
  text: string;
  options: ChoiceOption[];
  accent: string;
  testID: string;
  onChoose: (key: string | null) => void;
}) {
  const th = useTheme();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => p.onChoose(null)}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable
          testID={`${p.testID}-veil`}
          accessibilityRole="button"
          accessibilityLabel={p.title}
          onPress={() => p.onChoose(null)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,.5)',
          }}
        />
        <View
          testID={p.testID}
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 20,
            gap: 10,
            borderRadius: 24,
            backgroundColor: th.surface,
            boxShadow: '0 24px 60px -20px rgba(0,0,0,.6)',
          }}
        >
          <Text style={[{ color: th.text, textAlign: 'center' }, titleStyle(th, 19, '700')]}>
            {p.title}
          </Text>
          <Text
            style={{
              color: th.text2,
              textAlign: 'center',
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 6,
            }}
          >
            {p.text}
          </Text>
          {p.options.map((o): ReactNode => {
            const ink = o.primary ? '#fff' : th.text;
            return (
              <Pressable
                key={o.key}
                testID={`${p.testID}-${o.key}`}
                accessibilityRole="button"
                onPress={() => p.onChoose(o.key)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  minHeight: 50,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                  backgroundColor: o.primary ? p.accent : th.surface2,
                  boxShadow: o.primary ? undefined : `inset 0 0 0 0.5px ${th.hairline}`,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Icon name={o.icon} color={ink} />
                <Text style={{ color: ink, fontSize: 16, fontWeight: '700' }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

/** L'avviso breve in basso («Sessione salvata»): `show` lo accende, sparisce da solo dopo due secondi. */
export function useToast(bottom: number): { node: ReactNode; show: (text: string) => void } {
  const th = useTheme();
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string) => {
    setText(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(''), 2200);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const node = text ? (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 24, right: 24, bottom, alignItems: 'center' }}
    >
      <View
        testID="pomodoro-toast"
        style={{
          paddingVertical: 11,
          paddingHorizontal: 18,
          borderRadius: 999,
          backgroundColor: th.text,
          boxShadow: '0 10px 26px -10px rgba(0,0,0,.5)',
        }}
      >
        <Text style={{ color: th.bg, fontSize: 14, fontWeight: '700' }}>{text}</Text>
      </View>
    </View>
  ) : null;
  return { node, show };
}
