import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { DrifterType, ParticleType } from './scene';

/** Le figurine che cadono (PART_SVG del sito): tutte nel colore dato. */
export function PartIcon({
  type,
  color,
  size,
}: {
  type: ParticleType;
  color: string;
  size: number;
}) {
  const h = type === 'rain' ? size * 1.6 : size;
  const common = { width: size, height: h };
  switch (type) {
    case 'snow':
      return (
        <Svg {...common} viewBox="0 0 10 10">
          <Circle cx={5} cy={5} r={3.6} fill={color} />
        </Svg>
      );
    case 'petal':
      return (
        <Svg {...common} viewBox="0 0 10 10">
          <Path
            d="M5 .8C7.6 2.6 8.8 5 7.4 7.2 6.4 8.8 3.6 8.8 2.6 7.2 1.2 5 2.4 2.6 5 .8z"
            fill={color}
          />
        </Svg>
      );
    case 'leaf':
      return (
        <Svg {...common} viewBox="0 0 12 12">
          <Path d="M11 1C6 1 1 4 1 8.2c0 1.6.8 2.6 2 2.8C4.6 8 7.4 5 11 1z" fill={color} />
        </Svg>
      );
    case 'seed':
      return (
        <Svg {...common} viewBox="0 0 12 12">
          <Circle cx={6} cy={8.6} r={1.5} fill={color} />
          <Path
            d="M6 7.2V2M6 7.2L2.6 3.4M6 7.2l3.4-3.8M6 7.2L3.2 6M6 7.2L8.8 6"
            stroke={color}
            strokeWidth={0.7}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      );
    case 'rain':
      return (
        <Svg {...common} viewBox="0 0 4 14">
          <Path d="M2 1v12" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
        </Svg>
      );
    case 'star':
      return (
        <Svg {...common} viewBox="0 0 12 12">
          <Path d="M6 0l1 5 5 1-5 1-1 5-1-5-5-1 5-1z" fill={color} />
        </Svg>
      );
    default:
      return (
        <Svg {...common} viewBox="0 0 10 10">
          <Circle cx={5} cy={5} r={3} fill={color} opacity={0.7} />
        </Svg>
      );
  }
}

/** Insetti e uccelli che attraversano la barra (DRIFT_SVG del sito). */
export function DriftIcon({
  type,
  color,
  size,
}: {
  type: DrifterType;
  color: string;
  size: number;
}) {
  const line = {
    stroke: color,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  const box = { width: size, height: size, viewBox: '0 0 24 24' };
  switch (type) {
    case 'butterfly':
      return (
        <Svg {...box}>
          <G {...line} strokeWidth={1.2}>
            <Path d="M12 6v11" />
            <Path d="M12 8c-2-4-6-5-8-3 0 3 3 6 8 7" />
            <Path d="M12 8c2-4 6-5 8-3 0 3-3 6-8 7" />
            <Path d="M12 6l-1.6-2.4M12 6l1.6-2.4" />
          </G>
        </Svg>
      );
    case 'bee':
      return (
        <Svg {...box}>
          <G {...line} strokeWidth={1.2}>
            <Ellipse cx={13} cy={14} rx={5} ry={3.6} />
            <Path d="M11 11.2v5.6M14 10.8v6.4" />
            <Path d="M11 11c-2-3-5-4-7-2 0 2.4 2.4 4 5 4.4" />
            <Path d="M18 12.4c1.6-.8 2.6-.4 3 .6" />
          </G>
        </Svg>
      );
    case 'ladybug':
      return (
        <Svg {...box}>
          <G {...line} strokeWidth={1.2}>
            <Circle cx={12} cy={13} r={5.6} />
            <Path d="M12 7.4v11" />
            <Path d="M10 6.4l-.8-1.6M14 6.4l.8-1.6" />
          </G>
          <Circle cx={9} cy={11.6} r={0.9} fill={color} />
          <Circle cx={15} cy={14.4} r={0.9} fill={color} />
        </Svg>
      );
    case 'dragonfly':
      return (
        <Svg {...box}>
          <G {...line} strokeWidth={1.1}>
            <Path d="M12 7v11" />
            <Circle cx={12} cy={6} r={1.4} />
            <Path d="M12 9.4c-3.4-2-6.6-2-8 0 1.4 1.6 4.6 1.8 8 .6" />
            <Path d="M12 9.4c3.4-2 6.6-2 8 0-1.4 1.6-4.6 1.8-8 .6" />
            <Path d="M12 12.6c-2.6-1.4-5-1.4-6 0 1 1.2 3.4 1.4 6 .5" />
            <Path d="M12 12.6c2.6-1.4 5-1.4 6 0-1 1.2-3.4 1.4-6 .5" />
          </G>
        </Svg>
      );
    case 'swallow':
      return (
        <Svg {...box}>
          <G {...line} strokeWidth={1.3}>
            <Path d="M2 11c4-3.6 7.4-3 10 1 2.6-4 6-4.6 10-1" />
            <Path d="M12 12v3.4" />
          </G>
        </Svg>
      );
    case 'firefly':
      return null;
    default:
      return (
        <Svg {...box}>
          <G {...line} strokeWidth={1.3}>
            <Path d="M3 13c3-4 6-4 9 0 3-4 6-4 9 0" />
          </G>
        </Svg>
      );
  }
}
