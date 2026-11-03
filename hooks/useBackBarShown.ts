import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { BACK_BAR_SHOWN } from '@/lib/backBar';

/** The back bar map shows: built (BACK_BAR_SHOWN, lib/backBar.ts) and switched on where you are. */
export function useBackBarShown(): boolean {
  return useVenueFeature('backBar') && BACK_BAR_SHOWN;
}
