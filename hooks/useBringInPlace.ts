import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useHereVenue } from '@/hooks/useMode';

/**
 * Where Bring in puts things: the venue you're in when you can add drinks
 * there (Drink Creator, edit_drinks), else your home bar. `heldBack` names
 * the venue you're in but can't add to, so the sheet can say so. `loading`
 * until that's known: on a cold start the venues, the mode and your rights
 * at the venue arrive after the first paint, and until then it reads as home.
 */
export function useBringInPlace() {
  const { isLoading } = useActiveVenue();
  const venue = useHereVenue();
  const caps = useCapabilities(venue?.id ?? null);
  // ponytail: offline with no rights cached (paused) it settles on home rather than wait for signal; the venue's role level could stand in.
  const capsKnown = !venue || caps.data !== undefined || caps.isError || caps.fetchStatus === 'paused';
  const canAdd = !venue || !!caps.data?.includes('edit_drinks');
  return {
    barId: venue && canAdd ? venue.id : null,
    venueName: venue && canAdd ? venue.name : null,
    heldBack: venue && !canAdd && capsKnown ? venue.name : null,
    loading: isLoading || !capsKnown,
  };
}

/**
 * Where a create page (/add-beer, /add-wine, /add-ingredient, /make-recipe)
 * makes its thing: the bar its link names (`null`: at home), else, with no
 * bar in the link (a cold deep link, a bookmark, a typed address), where you
 * are now, as Bring in decides it. `ready` is false until that's known, so
 * the page waits rather than open at home and change its steps under
 * someone typing (Android walk, 9 Nov: a cold /add-beer at a bar opened as
 * a home beer, with no price).
 */
export function useCreateBar(named: string | null | undefined): { barId: string | null; ready: boolean } {
  const here = useBringInPlace();
  if (named !== undefined) return { barId: named, ready: true };
  return { barId: here.barId, ready: !here.loading };
}
