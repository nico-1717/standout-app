import * as Location from 'expo-location';

import { wxState, type AccountApi } from '@/core/account/accountApi';

import { distanceKm, livePosition } from '../livePosition';
import { WeatherStore } from '../weather';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const loc = Location as jest.Mocked<typeof Location>;
const fix = (lat: number, lon: number) =>
  ({ coords: { latitude: lat, longitude: lon } }) as Location.LocationObject;

describe('distanceKm', () => {
  test('Milan to Rome is about 477 km, and the same point is zero', () => {
    expect(Math.round(distanceKm(45.4642, 9.19, 41.9028, 12.4964))).toBe(477);
    expect(distanceKm(45.46, 9.19, 45.46, 9.19)).toBe(0);
  });
});

describe('livePosition', () => {
  beforeEach(() => jest.resetAllMocks());

  test('without permission it gives nothing and never reads the GPS', async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as Location.LocationPermissionResponse);
    expect(await livePosition()).toBeNull();
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('uses a recent known position before waking the GPS', async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Location.LocationPermissionResponse);
    loc.getLastKnownPositionAsync.mockResolvedValue(fix(45.5, 9.2));
    expect(await livePosition()).toEqual({ lat: 45.5, lon: 9.2 });
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('asks the GPS when nothing is known, and gives nothing if it fails', async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Location.LocationPermissionResponse);
    loc.getLastKnownPositionAsync.mockResolvedValue(null);
    loc.getCurrentPositionAsync.mockResolvedValueOnce(fix(41.9, 12.5));
    expect(await livePosition()).toEqual({ lat: 41.9, lon: 12.5 });
    loc.getCurrentPositionAsync.mockRejectedValueOnce(new Error('no signal'));
    expect(await livePosition()).toBeNull();
  });
});

describe('WeatherStore.follow', () => {
  const raw = { enabled: true, place: 'Milano', lat: 45.46, lon: 9.19, auto: true };
  const setup = (over: Record<string, unknown> = {}) => {
    const api = {
      weather: jest.fn(async () => wxState({ ...raw, ...over })),
      weatherEnable: jest.fn(async () => wxState({ ...raw, place: 'Roma', lat: 41.9, lon: 12.5 })),
    } as unknown as AccountApi;
    const store = new WeatherStore();
    return { api, store };
  };

  test('moves the saved place when the phone is more than 3 km away', async () => {
    const { api, store } = setup();
    store.locate = jest.fn(async () => ({ lat: 41.9, lon: 12.5 }));
    await store.load(api);
    await store.follow(api);
    expect(api.weatherEnable).toHaveBeenCalledWith(41.9, 12.5, true);
    expect(store.state?.place).toBe('Roma');
  });

  test('stays still for a short move, in manual mode, or without a position', async () => {
    const near = setup();
    near.store.locate = jest.fn(async () => ({ lat: 45.47, lon: 9.2 }));
    await near.store.load(near.api);
    await near.store.follow(near.api);
    expect(near.api.weatherEnable).not.toHaveBeenCalled();

    const manual = setup({ auto: false });
    manual.store.locate = jest.fn(async () => ({ lat: 41.9, lon: 12.5 }));
    await manual.store.load(manual.api);
    await manual.store.follow(manual.api);
    expect(manual.store.locate).not.toHaveBeenCalled();
    expect(manual.api.weatherEnable).not.toHaveBeenCalled();

    const none = setup();
    none.store.locate = jest.fn(async () => null);
    await none.store.load(none.api);
    await none.store.follow(none.api);
    expect(none.api.weatherEnable).not.toHaveBeenCalled();
  });

  test('asks the position at most once every ten minutes unless forced', async () => {
    const { api, store } = setup();
    store.locate = jest.fn(async () => null);
    await store.load(api);
    await store.follow(api);
    await store.follow(api);
    expect(store.locate).toHaveBeenCalledTimes(1);
    await store.follow(api, true);
    expect(store.locate).toHaveBeenCalledTimes(2);
  });

  test('a failed save keeps the old place and does not throw', async () => {
    const { api, store } = setup();
    (api.weatherEnable as jest.Mock).mockRejectedValue(new Error('offline'));
    store.locate = jest.fn(async () => ({ lat: 41.9, lon: 12.5 }));
    await store.load(api);
    await expect(store.follow(api)).resolves.toBeUndefined();
    expect(store.state?.place).toBe('Milano');
  });
});
