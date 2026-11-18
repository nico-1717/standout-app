import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme, type Theme } from '@/core/theme/ThemeProvider';

import { CODE_LANGS } from './doc';
import { markColor } from './DocView';
import type { BlockKind } from './docEdit';

export type PanelId = 'font' | 'list' | 'math' | 'code';
export type Target = 'c' | 'h';

/** I colori del testo, nell'ordine del sito (public/partials/format_toolbar.php). */
export const SWATCHES = [
  'red',
  'orange',
  'gold',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
  'brown',
  'gray',
] as const;
/** I colori dei pallini di un elenco (sono meno, come sul sito). */
export const LIST_SWATCHES = ['red', 'orange', 'green', 'blue', 'purple', 'gray'] as const;
const YELLOW = '#FFCC00';

/** Quello che la barra deve mostrare (acceso / spento / scelto). */
export interface BarState {
  open: boolean;
  panel: PanelId | null;
  canUndo: boolean;
  marks: { b: boolean; i: boolean; u: boolean; h: boolean; c: string | null };
  target: Target;
  /** l'evidenziatore in uso: 'default' = nessuno, 'yellow' = giallo, altrimenti il nome del colore */
  highlight: string;
  kind: BlockKind;
  listColor: string | null;
  codeLang: string | null;
  codeHl: boolean;
  dollars: boolean;
  smart: boolean;
}

/** Quello che la barra sa fare: ogni tasto chiama una di queste. */
export interface BarActions {
  toggleOpen: () => void;
  tab: (p: PanelId) => void;
  undo: () => void;
  mark: (k: 'b' | 'i' | 'u') => void;
  clear: () => void;
  kind: (k: BlockKind) => void;
  target: (t: Target) => void;
  color: (c: string | null) => void;
  highlight: (c: string) => void;
  outdent: () => void;
  indent: () => void;
  softBreak: () => void;
  listColor: (c: string | null) => void;
  codeHl: () => void;
  codeLang: (l: string) => void;
  mathInline: () => void;
  toggleDollars: () => void;
  toggleSmart: () => void;
}

type IconName =
  | 'switch'
  | 'text'
  | 'list'
  | 'math'
  | 'code'
  | 'undo'
  | 'clear'
  | 'check'
  | 'quote'
  | 'outdent'
  | 'indent'
  | 'softbreak'
  | 'codeblock'
  | 'codehl'
  | 'dollar'
  | 'spark'
  | 'x';

