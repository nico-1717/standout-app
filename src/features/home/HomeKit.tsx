import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { Theme } from '@/core/theme/ThemeProvider';
import { Avatar } from '@/ui/Avatar';
import { Text } from '@/ui/CappedText';

/**
 * I colori e i pezzi della Home del sito (dashboard.css). La Home ha sempre il suo aspetto iOS, qualunque stile
 * (Glass o Calm paper) sia scelto per Planner e To do: lo stesso vale qui.
 */
export interface Ho {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  text3: string;
  hair: string;
  hair2: string;
  blue: string;
  blueInk: string;
  blueSoft: string;
  green: string;
  greenInk: string;
  greenSoft: string;
  red: string;
  redInk: string;
  redSoft: string;
  orange: string;
  orangeInk: string;
  orangeSoft: string;
  purple: string;
  purpleSoft: string;
  indigo: string;
  teal: string;
  pink: string;
  shadow: string;
}

export function hoTheme(th: Theme): Ho {
  const dark = th.scheme === 'dark';
  return dark
    ? {
        dark,
        bg: '#000000',
        surface: '#1C1C1E',
        surface2: '#2C2C2E',
        text: '#F5F5F7',
        text2: '#A1A1A8',
        text3: '#636366',
        hair: 'rgba(84,84,88,.42)',
        hair2: 'rgba(84,84,88,.62)',
        blue: '#0A84FF',
        blueInk: '#4DA3FF',
        blueSoft: 'rgba(10,132,255,.18)',
        green: '#30D158',
        greenInk: '#5FDB82',
        greenSoft: 'rgba(52,199,89,.17)',
        red: '#FF453A',
        redInk: '#FF6961',
        redSoft: 'rgba(255,69,58,.18)',
        orange: '#FF9F0A',
        orangeInk: '#FFB340',
        orangeSoft: 'rgba(255,159,10,.2)',
        purple: '#BF5AF2',
        purpleSoft: 'rgba(191,90,242,.2)',
        indigo: '#5E5CE6',
        teal: '#40C8E0',
        pink: '#FF375F',
        shadow: '0 1px 1px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.5)',
      }
    : {
        dark,
        bg: '#F2F2F7',
        surface: '#FFFFFF',
        surface2: '#F2F2F7',
        text: '#1C1C1E',
        text2: '#6C6C70',
        text3: '#AEAEB2',
        hair: 'rgba(60,60,67,.12)',
        hair2: 'rgba(60,60,67,.22)',
        blue: '#007AFF',
        blueInk: '#0062D6',
        blueSoft: 'rgba(0,122,255,.10)',
        green: '#34C759',
        greenInk: '#1E8E3E',
        greenSoft: 'rgba(52,199,89,.14)',
        red: '#FF3B30',
        redInk: '#C4291C',
        redSoft: 'rgba(255,59,48,.12)',
        orange: '#FF9500',
        orangeInk: '#A35A00',
        orangeSoft: 'rgba(255,149,0,.15)',
        purple: '#AF52DE',
        purpleSoft: 'rgba(175,82,222,.12)',
        indigo: '#5856D6',
        teal: '#30B0C7',
        pink: '#FF2D55',
        shadow: '0 1px 1px rgba(0,0,0,.04), 0 10px 30px rgba(0,0,0,.07)',
      };
}

