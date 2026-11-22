/**
 * I pezzi del foglio dell'evento, ricalcati da planner_fogli.css del sito: il foglio con la maniglia, i campi con
 * l'etichetta in maiuscoletto, le righe «etichetta a sinistra, controllo a destra», le pillole, gli interruttori.
 */
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { mix } from '@/features/buy/buyTheme';
import { Text } from '@/ui/CappedText';

import type { PlannerTheme } from './plannerTheme';

/** `--r-md` e `--r-xl` del sito. */
export const R_MD = 14;
export const R_XL = 28;

/** Il colore del campo di un foglio: la carta, con un filo sottile (`box-shadow: inset 0 0 0 .5px var(--hair)`). */
export const fieldBox = (pt: PlannerTheme): ViewStyle => ({
  backgroundColor: pt.fill,
  borderRadius: R_MD,
  borderWidth: 0.5,
  borderColor: pt.hair,
});

/** Un campo del foglio (`.pl-field`): etichetta piccola sopra, margine sotto. */
export function Field({
  pt,
  label,
  children,
}: {
  pt: PlannerTheme;
  label?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ marginBottom: 13 }}>
      {label ? <FieldLabel pt={pt}>{label}</FieldLabel> : null}
      {children}
    </View>
  );
}

/** `.pl-label`: 9,5 px, interlettera ampio, maiuscolo. */
export function FieldLabel({ pt, children }: { pt: PlannerTheme; children: ReactNode }) {
  return (
    <Text
      style={{
        marginHorizontal: 2,
        marginBottom: 5,
        color: pt.ink3,
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 1.8,
        textTransform: 'uppercase',
        fontFamily: pt.sans,
      }}
    >
      {children}
    </Text>
  );
}

/** `.pl-row-sb`: etichetta a sinistra, controllo a destra, filo sotto (tranne l'ultima riga). */
export function RowSB({
  pt,
  label,
  last,
  children,
}: {
  pt: PlannerTheme;
  label?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: pt.hair,
      }}
    >
      <Text style={{ color: pt.ink, fontSize: 14.5, fontFamily: pt.sans }}>{label ?? ''}</Text>
      <View style={{ flexShrink: 1 }}>{children}</View>
    </View>
  );
}

