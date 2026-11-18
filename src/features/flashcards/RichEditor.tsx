import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputKeyPressEvent,
  type TextInputSelectionChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { parseDoc, stringifyDoc, trimDoc, TEXT_COLORS, bulletFor, type Doc } from './doc';
import { DocView } from './DocView';
import {
  autoMath,
  clearHighlight,
  clearMarks,
  editBlockText,
  highlightColorAt,
  indent,
  insertMathInline,
  isRich,
  kindOf,
  marksAt,
  mergeWithPrevious,
  setCodeLang,
  setColor,
  setHighlightColor,
  setKind,
  setListColor,
  splitBlock,
  textOf,
  toggleChecked,
  toggleHighlightLine,
  toggleMark,
  type BlockKind,
} from './docEdit';
import { FormatBar, type BarActions, type BarState, type PanelId, type Target } from './FormatBar';

const MONO = 'Menlo';
const HISTORY = 100;
/** Le battute scritte una dopo l'altra entro questo tempo sono un solo passo di «annulla» (come sul sito: a blocchi). */
const TYPING_MS = 1000;
/** Il tempo che la barra resta se il campo perde il fuoco perché si è toccata la barra stessa. */
const BAR_TOUCH_MS = 700;

/** Il testo del campo: documento pronto da salvare, o null se non c'è niente di scritto. */
export function docToField(doc: Doc): string | null {
  const t = trimDoc(doc);
  const empty = t.blocks.every((b) => textOf(b).trim() === '');
  return empty ? null : stringifyDoc(t);
}

/** L'ora in millisecondi (fuori dal render: il linter non vuole chiamate impure dentro un componente). */
const nowMs = (): number => Date.now();

const newlines = (s: string): number => s.split('\n').length - 1;

