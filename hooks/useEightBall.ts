import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useDrinkLists, useTopBars } from '@/hooks/useDiscover';
import { useBarDrinks, useShelf } from '@/hooks/useHomeBar';
import { getKnownDeviceLocation } from '@/lib/deviceLocation';
import { buildPool, type Candidate } from '@/lib/eightBall';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { NEAR_ME_KM, type Area } from '@/lib/nearMe';
import { supabase } from '@/lib/supabase';

/**
 * A fix that takes longer than this isn't worth the wait: the ball answers
 * for anywhere. Shorter than the ball's think time, so it never holds it up.
 */
const LOCATION_WAIT_MS = 1000;

const NO_BARS: string[] = [];

/**
 * The drinks the well-rated bars pour: the only bar drinks the pool can
 * use (buildPool skips the rest), so it reads those, not every bar drink.
 * ponytail: one page of 1000, plenty for 50 bars. Upgrade path: page it if
 * top bars ever list more.
 */
function useRatedBarDrinks(barIds: string[]) {
  return useQuery({
    queryKey: ['eight-ball-bar-drinks', barIds],
    meta: { persist: false },
    enabled: barIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, origin_bar_profile_id, item_images ( angle, sort_order, is_generated, images ( url ) )')
        .eq('item_type', 'cocktail')
        .is('bar_id', null)
        .in('origin_bar_profile_id', barIds)
        .limit(1000);
      if (error) throw error;
      const rows = (data ?? []) as unknown as { id: string; name: string; origin_bar_profile_id: string; item_images: ItemImageLink[] | null }[];
      return rows.map((r) => ({ id: r.id, name: r.name, imageUrl: heroPicture(r.item_images)?.url ?? null, glass: null, barId: r.origin_bar_profile_id }));
    },
  });
}

/**
 * The eight ball's pool: the classics, the well-rated bars' drinks, and
 * what the shelf makes or nearly makes, weighted toward what their shelf
 * makes and what's well rated nearby (lib/eightBall.ts). Mounted only
 * while the ball is open, so nothing loads until someone shakes. Location
 * is used only if it's already allowed; a playful extra never asks for it.
 */
export function useEightBallPool(): { pool: Candidate[]; isLoading: boolean } {
  const shelf = useShelf();
  const bar = useBarDrinks();
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
  const ranked = area ? top.data?.ranked : undefined;
  const barIds = useMemo(() => ranked?.map((r) => r.venue_profile_id) ?? NO_BARS, [ranked]);
  const barDrinks = useRatedBarDrinks(barIds);

  const classics = useDrinkLists();
  const pool = useMemo(
    () =>
      buildPool({
        // What the shelf makes or nearly makes, and the classics; bar drinks join below.
        drinks: [
          ...bar.canMake,
          ...bar.oneAway.flatMap((a) => a.drinks),
          ...(classics.data ?? []).map((d) => ({ id: d.id, name: d.name, imageUrl: d.imageUrl, glass: null })),
        ],
        canMake: bar.canMakeIds,
        barDrinks: barDrinks.data ?? [],
        ratedBars: (ranked ?? []).map((r) => ({ id: r.venue_profile_id, name: r.display_name, score: r.score })),
        near: area?.kind === 'point',
      }),
    [bar.canMake, bar.oneAway, bar.canMakeIds, classics.data, barDrinks.data, ranked, area]
  );
  // Wait for what the shelf makes (an empty shelf makes nothing, so not
  // then; EightBall gives up on a slow one) and location, so the first pick
  // is already weighted. Bar drinks join when they arrive.
  const shelfLoading = shelf.isLoading || (!!shelf.data?.length && bar.isLoading);
  return { pool, isLoading: shelfLoading || area === null };
}
