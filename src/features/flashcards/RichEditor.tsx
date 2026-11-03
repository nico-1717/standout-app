import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputKeyPressEvent,
  type TextInputSelectionChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { parseDoc, stringifyDoc, trimDoc, TEXT_COLORS, bulletFor, type Doc } from './doc';
import { DocView, markColor } from './DocView';
import {
  editBlockText,
  indent,
  kindOf,
  marksAt,
  mergeWithPrevious,
  setColor,
  setKind,
  splitBlock,
  textOf,
  toggleChecked,
  toggleMark,
  type BlockKind,
  type MarkKey,
} from './docEdit';

const MONO = 'Menlo';
const COLORS = ['red', 'orange', 'green', 'blue', 'purple', 'gray'];

/** Il testo del campo: documento pronto da salvare, o null se non c'è niente di scritto. */
export function docToField(doc: Doc): string | null {
  const t = trimDoc(doc);
  const empty = t.blocks.every((b) => textOf(b).trim() === '');
  return empty ? null : stringifyDoc(t);
}

/**
 * L'editor ricco di una carta (domanda o risposta): un blocco per riga, una barra con grassetto, corsivo, sottolineato,
 * evidenziatore, colori, elenco, casella, citazione, codice, formula e rientro. Il testo si scrive in caselle normali; le
 * etichette si vedono nell'anteprima sotto. `onChange` riceve il campo da salvare (o null se è vuoto).
 */
