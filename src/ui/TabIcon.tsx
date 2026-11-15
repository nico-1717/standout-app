import Svg, { Path, Rect } from 'react-native-svg';

export type TabIconKind = 'home' | 'planner' | 'todo' | 'habits' | 'buy' | 'pills' | 'more';

/** Il colore di ogni sezione, lo stesso della barra laterale del sito (--sb-c). `null` = il colore del tema. */
export const TAB_COLOR: Record<TabIconKind, string | null> = {
  home: null,
  planner: '#FF453A',
  todo: '#30D158',
  habits: '#FF375F',
  buy: '#FF9F0A',
  pills: '#BF5AF2',
  more: null,
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
    </Svg>
  );
}
