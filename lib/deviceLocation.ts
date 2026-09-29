import * as Location from 'expo-location';

/** Where the device is, once, or why not. Never stored; see lib/nearMe.ts for what's sent. */
export type DeviceLocation =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * Native: asks for "while using the app" permission (only when it's
 * needed), then one position. Balanced accuracy is plenty for a 10 km search
 * and answers faster than GPS.
 */
export async function getDeviceLocation(): Promise<DeviceLocation> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000, requiredAccuracy: 1000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
