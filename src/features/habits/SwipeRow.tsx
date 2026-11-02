import { useEffect, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { HabitsTheme } from './habitsTheme';

const THRESHOLD = 74;

interface SwipeProps {
  allowRight: boolean;
  allowLeft: boolean;
  onSwipe: (dir: 1 | -1) => void;
  onBuzz?: () => void;
}

/** Il gesto vero e proprio. Sta fuori dal componente: legge sempre le proprietà più recenti tramite update(). */
class SwipeGesture {
  private props: SwipeProps;
  private buzzed = false;
  readonly responder;

  constructor(
    private readonly x: Animated.Value,
    props: SwipeProps,
  ) {
    this.props = props;
    this.responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 10 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 &&
        (g.dx > 0 ? this.props.allowRight : this.props.allowLeft),
      onPanResponderMove: (_e, g) => {
        const ok = g.dx > 0 ? this.props.allowRight : this.props.allowLeft;
        const dx = ok ? g.dx : 0;
        // resistenza oltre la soglia: si sente che il gesto è «arrivato»
        const eased =
          Math.abs(dx) > THRESHOLD
            ? Math.sign(dx) * (THRESHOLD + (Math.abs(dx) - THRESHOLD) * 0.34)
            : dx;
        this.x.setValue(eased);
        if (!this.buzzed && Math.abs(dx) >= THRESHOLD) {
          this.buzzed = true;
          this.props.onBuzz?.();
        }
        if (this.buzzed && Math.abs(dx) < THRESHOLD) this.buzzed = false;
      },
      onPanResponderRelease: (_e, g) => {
        this.buzzed = false;
        Animated.spring(this.x, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        if (g.dx >= THRESHOLD && this.props.allowRight) this.props.onSwipe(1);
        else if (g.dx <= -THRESHOLD && this.props.allowLeft) this.props.onSwipe(-1);
      },
      onPanResponderTerminate: () => {
        this.buzzed = false;
        Animated.spring(this.x, { toValue: 0, useNativeDriver: true }).start();
      },
    });
  }

  update(props: SwipeProps) {
    this.props = props;
  }
}

/**
 * Lo scorrimento laterale di una riga (come .hb-row-behind del sito): verso destra «Fatto» (o «Ci sono cascato»),
 * verso sinistra «Annulla». Oltre 74 punti, al rilascio, scatta l'azione; se in quella direzione non c'è nulla
 * da fare la riga resta ferma. Un movimento più verticale che orizzontale è lo scorrimento della pagina e non conta.
 */
export function SwipeRow(p: {
  th: HabitsTheme;
  color: string;
  doneLabel: string;
  undoLabel: string;
  allowRight: boolean;
  allowLeft: boolean;
  onSwipe: (dir: 1 | -1) => void;
  onBuzz?: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const { th } = p;
  const [x] = useState(() => new Animated.Value(0));
  const [gesture] = useState(() => new SwipeGesture(x, p));
  useEffect(() => {
    gesture.update(p);
  });
  const pan = gesture.responder;

  return (
    <View style={styles.wrap} testID={p.testID}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.behind,
          // fermo non si vede (niente bordino colorato attorno alla riga); appena si muove, appare
          { opacity: x.interpolate({ inputRange: [-6, 0, 6], outputRange: [1, 0, 1] }) },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.side, { backgroundColor: p.color, justifyContent: 'flex-start' }]}>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path
              d="M20 6L9 17l-5-5"
              stroke="#fff"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.label}>{p.doneLabel}</Text>
        </View>
        <View style={[styles.side, { backgroundColor: th.red, justifyContent: 'flex-end' }]}>
          <Text style={styles.label}>{p.undoLabel}</Text>
          <Svg width={19} height={19} viewBox="0 0 24 24">
            <Path
              d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1"
              stroke="#fff"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {p.children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 22 },
  behind: { flexDirection: 'row', borderRadius: 22, overflow: 'hidden' },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22 },
  label: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
});
