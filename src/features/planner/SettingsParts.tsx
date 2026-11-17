import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, View, type HostInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/ui/CappedText';

import type { PlannerTheme } from './plannerTheme';

/**
 * `.pl-fold-head` del sito (sezionePieghevole): una sezione delle impostazioni che si apre e si chiude. Chiusa è una riga
 * con il titolo, quante voci ci sono e la freccina.
 */
export function Fold({
  pt,
  title,
  count,
  testID,
  children,
}: {
  pt: PlannerTheme;
  title: string;
  count: number;
  testID: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 13 }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
      >
        <Text
          style={{
            flex: 1,
            color: pt.ink3,
            fontSize: 11,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            fontFamily: pt.sans,
          }}
        >
          {title}
        </Text>
        <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>
          {count ? String(count) : ''}
        </Text>
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        >
          <Path
            d="M9 5l7 7-7 7"
            stroke={pt.ink3}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      {open ? <View style={{ marginTop: 4 }}>{children}</View> : null}
    </View>
  );
}

/** Il gesto del cursore, fuori dal componente: tiene le misure e il valore di adesso, e trasforma un dito in un intero. */
class SliderGesture {
  cfg = { min: 0, max: 1, value: 0, onChange: (_v: number) => undefined as void };
  private width = 140;
  private left = 0;
  update(cfg: SliderGesture['cfg']) {
    this.cfg = cfg;
  }
  size(width: number) {
    this.width = width;
  }
  origin(left: number) {
    this.left = left;
  }
  at(x: number) {
    const { min, max, value, onChange } = this.cfg;
    const ratio = Math.min(1, Math.max(0, x / this.width));
    const next = Math.round(min + ratio * (max - min));
    if (next !== value) onChange(next);
  }
  pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => this.at(e.nativeEvent.locationX),
    onPanResponderMove: (_e, g) => this.at(g.moveX - this.left),
  });
}

/**
 * Il cursore del sito (`<input type="range">`): la barra, la parte piena e il pallino. Si trascina o si tocca; per chi usa
 * VoiceOver si regola con su/giù (azioni di accessibilità). Il valore è un intero fra `min` e `max`.
 */
export function PlSlider({
  pt,
  min,
  max,
  value,
  onChange,
  testID,
  label,
}: {
  pt: PlannerTheme;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  testID: string;
  label: string;
}) {
  const [g] = useState(() => new SliderGesture());
  const view = useRef<HostInstance | null>(null);
  const [w, setW] = useState(140);
  useEffect(() => {
    g.update({ min, max, value, onChange });
  });

  const ratio = (value - min) / Math.max(1, max - min);
  return (
    <View
      ref={(v) => {
        view.current = v;
      }}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const step = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(Math.min(max, Math.max(min, value + step)));
      }}
      onLayout={(e) => {
        g.size(e.nativeEvent.layout.width);
        setW(e.nativeEvent.layout.width);
        view.current?.measureInWindow((x) => {
          g.origin(x);
        });
      }}
      {...g.pan.panHandlers}
      style={{ width: 140, height: 32, justifyContent: 'center' }}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: pt.hair2 }} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          height: 4,
          borderRadius: 2,
          width: ratio * w,
          backgroundColor: pt.accent,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: ratio * (w - 22),
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: pt.card,
          borderWidth: 0.5,
          borderColor: pt.hair2,
          boxShadow: '0 1px 4px rgba(0,0,0,.28)',
        }}
      />
    </View>
  );
}