/** Le stesse icone a linea del sito (H.IC di home_core.js): tratto 2, estremi arrotondati. */
const IC: Record<string, string> = {
  calendar: '<path d="M7 3v3M17 3v3M4 8h16"/><rect x="4" y="5" width="16" height="16" rx="2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  heart:
    '<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0112 6.6 5.2 5.2 0 0121.3 12C19 16.6 12 21 12 21z"/>',
  cards: '<rect x="7" y="3" width="13" height="16" rx="2.4"/><path d="M4 7.2V19a2 2 0 002 2h9.6"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11.4V17c0 1.1 2.7 3 6 3s6-1.9 6-3v-5.6"/>',
  chart: '<path d="M3 3v18h18"/><path d="M19 9l-5 5-4-4-3 3"/>',
  sliders:
    '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/>',
  pill: '<path d="M10.5 20.5a5 5 0 01-7-7l10-10a5 5 0 017 7z"/><path d="M8.5 8.5l7 7"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  book: '<path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3z"/><path d="M4 17a3 3 0 013-3h12"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  note: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 11h8M8 15h5"/>',
  globe:
    '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5s-1.3 6.7-3.9 9.5c-2.6-2.8-3.9-6-3.9-9.5s1.3-6.7 3.9-9.5z"/>',
  play: '<path d="M8 5.1v13.8a1 1 0 001.5.9l11-6.9a1 1 0 000-1.8l-11-6.9A1 1 0 008 5.1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flame:
    '<path d="M12.6 2.2c.4 2.6-.5 4.6-2.2 6.3-1.4 1.4-2.9 2.8-2.9 5.4 0 1 .3 1.8.8 2.5-.9-.3-1.7-1-2.2-1.9C5 16 5 17 5 17.6 5 21 8 23 12 23s7-2.4 7-6.5c0-3.2-1.6-5.2-3-7 .1 1.3-.3 2.4-1 3.1.2-3.9-.9-7.6-2.4-10.4z"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  bars: '<path d="M3 20h18M6 20V10M10 20V5M14 20v-8M18 20V8"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
};
export type HoIconName = keyof typeof IC;