/**
 * L'editor ricco di una carta (domanda o risposta), con la barra del formato del sito: la pastiglia con il tastino, le
 * famiglie Testo / Elenco / Formula / Codice e «annulla». La barra c'è solo mentre si scrive in quel campo. Il testo si scrive
 * in caselle normali, una per blocco; quello che ne esce (grassetto, colori, formule…) si vede nell'anteprima sotto.
 * `onChange` riceve il campo da salvare (o null se è vuoto).
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
  // la barra: c'è mentre si scrive qui; aperta o chiusa al tastino; un pannello alla volta
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(true);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [target, setTarget] = useState<Target>('c');
  const [dollars, setDollars] = useState(false);
  const [smart, setSmart] = useState(false);
  // la cronologia di «annulla»
  const history = useRef<Doc[]>([]);
  const lastTyping = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  // il dito sulla barra: il campo perde il fuoco, ma la barra deve restare
  const barTouched = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const commit = (next: Doc) => {
    setDoc(next);
    onChange(docToField(next));
  };
  const remember = (typing: boolean) => {
    const now = nowMs();
    const sameRun = typing && lastTyping.current > 0 && now - lastTyping.current < TYPING_MS;
    lastTyping.current = typing ? now : 0;
    if (sameRun) return;
    history.current.push(doc);
    if (history.current.length > HISTORY) history.current.shift();
    setCanUndo(true);
  };
  const update = (next: Doc, typing = false) => {
    if (next === doc) return;
    remember(typing);
    commit(next);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    lastTyping.current = 0;
    setCanUndo(history.current.length > 0);
    commit(prev);
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
  const hlName = (() => {
    if (!block) return null;
    const [a, b] = range();
    return highlightColorAt(doc, cur, a, b);
  })();
  const highlight = !marks.h ? 'default' : (hlName ?? 'yellow');
  const listColor = block?.t === 'li' ? (block.c ?? null) : null;

  /** Dopo aver agito sulla barra il campo riprende il fuoco, così la tastiera resta su. */
  const back = () => {
    barTouched.current = nowMs();
    const input = inputs.current[cur];
    input?.focus?.();
  };

  const actions: BarActions = {
    toggleOpen: () => {
      setOpen((o) => !o);
      setPanel(null);
    },
    tab: (p) => {
      if (p === 'list') {
        // a due tempi, come sul sito: una riga senza pallino ne riceve uno e il pannello si apre; con il pallino già messo
        // il primo tocco apre solo il pannello, il secondo (a pannello aperto) toglie il pallino e lo chiude
        const isList = block?.t === 'li';
        if (isList && panel !== 'list') {
          setPanel('list');
          return;
        }
        update(setKind(doc, cur, isList ? 'p' : 'li'));
        setPanel(isList ? null : 'list');
        back();
        return;
      }
      setPanel(panel === p ? null : p);
    },
    undo: () => {
      undo();
      back();
    },
    mark: (k) => {
      const [a, b] = range();
      update(toggleMark(doc, cur, a, b, k));
      back();
    },
    clear: () => {
      const [a, b] = range();
      update(clearMarks(doc, cur, a, b));
      back();
    },
    kind: (k: BlockKind) => {
      update(setKind(doc, cur, kind === k ? 'p' : k));
      back();
    },
    target: (k) => setTarget(k),
    color: (c) => {
      const [a, b] = range();
      update(setColor(doc, cur, a, b, c));
      back();
    },
    highlight: (c) => {
      const [a, b] = range();
      update(
        c === 'default'
          ? clearHighlight(doc, cur, a, b)
          : setHighlightColor(doc, cur, a, b, c === 'yellow' ? null : c),
      );
      back();
    },
    outdent: () => {
      update(indent(doc, cur, -1));
      back();
    },
    indent: () => {
      update(indent(doc, cur, 1));
      back();
    },
    softBreak: () => {
      // a capo senza aprire un punto nuovo: la riga continua sotto lo stesso pallino
      if (!block || block.t === 'fx') return;
      const old = textOf(block);
      const a = Math.min(sel.start, old.length);
      const b = Math.min(sel.end, old.length);
      pending.current = { block: cur, at: a + 1 };
      update(editBlockText(doc, cur, `${old.slice(0, a)}\n${old.slice(b)}`));
    },
    listColor: (c) => {
      update(setListColor(doc, cur, c));
      back();
    },
    codeHl: () => {
      update(toggleHighlightLine(doc, cur));
      back();
    },
    codeLang: (l) => {
      update(kind === 'code' ? setCodeLang(doc, cur, l) : setKind(doc, cur, 'code', l));
      back();
    },
    mathInline: () => {
      const r = insertMathInline(doc, cur, sel.start, sel.end);
      if (r.doc === doc) return;
      pending.current = { block: cur, at: r.at };
      update(r.doc);
    },
    toggleDollars: () => setDollars((d) => !d),
    toggleSmart: () => setSmart((s) => !s),
  };
  const barState: BarState = {
    open,
    panel,
    canUndo,
    marks,
    target,
    highlight,
    kind,
    listColor,
    codeLang: block && block.t === 'p' ? (block.code ?? null) : null,
    codeHl: block?.t === 'p' && !!block.hl,
    dollars,
    smart,
  };

  const onText = (i: number, text: string) => {
    const b = doc.blocks[i];
    const old = textOf(b);
    let added = newlines(text) - newlines(old);
    if (added <= 0) {
      const edited = editBlockText(doc, i, text);
      if (dollars || smart) {
        const m = autoMath(edited, i, { dollars, smart });
        if (m.doc !== edited) {
          if (m.at !== null) pending.current = { block: i, at: m.at };
          update(m.doc, true);
          return;
        }
      }
      update(edited, true);
      return;
    }
    // un a capo scritto: il blocco si spezza lì (se ne sono incollati di più, si spezza a ogni a capo)
    let d = doc;
    let idx = i;
    let rest = text;
    let first = true;
    while (added > 0) {
      let from = 0;
      if (first) {
        const base = textOf(d.blocks[idx]);
        while (from < base.length && base[from] === rest[from]) from++;
      }
      const nl = rest.indexOf('\n', from);
      if (nl === -1) break;
      d = splitBlock(editBlockText(d, idx, rest.slice(0, nl) + rest.slice(nl + 1)), idx, nl);
      idx += 1;
      rest = textOf(d.blocks[idx]);
      first = false;
      added -= 1;
    }
    pending.current = { block: idx, at: 0 };
    setFocus(idx);
    update(d);
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

  const onFocus = (i: number) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setActive(true);
    setFocus(i);
  };
  const onBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    // la barra se ne va solo se il campo ha perso il fuoco davvero (non perché si è toccata la barra)
    blurTimer.current = setTimeout(() => {
      if (nowMs() - barTouched.current < BAR_TOUCH_MS) return;
      setActive(false);
    }, 250);
  };

  return (
    <View testID={testID} style={{ gap: 8 }}>
      {active ? (
        <FormatBar
          testID={testID}
          state={barState}
          actions={actions}
          onTouch={() => {
            barTouched.current = nowMs();
          }}
        />
      ) : null}

      <View
        style={{
          gap: 2,
          borderRadius: 14,
          backgroundColor: th.surface2,
          paddingVertical: 6,
          paddingHorizontal: 6,
          minHeight: 96,
        }}
      >
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
                  hitSlop={11}
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
                onFocus={() => onFocus(i)}
                onBlur={onBlur}
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
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  ...(k === 'code' || k === 'fx' ? { fontFamily: MONO } : null),
                  ...(b.t === 'p' && b.hl ? { backgroundColor: '#FFCC0040' } : null),
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

      {isRich(doc) ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>
            {t('fc.smi_anteprima').toUpperCase()}
          </Text>
          <DocView testID={`${testID}-preview`} raw={stringifyDoc(doc)} />
        </View>
      ) : null}
    </View>
  );
}

export { TEXT_COLORS };
