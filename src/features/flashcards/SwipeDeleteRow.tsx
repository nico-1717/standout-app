import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/core/theme/ThemeProvider';

import { Icon } from './game/GameUi';

/** Quanto è largo il tasto rosso che compare dietro (.sfc-swipe-del del sito). */
const WIDTH = 88;
const TRASH = [
  'M4 7h16',
  'M10 11v6M14 11v6',
  'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12',
  'M9 7V4h6v3',
];

/**
 * Una riga che si trascina a sinistra per scoprire «Elimina» (lo storico del sito): oltre metà resta aperta, se no torna
 * a posto. Il tasto rosso chiede conferma (`onDelete`), non cancella da solo.
 */
export function SwipeDeleteRow(p: {
  testID: string;
  label: string;
  onDelete: () => void;
  children: ReactNode;
}) {
  const th = useTheme();
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const latest = useRef(p);
  useEffect(() => {
    latest.current = p;
  });
  const ask = useCallback(() => latest.current.onDelete(), []);
  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    onActivate: () => {
      'worklet';
      start.set(x.get());
    },
    onUpdate: (e) => {
      'worklet';
      const v = start.get() + e.translationX;
      // oltre il tasto si sente una resistenza; a destra non si va
      x.set(v < -WIDTH ? -WIDTH + (v + WIDTH) * 0.3 : Math.min(0, v));
    },
    onDeactivate: (e) => {
      'worklet';
      const open = start.get() + e.translationX < -WIDTH / 2;
      x.set(withSpring(open ? -WIDTH : 0, { damping: 20, stiffness: 240 }));
    },
  });
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const back = useAnimatedStyle(() => ({ opacity: x.get() < -2 ? 1 : 0 }));
  return (
    <View>
      <Animated.View
        style={[{ position: 'absolute', top: 0, bottom: 0, right: 0, width: WIDTH }, back]}
      >
        <Pressable
          testID={`${p.testID}-del`}
          accessibilityRole="button"
          accessibilityLabel={p.label}
          onPress={() => {
            x.set(withSpring(0, { damping: 20, stiffness: 240 }));
            scheduleOnRN(ask);
          }}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            backgroundColor: th.red,
          }}
        >
          <Icon d={TRASH} size={19} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{p.label}</Text>
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={row}>{p.children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
