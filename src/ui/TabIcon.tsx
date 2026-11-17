import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconKind =
  | 'home'
  | 'planner'
  | 'todo'
  | 'habits'
  | 'buy'
  | 'pills'
  | 'more'
  | 'pomodoro'
  | 'diary'
  | 'grades'
  | 'flashcards'
  | 'languages'
  | 'projects';

/** Il colore di ogni sezione, lo stesso della barra laterale del sito (--sb-c). `null` = il colore del tema. */
export const TAB_COLOR: Record<TabIconKind, string | null> = {
  home: null,
  planner: '#FF453A',
  todo: '#30D158',
  habits: '#FF375F',
  buy: '#FF9F0A',
  pills: '#BF5AF2',
  more: null,
  pomodoro: '#FF6A3D',
  diary: '#BF8A3C',
  grades: '#5E5CE6',
  flashcards: '#BF5AF2',
  languages: '#32ADE6',
  projects: '#FF9F0A',
};

/**
 * Le icone della barra in basso: gli stessi disegni a linea del sito (partials/sidebar.html), a tratto
 * arrotondato, così app e sito si riconoscono. Prima erano riquadri e cerchi messi a mano.
 */
export function TabIcon({
  kind,
  color,
  size = 25,
  active = false,
}: {
  kind: TabIconKind;
  color: string;
  size?: number;
  active?: boolean;
}) {
  const line = {
    stroke: color,
    strokeWidth: active ? 2.25 : 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {kind === 'home' && (
        <>
          <Path d="M3.5 10.6 12 3.8l8.5 6.8" {...line} />
          <Path d="M5.8 9v10.2c0 .5.4.8.8.8h3.6v-5.5h3.6V20h3.6c.4 0 .8-.3.8-.8V9" {...line} />
        </>
      )}
      {kind === 'planner' && (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={2.6} {...line} />
          <Path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17.2h2" {...line} />
        </>
      )}
      {kind === 'todo' && (
        <>
          <Rect x={3.6} y={3.6} width={16.8} height={16.8} rx={4} {...line} />
          <Path d="m8.2 12.3 2.6 2.6 5-5.4" {...line} />
        </>
      )}
      {kind === 'habits' && (
        <>
          <Path
            d="M12 21c-3.9 0-6.8-2.7-6.8-6.3 0-3.2 2.1-5.1 3.6-7 .4 1.6 1.3 2.6 2.4 3.1C11 7.6 12.3 4.8 15 3c-.3 2.9 1 4.6 2.3 6.2 1 1.3 1.6 2.6 1.6 4.6C18.9 17.9 16 21 12 21Z"
            {...line}
          />
          <Path
            d="M12 21c-1.6 0-2.8-1.1-2.8-2.6 0-1.7 1.4-2.6 2.8-4 1.4 1.4 2.8 2.3 2.8 4 0 1.5-1.2 2.6-2.8 2.6Z"
            {...line}
          />
        </>
      )}
      {kind === 'buy' && (
        <>
          <Path d="M5 8.2h14l-1 11.3c-.1.6-.5 1-1.1 1H7.1c-.6 0-1-.4-1.1-1L5 8.2Z" {...line} />
          <Path d="M9 8.2V7a3 3 0 0 1 6 0v1.2" {...line} />
        </>
      )}
      {kind === 'pills' && (
        <>
          <Path d="m10.6 20.4-7-7a4.9 4.9 0 0 1 6.9-6.9l7 7a4.9 4.9 0 0 1-6.9 6.9Z" {...line} />
          <Path d="m7.1 10 6.9 6.9" {...line} />
        </>
      )}
      {kind === 'more' && <Path d="M4.5 7h15M4.5 12h15M4.5 17h9" {...line} />}
      {kind === 'pomodoro' && (
        <>
          <Circle cx={12} cy={13.5} r={7.5} {...line} />
          <Path d="M12 9.5v4l2.5 1.5M9.5 3h5" {...line} />
        </>
      )}
      {kind === 'diary' && (
        <>
          <Rect x={5.5} y={3.8} width={13} height={16.4} rx={2.2} {...line} />
          <Path d="M9.5 8.2h6M9.5 11.8h6" {...line} />
        </>
      )}
      {kind === 'grades' && (
        <>
          <Path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" {...line} />
          <Path d="M6.5 11.8V16c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.2M21.5 9.5v5" {...line} />
        </>
      )}
      {kind === 'flashcards' && (
        <>
          <Rect x={3.5} y={7.5} width={13} height={12.5} rx={2.5} {...line} />
          <Path d="M7.5 7.5V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H17" {...line} />
        </>
      )}
      {kind === 'languages' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...line} />
          <Path
            d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5"
            {...line}
          />
        </>
      )}
      {kind === 'projects' && (
        <Path
          d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"
          {...line}
        />
      )}
    </Svg>
  );
}
