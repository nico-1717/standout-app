import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';
import { haptic } from '@/ui/motion';

import { Pick } from './Pick';
import { LineIcon } from './PlannerIcons';
import type { PlannerTheme } from './plannerTheme';
import type { Armed } from './armed';

const FAB_MS = 340;

type Glyph = 'routine' | 'tag' | 'star' | 'clock' | 'chevUp' | 'chevDown';

/** Il tondo di vetro dei tastini sul bordo destro (.pl-fab): 36px, filo sottile, ombra morbida. */
function Fab(p: {
  pt: PlannerTheme;
  testID: string;
  label: string;
  icon: Glyph;
  on?: boolean;
  /** 0 → 1 gira l'icona di mezzo giro (la freccetta che apre e chiude la colonna) */
  turn?: SharedValue<number>;
  onPress: () => void;
}) {
  const { pt } = p;
  const glass =
    pt.style === 'standard' ? (pt.dark ? 'rgba(28,28,30,.82)' : 'rgba(255,255,255,.82)') : pt.pill;
  const turned = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(p.turn?.get() ?? 0) * 180}deg` }],
  }));
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: p.on ? pt.accentSoft : glass,
        borderWidth: 0.5,
        borderColor: pt.fieldRing,
        boxShadow: pt.dark
          ? '0 1px 1px rgba(0,0,0,.4), 0 6px 18px -8px rgba(0,0,0,.6)'
          : '0 1px 1px rgba(0,0,0,.04), 0 6px 18px -10px rgba(0,0,0,.14)',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Animated.View style={turned}>
        <LineIcon name={p.icon} color={p.on ? pt.accentInk : pt.ink2} size={18} />
      </Animated.View>
    </Pressable>
  );
}

/** Gli anelli delle abitudini di oggi (.pl-ring): quanto è fatto, con la spunta al centro. */
function HabitRing(p: { pt: PlannerTheme; progress: number; label: string; onPress: () => void }) {
  const { pt } = p;
  const R = 20.5;
  const C = 2 * Math.PI * R;
  const glass =
    pt.style === 'standard' ? (pt.dark ? 'rgba(28,28,30,.82)' : 'rgba(255,255,255,.82)') : pt.pill;
  return (
    <Pressable
      testID="planner-ring"
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: glass,
        boxShadow: pt.dark
          ? '0 1px 1px rgba(0,0,0,.4), 0 6px 18px -8px rgba(0,0,0,.6)'
          : '0 1px 1px rgba(0,0,0,.04), 0 6px 18px -10px rgba(0,0,0,.14)',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Svg width={46} height={46} viewBox="0 0 46 46">
          <Circle
            cx={23}
            cy={23}
            r={R}
            stroke={pt.ink}
            strokeOpacity={0.12}
            strokeWidth={3}
            fill="none"
          />
          <Circle
            cx={23}
            cy={23}
            r={15.5}
            stroke={pt.ink}
            strokeOpacity={0.08}
            strokeWidth={2}
            fill="none"
          />
          <Circle
            cx={23}
            cy={23}
            r={R}
            stroke={pt.accent}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C * Math.max(0.02, p.progress)} ${C}`}
            transform="rotate(-90 23 23)"
          />
        </Svg>
      </View>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pt.field,
        }}
      >
        <LineIcon name="check" color={pt.ink2} size={14} />
      </View>
    </Pressable>
  );
}