/** Un disegno a linea: le stringhe sopra sono costanti di questo file (path, rect, circle), mai dati dell'utente. */
export function HoIcon({
  name,
  color,
  size = 18,
  sw = 2,
}: {
  name: HoIconName;
  color: string;
  size?: number;
  sw?: number;
}) {
  const src = IC[name] ?? '';
  const parts = [...src.matchAll(/<(path|rect|circle)\s+([^/]*)\/>/g)];
  const attrs = (s: string) =>
    Object.fromEntries([...s.matchAll(/([a-z]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
  const line = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {parts.map((p, i) => {
        const a = attrs(p[2]!);
        if (p[1] === 'path') return <Path key={i} d={a.d} {...line} />;
        if (p[1] === 'rect')
          return (
            <Rect
              key={i}
              x={Number(a.x)}
              y={Number(a.y)}
              width={Number(a.width)}
              height={Number(a.height)}
              rx={Number(a.rx ?? 0)}
              {...line}
            />
          );
        return <Circle key={i} cx={Number(a.cx)} cy={Number(a.cy)} r={Number(a.r)} {...line} />;
      })}
    </Svg>
  );
}

/** Mescola due colori «#RRGGBB» (color-mix in srgb del sito). */
export function tint(a: string, b: string, ratio: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return (
    '#' +
    x
      .map((v, i) =>
        Math.round(v * ratio + y[i]! * (1 - ratio))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** L'intestazione: data in maiuscoletto, saluto, a destra la serie di giorni e il tasto «Personalizza». */
export function HoHeader({
  ho,
  top,
  date,
  hello,
  streak,
  editing,
  onEdit,
  letter,
  onAvatar,
  avatarLabel,
  editLabel,
}: {
  ho: Ho;
  top: number;
  date: string;
  hello: string;
  streak: number;
  editing: boolean;
  onEdit: () => void;
  letter: string;
  onAvatar: () => void;
  avatarLabel: string;
  editLabel: string;
}) {
  return (
    <View style={{ paddingTop: top + 22, paddingHorizontal: 16 }}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: ho.text2,
              fontSize: 12.5,
              fontWeight: '700',
              letterSpacing: 0.75,
              textTransform: 'uppercase',
            }}
          >
            {date}
          </Text>
          <Text
            testID="home-greeting"
            accessibilityRole="header"
            style={{
              color: ho.text,
              marginTop: 2,
              fontSize: 26,
              lineHeight: 28.6,
              fontWeight: '800',
              letterSpacing: -0.65,
            }}
          >
            {hello}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {
            <View
              testID="home-streak"
              style={{
                height: 38,
                paddingHorizontal: 13,
                borderRadius: 999,
                backgroundColor: ho.orangeSoft,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Text style={{ color: ho.orangeInk, fontWeight: '800', fontSize: 14.5 }}>
                {`🔥 ${streak}`}
              </Text>
            </View>
          }
          <Pressable
            testID={editing ? 'home-done' : 'home-customise'}
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            accessibilityState={{ selected: editing }}
            onPress={onEdit}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: editing ? ho.blue : ho.surface,
              boxShadow: ho.shadow,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            })}
          >
            <HoIcon name="sliders" size={18} color={editing ? '#FFFFFF' : ho.text} />
          </Pressable>
        </View>
      </View>
      {/* il pallino del profilo: fisso in alto a destra, come .standout-fab-avatar */}
      <View style={{ position: 'absolute', top: top + 18, right: 16 }}>
        <Avatar
          letter={letter}
          label={avatarLabel}
          onPress={onAvatar}
          testID="home-avatar"
          size={42}
        />
      </View>
    </View>
  );
}

/** Una scorciatoia a un tocco: quadrato con l'icona a colori, nome sotto (.ho-qa). */
export type Quick = { key: string; label: string; icon: HoIconName; color: string };

export function HoQuick({
  ho,
  items,
  onGo,
  testIDOf,
  iconTestIDOf,
}: {
  ho: Ho;
  items: Quick[];
  onGo: (key: string) => void;
  testIDOf: (key: string) => string;
  iconTestIDOf?: (key: string) => string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 }}
    >
      {items.map((s) => (
        <Pressable
          key={s.key}
          testID={testIDOf(s.key)}
          accessibilityRole="button"
          accessibilityLabel={s.label}
          onPress={() => onGo(s.key)}
          style={({ pressed }) => ({
            width: 78,
            alignItems: 'center',
            gap: 7,
            paddingTop: 12,
            paddingBottom: 10,
            paddingHorizontal: 4,
            borderRadius: 18,
            backgroundColor: ho.surface,
            boxShadow: ho.shadow,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <LinearGradient
            testID={iconTestIDOf?.(s.key)}
            colors={[tint(s.color, '#FFFFFF', 0.82), s.color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px -4px ${s.color}`,
            }}
          >
            <HoIcon name={s.icon} size={22} color="#FFFFFF" />
          </LinearGradient>
          <Text
            numberOfLines={1}
            style={{ color: ho.text, fontSize: 13.5, fontWeight: '600', lineHeight: 15 }}
          >
            {s.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Il riquadro della griglia (.ho-w): superficie, 22 di raggio, titolo con l'icona colorata e «Apri ›» a destra. */
export function HoWidget({
  ho,
  id,
  title,
  icon,
  color,
  action,
  onAction,
  children,
}: {
  ho: Ho;
  id: string;
  title?: string;
  icon?: HoIconName;
  color?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View
      testID={`home-w-${id}`}
      style={{
        backgroundColor: ho.surface,
        borderRadius: 22,
        padding: 16,
        gap: 12,
        boxShadow: ho.shadow,
      }}
    >
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 }}>
          {icon ? (
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: color ?? ho.blue,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
              }}
            >
              <HoIcon name={icon} size={17} color="#FFFFFF" />
            </View>
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: ho.text,
              fontSize: 17,
              fontWeight: '800',
              letterSpacing: -0.17,
            }}
          >
            {title}
          </Text>
          {action ? (
            <Pressable
              testID={`home-open-${id}`}
              accessibilityRole="button"
              onPress={onAction}
              hitSlop={8}
              style={{ paddingVertical: 6, paddingHorizontal: 4 }}
            >
              <Text style={{ color: ho.blueInk, fontSize: 13.5, fontWeight: '600' }}>{action}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Pastiglietta con un numero o una data (.ho-chip): neutra, rossa, blu, verde o arancione. */
export function HoChip({
  ho,
  tone = 'grey',
  children,
}: {
  ho: Ho;
  tone?: 'grey' | 'red' | 'blue' | 'green' | 'orange';
  children: ReactNode;
}) {
  const t = {
    grey: [ho.surface2, ho.text2],
    red: [ho.redSoft, ho.redInk],
    blue: [ho.blueSoft, ho.blueInk],
    green: [ho.green + '24', ho.greenInk],
    orange: [ho.orangeSoft, ho.orangeInk],
  }[tone];
  return (
    <View
      style={{
        height: 24,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: t[0],
        justifyContent: 'center',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: t[1], fontSize: 12.5, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

/** Il titolo di una sezione con il conto e la pillola «Apri …» col colore della sezione (secHead/openBtn). */
export function HoSecHead({
  ho,
  title,
  count,
  openLabel,
  openColor,
  onOpen,
  testID,
}: {
  ho: Ho;
  title: string;
  count?: number;
  openLabel?: string;
  openColor?: string;
  onOpen?: () => void;
  testID?: string;
}) {
  const c = openColor ?? ho.blue;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: ho.hair,
        marginBottom: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Text style={cap(ho)}>{title}</Text>
        {count ? <HoChip ho={ho}>{count}</HoChip> : null}
      </View>
      {openLabel ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => ({
            height: 28,
            paddingLeft: 11,
            paddingRight: 4,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: tint(c, ho.surface, 0.12),
            boxShadow: `inset 0 0 0 1px ${c}40`,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <Text style={{ color: ho.text, fontSize: 12.5, fontWeight: '700' }}>{openLabel}</Text>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: c,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HoIcon name="right" size={11} color="#FFFFFF" sw={2.8} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Il «cap» del sito: 12px, maiuscolo, spaziato (.ho-cap). */
export const cap = (ho: Ho) =>
  ({
    color: ho.text2,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.72,
    textTransform: 'uppercase',
  }) as const;

/** Il cerchio per spuntare (.ho-chk). */
export function HoCheck({
  ho,
  color,
  label,
  onPress,
  testID,
}: {
  ho: Ho;
  color?: string;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const [on, setOn] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={6}
      onPress={() => {
        setOn(true);
        onPress();
      }}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: on ? (color ?? ho.green) : ho.hair2,
        backgroundColor: on ? (color ?? ho.green) : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <HoIcon name="check" size={14} color="#FFFFFF" sw={3.4} /> : null}
    </Pressable>
  );
}

/** Gli anelli concentrici delle abitudini di oggi (drawRing): uno per ritmo, il primo è il più interno. */
export function HoRings({
  ho,
  rings,
  size = 68,
}: {
  ho: Ho;
  rings: { key: 'daily' | 'weekly' | 'monthly' | 'interval'; done: number; total: number }[];
  size?: number;
}) {
  const color = { daily: ho.pink, weekly: ho.orange, monthly: ho.purple, interval: ho.teal };
  const n = Math.max(1, rings.length);
  const full = rings.length > 0 && rings.every((r) => r.total > 0 && r.done >= r.total);
  const track = ho.dark ? 'rgba(245,245,247,.11)' : 'rgba(28,28,30,.11)';
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 46 46"
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {Array.from({ length: n }, (_, i) => {
          const r = 21 - (n - 1 - i) * (3.4 + 0.9);
          if (r < 3) return null;
          const C = 2 * Math.PI * r;
          const rg = rings[i];
          const frac = rg && rg.total > 0 ? Math.min(1, rg.done / rg.total) : 0;
          return (
            <G key={i}>
              <Circle cx={23} cy={23} r={r} stroke={track} strokeWidth={3.4} fill="none" />
              {rg ? (
                <Circle
                  cx={23}
                  cy={23}
                  r={r}
                  stroke={color[rg.key]}
                  strokeWidth={3.4}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${C}`}
                  strokeDashoffset={C * (1 - frac)}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: full ? 1 : 0.5,
        }}
      >
        <HoIcon name="check" size={16} color={full ? ho.green : ho.text3} sw={2.4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingRight: 54, minHeight: 62 },
});
