import { memo, useMemo, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View, type TextStyle } from 'react-native';

import { useTheme, type Theme } from '@/core/theme/ThemeProvider';

import { codeGroups, codeSegments, type CodeSeg } from './codeBlocks';
import { CODE_BG, CODE_FG, CODE_HEAD_FG, TOKEN_COLORS } from './highlight';
import { MathView } from './math/MathView';
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

export function markStyle(th: Theme, m: Marks | undefined): TextStyle {
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

export function Runs({
  runs,
  th,
  size,
  color,
}: {
  runs: Run[];
  th: Theme;
  size: number;
  color: string;
}): ReactNode {
  return runs.map((r, i) => {
    if ('x' in r && typeof r.x === 'string') {
      // le formule in linea: disegnate, dentro la riga di testo
      const st = markStyle(th, r.m);
      return (
        <View
          key={i}
          style={{
            alignSelf: 'center',
            ...(st.backgroundColor ? { backgroundColor: st.backgroundColor } : null),
          }}
        >
          <MathView tex={r.x} size={size} color={typeof st.color === 'string' ? st.color : color} />
        </View>
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

/** Lo stile di un tratto di codice: il colore del suo pezzo di linguaggio, più i marchi (come .fc-code .fc-t del sito). */
export function codeSegStyle(th: Theme, seg: CodeSeg): TextStyle {
  const m = seg.m;
  const base: TextStyle = {
    color: seg.tk ? TOKEN_COLORS[seg.tk] : CODE_FG,
    ...(seg.tk === 'c' ? { fontStyle: 'italic' as const } : null),
  };
  if (!m) return base;
  return {
    ...base,
    ...(m.b
      ? { fontWeight: '900' as const, color: '#fff', backgroundColor: 'rgba(255,255,255,.16)' }
      : null),
    ...(m.i ? { fontStyle: 'italic' as const } : null),
    ...(m.u ? { textDecorationLine: 'underline' as const } : null),
    ...(typeof m.c === 'string' ? { color: markColor(th, m.c) } : null),
    ...(m.h
      ? {
          backgroundColor:
            typeof m.h === 'string' ? `${markColor(th, m.h)}73` : 'rgba(255,224,102,.38)',
        }
      : null),
  };
}

/**
 * Il testo di una carta (domanda, risposta) com'è sul sito: grassetto, corsivo, sottolineato, evidenziatore, colori,
 * elenchi (anche a più livelli e con le caselle), citazioni, righe di codice e formule. Legge il formato nuovo e quello vecchio.
 * Le formule si vedono ancora come LaTeX: il disegno vero arriva con il visualizzatore matematico.
 */
export const DocView = memo(function DocView({
  raw,
  size = 17,
  color,
  weight,
  testID,
}: {
  raw: string | null | undefined;
  size?: number;
  color?: string;
  /** lo spessore di base del testo (le parti in grassetto restano in grassetto) */
  weight?: TextStyle['fontWeight'];
  testID?: string;
}) {
  const th = useTheme();
  const blocks = useMemo(() => parseDoc(raw).blocks, [raw]);
  const base: TextStyle = {
    color: color ?? th.text,
    fontSize: size,
    lineHeight: Math.round(size * 1.4),
    ...(weight ? { fontWeight: weight } : null),
  };

  const groups = useMemo(() => codeGroups(blocks), [blocks]);
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (isCode(b)) {
      // le righe di codice vicine stanno in un riquadro solo, scuro, con la lingua in testa e i pezzi colorati (come sul sito)
      const group = groups.byStart.get(i);
      let j = i;
      while (j + 1 < blocks.length && isCode(blocks[j + 1]!)) j++;
      const lines = blocks.slice(i, j + 1);
      const fs = size - 2;
      out.push(
        <View
          key={i}
          testID={`doc-code-${i}`}
          style={{
            backgroundColor: CODE_BG,
            borderRadius: 12,
            overflow: 'hidden',
            marginVertical: 6,
            paddingBottom: 10,
          }}
        >
          <Text
            testID={`doc-code-${i}-lang`}
            style={{
              backgroundColor: 'rgba(255,255,255,.07)',
              color: CODE_HEAD_FG,
              fontSize: 11.5,
              fontWeight: '700',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              paddingHorizontal: 14,
              paddingVertical: 7,
              marginBottom: 6,
            }}
          >
            {group?.label ?? 'Code'}
          </Text>
          {lines.map((l, k) => {
            const segs = group && l.t === 'p' ? codeSegments(l.runs, group.lines[k] ?? []) : [];
            return (
              <Text
                key={k}
                style={[
                  {
                    color: CODE_FG,
                    fontFamily: MONO,
                    fontSize: fs,
                    lineHeight: Math.round(fs * 1.55),
                    paddingHorizontal: 14,
                  },
                  l.t === 'p' && l.hl
                    ? {
                        backgroundColor: 'rgba(255,214,10,.16)',
                        borderLeftWidth: 3,
                        borderLeftColor: '#FFD60A',
                        paddingLeft: 11,
                      }
                    : null,
                ]}
              >
                {segs.length
                  ? segs.map((sg, n) => (
                      <Text key={n} style={codeSegStyle(th, sg)}>
                        {sg.s}
                      </Text>
                    ))
                  : ' '}
              </Text>
            );
          })}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <MathView
              testID={`doc-fx-${i}`}
              tex={b.tex}
              size={size + 2}
              color={
                typeof markStyle(th, b.m).color === 'string'
                  ? (markStyle(th, b.m).color as string)
                  : (color ?? th.text)
              }
            />
          </ScrollView>
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
            {b.runs.length ? (
              <Runs runs={b.runs} th={th} size={size} color={color ?? th.text} />
            ) : (
              ' '
            )}
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
          {b.runs.length ? (
            <Runs runs={b.runs} th={th} size={size} color={color ?? th.text} />
          ) : (
            ' '
          )}
        </Text>
      </View>,
    );
  }
  return <View testID={testID}>{out}</View>;
});
