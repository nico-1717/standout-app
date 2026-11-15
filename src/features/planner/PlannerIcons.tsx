import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { PlannerTheme } from './plannerTheme';

/** Gli stessi disegni a linea dell'intestazione del sito (planner.php): tratto 1.8, estremi arrotondati. */
type IconName = 'search' | 'filter' | 'gear' | 'left' | 'right';

const GEAR =
  'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z';

export function LineIcon({
  name,
  color,
  size = 18,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  const line = {
    stroke: color,
    strokeWidth: name === 'left' || name === 'right' ? 2.2 : 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={6.5} {...line} />
          <Path d="M16 16l4.5 4.5" {...line} />
        </>
      )}
      {name === 'filter' && <Path d="M4 7h16M7 12h10M10 17h4" {...line} />}
      {name === 'gear' && (
        <>
          <Circle cx={12} cy={12} r={3} {...line} />
          <Path d={GEAR} {...line} />
        </>
      )}
      {name === 'left' && <Path d="M14.5 6l-6 6 6 6" {...line} />}
      {name === 'right' && <Path d="M9.5 6l6 6-6 6" {...line} />}
    </Svg>
  );
}

/** Il tondo con il bordo sottile dei tasti dell'intestazione (.pl-tool del sito). */
export function ToolButton({
  pt,
  label,
  testID,
  onPress,
  children,
}: {
  pt: Pick<PlannerTheme, 'hair' | 'card'>;
  label: string;
  testID?: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pt.card,
        borderWidth: 0.5,
        borderColor: pt.hair,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}
