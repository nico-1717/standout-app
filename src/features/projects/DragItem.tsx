import { useSyncExternalStore, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/core/theme/ThemeProvider';

import type { RowDrag } from './useRowDrag';

/**
 * Una riga dell'elenco che si può tenere in mano: mentre un'altra è trascinata scivola a fare posto, quando è lei la
 * trascinata si solleva e segue il dito; il progetto sopra cui si sta per lasciarla si colora, e sulla riga in mano
 * compare dove andrà («Dentro “X”»).
 */
export function DragItem(p: {
  id: string;
  drag: RowDrag;
  /** la scritta «Dentro …» da mostrare sulla riga in mano */
  caption?: string | null;
  children: ReactNode;
}) {
  const th = useTheme();
  const { ui } = p.drag;
  const busy = ui.active !== null;
  const lifted = ui.active === p.id;
  const carried = ui.carried.has(p.id);
  const shift = ui.shifts.get(p.id) ?? 0;
  // chi è in mano (o ci sta dentro) segue il dito; le altre non si accorgono dei movimenti
  const { lift } = p.drag;
  const dy = useSyncExternalStore(lift.subscribe, () => (carried ? lift.get() : 0));
  const target = ui.plan.kind === 'nest' && ui.plan.id === p.id;

  // ferma, subito al suo posto; durante il trascinamento scivola piano
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: busy ? withTiming(shift, { duration: 220 }) : 0 }],
  }));

  return (
    <Animated.View
      testID={`drag-item-${p.id}`}
      onLayout={(e: LayoutChangeEvent) => p.drag.onRowLayout(p.id, e)}
      style={[
        { zIndex: carried ? 10 : 0 },
        carried && { backgroundColor: th.surface },
        lifted && { boxShadow: '0 8px 24px rgba(0,0,0,0.18)', borderRadius: 14 },
        target && { backgroundColor: th.brandSoft },
        carried ? { transform: [{ translateY: dy }, { scale: lifted ? 1.02 : 1 }] } : slide,
      ]}
    >
      {p.children}
      {lifted && p.caption ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 10,
            bottom: 4,
            maxWidth: '70%',
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 99,
            backgroundColor: th.brand,
          }}
        >
          <Text testID="drag-caption" numberOfLines={1} style={{ color: '#fff', fontSize: 12 }}>
            {p.caption}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
