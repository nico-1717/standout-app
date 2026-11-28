import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import { tint } from '@/features/home/HomeKit';

import { LEVEL_COLORS, type Level } from '../levels';

/*
 * I pezzi della carta del gioco, uguali a fc_game.php / fc_game.css del sito: l'intestazione con la strada, l'anello e
 * i tasti tondi; la carta con la stella e la matita negli angoli, il livello in mezzo, l'etichetta con la bandiera, il
 * posto della risposta velato a puntini; i tre voti tondi; «Indietro» e «Concludi» sotto.
 */

const PILL_SHADOW: ViewStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.22,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
};

/** Un'icona a tratto, 24×24 come quelle del sito. */
export function Icon({
  d,
  size = 19,
  color,
  width = 2,
  fill,
}: {
  d: string | string[];
  size?: number;
  color: string;
  width?: number;
  fill?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(Array.isArray(d) ? d : [d]).map((x) => (
        <Path
          key={x}
          d={x}
          fill={fill ? color : 'none'}
          stroke={fill ? 'none' : color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

export const ICONS = {
  gear: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  ],
  mic: [
    'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z',
    'M19 10v2a7 7 0 0 1-14 0v-2',
    'M12 19v3',
  ],
  close: 'M6 6l12 12M18 6 6 18',
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
  star: 'm12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8Z',
  pencil: ['M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'],
  eye: [
    'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z',
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  ],
  wrong: 'M6 6l12 12M18 6 6 18',
  right: 'M5 12.5 10 17l9-10',
  learnt: ['M12 3 2 8l10 5 10-5-10-5Z', 'M6 10.5V16c0 1 2.7 3 6 3s6-2 6-3v-5.5', 'M22 8v6'],
  back: 'M15 6l-6 6 6 6',
  fwd: 'M9 6l6 6-6 6',
};

/** Il tasto tondo dell'intestazione (.icon-btn): 38px, superficie, ombra leggera. */
export function IconBtn(p: {
  testID: string;
  label: string;
  onPress: () => void;
  children: ReactNode;
  on?: boolean;
  accent?: string;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ selected: !!p.on }}
      onPress={p.onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: p.on && p.accent ? p.accent : th.surface,
        transform: [{ scale: pressed ? 0.88 : 1 }],
        ...PILL_SHADOW,
      })}
    >
      {p.children}
    </Pressable>
  );
}

/** «0:51»: ore e minuti, come fmtChrono del sito. */
export function chronoText(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

/**
 * L'orologio della partita (.chrono-pill): il tempo giocato in tutto, che continua a salire mentre si gioca. Un tocco
 * lo chiude in un tondo (e lo riapre), come sul sito.
 */
export function ChronoPill({ base, color, label }: { base: number; color: string; label: string }) {
  const th = useTheme();
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const secs = base + Math.round((now - start) / 1000);
  return (
    <Pressable
      testID="fcg-chrono"
      accessibilityRole="button"
      accessibilityLabel={`${label} ${chronoText(secs)}`}
      onPress={() => setSmall(!small)}
      style={({ pressed }) => ({
        height: 38,
        minWidth: 38,
        borderRadius: 19,
        paddingLeft: small ? 0 : 10,
        paddingRight: small ? 0 : 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: th.surface,
        transform: [{ scale: pressed ? 0.88 : 1 }],
        ...PILL_SHADOW,
      })}
    >
      <Icon d={ICONS.clock} size={17} color={color} />
      {small ? null : (
        <Text
          style={{
            color,
            fontSize: 13,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.1,
          }}
        >
          {chronoText(secs)}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * La carta (.card-box): superficie, angoli di 22, bordo sottile. Una carta fra i preferiti ha il bordo d'oro che
 * luccica (.is-favorita); dopo il voto un filo verde o rosso.
 */
export function GameCard(p: {
  gold: boolean;
  result?: 'correct' | 'wrong' | null;
  top?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const th = useTheme();
  const inner = (
    <View
      style={{
        backgroundColor: th.surface,
        borderRadius: p.gold ? 20.5 : 22,
        paddingTop: 20,
        paddingHorizontal: 18,
        paddingBottom: 18,
        borderWidth: p.gold ? 0 : p.result ? 1.5 : 0.5,
        borderColor:
          p.result === 'correct'
            ? 'rgba(48,209,88,.4)'
            : p.result === 'wrong'
              ? 'rgba(255,69,58,.4)'
              : th.hairline,
      }}
    >
      {p.children}
    </View>
  );
  return (
    <View
      testID={p.testID}
      style={{
        borderRadius: 22,
        shadowColor: p.gold ? '#FFC107' : '#000',
        shadowOpacity: p.gold ? 0.45 : 0.3,
        shadowRadius: p.gold ? 10 : 16,
        shadowOffset: { width: 0, height: p.gold ? 0 : 8 },
      }}
    >
      {p.gold ? <GoldFrame>{inner}</GoldFrame> : inner}
      {p.top ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -17, left: 0, right: 0, alignItems: 'center' }}
        >
          {p.top}
        </View>
      ) : null}
    </View>
  );
}

/** Il bordo d'oro di una preferita, con il riflesso che scorre (oroLuccica). */
function GoldFrame({ children }: { children: ReactNode }) {
  const still = useReducedMotion();
  const x = useSharedValue(0);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (still || !w) return;
    x.set(withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(x);
  }, [still, w, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: -x.get() * w * 1.6 }] }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ borderRadius: 22, padding: 1.5, overflow: 'hidden' }}
    >
      <Animated.View
        style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w * 3.2 }, slide]}
      >
        <LinearGradient
          colors={[
            '#FFD60A',
            '#FFF3B0',
            '#E8A100',
            '#FFD60A',
            '#FFF7CC',
            '#E8A100',
            '#FFD60A',
            '#FFF3B0',
          ]}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      {children}
    </View>
  );
}