/** `.pl-pick`: la pillola di un valore (data, ora, scelta). */
export function PickBox({
  pt,
  children,
  style,
}: {
  pt: PlannerTheme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        fieldBox(pt),
        { paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', flexDirection: 'row' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** `.pl-seg`: un selettore a pillole (Evento / Task, Normale / Importante / Importantissimo). */
export function Seg<T extends string>({
  pt,
  options,
  value,
  onChange,
  small,
  tight,
  testID,
}: {
  pt: PlannerTheme;
  options: { id: T; label: string; testID?: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
  /** ancora più stretta (la priorità, che deve stare a destra sulla riga del tipo) */
  tight?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        backgroundColor: pt.fill,
        borderRadius: 999,
        padding: small ? 2 : 2.5,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            testID={o.testID}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={{
              paddingVertical: small ? 5 : 8,
              paddingHorizontal: tight ? 7 : small ? 11 : 6,
              borderRadius: 999,
              backgroundColor: on ? pt.fillOn : 'transparent',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : undefined,
            }}
          >
            <Text
              style={{
                color: on ? pt.ink : pt.ink2,
                fontSize: tight ? 11.5 : 12.5,
                fontWeight: on ? '500' : '400',
                fontFamily: pt.sans,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** `.pl-toggle`: 44×26, la pallina scorre. */
export function Toggle({
  pt,
  on,
  onChange,
  testID,
}: {
  pt: PlannerTheme;
  on: boolean;
  onChange: (v: boolean) => void;
  testID: string;
}) {
  const off =
    pt.style === 'paper' ? (pt.dark ? '#332E26' : '#EAE4DA') : pt.dark ? '#39393D' : '#E5E5EA';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: on ? pt.accent : off,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: pt.card,
          boxShadow: '0 1px 3px rgba(0,0,0,.22)',
          transform: [{ translateX: on ? 18 : 0 }],
        }}
      />
    </Pressable>
  );
}

/** `.pl-tag`: una pillola con il pallino del colore; accesa si tinge del suo colore. */
export function Tag({
  pt,
  label,
  color,
  on,
  onPress,
  testID,
  dot = true,
  trailing,
}: {
  pt: PlannerTheme;
  label: string;
  color?: string;
  on: boolean;
  onPress: () => void;
  testID?: string;
  dot?: boolean;
  trailing?: ReactNode;
}) {
  const ev = color ?? pt.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: on ? mix(ev, pt.card, 0.3) : pt.fill,
        borderWidth: on ? 1 : 0.5,
        borderColor: on ? mix(ev, pt.card, 0.6) : pt.hair,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {dot ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ev }} /> : null}
      <Text
        style={{ color: on ? pt.ink : pt.ink2, fontSize: 13, fontFamily: pt.sans }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

/** `.pl-sw`: un campione di colore, 34 px; quello scelto cresce e ha l'anello. */
export function Swatch({
  pt,
  color,
  on,
  onPress,
  testID,
  size = 34,
}: {
  pt: PlannerTheme;
  color: string;
  on: boolean;
  onPress: () => void;
  testID: string;
  size?: number;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 0.5,
        borderColor: pt.hair2,
        transform: [{ scale: on ? 1.1 : 1 }],
        boxShadow: on ? `0 0 0 2px ${pt.card}, 0 0 0 3.4px ${color}` : undefined,
      }}
    />
  );
}

/** `.pl-icon-btn`: il tondo da 32 px con un'icona a filo. */
export function IconBtn({
  pt,
  testID,
  label,
  onPress,
  children,
}: {
  pt: PlannerTheme;
  testID: string;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pt.fillOn,
        borderWidth: 0.5,
        borderColor: pt.hair,
      }}
    >
      {children}
    </Pressable>
  );
}

const ICONS = {
  folder:
    'M4 7.5A1.5 1.5 0 015.5 6h4l1.6 2H18a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0118 18H5.5A1.5 1.5 0 014 16.5z',
  pin: 'M12 21s-6.5-5.6-6.5-10a6.5 6.5 0 1113 0c0 4.4-6.5 10-6.5 10z',
  bookmark: 'M7 4h10a1 1 0 011 1v15l-6-3.5L6 20V5a1 1 0 011-1z',
  book: 'M7 4h11a1 1 0 011 1v14a1 1 0 01-1 1H7zM4 8h3M4 12h3M4 16h3M9.5 16c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5',
  trash: 'M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10.5 11v6M13.5 11v6',
  chevron: 'M6 9l6 6 6-6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  spark: 'M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z',
  close: 'M6 6l12 12M18 6L6 18',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
  bell: 'M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0',
} as const;
export type SheetIcon = keyof typeof ICONS;

export function SheetGlyph({
  name,
  color,
  size = 15,
  stroke = 1.8,
}: {
  name: SheetIcon;
  color: string;
  size?: number;
  stroke?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={ICONS[name]}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {name === 'pin' ? (
        <Path d="M12 9a2 2 0 100 4 2 2 0 000-4z" stroke={color} strokeWidth={stroke} />
      ) : null}
      {name === 'book' ? (
        <Path d="M12.5 8a2 2 0 100 4 2 2 0 000-4z" stroke={color} strokeWidth={stroke} />
      ) : null}
    </Svg>
  );
}

/**
 * Il lucchetto della durata (`.pl-lock`), a tre stati come sul sito: `auto` pallido e sbarrato, `chiuso` e `aperto`
 * accesi (cambia solo l'archetto).
 */
export function LockBtn({
  pt,
  state,
  label,
  onPress,
}: {
  pt: PlannerTheme;
  state: 'auto' | 'chiuso' | 'aperto';
  label: string;
  onPress: () => void;
}) {
  const decided = state !== 'auto';
  const color = decided ? pt.accentInk : pt.ink3;
  return (
    <Pressable
      testID="sheet-lock"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ checked: state === 'chiuso' }}
      onPress={onPress}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: state === 'auto' ? 0.34 : 1,
        backgroundColor: decided ? pt.accentSoft : pt.card,
        borderWidth: decided ? 0.5 : 0.5,
        borderColor: decided ? pt.accent : pt.hair,
      }}
    >
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7.2 11h9.6a2.2 2.2 0 012.2 2.2v4.6a2.2 2.2 0 01-2.2 2.2H7.2A2.2 2.2 0 015 17.8v-4.6A2.2 2.2 0 017.2 11z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={state === 'aperto' ? 'M8.5 11V8a3.5 3.5 0 016.9-1.2' : 'M8.5 11V8a3.5 3.5 0 017 0v3'}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        {state === 'auto' ? (
          <Path d="M4.6 19.4L19.4 4.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        ) : null}
      </Svg>
    </Pressable>
  );
}

/**
 * Il menu a tendina del sito (`<select>`): la pillola col valore e la freccia; toccandola si apre l'elenco delle scelte.
 * Le righe hanno testID `${testID}-${id}`.
 */
