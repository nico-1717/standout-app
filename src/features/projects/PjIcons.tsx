import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * I disegni a linea della pagina Progetti (progetti.php): stesso tratto del sito (1.8, estremi arrotondati),
 * viewBox 24. Il pallino di stato ha tre forme: vuoto (in corso), spuntato (fatto), con l'orologio (in programma).
 */
export type PjIconName =
  | 'calendar'
  | 'gear'
  | 'timer'
  | 'dots'
  | 'star'
  | 'star-line'
  | 'select'
  | 'grid'
  | 'list'
  | 'plus'
  | 'chevron'
  | 'mic'
  | 'palette'
  | 'target'
  | 'folder'
  | 'note'
  | 'checks'
  | 'move'
  | 'trash'
  | 'close'
  | 'back'
  | 'bolt'
  | 'brush'
  | 'erase'
  | 'eye'
  | 'events'
  | 'undo'
  | 'spark'
  | 'fold'
  | 'unfold';

const GEAR =
  'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z';
/** Gli strumenti del calendario e il tasto apri/chiudi rami: gli stessi tratti del sito (piano.js, progetti.php). */
const PATHS: Partial<Record<PjIconName, string>> = {
  brush: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z',
  erase: 'M8 20h11M5.5 14.5l7-8a2 2 0 013 0l2.5 2.5a2 2 0 010 3L12 18H8z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.8a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z',
  events:
    'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z',
  undo: 'M9 14L4 9l5-5M4 9h9.5a6 6 0 010 12H11',
  spark:
    'M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z',
  fold: 'M8 4.5l4 4 4-4M8 19.5l4-4 4 4M4 12h16',
  unfold: 'M8 8l4-4 4 4M8 16l4 4 4-4M4 12h16',
};
const STAR = 'M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z';

export function PjIcon({
  name,
  color,
  size = 18,
  width = 1.8,
}: {
  name: PjIconName;
  color: string;
  size?: number;
  width?: number;
}) {
  const line = {
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {name === 'calendar' && (
        <>
          <Rect x={3.5} y={5} width={17} height={15} rx={3} {...line} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...line} />
        </>
      )}
      {name === 'gear' && (
        <>
          <Circle cx={12} cy={12} r={3} {...line} />
          <Path d={GEAR} {...line} />
        </>
      )}
      {name === 'timer' && (
        <>
          <Circle cx={12} cy={13.5} r={7.5} {...line} />
          <Path d="M12 9.5v4l2.4 1.6M9.5 2.8h5" {...line} />
        </>
      )}
      {name === 'dots' && (
        <>
          <Circle cx={5.5} cy={12} r={1.6} fill={color} />
          <Circle cx={12} cy={12} r={1.6} fill={color} />
          <Circle cx={18.5} cy={12} r={1.6} fill={color} />
        </>
      )}
      {name === 'star' && (
        <Path d={STAR} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />
      )}
      {name === 'star-line' && <Path d={STAR} {...line} />}
      {name === 'select' && (
        <>
          <Rect x={3.5} y={3.5} width={17} height={17} rx={4.5} {...line} />
          <Path d="M8 12.2l2.8 2.8L16.3 9.5" {...line} />
        </>
      )}
      {name === 'grid' && (
        <>
          <Rect x={3.5} y={3.5} width={7} height={7} rx={2} {...line} />
          <Rect x={13.5} y={3.5} width={7} height={7} rx={2} {...line} />
          <Rect x={3.5} y={13.5} width={7} height={7} rx={2} {...line} />
          <Rect x={13.5} y={13.5} width={7} height={7} rx={2} {...line} />
        </>
      )}
      {name === 'list' && (
        <Path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" {...line} />
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...line} />}
      {name === 'chevron' && <Path d="M9.5 6l6 6-6 6" {...line} />}
      {name === 'mic' && (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...line} />
          <Path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" {...line} />
        </>
      )}
      {name === 'palette' && <Circle cx={12} cy={12} r={8.5} {...line} />}
      {name === 'target' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...line} />
          <Circle cx={12} cy={12} r={4.5} {...line} />
          <Circle cx={12} cy={12} r={0.8} fill={color} />
        </>
      )}
      {name === 'folder' && (
        <Path
          d="M3.5 7.5a2 2 0 012-2H9l2 2.2h7.5a2 2 0 012 2V17.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"
          {...line}
        />
      )}
      {name === 'note' && <Path d="M5 4.5h14v10.5l-5 4.5H5zM14 19.5V15h5" {...line} />}
      {name === 'checks' && (
        <Path
          d="M4 6.5l1.6 1.6L8.5 5M4 12.5l1.6 1.6L8.5 11M4 18.5l1.6 1.6L8.5 17M12 7h8M12 13h8M12 19h8"
          {...line}
        />
      )}
      {name === 'move' && (
        <>
          <Path
            d="M3.5 7.5a2 2 0 012-2H9l2 2.2h7.5a2 2 0 012 2V17.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"
            {...line}
          />
          <Path d="M10 13h5M13 10.8l2.2 2.2L13 15.2" {...line} />
        </>
      )}
      {name === 'trash' && (
        <Path d="M4.5 7h15M9.5 11v5.5M14.5 11v5.5M6.5 7l.8 12h9.4l.8-12M9 7V4.5h6V7" {...line} />
      )}
      {name === 'close' && <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...line} />}
      {name === 'back' && <Path d="M14.5 6l-6 6 6 6" {...line} />}
      {name === 'bolt' && <Path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" {...line} />}
      {PATHS[name] ? <Path d={PATHS[name]} {...line} /> : null}
    </Svg>
  );
}

/** Il pallino di stato di un progetto: in corso (cerchio vuoto), fatto (pieno con la spunta), in programma (orologio). */
export function StatusRing({
  status,
  color,
  size = 24,
}: {
  status: string;
  color: string;
  size?: number;
}) {
  const line = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {status === 'completed' ? (
        <>
          <Circle cx={12} cy={12} r={10} fill={color} />
          <Path
            d="M7.4 12.4l3 3 6.2-6.4"
            stroke="#FFFFFF"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <Circle cx={12} cy={12} r={9.5} fill="none" {...line} />
          {status === 'planned' ? <Path d="M12 7v5.2l3.2 1.8" fill="none" {...line} /> : null}
        </>
      )}
    </Svg>
  );
}