/** I tasti negli angoli della carta (.btn-fav-fab, .btn-edit-fab): 36px, vetro. */
export function CornerFab(p: {
  testID: string;
  label: string;
  side: 'left' | 'right';
  gold?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const th = useTheme();
  const [pop, setPop] = useState(0);
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ selected: !!p.gold }}
      hitSlop={6}
      onPress={() => {
        setPop(pop + 1);
        p.onPress();
      }}
      style={({ pressed }) => ({
        position: 'absolute',
        top: 14,
        [p.side]: 14,
        zIndex: 5,
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: p.gold ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.3)',
        backgroundColor: p.gold ? '#FFD60A' : th.surface2,
        transform: [{ scale: pressed ? 0.88 : 1 }],
        shadowColor: p.gold ? '#FFD60A' : '#000',
        shadowOpacity: p.gold ? 0.55 : 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      })}
    >
      {p.gold ? (
        <LinearGradient
          colors={['#FFD60A', tint('#FFD60A', '#000000', 0.88)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      <Animated.View key={pop} entering={pop ? ZoomIn.springify().damping(9) : undefined}>
        {p.children}
      </Animated.View>
    </Pressable>
  );
}

/** Il livello della carta (.fcg-liv), fra la stella e la matita. */
export function LevelBadge({ level, label }: { level: Level; label: string }) {
  const c = level === 'nuova' ? '#64D2FF' : LEVEL_COLORS[level];
  const top = level === 'la_sai';
  const body = (
    <>
      {top ? (
        <Icon d={ICONS.star} size={12} color="#1C1C1E" fill />
      ) : (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: c,
            shadowColor: c,
            shadowOpacity: 0.6,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      )}
      <Text
        style={{
          color: top ? '#1C1C1E' : c,
          fontSize: 10.5,
          fontWeight: '800',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </>
  );
  return (
    <View
      testID="fcg-level"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 14,
        left: 58,
        right: 58,
        height: 36,
        zIndex: 4,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          height: 22,
          borderRadius: 99,
          overflow: 'hidden',
          paddingLeft: 7,
          paddingRight: 9,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: top ? '#FFC300' : `${c}26`,
        }}
      >
        {top ? (
          <LinearGradient
            colors={['#FFE066', '#FFC300', '#FF9F0A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : null}
        {body}
      </View>
    </View>
  );
}

/** «Concetto principale» / «↳ Sottoconcetto» (.card-title), solo se nella posizione ci sono più carte. */
export function CardTitle({ label, child }: { label: string; child: boolean }) {
  const th = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginTop: 2,
        marginBottom: 14,
      }}
    >
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: child ? th.purple : th.blue,
        }}
      />
      <Text
        style={{
          color: th.text3,
          fontSize: 10.5,
          fontWeight: '800',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {child ? `↳ ${label}` : label}
      </Text>
    </View>
  );
}

/** L'etichetta di un lato (.section-title): bandiera, nome in maiuscoletto e un filo fino al bordo. */
export function SectionTitle({
  flag,
  label,
  tight,
}: {
  flag?: string | null;
  label: string;
  tight?: boolean;
}) {
  const th = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginBottom: tight ? 2 : 10,
      }}
    >
      {flag ? <Text style={{ fontSize: 14 }}>{flag}</Text> : null}
      <Text
        style={{
          color: th.text2,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: th.hairline }} />
    </View>
  );
}

