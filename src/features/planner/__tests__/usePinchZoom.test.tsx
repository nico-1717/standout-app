import { act, renderHook } from '@testing-library/react-native';

import { pxPerMinute, type Zoom } from '../layout';
import { usePinchZoom } from '../usePinchZoom';

jest.mock('@/ui/motion', () => ({ haptic: { select: jest.fn(), tap: jest.fn() } }));

const touches = (gap: number) => [
  { pageX: 100, pageY: 300, identifier: 0, timestamp: 1, locationX: 0, locationY: 0, target: 1 },
  {
    pageX: 100,
    pageY: 300 + gap,
    identifier: 1,
    timestamp: 1,
    locationX: 0,
    locationY: 0,
    target: 1,
  },
];
const ev = (gap: number, n = 2) => {
  const t = touches(gap).slice(0, n);
  return {
    nativeEvent: { touches: t, changedTouches: t, pageX: 100, pageY: 300, timestamp: 1 },
    touchHistory: {
      touchBank: t.map((x) => ({
        touchActive: true,
        startPageX: x.pageX,
        startPageY: x.pageY,
        startTimeStamp: 1,
        currentPageX: x.pageX,
        currentPageY: x.pageY,
        currentTimeStamp: 1,
        previousPageX: x.pageX,
        previousPageY: x.pageY,
        previousTimeStamp: 1,
      })),
      numberActiveTouches: n,
      indexOfSingleActiveTouch: n === 1 ? 0 : -1,
      mostRecentTimeStamp: 1,
    },
  } as never;
};

const setup = async (zoom: Zoom = 'm30') => {
  const save = jest.fn();
  const restore = jest.fn();
  const anchorAt = jest.fn((pageY: number) => ({ min: 600, y: pageY - 100 }));
  const hook = await renderHook((z: typeof zoom) => usePinchZoom(z, { anchorAt, restore, save }), {
    initialProps: zoom,
  });
  const h = () => hook.result.current.panHandlers as Record<string, (e: never) => unknown>;
  return { hook, save, restore, anchorAt, h };
};

describe('usePinchZoom', () => {
  test('starts at the natural density of the saved step and ignores one finger', async () => {
    const { hook, h } = await setup();
    expect(hook.result.current.ppm).toBeCloseTo(pxPerMinute('m30'));
    expect(h().onStartShouldSetResponderCapture!(ev(80, 1))).toBe(false);
    expect(h().onStartShouldSetResponderCapture!(ev(80, 2))).toBe(true);
  });

  test('two fingers: density follows the distance, the anchor is held, the step is saved once at the end', async () => {
    const { hook, h, save, restore, anchorAt } = await setup();
    await act(async () => {
      h().onResponderGrant!(ev(80));
    });
    expect(anchorAt).toHaveBeenCalledTimes(1);
    expect(hook.result.current.pinching).toBe(true);
    await act(async () => {
      h().onResponderMove!(ev(320));
    });
    expect(hook.result.current.ppm).toBeCloseTo(pxPerMinute('m30') * 4);
    expect(hook.result.current.step).toBe('m5');
    expect(restore).toHaveBeenCalled();
    expect(restore.mock.calls.at(-1)![0]).toEqual({ min: 600, y: 240 });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      h().onResponderEnd!(ev(320, 1));
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('m5');
    expect(hook.result.current.pinching).toBe(false);
  });

  test('pinching in from 3 hours goes to the list', async () => {
    const { hook, h, save } = await setup('h3');
    await act(async () => {
      h().onResponderGrant!(ev(200));
    });
    await act(async () => {
      h().onResponderMove!(ev(100));
    });
    expect(hook.result.current.step).toBe('agenda');
    await act(async () => {
      h().onResponderEnd!(ev(100, 1));
    });
    expect(save).toHaveBeenCalledWith('agenda');
  });

  test('from the list, a small opening returns to the hours', async () => {
    const { hook, h } = await setup('agenda');
    await act(async () => {
      h().onResponderGrant!(ev(100));
    });
    await act(async () => {
      h().onResponderMove!(ev(130));
    });
    expect(hook.result.current.step).toBe('h3');
    expect(hook.result.current.ppm).toBeCloseTo(pxPerMinute('h3'));
  });

  test('the dial picks a step at its natural density and saves it', async () => {
    const { hook, save } = await setup();
    await act(async () => {
      hook.result.current.choose('m15', { min: 500, y: 200 });
    });
    expect(save).toHaveBeenCalledWith('m15');
    await hook.rerender('m15');
    expect(hook.result.current.step).toBe('m15');
    expect(hook.result.current.ppm).toBeCloseTo(pxPerMinute('m15'));
  });
});
