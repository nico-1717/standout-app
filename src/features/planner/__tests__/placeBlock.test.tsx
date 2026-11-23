import { Linking } from 'react-native';
import '@/core/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EventView } from '../events';
import type { Block } from '../layout';
import { EventBlock } from '../PlannerParts';
import { osmTile } from '../PlaceSearch';
import { plannerTheme } from '../plannerTheme';

jest.mock('@/ui/motion', () => ({ haptic: { select: jest.fn(), tap: jest.fn() } }));

const theme = { brand: '#7c5cff', teal: '#00c2b2', dark: false } as never;

const block = (over: Partial<EventView>): Block => ({
  ev: {
    uid: 'u1@2026-11-20',
    title: 'Lunch',
    location: 'Via Roma 1',
    placeName: 'Trattoria Roma',
    placeLat: null,
    placeLon: null,
    type: 'event',
    importance: 'normal',
    done: false,
    start: '12:00',
    end: '13:00',
    ...over,
  } as EventView,
  top: 720,
  height: 60,
  col: 0,
  cols: 1,
});

const props = (b: Block) => ({
  pt: plannerTheme('standard', theme, 'rose', 0),
  categories: [],
  calendars: [],
  block: b,
  ppm: { value: 2 } as never,
  zoom: 'm5' as const,
  gutter: 0,
  width: 390,
  snap: 5,
  onOpen: jest.fn(),
  onToggle: jest.fn(),
});

describe('tile of the place', () => {
  test('the OpenStreetMap tile that holds the point', () => {
    expect(osmTile(0, 0, 1)).toBe('https://tile.openstreetmap.org/1/1/1.png');
    expect(osmTile(45.4642, 9.1919, 15)).toBe('https://tile.openstreetmap.org/15/17220/11727.png');
  });
});

describe('an event with a place', () => {
  test('a point on the map: map behind the block, pin, popup with the map and the open button', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
    const p = props(block({ placeLat: 45.4642, placeLon: 9.1919 }));
    await render(<EventBlock {...p} />);
    expect(screen.getByTestId('ev-mapbg-u1@2026-11-20')).toBeTruthy();
    expect(screen.queryByTestId('place-popup')).toBeNull();
    await fireEvent.press(screen.getByTestId('ev-pin-u1@2026-11-20'));
    expect(p.onOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId('place-popup')).toBeTruthy();
    expect(screen.getByTestId('place-map')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('place-popup-open'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('45.4642,9.1919'));
    await fireEvent.press(screen.getByTestId('place-popup-close'));
    expect(screen.queryByTestId('place-popup')).toBeNull();
  });

  test('only text: pin and popup without a map, and no map behind the block', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
    await render(<EventBlock {...props(block({}))} />);
    expect(screen.queryByTestId('ev-mapbg-u1@2026-11-20')).toBeNull();
    await fireEvent.press(screen.getByTestId('ev-pin-u1@2026-11-20'));
    expect(screen.getByTestId('place-popup')).toBeTruthy();
    expect(screen.queryByTestId('place-map')).toBeNull();
    await fireEvent.press(screen.getByTestId('place-popup-open'));
    expect(open).toHaveBeenLastCalledWith(expect.stringContaining('Via%20Roma%201'));
  });

  test('no place: no pin', async () => {
    await render(<EventBlock {...props(block({ location: '', placeName: null }))} />);
    expect(screen.queryByTestId('ev-pin-u1@2026-11-20')).toBeNull();
  });
});
