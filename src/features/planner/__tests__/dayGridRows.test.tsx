import { fireEvent, render, screen } from '@testing-library/react-native';

import { DayGrid } from '../PlannerParts';
import { plannerTheme } from '../plannerTheme';

jest.mock('@/ui/motion', () => ({ haptic: { select: jest.fn(), tap: jest.fn() } }));

const theme = { brand: '#7c5cff', teal: '#00c2b2', dark: false } as never;
const base = () => ({
  pt: plannerTheme('standard', theme, 'rose', 0),
  categories: [],
  calendars: [],
  day: '2026-11-20',
  events: [],
  zoom: 'm5' as const,
  ppm: { value: 26 / 5 } as never,
  width: 390,
  now: null,
  onOpen: jest.fn(),
  onToggle: jest.fn(),
  onEmptyTap: jest.fn(),
});

describe('hour rows of the day grid', () => {
  test('all of them without a window', async () => {
    await render(<DayGrid {...base()} />);
    expect(screen.getAllByText(/^\d\d:\d\d$/)).toHaveLength(288);
  });

  test('only the ones inside the minute window', async () => {
    // 09:40 to 10:35 is 580..635 minutes: 12 rows of 5 minutes
    await render(<DayGrid {...base()} rows={{ from: 580, to: 635 }} />);
    const labels = screen.getAllByText(/^\d\d:\d\d$/).map((n) => n.props.children as string);
    expect(labels).toHaveLength(12);
    expect(labels).toContain('10:00');
    expect(labels).not.toContain('04:00');
  });

  test('a tap on the empty grid asks for the minute under the finger at the live density', async () => {
    const props = base();
    props.zoom = 'h1' as never;
    props.ppm = { value: 1 } as never;
    await render(<DayGrid {...props} />);
    await fireEvent.press(screen.getByTestId('grid-empty'), { nativeEvent: { locationY: 600 } });
    // 600 px a 1 px/min = 10:00, il passo di tocco è un'ora
    expect(props.onEmptyTap).toHaveBeenCalledWith(600);
  });
});

describe('the weather beside the hours', () => {
  const ore = (h: number, i: string, t: number) => ({
    h: `${String(h).padStart(2, '0')}:00`,
    i,
    l: 'Label',
    t,
    ap: null,
    p: null,
    v: null,
    u: null,
  });
  const weather = (onOpen = jest.fn()) =>
    ({
      onOpen,
      nowTemp: null,
      wx: {
        enabled: true,
        giorni: {
          '2026-11-20': {
            alba: '07:20',
            tramonto: '16:55',
            ore: [ore(9, 'pioggia', 8), ore(10, 'sole', 9), ore(21, 'sole', 4)],
          },
        },
      },
    }) as never;

  test('an icon and the degrees under each hour that has a forecast, one tap opens the day', async () => {
    const props = { ...base(), zoom: 'h1' as never, ppm: { value: 1 } as never };
    const onOpen = jest.fn();
    await render(<DayGrid {...props} weather={weather(onOpen)} />);
    expect(screen.getByTestId('wx-hour-9')).toBeTruthy();
    expect(screen.getByTestId('wx-hour-10')).toBeTruthy();
    expect(screen.getByText('8°')).toBeTruthy();
    expect(screen.queryByTestId('wx-hour-11')).toBeNull();
    await fireEvent.press(screen.getByTestId('wx-hour-9'));
    expect(onOpen).toHaveBeenCalledWith('2026-11-20');
  });

  test('with the 5 minute step only the icons stay, and nothing without the weather', async () => {
    const props = { ...base(), zoom: 'm5' as never, ppm: { value: 26 / 5 } as never };
    await render(<DayGrid {...props} weather={weather()} />);
    expect(screen.getByTestId('wx-hour-9')).toBeTruthy();
    expect(screen.queryByText('8°')).toBeNull();
  });

  test('no weather, no tags', async () => {
    await render(<DayGrid {...base()} />);
    expect(screen.queryByTestId('wx-hour-9')).toBeNull();
  });
});
