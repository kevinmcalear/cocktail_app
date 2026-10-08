import * as Location from 'expo-location';

/** Where the device is, once, or why not. See lib/nearMe.ts for what's sent and store/useLastPlace.ts for what's kept. */
export type DeviceLocation =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: 'denied' | 'unavailable' };

/** How long a fresh fix may take before near me gives up and says so. */
const FIX_TIMEOUT_MS = 8000;

/**
 * Native: asks for "while using the app" permission (only when it's
 * needed), then one position: the last one the device knows when it's under
 * an hour old and within 3 km (a 10 km search needs no better), else a
 * fresh balanced fix, which answers faster than GPS. A fix that doesn't come
 * in 8 seconds is "unavailable", never a wait without end.
 */
export async function getDeviceLocation(): Promise<DeviceLocation> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000, requiredAccuracy: 3000 });
    const pos =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
      ]));
    if (!pos) return { ok: false, reason: 'unavailable' };
    return { ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** The position only if location is already allowed: never asks. For extras like the eight ball. */
export async function getKnownDeviceLocation(): Promise<DeviceLocation> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };
    return await getDeviceLocation();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
