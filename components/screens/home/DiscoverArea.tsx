import type { NearMe } from '@/hooks/useNearMe';

/**
 * Why near me didn't stick, when it didn't. `usingLast`: no fresh position, so near me is near the last place.
 * Location off is the location card's to say (FirstCards.tsx), with its way to turn it on.
 */
export function areaStatus(near: NearMe, usingLast = false): string | null {
  if (near.status === 'locating') return 'Finding where you are…';
  if (near.status === 'unavailable' && usingLast) return "Couldn't get a fresh position, so this is near where you were last.";
  if (near.status === 'unavailable') return "Couldn't find where you are. Pick a city instead, or try again.";
  return null;
}
