import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

export type ToastKind = 'step' | 'record' | 'lost' | 'up' | 'down' | 'final' | 'mastered';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  sub?: string;
  /** un simbolo davanti al titolo */
  icon?: string;
}

export const TOAST_MS = 2300;

let lastId = 0;

/**
 * La coda dei richiami in cima alla partita: uno alla volta, ognuno per un paio di secondi, senza accavallarsi
 * (se ne arrivano due insieme, il secondo aspetta il suo turno).
 */
export function useToasts(): { toast: Toast | null; push: (t: Omit<Toast, 'id'>) => void } {
  const [queue, setQueue] = useState<Toast[]>([]);
  const head = queue[0] ?? null;
  const headId = head?.id ?? null;

  useEffect(() => {
    if (headId === null) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [headId]);

  const push = (t: Omit<Toast, 'id'>) => {
    lastId += 1;
    const id = lastId;
    // niente doppioni di fila (stessa frase uguale a quella in coda)
    setQueue((q) =>
      q.some((x) => x.kind === t.kind && x.title === t.title) ? q : [...q, { ...t, id }],
    );
  };
  return { toast: head, push };
}

const COLORS: Record<ToastKind, { bg: string; fg: string }> = {
  step: { bg: '#FF9F0A', fg: '#2B1700' },
  record: { bg: '#FFD60A', fg: '#2B2300' },
  lost: { bg: '#3A3A3C', fg: '#FFFFFF' },
  up: { bg: '#30D158', fg: '#04230D' },
  down: { bg: '#FF9F0A', fg: '#2B1700' },
  final: { bg: '#BF5AF2', fg: '#FFFFFF' },
  mastered: { bg: '#0A84FF', fg: '#FFFFFF' },
};

export function ToastHost({ toast, top }: { toast: Toast | null; top: number }) {
  if (!toast) return null;
  const c = COLORS[toast.kind];
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 16, right: 16, top, alignItems: 'center', zIndex: 20 }}
    >
      <Animated.View
        key={toast.id}
        testID="fcg-toast"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        entering={FadeInDown.duration(220)}
        exiting={FadeOutUp.duration(150)}
        style={{
          backgroundColor: c.bg,
          borderRadius: 18,
          paddingHorizontal: 16,
          paddingVertical: 10,
          maxWidth: 420,
          boxShadow: '0 6px 18px rgba(0,0,0,.28)',
        }}
      >
        <Text style={{ color: c.fg, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
          {toast.icon ? `${toast.icon} ` : ''}
          {toast.title}
        </Text>
        {toast.sub ? (
          <Text style={{ color: c.fg, opacity: 0.8, fontSize: 13, textAlign: 'center' }}>
            {toast.sub}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