/** Cosa si è scelto (il tastino del sito lo mostra al posto dell'icona): pallino, nome e una ×; toccandolo si posa. */
function ArmedChip(p: { pt: PlannerTheme; armed: Armed; onPress: () => void }) {
  const { pt, armed } = p;
  const glass =
    pt.style === 'standard' ? (pt.dark ? 'rgba(28,28,30,.92)' : 'rgba(255,255,255,.92)') : pt.pill;
  return (
    <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(90)}>
      <Pressable
        testID="armed-chip"
        accessibilityRole="button"
        accessibilityLabel={armed.name}
        onPress={p.onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          maxWidth: 190,
          paddingVertical: 7,
          paddingLeft: 11,
          paddingRight: 9,
          borderRadius: 999,
          backgroundColor: glass,
          borderWidth: 1,
          borderColor: armed.color,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        {armed.icon ? (
          <Text style={{ fontSize: 13 }}>{armed.icon}</Text>
        ) : (
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: armed.color }} />
        )}
        <Text
          numberOfLines={1}
          style={{ flexShrink: 1, color: pt.ink, fontSize: 13, fontFamily: pt.sans }}
        >
          {armed.name}
        </Text>
        <LineIcon name="close" color={pt.ink3} size={12} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * La colonna di tastini sul bordo destro (#plFabs): in cima l'anello delle abitudini, poi routine, categoria, preferiti
 * (solo se ce ne sono) e anticipi/ritardi; l'ultima freccetta chiude e riapre la colonna.
 */
export function SideFabs(p: {
  pt: PlannerTheme;
  top: number;
  open: boolean;
  progress: number;
  hasFavorites: boolean;
  shiftOn: boolean;
  /** cosa è armato adesso (si posa toccando la griglia) */
  armed: Armed | null;
  onDisarm: () => void;
  onToggle: () => void;
  onRing: () => void;
  onRoutine: () => void;
  onCategory: () => void;
  onFavorites: () => void;
  onShift: () => void;
}) {
  const { t: tr } = useTranslation();
  const { pt } = p;
  // la colonna si apre e si chiude scivolando, come sul sito (.pl-fab-group): altezza e trasparenza in 340 ms,
  // e la freccetta gira di mezzo giro; a corsa finita la colonna sparisce davvero (niente tocchi fantasma)
  const t = useSharedValue(p.open ? 1 : 0);
  const [show, setShow] = useState(p.open);
  const [moving, setMoving] = useState(false);
  // aperta o chiusa da poco: la colonna c'è subito (se si apre) e resta ritagliata finché corre
  const [seen, setSeen] = useState(p.open);
  if (seen !== p.open) {
    setSeen(p.open);
    setMoving(true);
    if (p.open) setShow(true);
  }
  const count = 3 + (p.hasFavorites ? 1 : 0);
  const groupH = count * 36 + (count - 1) * 6;
  useEffect(() => {
    const run = {
      duration: FAB_MS,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      reduceMotion: ReduceMotion.System,
    };
    t.set(withTiming(p.open ? 1 : 0, run));
    const id = setTimeout(() => {
      setMoving(false);
      if (!p.open) setShow(false);
    }, FAB_MS + 30);
    return () => clearTimeout(id);
  }, [p.open, t]);
  const groupStyle = useAnimatedStyle(() => ({
    height: groupH * t.get(),
    opacity: t.get(),
    // le due distanze del contenitore attorno al gruppo chiuso si annullano: la freccetta non si sposta
    marginTop: -6 + 6 * t.get(),
  }));
  return (
    <View
      pointerEvents="box-none"
      testID="side-fabs"
      style={{ position: 'absolute', right: 12, top: p.top, alignItems: 'flex-end', gap: 6 }}
    >
      <View style={{ marginRight: 1, marginBottom: 1 }}>
        <HabitRing
          pt={pt}
          progress={p.progress}
          label={tr('planner.abitudini')}
          onPress={p.onRing}
        />
      </View>
      {p.armed ? <ArmedChip pt={pt} armed={p.armed} onPress={p.onDisarm} /> : null}
      {show ? (
        <Animated.View
          testID="fab-group"
          pointerEvents={p.open ? 'box-none' : 'none'}
          style={[{ alignItems: 'flex-end', overflow: moving ? 'hidden' : 'visible' }, groupStyle]}
        >
          <View style={{ alignItems: 'flex-end', gap: 6, height: groupH }}>
            <Fab
              pt={pt}
              testID="fab-routine"
              label={tr('planner.routine')}
              icon="routine"
              onPress={p.onRoutine}
            />
            <Fab
              pt={pt}
              testID="fab-category"
              label={tr('planner.categoria_predefinita')}
              icon="tag"
              on={p.armed?.kind === 'category'}
              onPress={p.onCategory}
            />
            {p.hasFavorites ? (
              <Fab
                pt={pt}
                testID="fab-favorites"
                label={tr('planner.progetti_preferiti')}
                icon="star"
                on={p.armed?.kind === 'project'}
                onPress={p.onFavorites}
              />
            ) : null}
            <Fab
              pt={pt}
              testID="fab-shift"
              label={tr('planner.anticipa_o_ritarda')}
              icon="clock"
              on={p.shiftOn}
              onPress={p.onShift}
            />
          </View>
        </Animated.View>
      ) : null}
      <Fab
        pt={pt}
        testID="fab-toggle"
        label={tr('planner.mostra_o_nascondi_i_tastini')}
        icon="chevDown"
        turn={t}
        onPress={p.onToggle}
      />
    </View>
  );
}

const SHIFT_STEPS = [5, 10, 15, 30, 60];
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * La barra della modalità anticipi/ritardi (.pl-shift-bar): in basso, sopra la barra delle schede, con la griglia
 * ancora toccabile. Su una riga «Annulla», «prima/dopo» e «Salva»; sotto, i tempi suggeriti (5, 10, 15, 30 minuti,
 * 1 ora) e il campo per un orario qualsiasi (hh:mm). Gli eventi da spostare si toccano sulla griglia.
 */
export function ShiftBar(p: {
  pt: PlannerTheme;
  bottom: number;
  dir: 'early' | 'late';
  /** di quanto, «hh:mm» come il campo del sito */
  time: string;
  picked: number;
  onDir: (d: 'early' | 'late') => void;
  onTime: (v: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const ready = p.picked > 0 && p.time !== '00:00';
  const isStep = SHIFT_STEPS.some((m) => hhmm(m) === p.time);
  const label = (m: number) =>
    m >= 60 && m % 60 === 0
      ? t(m === 60 ? 'planner.n_ora' : 'planner.n_ore', { n: m / 60 })
      : t('planner.n_min', { n: m });
  return (
    <View
      testID="shift-bar"
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: p.bottom,
        zIndex: 80,
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 22,
        backgroundColor: pt.card,
        boxShadow: pt.dark
          ? '0 1px 1px rgba(0,0,0,.4), 0 -6px 28px -8px rgba(0,0,0,.6)'
          : '0 1px 1px rgba(0,0,0,.05), 0 -6px 28px -10px rgba(0,0,0,.22)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable testID="shift-cancel" accessibilityRole="button" onPress={p.onClose} hitSlop={8}>
          <Text style={{ color: pt.ink2, fontSize: 15, fontFamily: pt.sans }}>
            {t('comune.annulla')}
          </Text>
        </Pressable>
        <View
          style={{ flexDirection: 'row', backgroundColor: pt.fill, borderRadius: 999, padding: 2 }}
        >
          {(['early', 'late'] as const).map((d) => (
            <Pressable
              key={d}
              testID={`shift-${d}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: p.dir === d }}
              onPress={() => p.onDir(d)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: p.dir === d ? pt.fillOn : 'transparent',
              }}
            >
              <Text
                style={{
                  color: p.dir === d ? pt.ink : pt.ink2,
                  fontSize: 13,
                  fontFamily: pt.sans,
                }}
              >
                {t(d === 'early' ? 'planner.anticipo' : 'planner.ritardo')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          testID="shift-save"
          accessibilityRole="button"
          disabled={!ready}
          onPress={p.onApply}
          hitSlop={8}
        >
          <Text
            style={{
              color: pt.accentInk,
              fontSize: 15,
              fontWeight: '600',
              opacity: ready ? 1 : 0.4,
              fontFamily: pt.sans,
            }}
          >
            {p.picked > 0 ? `${t('comune.salva')} (${p.picked})` : t('comune.salva')}
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {SHIFT_STEPS.map((m) => {
          const on = hhmm(m) === p.time;
          return (
            <Pressable
              key={m}
              testID={`shift-step-${m}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic.tap();
                p.onTime(hhmm(m));
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: on ? pt.accentSoft : pt.fill,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: on ? pt.accentInk : pt.ink2,
                  fontSize: 12.5,
                  fontWeight: on ? '600' : '400',
                  fontFamily: pt.sans,
                }}
              >
                {label(m)}
              </Text>
            </Pressable>
          );
        })}
        {/* un valore a piacere: l'orario hh:mm, acceso quando non è uno dei suggeriti */}
        <View
          style={{
            borderRadius: 999,
            backgroundColor: isStep ? 'transparent' : pt.accentSoft,
          }}
        >
          <Pick
            pt={pt}
            kind="time"
            testID="shift-time"
            value={p.time}
            onChange={p.onTime}
            width={84}
          />
        </View>
      </View>
    </View>
  );
}
