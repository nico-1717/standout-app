import { render, screen } from '@testing-library/react-native';

import { DayGrid } from '../PlannerParts';
import { PinchStore } from '../usePinchZoom';
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
  ppm: 26 / 5,
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

  test('only the ones inside the pixel window', async () => {
    // 10:00 is at 600 min x 5.2 px = 3120 px; a window of 3000..3300 holds 09:40 to 10:35 (12 rows)
    await render(<DayGrid {...base()} rows={{ from: 3000, to: 3300 }} />);
    const labels = screen.getAllByText(/^\d\d:\d\d$/).map((n) => n.props.children as string);
    expect(labels.length).toBeLessThan(15);
    expect(labels).toContain('10:00');
    expect(labels).not.toContain('04:00');
  });
});

describe('pinch store', () => {
  test('the same value again does not wake anybody up', () => {
    const store = new PinchStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.set({ pxm: 0.3, step: 'h3', pinching: true });
    store.set({ pxm: 0.3, step: 'h3', pinching: true });
    expect(listener).toHaveBeenCalledTimes(1);
    store.set({ pxm: 0.31, step: 'h3', pinching: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('the page only cares about the step and whether fingers are down', () => {
    const store = new PinchStore();
    expect(store.coarse()).toBe('-');
    store.set({ pxm: 0.3, step: 'h3', pinching: true });
    const a = store.coarse();
    store.set({ pxm: 0.32, step: 'h3', pinching: true });
    expect(store.coarse()).toBe(a);
    store.set({ pxm: 0.32, step: 'h3', pinching: false });
    expect(store.coarse()).not.toBe(a);
  });
});
