import * as Location from 'expo-location';

/** Dove si trova il telefono adesso. */
export interface LivePosition {
  lat: number;
  lon: number;
}

/** Quanto aspettare il GPS prima di rinunciare (come sul sito). */
const WAIT_MS = 8000;
/** Una posizione vecchia di meno di 10 minuti va bene (come sul sito). */
const MAX_AGE_MS = 10 * 60_000;

/** Chilometri fra due punti (formula di haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

/**
 * La posizione viva del telefono, o null se manca il permesso, il GPS non risponde in tempo o qualcosa va storto.
 * Il permesso si chiede qui, solo «mentre l'app è in uso»: niente posizione in background, niente tracciamento.
 * Non salva né manda niente da sola.
 */
export async function livePosition(): Promise<LivePosition | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const known = await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS });
    const found =
      known ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_MS)),
      ]));
    if (!found) return null;
    return { lat: found.coords.latitude, lon: found.coords.longitude };
  } catch {
    return null;
  }
}
