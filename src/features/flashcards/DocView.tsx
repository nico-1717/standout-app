import { memo, useMemo, type ReactNode } from 'react';
import { Platform, Text, View, type TextStyle } from 'react-native';

import { useTheme, type Theme } from '@/core/theme/ThemeProvider';

import {
  bulletFor,
  parseDoc,
  TEXT_COLORS,
  type Block,
  type Marks,
  type Run,
  type TextRun,
} from './doc';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const INDENT = 18;

/** Il colore di un'etichetta di colore: quello del tema se c'è (così segue chiaro e scuro), altrimenti quello del sito. */
export function markColor(th: Theme, key: string): string {
  const fromTheme = (th as unknown as Record<string, string>)[key];
  return typeof fromTheme === 'string' && fromTheme.startsWith('#')
    ? fromTheme
    : (TEXT_COLORS[key] ?? th.text);
}

function markStyle(th: Theme, m: Marks | undefined): TextStyle {
  if (!m) return {};
  // evidenziatore: giallo, o del colore scelto
  const hl = typeof m.h === 'string' ? markColor(th, m.h) : '#FFD60A';
  return {
    ...(m.b ? { fontWeight: '700' as const } : null),
    ...(m.i ? { fontStyle: 'italic' as const } : null),
    ...(m.u ? { textDecorationLine: 'underline' as const } : null),
    ...(typeof m.c === 'string' ? { color: markColor(th, m.c) } : null),
    ...(m.h ? { backgroundColor: hl + (th.scheme === 'dark' ? '66' : '59') } : null),
  };
}

function Runs({ runs, th }: { runs: Run[]; th: Theme }): ReactNode {
  return runs.map((r, i) => {
    if ('x' in r && typeof r.x === 'string') {
      // le formule in linea: per ora il LaTeX com'è, in un carattere a spaziatura fissa
      return (
        <Text key={i} style={[{ fontFamily: MONO }, markStyle(th, r.m)]}>
          {r.x}
        </Text>
      );
    }
    const t = r as TextRun;
    return (
      <Text key={i} style={markStyle(th, t.m)}>
        {t.s}
      </Text>
    );
  });
}

const isCode = (b: Block): boolean => b.t === 'p' && !!b.code;

/**
 * Il testo di una carta (domanda, risposta) com'è sul sito: grassetto, corsivo, sottolineato, evidenziatore, colori,
 * elenchi (anche a più livelli e con le caselle), citazioni, righe di codice e formule. Legge il formato nuovo e quello vecchio.
 * Le formule si vedono ancora come LaTeX: il disegno vero arriva con il visualizzatore matematico.
 */
export const DocView = memo(function DocView({
  raw,
  size = 17,
  color,
  testID,
}: {
  raw: string | null | undefined;
  size?: number;
  color?: string;
  testID?: string;
}) {
  const th = useTheme();
  const blocks = useMemo(() => parseDoc(raw).blocks, [raw]);
  const base: TextStyle = {
    color: color ?? th.text,
    fontSize: size,
    lineHeight: Math.round(size * 1.4),
  };

  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (isCode(b)) {
      // le righe di codice vicine stanno in un riquadro solo
      let j = i;
      while (j + 1 < blocks.length && isCode(blocks[j + 1]!)) j++;
      const lines = blocks.slice(i, j + 1);
      out.push(
        <View
          key={i}
          style={{
            backgroundColor: th.surface2,
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            marginVertical: 4,
          }}
        >
          {lines.map((l, k) => (
            <Text
              key={k}
              style={[
                base,
                { fontFamily: MONO, fontSize: size - 2, lineHeight: Math.round((size - 2) * 1.45) },
              ]}
            >
              {l.t === 'p' && l.runs.length ? <Runs runs={l.runs} th={th} /> : ' '}
            </Text>
          ))}
        </View>,
      );
      i = j;
      continue;
    }
    if (b.t === 'fx') {
      out.push(
        <View
          key={i}
          style={{
            paddingLeft: Math.max(0, (b.lvl ?? 0) - 1) * INDENT + (b.lvl ? INDENT : 0),
            marginVertical: 4,
          }}
        >
          <Text style={[base, { fontFamily: MONO }, markStyle(th, b.m)]}>{b.tex}</Text>
        </View>,
      );
      continue;
    }
    if (b.t === 'li') {
      const bullet = b.ck === undefined ? bulletFor(b.lvl) : b.ck === 1 ? '☑' : '☐';
      out.push(
        <View
          key={i}
          style={{ flexDirection: 'row', paddingLeft: (b.lvl - 1) * INDENT, marginVertical: 1 }}
        >
          <Text
            style={[
              base,
              { width: INDENT + 2, color: b.c ? markColor(th, b.c) : (color ?? th.text) },
            ]}
          >
            {bullet}
          </Text>
          <Text style={[base, { flex: 1 }, b.ck === 1 ? { color: th.text2 } : null]}>
            {b.runs.length ? <Runs runs={b.runs} th={th} /> : ' '}
          </Text>
        </View>,
      );
      continue;
    }
    // paragrafo (o citazione)
    out.push(
      <View
        key={i}
        style={[
          { paddingLeft: (b.lvl ?? 0) * INDENT, marginVertical: 1 },
          b.q
            ? {
                borderLeftWidth: 3,
                borderLeftColor: th.hairline2,
                paddingLeft: 10,
                marginVertical: 3,
              }
            : null,
        ]}
      >
        <Text style={[base, b.q ? { color: th.text2, fontStyle: 'italic' } : null]}>
          {b.runs.length ? <Runs runs={b.runs} th={th} /> : ' '}
        </Text>
      </View>,
    );
  }
  return <View testID={testID}>{out}</View>;
});
