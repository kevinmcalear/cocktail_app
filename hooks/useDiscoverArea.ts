import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { areaStatus } from '@/components/screens/home/DiscoverArea';
import { useNearMe, type NearMe } from '@/hooks/useNearMe';
import { nearMeArea, type Area } from '@/lib/nearMe';
import { useLastPlace } from '@/store/useLastPlace';

const ANYWHERE: Area = { kind: 'anywhere' };

/**
 * Discover's "where". It opens near the last place this device was found
 * (store/useLastPlace.ts) at once, asks for a fresh position as the screen
 * shows, and moves only if that lands in another ~1 km cell (so the same
 * query, and its cache, carry on). With no place yet it waits for location
 * (`locating`) rather than load every bar drink as a stand-in.
 */
export function useDiscoverArea() {
  const [area, setArea] = useState<Area>(() => {
    const last = useLastPlace.getState().place;
    return last ? nearMeArea(last) : ANYWHERE;
  });
  const [preferNear, setPreferNear] = useState(true);
  // Once the person picks a where, a late answer from the first ask doesn't move them.
  const touched = useRef(false);
  const { state: near, locate } = useNearMe();
  const clearPlace = useLastPlace((s) => s.clear);
  const place = useCallback(
    (found: NearMe) => {
      // No fresh fix (a timeout, no signal): near where this device was last is still near me.
      const last = found.status === 'unavailable' ? useLastPlace.getState().place : null;
      if (found.status === 'ready' || last) {
        setPreferNear(true);
        setArea(nearMeArea(found.status === 'ready' ? found : last!));
        return;
      }
      // Location turned off: forget the last place too, and stop showing near it.
      if (found.status === 'denied') clearPlace();
      setPreferNear(false);
      setArea((a) => (a.kind === 'point' && a.source === 'me' ? ANYWHERE : a));
    },
    [clearPlace]
  );
  const onArea = (next: Area) => {
    touched.current = true;
    setPreferNear(next.kind === 'point' && next.source === 'me');
    setArea(next);
  };
  const onNearMe = () => {
    touched.current = true;
    setPreferNear(true);
    void locate().then(place);
  };
  /** Going to the map from Anywhere: near me, as the map is about here. */
  const nearIfAnywhere = () => {
    if (area.kind === 'anywhere') onNearMe();
  };

  // Storage still loading when Discover opened: open near the last place once it's in.
  useEffect(
    () =>
      useLastPlace.persist.onFinishHydration(({ place: last }) => {
        if (!touched.current && last) setArea((a) => (a.kind === 'anywhere' ? nearMeArea(last) : a));
      }),
    []
  );
  // Ask once Discover is on screen. The tab mounts on its first focus (MountOnFocus), and this
  // guards anywhere else it's rendered off screen.
  const onScreen = usePathname() === '/discover';
  const asked = useRef(false);
  useEffect(() => {
    if (!onScreen || asked.current) return;
    asked.current = true;
    void locate().then((found) => {
      if (!touched.current) place(found);
    });
  }, [onScreen, locate, place]);

  // Location gives up after 8 s (lib/deviceLocation.ts), so this wait has an end.
  const locating = area.kind === 'anywhere' && preferNear && (near.status === 'idle' || near.status === 'locating');
  // "Finding where you are" only while there's nothing to show yet; a refresh near the last place is quiet.
  const usingLast = near.status === 'unavailable' && area.kind === 'point' && area.source === 'me';
  const note = near.status === 'locating' && !locating ? null : areaStatus(near, usingLast);
  return { area, onArea, preferNear, near, onNearMe, nearIfAnywhere, locating, note };
}
