import { useState } from 'react';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBars } from '@/hooks/useBars';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useHereVenue } from '@/hooks/useMode';
import { HOME_BAR } from '@/lib/itemRoutes';

/**
 * Where Bring in puts things: the venue you're in when you can add drinks
 * there (Drink Creator, edit_drinks), else your home bar. `heldBack` names
 * the venue you're in but can't add to, so the sheet can say so. `loading`
 * until that's known: on a cold start the venues, the mode and your rights
 * at the venue arrive after the first paint, and until then it reads as home.
 */
export function useBringInPlace() {
  const { isLoading } = useActiveVenue();
  // Offline with nothing saved, the venues or the rights wait for signal (paused): it settles on what it has (home) rather than wait.
  // ponytail: the venue's role level could stand in for rights not yet read.
  const venuesPaused = useBars().fetchStatus === 'paused';
  const venue = useHereVenue();
  const caps = useCapabilities(venue?.id ?? null);
  // Not fetching and still nothing: offline (paused) or not asked (no user yet). Either way it settles rather than wait.
  const capsKnown = !venue || caps.data !== undefined || caps.isError || caps.fetchStatus !== 'fetching';
  const canAdd = !venue || !!caps.data?.includes('edit_drinks');
  return {
    barId: venue && canAdd ? venue.id : null,
    venueName: venue && canAdd ? venue.name : null,
    heldBack: venue && !canAdd && capsKnown ? venue.name : null,
    loading: (isLoading && !venuesPaused) || !capsKnown,
  };
}

/**
 * Where a create page (/add-cocktail, /add-beer, /add-wine, /add-ingredient,
 * /make-recipe)
 * makes its thing: the bar its link names (`null` or HOME_BAR: at home),
 * else, with no bar in the link (a cold deep link, a bookmark, a typed
 * address), where you are now, as Bring in decides it. `ready` is false
 * until that's known, so the page waits rather than open at home and change
 * its steps under someone typing (Android walk, 9 Nov: a cold /add-beer at a
 * bar opened as a home beer, with no price). Once known it holds for the
 * page: rights that arrive later never move it.
 */
export function useCreateBar(named: string | null | undefined): { barId: string | null; ready: boolean } {
  const here = useBringInPlace();
  const [held, setHeld] = useState<{ barId: string | null; ready: true } | null>(null);
  if (named !== undefined) return { barId: named === HOME_BAR ? null : named, ready: true };
  // Held in render (React's "state from props"), so the page opens in the same pass.
  if (!held && !here.loading) setHeld({ barId: here.barId, ready: true });
  return held ?? { barId: here.barId, ready: false };
}
