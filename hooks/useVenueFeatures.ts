import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { supabase } from '@/lib/supabase';
import { featureShown, isFeatureKey, readFeatures, venueHome, type VenueFeatureKey } from '@/lib/venueFeatures';

export const venueFeaturesKey = (barId: string | null) => ['venue-features', barId] as const;

/**
 * A venue's switches (bars.enabled_features), in a query of their own so the
 * venue list never asks for the column. The read never throws
 * (lib/venueFeatures.ts readFeatures), so there's nothing to retry. Saved
 * between launches.
 */
export function useFeatureRow(barId: string | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: venueFeaturesKey(barId),
    enabled: !!barId,
    meta: { persist: true },
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('bars').select('enabled_features').eq('id', barId!).maybeSingle();
      return readFeatures(data, error, client.getQueryData<string[]>(venueFeaturesKey(barId)));
    },
  });
}

/** The stored list with Advanced options read from its own home (bars.advanced_options). */
export function withAdvanced(list: readonly string[], advanced: boolean): string[] {
  return [...list.filter((k) => k !== 'advanced'), ...(advanced ? ['advanced'] : [])];
}

/**
 * Which sections show where you are (every page loads this, so it stays small:
 * useBarFeature, useBackBarShown and useSetVenueFeature are files of their own). At a venue, its Admin's switches; at
 * home, what home mode always had. `ready` is false in venue mode until the
 * venue and its switches are known, so a tab or a redirect can wait instead
 * of guessing. `home` is where a deep link to a switched-off section goes.
 */
export function useVenueFeatures() {
  const { mode } = useMode();
  const { active, isLoading } = useActiveVenue();
  const venue = mode === 'venue' ? active : null;
  const { data } = useFeatureRow(venue?.id ?? null);
  // Advanced options has its own home (bars.advanced_options): read it with useBarFeature, so every
  // page doesn't load it. Here it is never on.
  const list = venue ? withAdvanced(data ?? [], false) : null;
  const has = (key: VenueFeatureKey) => (mode === 'home' ? featureShown(key, null) : !!list && featureShown(key, list));
  return {
    ready: mode === 'home' || (venue ? data !== undefined : !isLoading),
    /** The venue's switches that are on (the ones this build knows); none at home. */
    on: (list ?? []).filter(isFeatureKey),
    has,
    home: venueHome(has),
  };
}

/** One switch, where you are: see useVenueFeatures. */
export function useVenueFeature(key: VenueFeatureKey): boolean {
  return useVenueFeatures().has(key);
}
