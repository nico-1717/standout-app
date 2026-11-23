import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { PlannerTheme } from './plannerTheme';

/** Gli stessi disegni a linea dell'intestazione del sito (planner.php): tratto 1.8, estremi arrotondati. */
type IconName =
  | 'search'
  | 'filter'
  | 'gear'
  | 'left'
  | 'right'
  | 'calendar'
  | 'chevDown'
  | 'chevUp'
  | 'mic'
  | 'arrow'
  | 'lists'
  | 'routine'
  | 'tag'
  | 'star'
  | 'clock'
  | 'check'
  | 'book'
  | 'plus'
  | 'close'
  | 'pin';

const GEAR =
  'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z';

const STROKES: Partial<Record<IconName, number>> = {
  left: 2.2,
  right: 2.2,
  chevDown: 2.4,
  chevUp: 2.1,
  arrow: 2,
  mic: 1.7,
  lists: 1.9,
  routine: 1.7,
  tag: 1.7,
  star: 1.7,
  clock: 1.7,
  check: 1.7,
  plus: 2.2,
  book: 2.2,
};

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
    strokeWidth: STROKES[name] ?? 1.8,
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
      {name === 'calendar' && (
        <>
          <Rect x={4} y={5} width={16} height={15} rx={2.4} {...line} />
          <Path d="M4 10h16M9 5V3M15 5V3" {...line} />
        </>
      )}
      {name === 'chevDown' && <Path d="M7 10l5 5 5-5" {...line} />}
      {name === 'chevUp' && <Path d="M6 15l6-6 6 6" {...line} />}
      {name === 'mic' && (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...line} />
          <Path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" {...line} />
        </>
      )}
      {name === 'arrow' && <Path d="M5 12h13M12.5 6l6 6-6 6" {...line} />}
      {name === 'lists' && (
        <Path d="M5 7h10M5 12h10M5 17h7M18.5 6.6l1.6 1.6M18.5 11.6l1.6 1.6" {...line} />
      )}
      {name === 'routine' && (
        <>
          <Path d="M4 6h10M4 12h13M4 18h8" {...line} />
          <Circle cx={19} cy={6} r={1.6} {...line} />
          <Circle cx={21} cy={12} r={1.6} {...line} />
        </>
      )}
      {name === 'tag' && (
        <>
          <Path d="M6.5 4h7.7L20 10.3 13.3 17 6 9.7z" {...line} />
          <Circle cx={10} cy={8.5} r={1.2} {...line} />
        </>
      )}
      {name === 'star' && (
        <Path
          d="M12 4.2l2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3-3.8-3.7 5.2-.7z"
          {...line}
        />
      )}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={8} {...line} />
          <Path d="M12 8v4.4l3 1.8" {...line} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5l4 4L19 7" {...line} />}
      {name === 'book' && <Path d="M6 4h12v16H8a2 2 0 01-2-2z" {...line} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...line} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...line} />}
      {name === 'pin' && (
        <>
          <Path d="M12 21s-6.5-5.6-6.5-10a6.5 6.5 0 1113 0c0 4.4-6.5 10-6.5 10z" {...line} />
          <Circle cx={12} cy={11} r={2.2} {...line} />
        </>
      )}
    </Svg>
  );
}

/** Il tondo dei tasti dell'intestazione (.pl-tool del sito): 32px, bianco/grigio scuro, filo interno e ombra leggera. */
export function ToolButton({
  pt,
  label,
  testID,
  onPress,
  children,
}: {
  pt: Pick<PlannerTheme, 'pill' | 'pillRing'>;
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
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pt.pill,
        borderWidth: 0.5,
        borderColor: pt.pillRing,
        boxShadow: '0 1px 2px rgba(0,0,0,.06)',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}