export function SelectField<T extends string>({
  pt,
  options,
  value,
  onChange,
  testID,
  title,
  wide,
  compact,
  icon,
  trigger,
  bigDots,
  glass,
}: {
  pt: PlannerTheme;
  /** un disegno davanti al valore (quando la scelta non ha un titolo sopra) */
  icon?: SheetIcon;
  /** al posto del campo: un proprio tastino che apre lo stesso elenco (il cerchio del colore) */
  trigger?: (open: () => void) => ReactNode;
  /** i pallini colorati dell'elenco grandi (i colori con il loro nome) */
  bigDots?: boolean;
  /** campo secondario: più basso e quasi trasparente (ripetizione, avviso) */
  glass?: boolean;
  /** `dot`: il pallino colorato davanti (le categorie) */
  options: { id: T; label: string; dot?: string }[];
  value: T;
  onChange: (v: T) => void;
  testID: string;
  title?: string;
  wide?: boolean;
  /** si stringe quanto serve (niente larghezza minima), per stare accanto ad altro */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentOpt = options.find((o) => o.id === value);
  const current = currentOpt?.label ?? '';
  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={title ?? current}
          accessibilityValue={{ text: current }}
          onPress={() => setOpen(true)}
          style={[
            fieldBox(pt),
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              paddingHorizontal: 12,
              minHeight: 38,
              minWidth: wide || compact ? 0 : 120,
            },
            wide ? { alignSelf: 'stretch' } : null,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            {icon ? <SheetGlyph name={icon} color={pt.ink3} size={glass ? 15 : 16} /> : null}
            {currentOpt?.dot ? (
              <View
                style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: currentOpt.dot }}
              />
            ) : null}
            <Text
              style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans, flexShrink: 1 }}
              numberOfLines={1}
            >
              {current}
            </Text>
          </View>
          <SheetGlyph name="chevron" color={pt.ink2} size={14} />
        </Pressable>
      )}
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          testID={`${testID}-backdrop`}
          accessibilityLabel={title}
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 28,
            backgroundColor: 'rgba(0,0,0,.28)',
          }}
        >
          <View
            style={{
              borderRadius: 18,
              backgroundColor: pt.card,
              overflow: 'hidden',
              maxHeight: '70%',
              boxShadow: '0 24px 60px -12px rgba(0,0,0,.4)',
            }}
          >
            <ScrollView>
              {options.map((o, i) => {
                const on = o.id === value;
                return (
                  <Pressable
                    key={o.id}
                    testID={`${testID}-${o.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setOpen(false);
                      onChange(o.id);
                    }}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 18,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopWidth: i ? 0.5 : 0,
                      borderTopColor: pt.hair,
                      backgroundColor: on ? pt.accentSoft : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {o.dot ? (
                        <View
                          style={{
                            width: bigDots ? 22 : 10,
                            height: bigDots ? 22 : 10,
                            borderRadius: bigDots ? 11 : 5,
                            backgroundColor: o.dot,
                          }}
                        />
                      ) : null}
                      <Text
                        style={{
                          color: on ? pt.accentInk : pt.ink,
                          fontSize: 15.5,
                          fontWeight: on ? '600' : '400',
                          fontFamily: pt.sans,
                        }}
                      >
                        {o.label}
                      </Text>
                    </View>
                    {on ? <Text style={{ color: pt.accentInk, fontWeight: '700' }}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Il foglio vero e proprio (`.pl-ov` + `.pl-sheet`): lo sfondo scurito, il pannello in basso con gli angoli alti
 * arrotondati, la maniglia e la testata. `tint` lo colora leggermente (`pl-sheet-tinted`); `tall` lo alza (88 %).
 */
export function SheetPanel({
  pt,
  tint,
  tall,
  head,
  onBackdrop,
  onClose,
  children,
}: {
  pt: PlannerTheme;
  tint?: string;
  tall?: boolean;
  head: ReactNode;
  onBackdrop: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          testID="sheet-backdrop"
          accessibilityLabel="backdrop"
          onPress={onBackdrop}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: pt.dark ? 'rgba(0,0,0,.5)' : 'rgba(76,70,63,.24)',
          }}
        />
        <View
          style={{
            width: '100%',
            maxWidth: 620,
            alignSelf: 'center',
            height: tall ? '88%' : '78%',
            backgroundColor: tint ? mix(tint, pt.card, 0.12) : pt.card,
            borderTopLeftRadius: R_XL,
            borderTopRightRadius: R_XL,
            overflow: 'hidden',
            boxShadow: '0 -20px 60px -12px rgba(0,0,0,.28)',
          }}
        >
          <View
            style={{
              width: 34,
              height: 4,
              borderRadius: 99,
              backgroundColor: pt.hair2,
              alignSelf: 'center',
              marginTop: 8,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              paddingTop: 10,
              paddingHorizontal: 14,
              paddingBottom: 8,
            }}
          >
            {head}
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** `.pl-txt-btn`: il testo che fa da pulsante nella testata (Annulla, Salva, Chiudi). */
export function TxtBtn({
  pt,
  label,
  onPress,
  testID,
  strong,
}: {
  pt: PlannerTheme;
  label: string;
  onPress: () => void;
  testID: string;
  strong?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={{ paddingVertical: 4, paddingHorizontal: 2 }}
    >
      <Text
        style={{
          color: strong ? pt.accentInk : pt.ink2,
          fontSize: 14.5,
          fontWeight: strong ? '500' : '400',
          fontFamily: pt.sans,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
