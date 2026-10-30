import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { supabase } from '@/lib/supabase';
import { featureAtHome, featureSaveMessage, isFeatureKey, readFeatures, withFeature, type VenueFeatureKey } from '@/lib/venueFeatures';

export const venueFeaturesKey = (barId: string | null) => ['venue-features', barId] as const;

/**
 * A venue's switches (bars.enabled_features), in a query of their own so the
 * venue list never asks for the column: the app keeps working if it ships
 * before the migration. The read never throws (lib/venueFeatures.ts
 * readFeatures), so there's nothing to retry. Saved between launches.
 */
function useFeatureRow(barId: string | null) {
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

/**
 * Which extras are on where you are. At a venue, its Admin's switches; at
 * home, what home mode always had. `ready` is false in venue mode until the
 * venue and its switches are known, so a tab or a redirect can wait instead
 * of guessing.
 */
export function useVenueFeatures() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const venue = mode === 'venue' ? active : null;
  const home = mode === 'home';
  const { data } = useFeatureRow(venue?.id ?? null);
  return {
    ready: home || (!!venue && data !== undefined),
    home,
    /** The venue's switches that are on (the ones this build knows); none at home, where nothing switches. */
    on: venue ? (data ?? []).filter(isFeatureKey) : [],
    has: (key: VenueFeatureKey) => (venue ? (data ?? []).includes(key) : home && featureAtHome(key)),
  };
}

/** One switch, where you are: see useVenueFeatures. */
export function useVenueFeature(key: VenueFeatureKey): boolean {
  return useVenueFeatures().has(key);
}

/**
 * One switch at a given venue, whichever mode you're in: for a drink or a
 * page that belongs to that venue (Fit it, Kit). Off until it loads.
 */
export function useBarFeature(barId: string | null | undefined, key: VenueFeatureKey): boolean {
  return (useFeatureRow(barId ?? null).data ?? []).includes(key);
}

/**
 * A venue's switches, and turning one on or off. Saves straight away and
 * updates the cached switches first, so the tabs change as the switch moves.
 * The database changes the one key (set_venue_feature, 20261130950000), so
 * a switch another build added is never dropped; before that function is
 * there, it writes the list, keeping keys this build doesn't know. Only the
 * venue's Admins can write it (bars_update).
 */
export function useSetVenueFeature(barId: string) {
  const client = useQueryClient();
  const queryKey = venueFeaturesKey(barId);
  const current = useFeatureRow(barId).data ?? [];
  const mutation = useMutation({
    mutationFn: async ({ key, on, next }: { key: VenueFeatureKey; on: boolean; next: string[] }) => {
      const rpc = await supabase.rpc('set_venue_feature', { p_bar_id: barId, p_feature: key, p_enabled: on });
      if (!rpc.error) return rpc.data ?? next;
      if (rpc.error.code !== 'PGRST202') throw rpc.error;
      // ponytail: the function isn't there until its migration is; drop this once it's live.
      // .select().single(): a write RLS refuses changes no row, and should say so.
      const { error } = await supabase.from('bars').update({ enabled_features: next }).eq('id', barId).select('id').single();
      if (error) throw error;
      return next;
    },
    onMutate: async ({ next }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<string[]>(queryKey);
      client.setQueryData(queryKey, next);
      return { previous };
    },
    onSuccess: (saved) => client.setQueryData(queryKey, saved),
    onError: (_error, _next, context) => client.setQueryData(queryKey, context?.previous ?? []),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  return {
    features: current,
    set: (key: VenueFeatureKey, on: boolean) => mutation.mutate({ key, on, next: withFeature(current, key, on) }),
    error: mutation.error ? featureSaveMessage(mutation.error as { code?: string }) : null,
  };
}
