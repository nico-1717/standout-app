import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { Fall, Twinkle, cycle, wave } from './MonthScene';
import { buildWxScene, type Cloud, type Fog, type WxSceneInput } from './wxScene';

/**
 * La scena del meteo dietro l'intestazione del planner (renderAmbientMeteo e planner_extra.css del sito): prende il
 * posto di albero e animale quando si guarda un solo giorno. Sole che gira piano (luna, di sera), nuvole che
 * attraversano la fascia, pioggia o neve, nebbia, lampi, il rosso del caldo e un velo scuro di notte. Con «Riduci
 * movimento» restano i veli e il sole, fermi.
 */

const AV = Animated.View;
const SUN = '#E8C874';
const SUN_HOT = '#E8532A';
const MOON = '#CFD8E4';
const CLOUD = '#FFFFFF';
/** il bianco delle nuvole di notte (il sito le scurisce con `brightness(.5) saturate(.7)`) */
const CLOUD_NIGHT = '#808080';

function Veil({ id, stops }: { id: string; stops: [string, string] }) {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="1" stopColor={stops[1]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const HEAT_OPACITY = [0, 0.3, 0.52, 0.74] as const;

/** il rosso del caldo: sta sotto il sole e cresce in tre gradini, al terzo la fascia è tutta rossa */
function Heat({ level }: { level: 1 | 2 | 3 }) {
  return (
    <Svg
      testID="wx-scene-heat"
      width="100%"
      height="100%"
      style={{ position: 'absolute', opacity: HEAT_OPACITY[level] }}
      preserveAspectRatio="none"
    >
      <Defs>
        <RadialGradient
          id="heat"
          cx="0.76"
          cy="0"
          rx="1.35"
          ry="1.7"
          gradientUnits="objectBoundingBox"
        >
          <Stop offset="0" stopColor="#E24A22" stopOpacity={1} />
          <Stop offset="0.4" stopColor="#E46E2C" stopOpacity={0.62} />
          <Stop offset="0.8" stopColor="#E8A046" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heat)" />
    </Svg>
  );
}

function Sun({
  moon,
  hot,
  time,
  still,
}: {
  moon: boolean;
  hot: boolean;
  time: SharedValue<number>;
  still: boolean;
}) {
  const color = moon ? MOON : hot ? SUN_HOT : SUN;
  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: hot ? 1.28 : 1 },
      { rotate: `${moon || still ? 0 : (time.get() / 90) * 360}deg` },
    ],
  }));
  return (
    <AV
      testID={moon ? 'wx-scene-moon' : 'wx-scene-sun'}
      style={[
        { position: 'absolute', top: '14%', left: '16%', width: 46, height: 46, opacity: 0.75 },
        style,
      ]}
    >
      <Svg width={46} height={46} viewBox="0 0 60 60">
        {moon ? (
          <Path d="M38 6a24 24 0 100 48 20 20 0 010-48z" fill={color} />
        ) : (
          <>
            <Circle cx={30} cy={30} r={13} fill={color} />
            <Path
              d="M30 4v8M30 48v8M4 30h8M48 30h8M11.6 11.6l5.6 5.6M42.8 42.8l5.6 5.6M11.6 48.4l5.6-5.6M42.8 17.2l5.6-5.6"
              stroke={color}
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}
      </Svg>
    </AV>
  );
}

function Cloudlet({
  c,
  i,
  width,
  night,
  time,
}: {
  c: Cloud;
  i: number;
  width: number;
  night: boolean;
  time: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: cycle(time.get(), c.duration, c.delay / c.duration) * (width + 200) },
    ],
  }));
  return (
    <AV
      testID={`wx-scene-cloud-${i}`}
      style={[
        { position: 'absolute', left: -140, top: `${c.top}%`, width: c.width, opacity: c.opacity },
        style,
      ]}
    >
      <Svg width={c.width} height={c.width * 0.46} viewBox="0 0 100 46" preserveAspectRatio="none">
        <Path
          d="M20 44h58c11 0 18-7 18-15 0-9-8-15-17-14-2-9-10-14-19-14-11 0-19 7-21 16-9 0-16 6-16 14 0 7 5 13 10 13z"
          fill={night ? CLOUD_NIGHT : CLOUD}
        />
      </Svg>
    </AV>
  );
}

function Mist({
  f,
  i,
  width,
  time,
}: {
  f: Fog;
  i: number;
  width: number;
  time: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const w = wave(time.get() + f.delay, f.duration / 2);
    return { transform: [{ translateX: interpolate(w, [0, 1], [-0.12, 0.12]) * width * 1.6 }] };
  });
  return (
    <AV
      testID={`wx-scene-fog-${i}`}
      style={[
        { position: 'absolute', left: '-30%', width: '160%', height: 16, top: `${f.top}%` },
        style,
      ]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`fog${i}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={8} fill={`url(#fog${i})`} />
      </Svg>
    </AV>
  );
}

/** il lampo è raro di proposito: un temporale che sfarfalla di continuo stanca dopo dieci secondi */
function Flash({ time }: { time: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      (time.get() / 9) % 1,
      [0, 0.88, 0.89, 0.91, 0.93, 0.95, 1],
      [0, 0, 0.5, 0, 0.28, 0, 0],
    ),
  }));
  return (
    <AV
      testID="wx-scene-flash"
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
        style,
      ]}
    />
  );
}

export function WeatherScene({
  input,
  testID = 'wx-scene',
}: {
  input: WxSceneInput;
  testID?: string;
}) {
  const still = useReducedMotion();
  const [width, setWidth] = useState(360);
  const time = useSharedValue(0);
  useFrameCallback((f) => {
    time.set((f.timeSinceFirstFrame ?? 0) / 1000);
  }, !still);
  const { icon, tmax, night } = input;
  const scene = useMemo(() => buildWxScene({ icon, tmax, night }), [icon, tmax, night]);
  const moving = !still;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {scene.hot ? <Heat level={scene.hot} /> : null}
      {scene.overcast ? (
        <View
          testID="wx-scene-overcast"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Veil id="overcast" stops={['rgba(120,133,146,0.42)', 'rgba(150,161,172,0.18)']} />
        </View>
      ) : null}
      {scene.night ? (
        <View
          testID="wx-scene-night"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Veil id="night" stops={['rgba(22,30,52,0.66)', 'rgba(32,40,64,0.44)']} />
        </View>
      ) : null}
      {moving && scene.stars.length ? (
        <View
          testID="wx-scene-stars"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {scene.stars.map((p, i) => (
            <Twinkle key={i} p={p} time={time} />
          ))}
        </View>
      ) : null}
      {scene.sun || scene.moon ? (
        <Sun moon={scene.moon} hot={scene.hotSun} time={time} still={still} />
      ) : null}
      {moving
        ? scene.clouds.map((c, i) => (
            <Cloudlet key={i} c={c} i={i} width={width} night={scene.night} time={time} />
          ))
        : null}
      {moving
        ? scene.fog.map((f, i) => <Mist key={i} f={f} i={i} width={width} time={time} />)
        : null}
      {moving && scene.drops.length ? (
        <View
          testID="wx-scene-drops"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {scene.drops.map((p, i) => (
            <Fall key={i} p={p} time={time} />
          ))}
        </View>
      ) : null}
      {moving && scene.lightning ? <Flash time={time} /> : null}
    </View>
  );
}
