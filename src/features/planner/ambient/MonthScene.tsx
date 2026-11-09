import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ANIMALS, TREES } from './shapes';
import { DriftIcon, PartIcon } from './icons';
import {
  FLYERS,
  TREE_BOX,
  WALKERS,
  animalBox,
  buildDrifters,
  buildParticles,
  fitContain,
  monthConfig,
  rng,
  type Drifter,
  type Particle,
} from './scene';

/**
 * La scena del mese dietro l'intestazione del planner (la fascia in alto del sito): il cielo del mese, un albero che
 * dondola, l'animale del mese, petali o neve che cadono, insetti e uccelli che attraversano. Un solo orologio muove
 * tutto (`time`, in secondi). Con «Riduci movimento» restano il cielo, l'albero e l'animale, fermi.
 */

const AV = Animated.View;
/** il primo quarto di giro di un'onda che va avanti e indietro (ease-in-out, come `alternate`) */
const wave = (t: number, half: number) => {
  'worklet';
  return (1 - Math.cos((Math.PI * t) / half)) / 2;
};
const cycle = (t: number, duration: number, phase: number) => {
  'worklet';
  return (t / duration + phase) % 1;
};

function Fall({ p, time }: { p: Particle; time: SharedValue<number> }) {
  const rain = p.type === 'rain';
  const style = useAnimatedStyle(() => {
    const u = cycle(time.get(), p.duration, p.phase);
    if (rain) {
      return {
        opacity: interpolate(u, [0, 0.12, 0.9, 1], [0, 0.75, 0.75, 0]),
        transform: [
          { translateX: interpolate(u, [0, 1], [0, p.sway]) },
          { translateY: interpolate(u, [0, 1], [-14, 160]) },
        ],
      };
    }
    return {
      opacity: interpolate(u, [0, 0.08, 0.92, 1], [0, 1, 0.9, 0]),
      transform: [
        { translateX: interpolate(u, [0, 0.5, 1], [0, p.sway, -p.sway]) },
        { translateY: interpolate(u, [0, 0.5, 1], [-16, 60, 150]) },
        { rotate: `${interpolate(u, [0, 0.5, 1], [0, 140, 300])}deg` },
      ],
    };
  });
  return (
    <AV style={[{ position: 'absolute', top: -14, left: `${p.left}%` }, style]}>
      <PartIcon type={p.type} color={p.color} size={p.size} />
    </AV>
  );
}

function Twinkle({ p, time }: { p: Particle; time: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const w = wave(time.get() + p.phase * p.duration, p.duration / 2);
    return {
      opacity: interpolate(w, [0, 1], [0.3, 0.95]),
      transform: [{ scale: interpolate(w, [0, 1], [0.9, 1.25]) }],
    };
  });
  return (
    <AV style={[{ position: 'absolute', top: `${p.top}%`, left: `${p.left}%` }, style]}>
      <PartIcon type="star" color={p.color} size={p.size} />
    </AV>
  );
}

function Cross({
  d,
  time,
  width,
  height,
}: {
  d: Drifter;
  time: SharedValue<number>;
  width: number;
  height: number;
}) {
  const firefly = d.type === 'firefly';
  const slow = d.type === 'bird' || d.type === 'swallow';
  const carry = useAnimatedStyle(() => ({
    transform: [{ translateX: cycle(time.get(), d.duration, d.phase) * (width + 60) }],
  }));
  const bob = useAnimatedStyle(() => {
    const w = wave(time.get() + d.phase * d.bob * 2, d.bob);
    return {
      transform: [
        { translateY: interpolate(w, [0, 1], [0, -16]) },
        { rotate: `${interpolate(w, [0, 1], [-5, 5])}deg` },
      ],
    };
  });
  const wing = useAnimatedStyle(() => {
    const w = wave(time.get() + d.phase, slow ? 2.6 : 1.1);
    return { transform: [{ scaleX: interpolate(w, [0, 1], [1, 0.62]) }] };
  });
  const glow = useAnimatedStyle(() => {
    const w = wave(time.get() + d.phase * 2.4, 2.4);
    return {
      opacity: interpolate(w, [0, 1], [0.3, 0.95]),
      transform: [{ scale: interpolate(w, [0, 1], [0.9, 1.25]) }],
    };
  });
  return (
    <AV
      style={[
        {
          position: 'absolute',
          left: -30,
          top: (height * d.top) / 100,
          width: d.size,
          height: d.size,
          opacity: 0.85,
        },
        carry,
      ]}
    >
      {firefly ? (
        <AV
          style={[
            {
              width: d.size,
              height: d.size,
              borderRadius: d.size / 2,
              backgroundColor: d.color,
              boxShadow: `0 0 10px 3px ${d.color}`,
            },
            glow,
          ]}
        />
      ) : (
        <AV style={bob}>
          <AV style={wing}>
            <DriftIcon type={d.type} color={d.color} size={d.size} />
          </AV>
        </AV>
      )}
    </AV>
  );
}

