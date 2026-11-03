import { useBarAdvanced, useBarAdvancedState } from '@/hooks/useAdvancedOptions';
import { useFeatureRow, withAdvanced } from '@/hooks/useVenueFeatures';
import { featureShown, type VenueFeatureKey } from '@/lib/venueFeatures';

/**
 * One switch at a given venue, whichever mode you're in: for a drink or a
 * page that belongs to that venue (Fit it, Kit). Off until it loads.
 */
export function useBarFeature(barId: string | null | undefined, key: VenueFeatureKey): boolean {
  return useBarFeatures(barId)(key);
}

/** Every switch at a given venue, as a `has`: see useBarFeature. */
export function useBarFeatures(barId: string | null | undefined): (key: VenueFeatureKey) => boolean {
  const row = useFeatureRow(barId ?? null).data;
  const advanced = useBarAdvanced(barId);
  const list = withAdvanced(row ?? [], advanced);
  return (key) => !!barId && featureShown(key, list);
}

/** One switch at a given venue, or undefined until it loads: for a route that waits before it redirects. */
export function useBarFeatureState(barId: string, key: VenueFeatureKey): boolean | undefined {
  const row = useFeatureRow(barId).data;
  const advanced = useBarAdvancedState(barId);
  if (key === 'advanced') return advanced;
  return row === undefined ? undefined : featureShown(key, row);
}
