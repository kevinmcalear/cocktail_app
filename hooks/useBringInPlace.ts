import { useCapabilities } from '@/hooks/useCapabilities';
import { useHereVenue } from '@/hooks/useMode';

/**
 * Where Bring in puts things: the venue you're in when you can add drinks
 * there (Drink Creator, edit_drinks), else your home bar. `heldBack` names
 * the venue you're in but can't add to, so the sheet can say so.
 */
export function useBringInPlace() {
  const venue = useHereVenue();
  const caps = useCapabilities(venue?.id ?? null);
  const canAdd = !venue || !!caps.data?.includes('edit_drinks');
  return {
    barId: venue && canAdd ? venue.id : null,
    venueName: venue && canAdd ? venue.name : null,
    heldBack: venue && !canAdd && !caps.isLoading ? venue.name : null,
    loading: !!venue && caps.isLoading,
  };
}