/** Le stesse icone della barra del sito (stesse linee, stesso spessore). */
function Ico({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  const line = {
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'switch' ? (
        <>
          <Path d="M4 6h9M4 12h6M4 18h9" {...line} />
          <Path d="M15.5 15.5l5-5" {...line} />
          <Path d="M18 8l3 3-6.5 6.5-3.5.5.5-3.5z" {...line} />
        </>
      ) : null}
      {name === 'text' ? (
        <>
          <Path d="M4.8 16.6L10.4 4.6h1.5l5.6 12" {...line} />
          <Path d="M7.1 12.6h8.1" {...line} />
          <Path d="M4.4 20.2h15.2" {...line} opacity={0.45} />
        </>
      ) : null}
      {name === 'list' ? (
        <>
          <Circle cx="4.6" cy="6.5" r="1.35" fill={color} />
          <Path d="M9.5 6.5h10.4" {...line} />
          <Circle cx="4.6" cy="12" r="1.35" fill={color} />
          <Path d="M9.5 12h10.4" {...line} />
          <Circle cx="4.6" cy="17.5" r="1.35" fill={color} />
          <Path d="M9.5 17.5h10.4" {...line} />
        </>
      ) : null}
      {name === 'math' ? (
        <>
          <Path d="M2.8 12.9l2.3 1.2 2.4-8.4h13.7" {...line} />
          <Path d="M11.8 11.2l5.4 6.6" {...line} />
          <Path d="M17.2 11.2l-5.4 6.6" {...line} />
        </>
      ) : null}
      {name === 'code' || name === 'codeblock' ? (
        <>
          <Path d="M8.5 7L3.5 12l5 5" {...line} strokeWidth={1.8} />
          <Path d="M15.5 7l5 5-5 5" {...line} strokeWidth={1.8} />
          {name === 'code' ? (
            <Path d="M13.2 5.5l-2.4 13" {...line} strokeWidth={1.8} opacity={0.7} />
          ) : null}
        </>
      ) : null}
      {name === 'undo' ? (
        <>
          <Path d="M9 6.5L4.5 11 9 15.5" {...line} />
          <Path d="M5 11h9a5.5 5.5 0 010 11h-3.5" {...line} />
        </>
      ) : null}
      {name === 'clear' ? (
        <>
          <Path d="M4 5.5h10" {...line} strokeWidth={1.8} />
          <Path d="M9 5.5v11" {...line} strokeWidth={1.8} />
          <Path d="M15.5 14.5l5 5" {...line} strokeWidth={1.8} />
          <Path d="M20.5 14.5l-5 5" {...line} strokeWidth={1.8} />
        </>
      ) : null}
      {name === 'check' ? (
        <>
          <Circle cx="12" cy="12" r="8.2" {...line} strokeWidth={1.8} />
          <Path d="M8.3 12.2l2.6 2.6 4.9-5.4" {...line} strokeWidth={1.8} />
        </>
      ) : null}
      {name === 'quote' ? (
        <Path
          d="M5 17.5V12c0-3.2 1.7-5.2 4.6-5.8l.6 1.5C8.6 8.3 8 9.3 8 10.6h2.6v6.9zM13.6 17.5V12c0-3.2 1.7-5.2 4.6-5.8l.6 1.5c-1.6.6-2.2 1.6-2.2 2.9H19v6.9z"
          fill={color}
        />
      ) : null}
      {name === 'outdent' || name === 'indent' ? (
        <>
          <Path d="M3.8 5.2h16.4" {...line} />
          <Path d={name === 'outdent' ? 'M3.8 9.7h9.6' : 'M10.6 9.7h9.6'} {...line} />
          <Path d={name === 'outdent' ? 'M3.8 14.3h9.6' : 'M10.6 14.3h9.6'} {...line} />
          <Path d="M3.8 18.8h16.4" {...line} />
          <Path
            d={name === 'outdent' ? 'M20.2 9.4l-3.6 2.6 3.6 2.6z' : 'M3.8 9.4l3.6 2.6-3.6 2.6z'}
            fill={color}
          />
        </>
      ) : null}
      {name === 'softbreak' ? (
        <>
          <Circle cx="4.6" cy="6.8" r="1.35" fill={color} />
          <Path d="M9.5 6.8h10.4" {...line} />
          <Path d="M20 12.4v2.2a2 2 0 01-2 2H10" {...line} />
          <Path d="M12.6 14.1L9.9 16.6l2.7 2.5" {...line} />
        </>
      ) : null}
      {name === 'codehl' ? (
        <>
          <Rect x="3.5" y="9" width="17" height="6" rx="1.5" fill={YELLOW} fillOpacity={0.35} />
          <Path d="M3.5 9v6" stroke={YELLOW} strokeWidth={3} />
        </>
      ) : null}
      {name === 'dollar' ? (
        <>
          <Path d="M12 3.5v17" {...line} />
          <Path
            d="M16.4 7.3c0-1.9-2-3.1-4.4-3.1s-4.4 1.2-4.4 3.1c0 4.1 8.8 2.4 8.8 6.5 0 1.9-2 3.1-4.4 3.1s-4.4-1.2-4.4-3.1"
            {...line}
          />
        </>
      ) : null}
      {name === 'spark' ? (
        <>
          <Path
            d="M12 3.2c.4 3 1 4.9 2.1 6 1.1 1.1 3 1.7 6 2.1-3 .4-4.9 1-6 2.1-1.1 1.1-1.7 3-2.1 6-.4-3-1-4.9-2.1-6-1.1-1.1-3-1.7-6-2.1 3-.4 4.9-1 6-2.1 1.1-1.1 1.7-3 2.1-6z"
            fill={color}
          />
          <Path
            d="M18.6 3.4c.2 1.3.5 2.1.9 2.5.4.4 1.2.7 2.5.9-1.3.2-2.1.5-2.5.9-.4.4-.7 1.2-.9 2.5-.2-1.3-.5-2.1-.9-2.5-.4-.4-1.2-.7-2.5-.9 1.3-.2 2.1-.5 2.5-.9.4-.4.7-1.2.9-2.5z"
            fill={color}
          />
        </>
      ) : null}
      {name === 'x' ? <Path d="M6 6l12 12M18 6L6 18" {...line} strokeWidth={2.6} /> : null}
    </Svg>
  );
}

