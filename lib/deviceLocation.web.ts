import type { DeviceLocation, LocationAccess } from './deviceLocation';

export type { DeviceLocation, LocationAccess } from './deviceLocation';

/**
 * Web: the site's geolocation permission as it stands, never prompting.
 * "denied" is blocked: the browser won't ask again until the person changes
 * it in the site's settings. Browsers without the Permissions API say "ask".
 */
export async function getLocationAccess(): Promise<LocationAccess> {
  try {
    const { state } = await navigator.permissions.query({ name: 'geolocation' });
    return state === 'granted' ? 'granted' : state === 'denied' ? 'blocked' : 'ask';
  } catch {
    return 'ask';
  }
}

/** Web: the browser's own geolocation prompt, then one position (coarse is fine, up to an hour old). */
export function getDeviceLocation(): Promise<DeviceLocation> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, reason: 'unavailable' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => resolve({ ok: false, reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, maximumAge: 60 * 60 * 1000, timeout: 15000 }
    );
  });
}

/** The position only if the browser already allows it: never prompts. */
export async function getKnownDeviceLocation(): Promise<DeviceLocation> {
  try {
    const { state } = await navigator.permissions.query({ name: 'geolocation' });
    if (state !== 'granted') return { ok: false, reason: 'denied' };
    return await getDeviceLocation();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
