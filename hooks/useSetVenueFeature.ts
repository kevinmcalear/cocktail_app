import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useBarAdvanced, useSetBarAdvanced } from '@/hooks/useAdvancedOptions';
import { useFeatureRow, venueFeaturesKey, withAdvanced } from '@/hooks/useVenueFeatures';
import { supabase } from '@/lib/supabase';
import { featureSaveMessage, withFeature } from '@/lib/venueFeatureList';
import type { VenueFeatureKey } from '@/lib/venueFeatures';

/**
 * A venue's switches, and turning one on or off. Saves straight away and
 * updates the cached switches first, so the tabs change as the switch moves.
 * set_venue_feature (20261130950000) changes the one key, so a switch another
 * build added is never dropped. Advanced options writes its own home. Only
 * the venue's Admins can write either (bars_update).
 */
export function useSetVenueFeature(barId: string) {
  const client = useQueryClient();
  const queryKey = venueFeaturesKey(barId);
  const row = useFeatureRow(barId).data ?? [];
  const advanced = useBarAdvanced(barId);
  const setAdvanced = useSetBarAdvanced(barId);
  const mutation = useMutation({
    mutationFn: async ({ key, on }: { key: VenueFeatureKey; on: boolean }) => {
      const { data, error } = await supabase.rpc('set_venue_feature', {
        p_bar_id: barId,
        p_feature: key,
        p_enabled: on,
      });
      if (error) throw error;
      return data ?? [];
    },
    // Each switch changes its own key in what's cached now, and a failed one puts back only its key,
    // so two quick switches never undo each other. The saved list comes back with the refetch.
    onMutate: async ({ key, on }) => {
      await client.cancelQueries({ queryKey });
      client.setQueryData<string[]>(queryKey, (list) => withFeature(list ?? [], key, on));
    },
    onError: (_error, { key, on }) => client.setQueryData<string[]>(queryKey, (list) => withFeature(list ?? [], key, !on)),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const error = mutation.error ?? setAdvanced.error;
  return {
    features: withAdvanced(row, advanced),
    set: (key: VenueFeatureKey, on: boolean) => (key === 'advanced' ? setAdvanced.mutate(on) : mutation.mutate({ key, on })),
    error: error ? featureSaveMessage(error as { code?: string }) : null,
  };
}