export function RichEditor({
  value,
  onChange,
  testID = 're',
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (field: string | null) => void;
  testID?: string;
  placeholder?: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [doc, setDoc] = useState<Doc>(() => parseDoc(value));
  const [focus, setFocus] = useState(0);
  const [sel, setSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const inputs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const pending = useRef<{ block: number; at: number } | null>(null);

  const update = (next: Doc) => {
    setDoc(next);
    onChange(docToField(next));
  };

  // dopo uno spezza/unisci si porta il cursore dove deve stare
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const input = inputs.current[p.block];
    input?.focus?.();
    input?.setSelection?.(p.at, p.at);
  });

  const cur = Math.min(focus, doc.blocks.length - 1);
  const block = doc.blocks[cur];
  const range = (): [number, number] => {
    const len = textOf(block).length;
    // senza selezione, la scelta vale per tutto il blocco
    return sel.start === sel.end ? [0, len] : [Math.min(sel.start, len), Math.min(sel.end, len)];
  };
  const marks = useMemo(
    () =>
      block
        ? marksAt(
            doc,
            cur,
            ...(sel.start === sel.end
              ? ([0, textOf(block).length] as const)
              : ([sel.start, sel.end] as const)),
          )
        : { b: false, i: false, u: false, h: false, c: null },
    [doc, cur, sel, block],
  );
  const kind = kindOf(block);

  const toggle = (k: MarkKey) => {
    const [a, b] = range();
    update(toggleMark(doc, cur, a, b, k));
  };
  const color = (c: string | null) => {
    const [a, b] = range();
    update(setColor(doc, cur, a, b, c));
  };
  const asKind = (k: BlockKind) => update(setKind(doc, cur, kind === k ? 'p' : k));

  const onText = (i: number, text: string) => {
    const nl = text.indexOf('\n');
    if (nl === -1) {
      update(editBlockText(doc, i, text));
      return;
    }
    // un a capo: il blocco si spezza lì
    const before = editBlockText(doc, i, text.slice(0, nl) + text.slice(nl + 1));
    const next = splitBlock(before, i, nl);
    pending.current = { block: i + 1, at: 0 };
    setFocus(i + 1);
    update(next);
  };

  const onKey = (i: number, e: TextInputKeyPressEvent) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (sel.start !== 0 || sel.end !== 0 || focus !== i) return;
    const r = mergeWithPrevious(doc, i);
    if (r.doc === doc) return;
    pending.current = { block: r.block, at: r.at };
    setFocus(r.block);
    update(r.doc);
  };

  const btn = (
    id: string,
    label: string,
    on: boolean,
    press: () => void,
    a11y: string,
    style?: object,
  ) => (
    <Pressable
      key={id}
      testID={`${testID}-${id}`}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: on }}
      onPress={press}
      style={{
        minWidth: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        backgroundColor: on ? th.brand : th.surface2,
      }}
    >
      <Text style={[{ color: on ? '#fff' : th.text, fontWeight: '700' }, style]}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID={testID} style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
      >
        {btn('b', 'B', marks.b, () => toggle('b'), t('editor.grassetto'))}
        {btn('i', 'I', marks.i, () => toggle('i'), t('editor.corsivo'), { fontStyle: 'italic' })}
        {btn('u', 'U', marks.u, () => toggle('u'), t('editor.sottolineato'), {
          textDecorationLine: 'underline',
        })}
        {btn('h', '▮', marks.h, () => toggle('h'), t('editor.evidenziatore'), { color: '#FFD60A' })}
        {COLORS.map((c) => (
          <Pressable
            key={c}
            testID={`${testID}-c-${c}`}
            accessibilityRole="button"
            accessibilityLabel={t('editor.colora_testo')}
            accessibilityState={{ selected: marks.c === c }}
            onPress={() => color(marks.c === c ? null : c)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: marks.c === c ? 3 : 0,
              borderColor: th.text,
              backgroundColor: markColor(th, c),
            }}
          />
        ))}
        {btn('li', '•', kind === 'li', () => asKind('li'), t('editor.elenco'))}
        {btn('ck', '☐', kind === 'ck', () => asKind('ck'), t('editor.checklist'))}
        {btn('q', '❝', kind === 'q', () => asKind('q'), t('editor.citazione'))}
        {btn('code', '</>', kind === 'code', () => asKind('code'), t('editor.codice'), {
          fontFamily: MONO,
          fontSize: 12,
        })}
        {btn('fx', 'fx', kind === 'fx', () => asKind('fx'), t('editor.formula'))}
        {btn('out', '←', false, () => update(indent(doc, cur, -1)), t('editor.riduci_livello'))}
        {btn('in', '→', false, () => update(indent(doc, cur, 1)), t('editor.sotto_punto'))}
      </ScrollView>

      <View style={{ gap: 4 }}>
        {doc.blocks.map((b, i) => {
          const k = kindOf(b);
          const lvl = b.t === 'li' ? b.lvl : b.t === 'p' ? (b.lvl ?? 0) : (b.lvl ?? 0);
          return (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingLeft: Math.max(0, k === 'li' || k === 'ck' ? lvl - 1 : lvl) * 18,
                gap: 6,
              }}
            >
              {k === 'li' ? (
                <Text style={{ color: th.text, paddingTop: 10, width: 16 }}>{bulletFor(lvl)}</Text>
              ) : null}
              {k === 'ck' ? (
                <Pressable
                  testID={`${testID}-check-${i}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: b.t === 'li' && b.ck === 1 }}
                  onPress={() => update(toggleChecked(doc, i))}
                  style={{ paddingTop: 8, width: 22 }}
                >
                  <Text style={{ color: th.text, fontSize: 17 }}>
                    {b.t === 'li' && b.ck === 1 ? '☑' : '☐'}
                  </Text>
                </Pressable>
              ) : null}
              <TextInput
                testID={`${testID}-block-${i}`}
                ref={(r) => {
                  inputs.current[i] = r;
                }}
                value={textOf(b)}
                onChangeText={(v) => onText(i, v)}
                onFocus={() => setFocus(i)}
                onSelectionChange={(e: TextInputSelectionChangeEvent) => {
                  if (i === focus) setSel(e.nativeEvent.selection);
                }}
                onKeyPress={(e) => onKey(i, e)}
                multiline
                scrollEnabled={false}
                placeholder={i === 0 && doc.blocks.length === 1 ? placeholder : undefined}
                placeholderTextColor={th.text3}
                style={{
                  flex: 1,
                  color: th.text,
                  fontSize: 16,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: i === cur ? th.surface2 : 'transparent',
                  ...(k === 'code' || k === 'fx' ? { fontFamily: MONO } : null),
                  ...(k === 'q'
                    ? {
                        fontStyle: 'italic' as const,
                        borderLeftWidth: 3,
                        borderLeftColor: th.hairline2,
                      }
                    : null),
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>
          {t('fc.smi_anteprima').toUpperCase()}
        </Text>
        <DocView testID={`${testID}-preview`} raw={stringifyDoc(doc)} />
      </View>
    </View>
  );
}

export { TEXT_COLORS };
