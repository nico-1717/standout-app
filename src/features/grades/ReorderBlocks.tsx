import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { Grip } from '@/ui/ReorderList';

/** Un blocco dell'elenco: un esame solo, o un gruppo con le sue parti. */
export interface ReorderBlock {
  id: string;
  /** gli esami che contiene, nell'ordine in cui si vedono */
  uuids: string[];
}

/** Dove atterra il blocco `from` trascinato di `dy`: si scavalca un blocco quando si supera la sua metà. */
export function landingIndex(heights: number[], from: number, dy: number): number {
  let to = from;
  let room = dy;
  if (dy > 0) {
    for (let j = from + 1; j < heights.length; j++) {
      const h = heights[j] ?? 0;
      if (room <= h / 2) break;
      room -= h;
      to = j;
    }
  } else {
    for (let j = from - 1; j >= 0; j--) {
      const h = heights[j] ?? 0;
      if (-room <= h / 2) break;
      room += h;
      to = j;
    }
  }
  return to;
}

/**
 * L'elenco degli esami che si riordina con la «maniglia» (voti.php, `bindDrag`): il blocco trascinato segue il dito, gli
 * altri scivolano per fare posto. Le altezze sono diverse (un gruppo è più alto di un esame), quindi si misurano.
 * Alla fine chiama `onReorder` con tutti i blocchi nell'ordine nuovo e quello spostato.
 */
export function ReorderBlocks(p: {
  blocks: ReorderBlock[];
  gripColor: string;
  renderBlock: (block: ReorderBlock, grip: ReactNode, dragging: boolean) => ReactNode;
  onReorder: (order: ReorderBlock[], moved: ReorderBlock) => void;
}) {
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const hs = p.blocks.map((b) => heights[b.id] ?? 0);
  const from = drag?.index ?? -1;
  const to = drag ? landingIndex(hs, drag.index, drag.dy) : -1;

  return (
    <View testID="reorder-blocks">
      {p.blocks.map((b, i) => {
        const me = i === from;
        let shift = 0;
        if (drag && !me) {
          const h = hs[from] ?? 0;
          if (to > from && i > from && i <= to) shift = -h;
          else if (to < from && i >= to && i < from) shift = h;
        }
        return (
          <View
            key={b.id}
            onLayout={(e: LayoutChangeEvent) => {
              const h = e.nativeEvent.layout.height;
              setHeights((cur) => (cur[b.id] === h ? cur : { ...cur, [b.id]: h }));
            }}
            style={{
              zIndex: me ? 10 : 0,
              transform: [{ translateY: me && drag ? drag.dy : shift }, { scale: me ? 1.02 : 1 }],
            }}
          >
            {p.renderBlock(
              b,
              <Grip
                testID={`grip-${b.id}`}
                color={p.gripColor}
                callbacks={{
                  start: () => setDrag({ index: i, dy: 0 }),
                  move: (dy) => setDrag({ index: i, dy }),
                  end: (dy) => {
                    setDrag(null);
                    const land = landingIndex(hs, i, dy);
                    if (land === i) return;
                    const order = p.blocks.slice();
                    order.splice(land, 0, order.splice(i, 1)[0]!);
                    p.onReorder(order, b);
                  },
                }}
              />,
              me,
            )}
          </View>
        );
      })}
    </View>
  );
}
