import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { HoIcon, type Ho } from '@/features/home/HomeKit';

/** L'anello che pulsa dietro al triangolo (`hdrPlayPulse` del sito): si allarga e sfuma, all'infinito. */
function PulseRing() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(
      withRepeat(
        withTiming(1, { duration: 1800, reduceMotion: ReduceMotion.System }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
    return () => cancelAnimation(p);
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - p.get()),
    transform: [{ scale: 1 + p.get() * 0.7 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: '#FFFFFF',
        },
        style,
      ]}
    />
  );
}

/**
 * «Continua la partita»: la fascia blu→indaco dell'`hero-card` del sito, con il triangolo che pulsa, a che punto
 * sei e una barra che si riempie. Un tocco e si riparte da dove ci si era fermati.
 */
export function ResumeCard({
  ho,
  title,
  closed,
  total,
  onPress,
}: {
  ho: Ho;
  title: string;
  closed: number;
  total: number;
  onPress: () => void;
}) {
  const done = total > 0 ? Math.min(1, closed / total) : 0;
  return (
    <Pressable
      testID="fc-resume"
      accessibilityRole="button"
      accessibilityLabel={`${title} ${closed} / ${total}`}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 18,
        overflow: 'hidden',
        transform: [{ scale: pressed ? 0.98 : 1 }],
        boxShadow: `0 10px 22px -8px ${ho.indigo}99`,
      })}
    >
      <LinearGradient
        colors={[ho.blue, ho.indigo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing />
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              backgroundColor: 'rgba(255,255,255,.22)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HoIcon name="play" color="#FFFFFF" size={19} sw={2.2} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '800',
                letterSpacing: -0.2,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,.85)',
                fontSize: 13,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {closed} / {total}
            </Text>
          </View>
          <View
            style={{
              height: 5,
              borderRadius: 3,
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,.28)',
            }}
          >
            <View
              style={{
                width: `${Math.round(done * 100)}%`,
                height: 5,
                borderRadius: 3,
                backgroundColor: '#FFFFFF',
              }}
            />
          </View>
        </View>
        <HoIcon name="right" color="#FFFFFF" size={22} sw={2.6} />
      </LinearGradient>
    </Pressable>
  );
}
