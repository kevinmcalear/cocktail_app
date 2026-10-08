import { useCallback, useRef, useState } from 'react';

import { getDeviceLocation } from '@/lib/deviceLocation';
import { nearMeArea } from '@/lib/nearMe';
import { useLastPlace } from '@/store/useLastPlace';

export type NearMe =
  | { status: 'idle' | 'locating' | 'denied' | 'unavailable' }
  | { status: 'ready'; latitude: number; longitude: number };

/**
 * The device's position for "near me". Discover asks as the screen opens;
 * tapping the pin asks again. A second ask while one is out shares it rather
 * than racing it. Each answer is kept on the device, snapped to about 1 km
 * (store/useLastPlace.ts), so the next launch opens there at once; what
 * leaves the device is rounded (lib/nearMe.ts) and goes only to our own RPCs.
 */
export function useNearMe() {
  const [state, setState] = useState<NearMe>({ status: 'idle' });
  const pending = useRef<Promise<NearMe> | null>(null);
  const setPlace = useLastPlace((s) => s.setPlace);
  const locate = useCallback((): Promise<NearMe> => {
    if (pending.current) return pending.current;
    setState({ status: 'locating' });
    const ask = getDeviceLocation().then((found): NearMe => {
      pending.current = null;
      const next: NearMe = found.ok ? { status: 'ready', latitude: found.latitude, longitude: found.longitude } : { status: found.reason };
      if (found.ok) {
        const { latitude, longitude } = nearMeArea(found);
        setPlace({ latitude, longitude });
      }
      setState(next);
      return next;
    });
    pending.current = ask;
    return ask;
  }, [setPlace]);
  return { state, locate };
}
