import { memo, useMemo, type ReactNode } from 'react';
import { Platform, Text, View, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { heightOf, parseTex, type Node } from './tex';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const SCRIPT = 0.7;

type Ctx = { size: number; color: string };

function Glyph({ s, v, size, color }: { s: string; v: 'it' | 'rm' | 'b' | 'tt' } & Ctx) {
  const style: TextStyle = {
    color,
    fontSize: size,
    lineHeight: Math.round(size * 1.3),
    ...(v === 'it' ? { fontStyle: 'italic' } : null),
    ...(v === 'b' ? { fontWeight: '700' } : null),
    ...(v === 'tt' ? { fontFamily: MONO } : null),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  };
  return <Text style={style}>{s}</Text>;
}

/** Un pezzo di formula, disegnato con `size` pixel di testo. Le righe stanno sull'asse della formula (al centro). */
function Draw({ n, size, color }: { n: Node } & Ctx): ReactNode {
  switch (n.k) {
    case 'ch':
      return <Glyph s={n.s} v={n.v} size={size} color={color} />;
    case 'sp':
      return <View style={{ width: n.w * size }} />;
    case 'row':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {n.c.map((c, i) => (
            <Draw key={i} n={c} size={size} color={color} />
          ))}
        </View>
      );
    case 'frac': {
      const pad = Math.max(1, Math.round(size * 0.08));
      return (
        <View style={{ alignItems: 'center', marginHorizontal: size * 0.1 }}>
          <View style={{ paddingHorizontal: pad, paddingBottom: pad }}>
            <Draw n={n.n} size={size * 0.92} color={color} />
          </View>
          {n.bar ? (
            <View
              style={{
                alignSelf: 'stretch',
                height: Math.max(1, size / 14),
                backgroundColor: color,
              }}
            />
          ) : null}
          <View style={{ paddingHorizontal: pad, paddingTop: pad }}>
            <Draw n={n.d} size={size * 0.92} color={color} />
          </View>
        </View>
      );
    }
    case 'sup':
    case 'sub':
    case 'subsup': {
      // il segno di derivata (f'): un apice senza base, a misura piena e un po' in alto
      if (n.k === 'sup' && n.b.k === 'row' && n.b.c.length === 0) {
        return (
          <View style={{ transform: [{ translateY: -size * 0.2 }] }}>
            <Draw n={n.s} size={size} color={color} />
          </View>
        );
      }
      const lift = Math.max(1, heightOf(n.b)) * size * 0.5;
      const up = (c: Node) => (
        <View style={{ transform: [{ translateY: -(lift - size * 0.05) }] }}>
          <Draw n={c} size={size * SCRIPT} color={color} />
        </View>
      );
      const down = (c: Node) => (
        <View style={{ transform: [{ translateY: lift - size * 0.15 }] }}>
          <Draw n={c} size={size * SCRIPT} color={color} />
        </View>
      );
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Draw n={n.b} size={size} color={color} />
          {n.k === 'sup' ? up(n.s) : null}
          {n.k === 'sub' ? down(n.s) : null}
          {n.k === 'subsup' ? (
            <View>
              {up(n.hi)}
              <View style={{ position: 'absolute', left: 0, top: 0 }}>{down(n.lo)}</View>
            </View>
          ) : null}
        </View>
      );
    }
    case 'sqrt': {
      const h = heightOf(n.c) * size * 1.15;
      const line = Math.max(1, size / 14);
      return (
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          {n.n ? (
            <View style={{ justifyContent: 'flex-start', marginRight: -size * 0.15 }}>
              <Draw n={n.n} size={size * 0.55} color={color} />
            </View>
          ) : null}
          <Svg width={size * 0.6} height={h} viewBox="0 0 10 20" preserveAspectRatio="none">
            <Path
              d="M0.5 11 L3 9.5 L6 18.5 L9.5 0.8"
              stroke={color}
              strokeWidth={1.4}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
          <View
            style={{
              borderTopWidth: line,
              borderTopColor: color,
              paddingTop: size * 0.1,
              paddingRight: size * 0.1,
              justifyContent: 'center',
            }}
          >
            <Draw n={n.c} size={size} color={color} />
          </View>
        </View>
      );
    }
    case 'op': {
      const isText = /^[a-z]/i.test(n.s);
      const big = isText ? size : size * (n.limits ? 1.35 : 1.7);
      const glyph = <Glyph s={n.s} v="rm" size={big} color={color} />;
      if (n.limits) {
        return (
          <View style={{ alignItems: 'center', marginHorizontal: size * 0.08 }}>
            {n.hi ? <Draw n={n.hi} size={size * SCRIPT} color={color} /> : null}
            {glyph}
            {n.lo ? <Draw n={n.lo} size={size * SCRIPT} color={color} /> : null}
          </View>
        );
      }
      // l'integrale: i due estremi stanno a destra del segno, uno in alto e uno in basso
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: size * 0.05 }}>
          {glyph}
          {n.hi || n.lo ? (
            <View
              style={{
                height: big * 1.15,
                justifyContent: n.hi && n.lo ? 'space-between' : n.hi ? 'flex-start' : 'flex-end',
                marginLeft: size * 0.08,
              }}
            >
              {n.hi ? <Draw n={n.hi} size={size * SCRIPT} color={color} /> : null}
              {n.lo ? <Draw n={n.lo} size={size * SCRIPT} color={color} /> : null}
            </View>
          ) : null}
        </View>
      );
    }
    case 'delim': {
      const h = Math.min(heightOf(n.c), 4);
      const big = size * Math.max(1, h * 0.95);
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {n.l ? <Glyph s={n.l} v="rm" size={big} color={color} /> : null}
          <Draw n={n.c} size={size} color={color} />
          {n.r ? <Glyph s={n.r} v="rm" size={big} color={color} /> : null}
        </View>
      );
    }
    case 'mat': {
      const cols = Math.max(0, ...n.rows.map((r) => r.length));
      const heights = n.rows.map((r) => Math.max(1, ...r.map(heightOf)) * size * 1.3 + size * 0.25);
      const total = heights.reduce((a, b) => a + b, 0);
      const big = Math.min(total, size * 5);
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: size * 0.1 }}>
          {n.l ? <Glyph s={n.l} v="rm" size={big * 0.8} color={color} /> : null}
          <View style={{ flexDirection: 'row' }}>
            {Array.from({ length: cols }, (_, c) => (
              <View
                key={c}
                style={{
                  alignItems: n.left ? 'flex-start' : 'center',
                  paddingHorizontal: size * 0.35,
                }}
              >
                {n.rows.map((r, i) => (
                  <View key={i} style={{ height: heights[i], justifyContent: 'center' }}>
                    {r[c] ? <Draw n={r[c]!} size={size} color={color} /> : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
          {n.r ? <Glyph s={n.r} v="rm" size={big * 0.8} color={color} /> : null}
        </View>
      );
    }
    case 'acc': {
      const mark = { bar: '', vec: '→', hat: '^', tilde: '~', dot: '˙', ddot: '¨', under: '' }[n.a];
      const line = Math.max(1, size / 14);
      if (n.a === 'bar' || n.a === 'under') {
        return (
          <View
            style={{
              ...(n.a === 'bar'
                ? { borderTopWidth: line, borderTopColor: color, paddingTop: size * 0.05 }
                : {
                    borderBottomWidth: line,
                    borderBottomColor: color,
                    paddingBottom: size * 0.05,
                  }),
            }}
          >
            <Draw n={n.c} size={size} color={color} />
          </View>
        );
      }
      return (
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              position: 'absolute',
              top: -size * 0.42,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <Glyph s={mark} v="rm" size={size * 0.7} color={color} />
          </View>
          <Draw n={n.c} size={size} color={color} />
        </View>
      );
    }
  }
}

/**
 * Una formula disegnata (le formule del sito sono LaTeX disegnato da MathQuill/MathJax; qui lo disegna l'app, senza rete e
 * senza librerie in più). `tex` vuoto non disegna niente.
 */
export const MathView = memo(function MathView({
  tex,
  size = 17,
  color,
  testID,
}: {
  tex: string;
  size?: number;
  color: string;
  testID?: string;
}) {
  const tree = useMemo(() => parseTex(tex), [tex]);
  if (!tex.trim()) return null;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={tex}
      style={{ paddingVertical: size * 0.25, alignSelf: 'flex-start' }}
    >
      <Draw n={tree} size={size} color={color} />
    </View>
  );
});
