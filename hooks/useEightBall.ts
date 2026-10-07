import { useEffect, useMemo, useState } from 'react';

import { useTopBars } from '@/hooks/useDiscover';
import { useDiscoverDrinks } from '@/hooks/useDiscoverDrinks';
import { useMyBar } from '@/hooks/useHomeBar';
import { getKnownDeviceLocation } from '@/lib/deviceLocation';
import { buildPool, type Candidate } from '@/lib/eightBall';
import { NEAR_ME_KM, type Area } from '@/lib/nearMe';

/** A fix that takes longer than this isn't worth the wait: the ball answers for anywhere. */
const LOCATION_WAIT_MS = 1500;

/**
 * The eight ball's pool: every drink the person can see, weighted toward
 * what their shelf makes and what's well rated nearby (lib/eightBall.ts).
 * Mounted only while the ball is open, so nothing loads until someone
 * shakes. Location is used only if it's already allowed; a playful extra
 * never asks for it. Held in memory, like Discover's.
 */
export function useEightBallPool(): { pool: Candidate[]; isLoading: boolean } {
  const bar = useMyBar();
  const barDrinks = useDiscoverDrinks();
  const [area, setArea] = useState<Area | null>(null);
  useEffect(() => {
    let live = true;
    const giveUp = setTimeout(() => live && setArea((a) => a ?? { kind: 'anywhere' }), LOCATION_WAIT_MS);
    void getKnownDeviceLocation().then((found) => {
      if (!live) return;
      if (found.ok) setArea({ kind: 'point', latitude: found.latitude, longitude: found.longitude, radiusKm: NEAR_ME_KM, source: 'me' });
      else setArea((a) => a ?? { kind: 'anywhere' });
    });
    return () => {
      live = false;
      clearTimeout(giveUp);
    };
  }, []);
  const top = useTopBars(area ?? { kind: 'anywhere' });

  const pool = useMemo(
    () =>
      buildPool({
        drinks: bar.drinks,
        canMake: bar.canMakeIds,
        barDrinks: (barDrinks.data?.drinks ?? []).map((d) => ({ id: d.id, name: d.name, imageUrl: d.imageUrl, glass: null, barId: d.barId })),
        ratedBars: (top.data?.ranked ?? []).map((r) => ({ id: r.venue_profile_id, name: r.display_name, score: r.score })),
        near: area?.kind === 'point',
      }),
    [bar.drinks, bar.canMakeIds, barDrinks.data, top.data, area]
  );
  // Wait for the shelf and location so the first pick is already weighted;
  // bar drinks and scores join when they arrive.
  return { pool, isLoading: bar.isLoading || area === null };
}