/** Un tasto della barra: tondo, e quando è acceso la pastiglia chiara dietro l'icona (come lo strumento scelto in GoodNotes). */
function Btn(p: {
  th: Theme;
  testID: string;
  label: string;
  on?: boolean;
  disabled?: boolean;
  wide?: boolean;
  small?: boolean;
  onPress: () => void;
  children: (color: string) => ReactNode;
}) {
  const color = p.on ? p.th.blue : p.th.text;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ selected: !!p.on, disabled: !!p.disabled }}
      disabled={p.disabled}
      hitSlop={4}
      onPress={p.onPress}
      style={({ pressed }) => ({
        minWidth: p.small ? 32 : 36,
        height: p.small ? 30 : 32,
        paddingHorizontal: p.wide ? 12 : p.small ? 5 : 6,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: p.disabled ? 0.32 : 1,
        transform: [{ scale: pressed ? 0.9 : 1 }],
        backgroundColor: p.on ? p.th.surface : 'transparent',
        boxShadow: p.on ? '0 1px 2px rgba(0,0,0,.12)' : undefined,
      })}
    >
      {p.children(color)}
    </Pressable>
  );
}

const Sep = ({ th, margin = 6 }: { th: Theme; margin?: number }) => (
  <View
    style={{
      width: 1,
      height: 18,
      marginHorizontal: margin,
      backgroundColor: th.hairline2,
      flexShrink: 0,
    }}
  />
);

