import { GRACE_MS, shouldCover, shouldLock } from '../logic';

describe('app lock logic', () => {
  test('never locks when it is off, or when the app never left', () => {
    expect(shouldLock({ enabled: false, leftAt: 0, now: 10 * GRACE_MS })).toBe(false);
    expect(shouldLock({ enabled: true, leftAt: null, now: 10 * GRACE_MS })).toBe(false);
  });
  test('locks only after the grace time in the background', () => {
    expect(shouldLock({ enabled: true, leftAt: 1000, now: 1000 + GRACE_MS - 1 })).toBe(false);
    expect(shouldLock({ enabled: true, leftAt: 1000, now: 1000 + GRACE_MS })).toBe(true);
    expect(shouldLock({ enabled: true, leftAt: 0, now: 5000, graceMs: 0 })).toBe(true);
  });
  test('covers the screen whenever the app is not in front, but only with the lock on', () => {
    expect(shouldCover({ enabled: true, appState: 'inactive' })).toBe(true);
    expect(shouldCover({ enabled: true, appState: 'background' })).toBe(true);
    expect(shouldCover({ enabled: true, appState: 'active' })).toBe(false);
    expect(shouldCover({ enabled: false, appState: 'background' })).toBe(false);
  });
});
