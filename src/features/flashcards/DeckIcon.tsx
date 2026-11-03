import { memo, useMemo } from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { deckIconSvg } from './logic';

interface Shape {
  tag: 'path' | 'circle' | 'ellipse' | 'rect';
  a: Record<string, string>;
}

/** Legge i tratti SVG di un'icona (solo path, circle, ellipse, rect: sono le sole che usa il sito). */
export function parseIcon(body: string): Shape[] {
  const out: Shape[] = [];
  for (const m of body.matchAll(/<(path|circle|ellipse|rect)\b([^>]*?)\/?>/g)) {
    const a: Record<string, string> = {};
    for (const k of m[2]!.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) a[k[1]!] = k[2]!;
    out.push({ tag: m[1] as Shape['tag'], a });
  }
  return out;
}

/** L'icona di un mazzo, disegnata come sul sito (24×24, tratto 2, senza riempimento). */
export const DeckIcon = memo(function DeckIcon({
  name,
  size = 24,
  color,
  stroke = 2,
}: {
  name: string;
  size?: number;
  color: string;
  stroke?: number;
}) {
  const shapes = useMemo(() => parseIcon(deckIconSvg(name)), [name]);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {shapes.map((s, i) => {
        const common = {
          stroke: color,
          strokeWidth: stroke,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill: 'none',
        };
        const tr = s.a.transform;
        switch (s.tag) {
          case 'path':
            return <Path key={i} d={s.a.d} {...common} transform={tr} />;
          case 'circle':
            return <Circle key={i} cx={s.a.cx} cy={s.a.cy} r={s.a.r} {...common} transform={tr} />;
          case 'ellipse':
            return (
              <Ellipse
                key={i}
                cx={s.a.cx}
                cy={s.a.cy}
                rx={s.a.rx}
                ry={s.a.ry}
                {...common}
                transform={tr}
              />
            );
          default:
            return (
              <Rect
                key={i}
                x={s.a.x}
                y={s.a.y}
                width={s.a.width}
                height={s.a.height}
                rx={s.a.rx}
                {...common}
                transform={tr}
              />
            );
        }
      })}
    </Svg>
  );
});
