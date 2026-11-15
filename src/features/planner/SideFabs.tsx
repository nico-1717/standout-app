import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import { LineIcon } from './PlannerIcons';
import type { PlannerTheme } from './plannerTheme';
import type { EventView } from './events';

type Glyph = 'routine' | 'tag' | 'star' | 'clock' | 'chevUp' | 'chevDown';

/** Il tondo di vetro dei tastini sul bordo destro (.pl-fab): 36px, filo sottile, ombra morbida. */
function Fab(p: {
  pt: PlannerTheme;
  testID: string;
  label: string;
  icon: Glyph;
  on?: boolean;
  onPress: () => void;
}) {
  const { pt } = p;
  const glass =
    pt.style === 'standard' ? (pt.dark ? 'rgba(28,28,30,.82)' : 'rgba(255,255,255,.82)') : pt.pill;
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
      <LineIcon name={p.icon} color={p.on ? pt.accentInk : pt.ink2} size={18} />
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
  onToggle: () => void;
  onRing: () => void;
  onRoutine: () => void;
  onCategory: () => void;
  onFavorites: () => void;
  onShift: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
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
          label={t('planner.abitudini')}
          onPress={p.onRing}
        />
      </View>
      {p.open ? (
        <>
          <Fab
            pt={pt}
            testID="fab-routine"
            label={t('planner.routine')}
            icon="routine"
            onPress={p.onRoutine}
          />
          <Fab
            pt={pt}
            testID="fab-category"
            label={t('planner.categoria_predefinita')}
            icon="tag"
            onPress={p.onCategory}
          />
          {p.hasFavorites ? (
            <Fab
              pt={pt}
              testID="fab-favorites"
              label={t('planner.progetti_preferiti')}
              icon="star"
              onPress={p.onFavorites}
            />
          ) : null}
          <Fab
            pt={pt}
            testID="fab-shift"
            label={t('planner.anticipa_o_ritarda')}
            icon="clock"
            on={p.shiftOn}
            onPress={p.onShift}
          />
        </>
      ) : null}
      <Fab
        pt={pt}
        testID="fab-toggle"
        label={t('planner.mostra_o_nascondi_i_tastini')}
        icon={p.open ? 'chevUp' : 'chevDown'}
        onPress={p.onToggle}
      />
    </View>
  );
}

/** Anticipi e ritardi (.pl-shift-bar): si sceglie «prima» o «dopo», di quanto, e gli eventi del giorno si spostano. */
export function ShiftSheet(p: {
  pt: PlannerTheme;
  events: EventView[];
  onApply: (minutes: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const [dir, setDir] = useState<'early' | 'late'>('late');
  const [minutes, setMinutes] = useState(10);
  const movable = p.events.filter((e) => !e.allDay && !e.multiday).length;
  const steps = [5, 10, 15, 30, 60];
  const chip = (on: boolean) => ({
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: on ? pt.accentSoft : pt.field,
  });
  return (
    <View
      testID="shift-sheet"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 60 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('comune.annulla')}
        onPress={p.onClose}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,.35)',
        }}
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View
          style={{
            gap: 14,
            padding: 18,
            paddingBottom: 26,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: pt.page,
          }}
        >
          <Text
            style={{
              color: pt.ink,
              fontSize: 20,
              fontWeight: pt.style === 'standard' ? '700' : '400',
              fontFamily: pt.serif,
            }}
          >
            {t('planner.anticipa_o_ritarda')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['early', 'late'] as const).map((d) => (
              <Pressable
                key={d}
                testID={`shift-${d}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: dir === d }}
                onPress={() => setDir(d)}
                style={chip(dir === d)}
              >
                <Text
                  style={{
                    color: dir === d ? pt.accentInk : pt.ink,
                    fontSize: 15,
                    fontFamily: pt.sans,
                  }}
                >
                  {t(d === 'early' ? 'planner.anticipo' : 'planner.ritardo')}
                </Text>
              </Pressable>
            ))}
          </View>
          <View
            accessibilityLabel={t('planner.di_quanto_spostarli_ore_e')}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {steps.map((m) => (
              <Pressable
                key={m}
                testID={`shift-min-${m}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: minutes === m }}
                onPress={() => setMinutes(m)}
                style={chip(minutes === m)}
              >
                <Text
                  style={{
                    color: minutes === m ? pt.accentInk : pt.ink,
                    fontSize: 15,
                    fontFamily: pt.sans,
                  }}
                >
                  {m === 60 ? '1 h' : `${m}'`}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
            <Pressable
              testID="shift-cancel"
              accessibilityRole="button"
              onPress={p.onClose}
              hitSlop={8}
            >
              <Text style={{ color: pt.ink2, fontSize: 16, fontFamily: pt.sans }}>
                {t('comune.annulla')}
              </Text>
            </Pressable>
            <Pressable
              testID="shift-save"
              accessibilityRole="button"
              disabled={!movable}
              onPress={() => p.onApply(dir === 'early' ? -minutes : minutes)}
              hitSlop={8}
            >
              <Text
                style={{
                  color: pt.accentInk,
                  fontSize: 16,
                  fontWeight: '600',
                  opacity: movable ? 1 : 0.4,
                  fontFamily: pt.sans,
                }}
              >
                {t('comune.salva')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