/** Lo sfondo del posto della risposta (.fcv-reveal, .answer-box.fcv-ans): un velo viola e blu appena accennato. */
function SlotBack() {
  const th = useTheme();
  return (
    <LinearGradient
      colors={[tint(th.purple, th.surface, 0.09), tint(th.blue, th.surface, 0.08)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${th.purple}33`,
      }}
    />
  );
}

/**
 * Il posto della risposta, ancora velato (.fcv-reveal): puntini che scorrono piano, un riflesso che passa ogni tanto e
 * la pastiglia «Tocca per vedere». È lui il comando per vedere la risposta.
 */
export function RevealVeil(p: {
  testID: string;
  label: ReactNode;
  text: string;
  a11y: string;
  onPress: () => void;
}) {
  const th = useTheme();
  const still = useReducedMotion();
  const drift = useSharedValue(0);
  const shine = useSharedValue(0);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (still) return;
    drift.set(withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1, false));
    shine.set(
      withRepeat(
        withDelay(1200, withTiming(1, { duration: 3400, easing: Easing.bezier(0.4, 0, 0.2, 1) })),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(drift);
      cancelAnimation(shine);
    };
  }, [still, drift, shine]);
  const dots = useAnimatedStyle(() => ({
    transform: [{ translateX: -22 + drift.get() * 22 }, { translateY: -11 + drift.get() * 11 }],
  }));
  const gleam = useAnimatedStyle(() => {
    const k = Math.min(1, shine.get() / 0.45);
    return { transform: [{ translateX: (k * 1.2 - 0.6) * w * 1.6 }], opacity: k < 1 ? 1 : 0 };
  });
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.a11y}
      onPress={p.onPress}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => ({
        minHeight: 96,
        borderRadius: 20,
        overflow: 'hidden',
        paddingTop: 13,
        paddingHorizontal: 16,
        paddingBottom: 15,
        gap: 6,
        transform: [{ scale: pressed ? 0.975 : 1 }],
      })}
    >
      <SlotBack />
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, width: w + 44, height: 400, opacity: 0.7 },
          dots,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="p1" width={11} height={11} patternUnits="userSpaceOnUse">
              <Circle cx={5.5} cy={5.5} r={1.1} fill={th.purple} fillOpacity={0.55} />
            </Pattern>
            <Pattern id="p2" x={6} y={4} width={17} height={17} patternUnits="userSpaceOnUse">
              <Circle cx={8.5} cy={8.5} r={0.95} fill={th.blue} fillOpacity={0.45} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#p1)" opacity={0.75} />
          <Rect width="100%" height="100%" fill="url(#p2)" opacity={0.75} />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: -20, bottom: -20, left: -w * 0.3, width: w * 0.6 },
          gleam,
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.32)', 'transparent']}
          start={{ x: 0, y: 0.4 }}
          end={{ x: 1, y: 0.6 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <View pointerEvents="none">{p.label}</View>
      <View
        pointerEvents="none"
        style={{
          alignSelf: 'center',
          marginTop: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 9,
          paddingHorizontal: 17,
          borderRadius: 99,
          backgroundColor: `${th.surface}E0`,
          shadowColor: th.purple,
          shadowOpacity: 0.45,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Icon d={ICONS.eye} size={18} color={th.purple} width={2.2} />
        <Text style={{ color: th.purple, fontSize: 15, fontWeight: '800', letterSpacing: -0.15 }}>
          {p.text}
        </Text>
      </View>
    </Pressable>
  );
}

/** La risposta vista, nello stesso posto del velo (.answer-box.fcv-ans), che arriva sfumando. */
export function AnswerSlot({
  label,
  children,
  testID,
}: {
  label: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <Animated.View
      testID={testID}
      entering={FadeIn.duration(300)}
      style={{
        minHeight: 96,
        borderRadius: 20,
        overflow: 'hidden',
        paddingTop: 13,
        paddingHorizontal: 16,
        paddingBottom: 15,
      }}
    >
      <SlotBack />
      {label}
      <View>{children}</View>
    </Animated.View>
  );
}

/** I tre voti tondi (.fcv-grade-row): sbagliata a sinistra, imparata in mezzo, giusta a destra. */
export function GradeRow(p: {
  wrongLabel: string;
  rightLabel: string;
  learntLabel: string;
  learnt: boolean;
  onWrong: () => void;
  onRight: () => void;
  onLearnt: () => void;
}) {
  const ball = (
    testID: string,
    label: string,
    color: string,
    size: number,
    icon: string | string[],
    onPress: () => void,
    delay: number,
    active = false,
  ) => (
    <Animated.View entering={FadeIn.duration(260).delay(delay)}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,.3)',
          transform: [{ scale: pressed ? 0.88 : 1 }],
          shadowColor: color,
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 10 },
        })}
      >
        <LinearGradient
          colors={active ? [color, tint(color, '#000000', 0.85)] : [`${color}52`, `${color}14`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Icon
          d={icon}
          size={size > 50 ? 28 : 19}
          color={active ? '#fff' : color}
          width={size > 50 ? 2.6 : 2.1}
        />
      </Pressable>
    </Animated.View>
  );
  return (
    <View
      style={{
        height: 76,
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}
    >
      {ball('fcg-wrong', p.wrongLabel, '#FF3B30', 72, ICONS.wrong, p.onWrong, 80)}
      {ball('fcg-learnt', p.learntLabel, '#FF9500', 46, ICONS.learnt, p.onLearnt, 80, p.learnt)}
      {ball('fcg-correct', p.rightLabel, '#34C759', 72, ICONS.right, p.onRight, 80)}
    </View>
  );
}

/** «‹ Indietro» e «Avanti ›» (.nav-btn, .nav-fwd). */
export function NavPill(p: {
  testID: string;
  label: string;
  onPress: () => void;
  forward?: boolean;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 11,
        paddingHorizontal: 20,
        borderRadius: 11,
        backgroundColor: p.forward ? th.blue : th.surface,
        borderWidth: p.forward ? 0 : 0.5,
        borderColor: th.hairline2,
        transform: [{ scale: pressed ? 0.95 : 1 }],
        ...PILL_SHADOW,
        shadowColor: p.forward ? th.blue : '#000',
      })}
    >
      {p.forward ? null : <Icon d={ICONS.back} size={15} color={th.text} width={2.4} />}
      <Text style={{ color: p.forward ? '#fff' : th.text, fontSize: 14, fontWeight: '700' }}>
        {p.label}
      </Text>
      {p.forward ? <Icon d={ICONS.fwd} size={15} color="#fff" width={2.4} /> : null}
    </Pressable>
  );
}

/** Il bottone largo (.btn): pieno (rosso) o «fantasma» (.btn-ghost, come «Concludi»). */
export function WideButton(p: {
  testID: string;
  label: string;
  onPress: () => void;
  tone?: 'ghost' | 'red';
}) {
  const th = useTheme();
  const red = p.tone === 'red';
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: '100%',
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderRadius: 15,
        alignItems: 'center',
        backgroundColor: red ? th.red : th.surface,
        borderWidth: red ? 0 : 0.5,
        borderColor: th.hairline2,
        opacity: pressed ? 0.85 : 1,
        ...PILL_SHADOW,
      })}
    >
      <Text
        style={{
          color: red ? '#fff' : th.text2,
          fontSize: 16.5,
          fontWeight: '700',
          letterSpacing: -0.15,
        }}
      >
        {p.label}
      </Text>
    </Pressable>
  );
}

/** Un riquadro di aiuto (.fcv-hint): significato o esempi; chiuso è un'etichetta da toccare. */
export function HintBox(p: {
  testID: string;
  label: string;
  open: boolean;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const th = useTheme();
  if (!p.open) {
    return (
      <Pressable
        testID={`${p.testID}-show`}
        accessibilityRole="button"
        onPress={p.onOpen}
        style={{
          alignSelf: 'flex-start',
          minHeight: 36,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 13,
          backgroundColor: th.surface2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon d={ICONS.eye} size={13} color={th.text2} width={2.4} />
        <Text
          style={{
            color: th.text2,
            fontSize: 12.5,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {p.label}
        </Text>
      </Pressable>
    );
  }
  return (
    <Animated.View
      testID={p.testID}
      entering={FadeIn.duration(280)}
      style={{
        alignSelf: 'stretch',
        paddingTop: 11,
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderRadius: 13,
        backgroundColor: th.surface2,
        gap: 4,
      }}
    >
      <Text
        style={{
          color: th.text3,
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0.9,
          textTransform: 'uppercase',
        }}
      >
        {p.label}
      </Text>
      {p.children}
    </Animated.View>
  );
}

/** Una riga d'esempio (.fcv-esempio): la barretta viola a sinistra. */
export function ExampleLine({ children }: { children: ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <View
        style={{
          alignSelf: 'stretch',
          width: 3,
          borderRadius: 2,
          marginVertical: 4,
          backgroundColor: `${th.purple}B3`,
        }}
      />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {children}
      </View>
    </View>
  );
}

/**
 * La casella vuota al posto della parola (.fcv-gap-vuoto): larga quanto basta a dire corta, media o lunga. Dentro ci
 * sono trattini invisibili, che le danno la larghezza e la leggono gli screen reader.
 */
export function GapBlank({ word }: { word: string }) {
  const th = useTheme();
  const n = word.length <= 4 ? 4 : word.length <= 9 ? 8 : 12;
  return (
    <View
      style={{
        marginBottom: -5,
        paddingHorizontal: 4,
        borderRadius: 6,
        backgroundColor: `${th.purple}1F`,
        borderBottomWidth: 2,
        borderStyle: 'dashed',
        borderColor: `${th.purple}B3`,
      }}
    >
      <Text style={{ color: 'transparent', fontSize: 16 }}>{'_'.repeat(n)}</Text>
    </View>
  );
}
