import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { supabase } from '@/lib/supabase';
import { featureAtHome, withFeature, type VenueFeatureKey } from '@/lib/venueFeatures';

/**
 * Which extras are on where you are. At a venue, its Admin's switches
 * (bars.enabled_features, riding along on the cached venue list); at home,
 * what home mode always had. `ready` is false in venue mode until the venue
 * is known, so a tab or a redirect can wait instead of guessing.
 */
export function useVenueFeatures() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const venue = mode === 'venue' ? active : null;
  const home = mode === 'home';
  return {
    ready: home || !!venue,
    home,
    has: (key: VenueFeatureKey) => (venue ? venue.features.includes(key) : home && featureAtHome(key)),
  };
}

/** One switch, where you are: see useVenueFeatures. */
export function useVenueFeature(key: VenueFeatureKey): boolean {
  return useVenueFeatures().has(key);
}

type BarRow = { bar_id: string; bars: { id: string; enabled_features?: string[] } | { id: string; enabled_features?: string[] }[] | null };

/**
 * A venue's switches, and turning one on or off. Saves straight away and updates the
 * cached venue list first, so the tabs change as the switch moves. The
 * database lets only the venue's Admins write it (bars_update).
 */
export function useSetVenueFeature(barId: string) {
  const client = useQueryClient();
  const userId = useUserId();
  const current = useActiveVenue().venues.find((v) => v.id === barId)?.features ?? [];
  const queryKey = ['bars', userId];
  const mutation = useMutation({
    mutationFn: async (next: VenueFeatureKey[]) => {
      // .select().single(): a write RLS refuses changes no row, and should say so.
      const { error } = await supabase.from('bars').update({ enabled_features: next }).eq('id', barId).select('id').single();
      if (error) throw error;
    },
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<BarRow[]>(queryKey);
      client.setQueryData<BarRow[]>(queryKey, (rows) =>
        rows?.map((row) => {
          if (row.bar_id !== barId || !row.bars) return row;
          const bar = Array.isArray(row.bars) ? row.bars[0] : row.bars;
          return { ...row, bars: { ...bar, enabled_features: next } };
        }),
      );
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  return {
    features: current,
    set: (key: VenueFeatureKey, on: boolean) => mutation.mutate(withFeature(current, key, on)),
    error: mutation.error,
  };
}