/** Un pallino di colore; quello scelto ha l'anello attorno. */
function Dot(p: {
  th: Theme;
  testID: string;
  label: string;
  color: string | null;
  chosen: boolean;
  size?: number;
  onPress: () => void;
}) {
  const size = p.size ?? 22;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ selected: p.chosen }}
      hitSlop={4}
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: size + 10,
        height: size + 10,
        borderRadius: (size + 10) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: p.chosen ? p.th.blue : 'transparent',
        transform: [{ scale: pressed ? 0.84 : 1 }],
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: p.color ?? p.th.text,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.07)',
        }}
      >
        {p.color === null ? <Ico name="x" size={11} color={p.th.surface} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * La barra del formato di una carta, come quella del sito (public/partials/format_toolbar.php): una pastiglia con il tastino
 * (chiude e riapre), le quattro famiglie (Testo, Elenco, Formula, Codice), «annulla»; toccando una famiglia sotto scorre
 * fuori il suo pannello. Il microfono non c'è: la dettatura vocale non esiste nell'app.
 */
export function FormatBar(p: {
  testID: string;
  state: BarState;
  actions: BarActions;
  /** serve a chi la contiene per sapere che il dito è sulla barra (e non togliere la barra mentre si tocca) */
  onTouch?: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const { state: s, actions: a, testID: id } = p;

  const tab = (panel: PanelId, icon: IconName, label: string) => (
    <Btn
      key={panel}
      th={th}
      testID={`${id}-tab-${panel}`}
      label={label}
      on={s.panel === panel}
      onPress={() => a.tab(panel)}
    >
      {(c) => <Ico name={icon} color={c} />}
    </Btn>
  );

  const shell: ViewStyle = {
    backgroundColor: th.surface2,
    borderRadius: s.open ? 22 : 999,
    boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
    overflow: 'hidden',
    alignSelf: s.open ? 'stretch' : 'flex-start',
  };

  return (
    <View testID={`${id}-bar`} onTouchStart={p.onTouch} style={shell}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingVertical: 3,
          paddingHorizontal: s.open ? 5 : 3,
        }}
      >
        <Pressable
          testID={`${id}-switch`}
          accessibilityRole="button"
          accessibilityLabel={t('editor.formattazione')}
          accessibilityState={{ expanded: s.open }}
          hitSlop={4}
          onPress={a.toggleOpen}
          style={({ pressed }) => ({
            width: s.open ? 36 : 34,
            height: 32,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.88 : 1 }],
          })}
        >
          <Ico name="switch" size={18} color={s.open ? th.text : th.text2} />
          {s.open ? null : (
            <View
              testID={`${id}-switch-dot`}
              style={{
                position: 'absolute',
                right: 5,
                bottom: 6,
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: th.blue,
              }}
            />
          )}
        </Pressable>

        {s.open ? (
          <>
            {tab('font', 'text', t('editor.testo'))}
            {tab('list', 'list', t('editor.elenco'))}
            {tab('math', 'math', t('editor.formula'))}
            {tab('code', 'code', t('editor.codice'))}
            <Sep th={th} />
            <Btn
              th={th}
              testID={`${id}-undo`}
              label={t('editor.annulla')}
              disabled={!s.canUndo}
              onPress={a.undo}
            >
              {(c) => <Ico name="undo" color={c} />}
            </Btn>
          </>
        ) : null}
      </View>

      {s.open && s.panel === 'font' ? (
        <View
          testID={`${id}-panel-font`}
          style={{ paddingBottom: 4, paddingHorizontal: 5, gap: 2 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Btn
              th={th}
              small
              testID={`${id}-b`}
              label={t('editor.grassetto')}
              on={s.marks.b}
              onPress={() => a.mark('b')}
            >
              {(c) => <Text style={{ color: c, fontSize: 16, fontWeight: '800' }}>B</Text>}
            </Btn>
            <Btn
              th={th}
              small
              testID={`${id}-i`}
              label={t('editor.corsivo')}
              on={s.marks.i}
              onPress={() => a.mark('i')}
            >
              {(c) => <Text style={{ color: c, fontSize: 16, fontStyle: 'italic' }}>I</Text>}
            </Btn>
            <Btn
              th={th}
              small
              testID={`${id}-u`}
              label={t('editor.sottolineato')}
              on={s.marks.u}
              onPress={() => a.mark('u')}
            >
              {(c) => (
                <Text style={{ color: c, fontSize: 16, textDecorationLine: 'underline' }}>U</Text>
              )}
            </Btn>
            <Sep th={th} margin={4} />
            <Btn
              th={th}
              small
              testID={`${id}-clear`}
              label={t('editor.cancella_formato')}
              onPress={a.clear}
            >
              {(c) => <Ico name="clear" color={c} />}
            </Btn>
            <Btn
              th={th}
              small
              testID={`${id}-ck`}
              label={t('editor.checklist')}
              on={s.kind === 'ck'}
              onPress={() => a.kind('ck')}
            >
              {(c) => <Ico name="check" color={c} />}
            </Btn>
            <Btn
              th={th}
              small
              testID={`${id}-q`}
              label={t('editor.citazione')}
              on={s.kind === 'q'}
              onPress={() => a.kind('q')}
            >
              {(c) => <Ico name="quote" color={c} />}
            </Btn>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ alignItems: 'center', gap: 2, paddingRight: 8 }}
            accessibilityLabel={t('editor.colore_testo')}
          >
            <View
              style={{
                flexDirection: 'row',
                gap: 2,
                padding: 3,
                marginRight: 4,
                borderRadius: 999,
                backgroundColor: `${th.text2}29`,
              }}
            >
              {(['c', 'h'] as const).map((k) => {
                const on = s.target === k;
                return (
                  <Pressable
                    key={k}
                    testID={`${id}-target-${k}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      k === 'c' ? t('editor.colora_testo') : t('editor.colora_evidenziatore')
                    }
                    accessibilityState={{ selected: on }}
                    onPress={() => a.target(k)}
                    style={{
                      width: 32,
                      height: 26,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? th.surface : 'transparent',
                      boxShadow: on ? '0 1px 3px rgba(0,0,0,.18)' : undefined,
                    }}
                  >
                    {k === 'c' ? (
                      <Text
                        style={{
                          color: on ? th.text : th.text2,
                          fontSize: 14,
                          fontWeight: '800',
                        }}
                      >
                        A
                      </Text>
                    ) : (
                      <Text
                        style={{
                          paddingHorizontal: 6,
                          borderRadius: 4,
                          overflow: 'hidden',
                          backgroundColor: YELLOW,
                          color: '#1c1c1e',
                          fontSize: 14,
                          fontWeight: '700',
                        }}
                      >
                        a
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Dot
              th={th}
              testID={`${id}-c-default`}
              label={t('editor.predefinito')}
              color={null}
              chosen={s.target === 'c' ? s.marks.c === null : s.highlight === 'default'}
              onPress={() => (s.target === 'c' ? a.color(null) : a.highlight('default'))}
            />
            {s.target === 'h' ? (
              <Dot
                th={th}
                testID={`${id}-c-yellow`}
                label={t('editor.giallo')}
                color={YELLOW}
                chosen={s.highlight === 'yellow'}
                onPress={() => a.highlight('yellow')}
              />
            ) : null}
            {SWATCHES.map((c) => {
              const chosen = s.target === 'c' ? s.marks.c === c : s.highlight === c;
              return (
                <Dot
                  key={c}
                  th={th}
                  testID={`${id}-c-${c}`}
                  label={t(`editor.${COLOR_LABEL[c]}`)}
                  color={markColor(th, c)}
                  chosen={chosen}
                  onPress={() =>
                    s.target === 'c'
                      ? a.color(chosen ? null : c)
                      : a.highlight(chosen ? 'yellow' : c)
                  }
                />
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {s.open && s.panel === 'list' ? (
        <View
          testID={`${id}-panel-list`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingBottom: 4,
            paddingHorizontal: 5,
          }}
        >
          <Btn
            th={th}
            small
            testID={`${id}-out`}
            label={t('editor.riduci_livello')}
            onPress={a.outdent}
          >
            {(c) => <Ico name="outdent" color={c} />}
          </Btn>
          <Btn th={th} small testID={`${id}-in`} label={t('editor.sotto_punto')} onPress={a.indent}>
            {(c) => <Ico name="indent" color={c} />}
          </Btn>
          <Btn
            th={th}
            small
            testID={`${id}-softbreak`}
            label={t('editor.a_capo')}
            onPress={a.softBreak}
          >
            {(c) => <Ico name="softbreak" color={c} />}
          </Btn>
          <Sep th={th} margin={4} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: 'center', gap: 0, paddingRight: 8 }}
            accessibilityLabel={t('editor.colore_pallini')}
          >
            <Dot
              th={th}
              size={18}
              testID={`${id}-lc-default`}
              label={t('editor.predefinito')}
              color={null}
              chosen={s.listColor === null}
              onPress={() => a.listColor(null)}
            />
            {LIST_SWATCHES.map((c) => (
              <Dot
                key={c}
                th={th}
                size={18}
                testID={`${id}-lc-${c}`}
                label={t(`editor.${COLOR_LABEL[c]}`)}
                color={markColor(th, c)}
                chosen={s.listColor === c}
                onPress={() => a.listColor(s.listColor === c ? null : c)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {s.open && s.panel === 'code' ? (
        <View
          testID={`${id}-panel-code`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingBottom: 4,
            paddingHorizontal: 5,
          }}
        >
          <Btn
            th={th}
            small
            wide
            testID={`${id}-code`}
            label={t('editor.blocco_codice')}
            on={s.kind === 'code'}
            onPress={() => a.kind('code')}
          >
            {(c) => (
              <>
                <Ico name="codeblock" size={18} color={c} />
                <Text
                  style={{
                    color: s.kind === 'code' ? c : th.text2,
                    fontSize: 12.5,
                    fontWeight: '600',
                  }}
                >
                  {t('editor.blocco_codice')}
                </Text>
              </>
            )}
          </Btn>
          <Btn
            th={th}
            small
            testID={`${id}-codehl`}
            label={t('editor.evidenzia_riga')}
            on={s.codeHl}
            onPress={a.codeHl}
          >
            {() => <Ico name="codehl" color={th.text} />}
          </Btn>
          <Sep th={th} margin={4} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 6, padding: 2 }}
          >
            {['auto', ...Object.keys(CODE_LANGS)].map((l) => {
              const on = s.kind === 'code' && s.codeLang === l;
              return (
                <Pressable
                  key={l}
                  testID={`${id}-lang-${l}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => a.codeLang(l)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 99,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? th.blue : `${th.text}17`,
                  }}
                >
                  <Text style={{ color: on ? '#fff' : th.text, fontSize: 13, fontWeight: '600' }}>
                    {l === 'auto'
                      ? t('editor.codice_auto')
                      : l === 'other'
                        ? t('editor.codice_altro')
                        : (CODE_LANGS[l] ?? l)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {s.open && s.panel === 'math' ? (
        <View
          testID={`${id}-panel-math`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingBottom: 4,
            paddingHorizontal: 5,
          }}
        >
          <Btn
            th={th}
            small
            wide
            testID={`${id}-mathinline`}
            label={t('editor.formula_in_linea')}
            onPress={() => a.mathInline()}
          >
            {() => (
              <>
                <Text
                  style={{
                    color: th.blue,
                    fontSize: 17,
                    fontStyle: 'italic',
                    fontFamily: 'Times New Roman',
                    fontWeight: '700',
                  }}
                >
                  x
                </Text>
                <Text style={{ color: th.text2, fontSize: 12.5, fontWeight: '600' }}>
                  {t('editor.in_linea')}
                </Text>
              </>
            )}
          </Btn>
          <Btn
            th={th}
            small
            wide
            testID={`${id}-mathblock`}
            label={t('editor.formula_a_blocco')}
            on={s.kind === 'fx'}
            onPress={() => a.kind('fx')}
          >
            {(c) => (
              <>
                <Text
                  style={{
                    color: th.blue,
                    fontSize: 17,
                    fontStyle: 'italic',
                    fontFamily: 'Times New Roman',
                    fontWeight: '700',
                  }}
                >
                  x
                </Text>
                <Text
                  style={{
                    color: s.kind === 'fx' ? c : th.text2,
                    fontSize: 12.5,
                    fontWeight: '600',
                  }}
                >
                  {t('editor.a_blocco')}
                </Text>
              </>
            )}
          </Btn>
          <Sep th={th} margin={4} />
          <Btn
            th={th}
            small
            testID={`${id}-dollars`}
            label={t('editor.dollari_titolo')}
            on={s.dollars}
            onPress={a.toggleDollars}
          >
            {(c) => <Ico name="dollar" color={c} />}
          </Btn>
          <Btn
            th={th}
            small
            testID={`${id}-smart`}
            label={t('editor.intelligente_titolo')}
            on={s.smart}
            onPress={a.toggleSmart}
          >
            {(c) => <Ico name="spark" color={c} />}
          </Btn>
        </View>
      ) : null}
    </View>
  );
}

const COLOR_LABEL = {
  red: 'rosso',
  orange: 'arancione',
  gold: 'oro',
  green: 'verde',
  teal: 'turchese',
  blue: 'blu',
  indigo: 'indaco',
  purple: 'viola',
  pink: 'rosa',
  brown: 'marrone',
  gray: 'grigio',
} as const;
