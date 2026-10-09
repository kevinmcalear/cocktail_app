/** Sentinel for personal items (bar_id IS NULL). */
export const PERSONAL_CONTEXT = 'personal';

/**
 * Contexts for a venue-mode screen (the redesign's Library): just the active
 * venue. No venue at all falls back to personal items; while venues are still
 * loading, nothing matches, so another context's items never flash up.
 */
export function venueContextIds(activeVenueId: string | null, venuesLoading: boolean): string[] {
  if (activeVenueId) return [activeVenueId];
  return venuesLoading ? [] : [PERSONAL_CONTEXT];
}

/** Client-side: is this bar_id in the selected venue contexts? */
export function inSelectedContext(
  barId: string | null | undefined,
  selectedContextIds: string[]
) {
  if (!barId) return selectedContextIds.includes(PERSONAL_CONTEXT);
  return selectedContextIds.includes(barId);
}

/**
 * Whether something seen belongs where you are now (`hereId`: the venue, or
 * null at home). Your other venues' things stay at those venues; your own and
 * other bars' public drinks show anywhere.
 */
export function belongsHere(barId: string | null | undefined, myVenueIds: string[], hereId: string | null) {
  return !barId || barId === hereId || !myVenueIds.includes(barId);
}
