import { useCallback, useState } from 'react';

import { getDeviceLocation } from '@/lib/deviceLocation';

export type NearMe =
  | { status: 'idle' | 'locating' | 'denied' | 'unavailable' }
  | { status: 'ready'; latitude: number; longitude: number };

/**
 * The device's position for "near me". Discover asks as the screen opens;
 * tapping the pin asks again. Held in memory and never saved; what leaves
 * the device is rounded (lib/nearMe.ts) and goes only to our own RPCs.
 */
export function useNearMe() {
  const [state, setState] = useState<NearMe>({ status: 'idle' });
  const locate = useCallback(async (): Promise<NearMe> => {
    setState({ status: 'locating' });
    const found = await getDeviceLocation();
    const next: NearMe = found.ok ? { status: 'ready', latitude: found.latitude, longitude: found.longitude } : { status: found.reason };
    setState(next);
    return next;
  }, []);
  return { state, locate };
}
