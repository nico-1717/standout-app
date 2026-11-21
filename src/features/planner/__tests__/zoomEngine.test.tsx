import { act, renderHook } from '@testing-library/react-native';
import { useRef } from 'react';

import { useZoomEngine } from '../zoomEngine';

// The gesture runs on the native/UI threads, which tests do not have: the hook's config is captured and the
// pinch is fed to it by hand, with shared values as plain boxes and scrollTo recorded.
const mockScrollTo = jest.fn();
let mockPinch: Record<string, (e: Record<string, number>) => void> = {};
jest.mock('react-native-gesture-handler', () => ({
  usePinchGesture: (cfg: Record<string, (e: Record<string, number>) => void>) => {
    if (cfg.onActivate) mockPinch = cfg;
    return {};
  },
}));
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: unknown) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const box = useRef({ value: v });
    return box.current;
  },
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: () => () => undefined,
  scrollTo: (...a: unknown[]) => mockScrollTo(...a),
}));
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a),
  scheduleOnUI: (fn: () => void) => fn(),
}));
jest.mock('@/ui/motion', () => ({ haptic: { select: () => undefined } }));

const finite = (calls: unknown[][]) =>
  calls.every(([, x, y]) => Number.isFinite(x) && Number.isFinite(y));

async function pinch(start: string, scales: number[], focal = 300) {
  const saved: string[] = [];
  const hook = await renderHook(() =>
    useZoomEngine({ zoom: start as never, save: (z) => saved.push(z), enabled: true }),
  );
  hook.result.current.setLayout(700, 120);
  mockScrollTo.mockClear();
  await act(async () => mockPinch.onActivate!({ scale: 1, focalY: focal }));
  for (const s of scales) await act(async () => mockPinch.onUpdate!({ scale: s, focalY: focal }));
  await act(async () => mockPinch.onFinalize!({}));
  return { hook, saved };
}

describe('zoom engine: a pinch writes finite numbers and saves once', () => {
  test('spreading the fingers from one hour zooms in step by step', async () => {
    const { hook, saved } = await pinch('h1', [1.1, 1.4, 1.9, 2.5, 3.2]);
    expect(Number.isFinite(hook.result.current.ppm.value)).toBe(true);
    expect(hook.result.current.ppm.value).toBeGreaterThan(46 / 60);
    expect(finite(mockScrollTo.mock.calls)).toBe(true);
    expect(saved).toHaveLength(1);
    expect(hook.result.current.pinching).toBe(false);
  });

  test('pinching in from one hour goes down to 3 hours', async () => {
    const { hook, saved } = await pinch('h1', [0.9, 0.7, 0.5, 0.3, 0.2]);
    expect(finite(mockScrollTo.mock.calls)).toBe(true);
    // from one hour one gesture reaches 3 hours; the list is the next gesture (like the website)
    expect(hook.result.current.step).toBe('h3');
    expect(saved).toEqual(['h3']);
  });

  test('from the list, a small opening comes back into the hours', async () => {
    const { hook, saved } = await pinch('agenda', [1.02, 1.1, 1.3]);
    expect(finite(mockScrollTo.mock.calls)).toBe(true);
    expect(hook.result.current.step).not.toBe('agenda');
    expect(hook.result.current.ppm.value).toBeGreaterThan(0);
    expect(saved).toHaveLength(1);
  });

  test('from 3 hours, pinching past the minimum goes to the list, once', async () => {
    const { hook, saved } = await pinch('h3', [0.9, 0.7, 0.5]);
    expect(finite(mockScrollTo.mock.calls)).toBe(true);
    expect(hook.result.current.step).toBe('agenda');
    expect(hook.result.current.ppm.value).toBe(0);
    expect(saved).toEqual(['agenda']);
  });

  test('a scale that is not a number changes nothing', async () => {
    const { hook } = await pinch('h1', [Number.NaN, 1.5]);
    expect(Number.isFinite(hook.result.current.ppm.value)).toBe(true);
    expect(finite(mockScrollTo.mock.calls)).toBe(true);
  });

  test('an error inside the gesture is reported and the gesture ends instead of crashing', async () => {
    const errors: string[] = [];
    const hook = await renderHook(() =>
      useZoomEngine({
        zoom: 'h1',
        save: () => undefined,
        enabled: true,
        onError: (m) => errors.push(m),
      }),
    );
    mockScrollTo.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    hook.result.current.setLayout(700, 120);
    await act(async () => mockPinch.onActivate!({ scale: 1, focalY: 300 }));
    await act(async () => mockPinch.onUpdate!({ scale: 1.5, focalY: 300 }));
    expect(errors[0]).toContain('boom');
    expect(hook.result.current.pinching).toBe(false);
  });

  test('missing numbers in the first event never reach the scroll', async () => {
    const hook = await renderHook(() =>
      useZoomEngine({ zoom: 'h1', save: () => undefined, enabled: true }),
    );
    hook.result.current.setLayout(700, 120);
    mockScrollTo.mockClear();
    await act(async () => mockPinch.onActivate!({}));
    await act(async () => mockPinch.onUpdate!({ scale: 1.5 }));
    expect(finite(mockScrollTo.mock.calls)).toBe(true);
  });
});