function Tree({
  name,
  color,
  width,
  time,
}: {
  name: string;
  color: string;
  width: number;
  time: SharedValue<number>;
}) {
  const shape = TREES[name];
  const sway = useAnimatedStyle(() => {
    const w = wave(time.get(), 11);
    return {
      transform: [
        { translateY: TREE_BOX.h / 2 },
        { rotate: `${interpolate(w, [0, 0.5, 1], [-1.1, 0.6, 1.3])}deg` },
        { translateY: -TREE_BOX.h / 2 + interpolate(w, [0, 0.5, 1], [0, -1, 0]) },
      ],
    };
  });
  if (!shape) return null;
  return (
    <AV
      style={[
        {
          position: 'absolute',
          bottom: TREE_BOX.down,
          left: (width * TREE_BOX.x) / 100 - TREE_BOX.w / 2,
          width: TREE_BOX.w,
          height: TREE_BOX.h,
          opacity: 0.38,
        },
        sway,
      ]}
    >
      <Svg
        width={TREE_BOX.w}
        height={TREE_BOX.h}
        viewBox={`0 0 ${shape.w} ${shape.h}`}
        preserveAspectRatio="none"
      >
        <Path d={shape.d} fill={color} />
      </Svg>
    </AV>
  );
}

function Animal({
  name,
  color,
  width,
  height,
  time,
  phase,
}: {
  name: string;
  color: string;
  width: number;
  height: number;
  time: SharedValue<number>;
  phase: number;
}) {
  const shape = ANIMALS[name];
  const box = animalBox(name);
  const walks = WALKERS.includes(name);
  const flies = FLYERS.includes(name);
  const size = flies ? { w: 52, h: 32 } : box;
  const move = useAnimatedStyle(() => {
    const t = time.get();
    if (walks) {
      const u = cycle(t, 150, phase);
      const x = interpolate(u, [0, 0.48, 0.5, 0.98, 1], [-46, width + 10, width + 10, -46, -46]);
      const flip = u >= 0.5 && u < 1 ? -1 : 1;
      return { transform: [{ translateX: x }, { scaleX: flip }] };
    }
    if (flies) {
      const x = cycle(t, 46, phase) * (width + 60);
      const w = wave(t + phase * 11, 5.5);
      return { top: height * interpolate(w, [0, 1], [0.1, 0.3]), transform: [{ translateX: x }] };
    }
    return {};
  });
  if (!shape) return null;
  const fit = fitContain(shape, size);
  return (
    <AV
      style={[
        {
          position: 'absolute',
          left: flies ? -60 : walks ? 0 : (width * box.x) / 100,
          ...(flies ? {} : { bottom: box.down }),
          width: size.w,
          height: size.h,
          opacity: flies ? 0.55 : 0.5,
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        move,
      ]}
    >
      <Svg width={fit.w} height={fit.h} viewBox={`0 0 ${shape.w} ${shape.h}`}>
        <Path d={shape.d} fill={color} />
      </Svg>
    </AV>
  );
}

export function MonthScene({
  month,
  opacity = 0.9,
  page,
  sky = true,
  testID = 'month-scene',
}: {
  /** 1–12 */
  month: number;
  /** quanto si vede (0–1), la barra delle impostazioni */
  opacity?: number;
  /** il colore della pagina, in cui sfuma il cielo */
  page: string;
  /** il cielo colorato del mese (solo nel chiaro) */
  sky?: boolean;
  testID?: string;
}) {
  const still = useReducedMotion();
  const win = useWindowDimensions();
  const [size, setSize] = useState({ w: win.width, h: 120 });
  const cfg = monthConfig(month);
  const time = useSharedValue(0);
  useFrameCallback((f) => {
    time.set((f.timeSinceFirstFrame ?? 0) / 1000);
  }, !still);

  const parts = useMemo(() => (cfg ? buildParticles(cfg, month * 7919) : []), [cfg, month]);
  const drifters = useMemo(() => (cfg ? buildDrifters(cfg, month * 104729) : []), [cfg, month]);
  const animalPhase = useMemo(() => rng(month * 31)(), [month]);
  if (!cfg) return null;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {sky && cfg.sky ? (
        <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="sky" x1="0.4" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={cfg.sky[0]} />
              <Stop offset="0.52" stopColor={cfg.sky[1]} />
              <Stop offset="0.94" stopColor={page} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky)" />
        </Svg>
      ) : null}
      <View style={{ flex: 1, opacity }}>
        <Tree name={cfg.tree} color={cfg.treeColor ?? '#9BAA9C'} width={size.w} time={time} />
        {cfg.animal ? (
          <Animal
            name={cfg.animal}
            color={cfg.animalColor ?? '#7A6F64'}
            width={size.w}
            height={size.h}
            time={time}
            phase={animalPhase}
          />
        ) : null}
        {still
          ? null
          : parts.map((p, i) =>
              p.type === 'star' ? (
                <Twinkle key={`p${i}`} p={p} time={time} />
              ) : (
                <Fall key={`p${i}`} p={p} time={time} />
              ),
            )}
        {still
          ? null
          : drifters.map((d, i) => (
              <Cross key={`d${i}`} d={d} time={time} width={size.w} height={size.h} />
            ))}
      </View>
    </View>
  );
}
