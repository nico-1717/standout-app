import { useCallback, useSyncExternalStore } from 'react';

import { useApp } from '@/core/app/AppProvider';

import { weatherStore } from './weather';

/** Lo stato del meteo e le azioni, legati all'account corrente. */
export function useWeather() {
  const { account } = useApp();
  useSyncExternalStore(weatherStore.subscribe, weatherStore.getSnapshot);
  const load = useCallback((force?: boolean) => weatherStore.load(account, force), [account]);
  return {
    wx: weatherStore.state,
    loading: weatherStore.loading,
    failed: weatherStore.failed,
    load,
    enable: (lat: number, lon: number, auto?: boolean) =>
      weatherStore.enable(account, lat, lon, auto),
    setPlace: (lat: number, lon: number, place: string) =>
      weatherStore.setPlace(account, lat, lon, place),
    setAuto: (auto: boolean) => weatherStore.setAuto(account, auto),
    disable: () => weatherStore.disable(account),
    preview: (lat: number, lon: number, place: string) =>
      weatherStore.preview(account, lat, lon, place),
    places: (q: string) => account.weatherPlaces(q),
  };
}
