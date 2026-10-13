import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getLocationAccess, type LocationAccess } from '@/lib/deviceLocation';

/**
 * Whether location is allowed, checked as this mounts, whenever the app comes
 * back to the front (so turning it on in Settings shows at once), and when
 * `recheck` changes (pass the latest near-me answer). Null until the first
 * check lands.
 */
export function useLocationAccess(recheck?: unknown): LocationAccess | null {
  const [access, setAccess] = useState<LocationAccess | null>(null);
  useEffect(() => {
    let live = true;
    const check = () => {
      void getLocationAccess().then((next) => {
        if (live) setAccess(next);
      });
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, [recheck]);
  return access;
}
