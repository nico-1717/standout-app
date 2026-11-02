import { useEffect, useState, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Un elenco che si riordina trascinando la «maniglia» (come il riordino del sito, ma con il dito del telefono).
 * Le righe hanno altezza fissa, così dal movimento si sa subito dove atterra la riga; quelle scavalcate si
 * spostano per far posto. Alla fine del trascinamento chiama onReorder(da, a).
 */
interface DragCallbacks {
  start: () => void;
  move: (dy: number) => void;
  end: (dy: number) => void;
}

class DragGesture {
  private cb: DragCallbacks;
  readonly responder;

  constructor(cb: DragCallbacks) {
    this.cb = cb;
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // la maniglia tiene il gesto: né la pagina né il foglio devono portarlo via
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => this.cb.start(),
      onPanResponderMove: (_e, g) => this.cb.move(g.dy),
      onPanResponderRelease: (_e, g) => this.cb.end(g.dy),
      onPanResponderTerminate: (_e, g) => this.cb.end(g.dy),
    });
  }

  update(cb: DragCallbacks) {
    this.cb = cb;
  }
}

export function Grip({
  color,
  ...p
}: {
  color: string;
  callbacks: DragCallbacks;
  testID?: string;
}) {
  const [g] = useState(() => new DragGesture(p.callbacks));
  useEffect(() => {
    g.update(p.callbacks);
  });
  return (
    <View
      testID={p.testID}
      accessibilityRole="button"
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      {...g.responder.panHandlers}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path
          d="M4 9h16M4 15h16"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

/** Dove atterra una riga trascinata: indice di partenza + spostamento in righe, tenuto dentro l'elenco. */
export function dropIndex(from: number, dy: number, step: number, count: number): number {
  return Math.max(0, Math.min(count - 1, from + Math.round(dy / step)));
}

export function reorderKeys<T>(items: T[], from: number, to: number): T[] {
  const out = items.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
}

export function ReorderList<T extends { key: string }>(p: {
  items: T[];
  rowHeight: number;
  gap?: number;
  gripColor: string;
  renderRow: (item: T, grip: ReactNode, dragging: boolean) => ReactNode;
  onReorder: (from: number, to: number) => void;
}) {
  const gap = p.gap ?? 8;
  const step = p.rowHeight + gap;
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const n = p.items.length;

  return (
    <View style={{ height: n * step - gap }} testID="reorder-list">
      {p.items.map((it, i) => {
        const target = drag ? dropIndex(drag.index, drag.dy, step, n) : i;
        let shift = 0;
        if (drag && i !== drag.index) {
          if (target > drag.index && i > drag.index && i <= target) shift = -step;
          else if (target < drag.index && i >= target && i < drag.index) shift = step;
        }
        const me = drag?.index === i;
        return (
          <View
            key={it.key}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: i * step,
              height: p.rowHeight,
              zIndex: me ? 10 : 0,
              transform: [{ translateY: me ? drag.dy : shift }, { scale: me ? 1.03 : 1 }],
            }}
          >
            {p.renderRow(
              it,
              <Grip
                testID={`grip-${it.key}`}
                color={p.gripColor}
                callbacks={{
                  start: () => setDrag({ index: i, dy: 0 }),
                  move: (dy) => setDrag({ index: i, dy }),
                  end: (dy) => {
                    setDrag(null);
                    const to = dropIndex(i, dy, step, n);
                    if (to !== i) p.onReorder(i, to);
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
