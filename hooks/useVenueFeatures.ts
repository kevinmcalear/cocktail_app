import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useBarAdvanced, useSetBarAdvanced } from '@/hooks/useAdvancedOptions';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { BACK_BAR_SHOWN } from '@/lib/backBar';
import { supabase } from '@/lib/supabase';
import { featureSaveMessage, featureShown, isFeatureKey, readFeatures, venueHome, withFeature, type VenueFeatureKey } from '@/lib/venueFeatures';

export const venueFeaturesKey = (barId: string | null) => ['venue-features', barId] as const;

/**
 * A venue's switches (bars.enabled_features), in a query of their own so the
 * venue list never asks for the column. The read never throws
 * (lib/venueFeatures.ts readFeatures), so there's nothing to retry. Saved
 * between launches.
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

/** The stored list with Advanced options read from its own home (bars.advanced_options). */
function withAdvanced(list: readonly string[], advanced: boolean): string[] {
  return [...list.filter((k) => k !== 'advanced'), ...(advanced ? ['advanced'] : [])];
}

/**
 * Which sections show where you are. At a venue, its Admin's switches; at
 * home, what home mode always had. `ready` is false in venue mode until the
 * venue and its switches are known, so a tab or a redirect can wait instead
 * of guessing. `home` is where a deep link to a switched-off section goes.
 */
export function useVenueFeatures() {
  const { mode } = useMode();
  const { active, isLoading } = useActiveVenue();
  const venue = mode === 'venue' ? active : null;
  const { data } = useFeatureRow(venue?.id ?? null);
  const advanced = useBarAdvanced(venue?.id ?? null);
  const list = venue ? withAdvanced(data ?? [], advanced) : null;
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

/** The back bar map shows: built (BACK_BAR_SHOWN, lib/backBar.ts) and switched on where you are. */
export function useBackBarShown(): boolean {
  return useVenueFeature('backBar') && BACK_BAR_SHOWN;
}

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
    mutationFn: async ({ key, on }: { key: VenueFeatureKey; on: boolean; next: string[] }) => {
      const { data, error } = await supabase.rpc('set_venue_feature', { p_bar_id: barId, p_feature: key, p_enabled: on });
      if (error) throw error;
      return data ?? [];
    },
    onMutate: async ({ next }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<string[]>(queryKey);
      client.setQueryData(queryKey, next);
      return { previous };
    },
    onSuccess: (saved) => client.setQueryData(queryKey, saved),
    onError: (_error, _vars, context) => client.setQueryData(queryKey, context?.previous ?? []),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const error = mutation.error ?? setAdvanced.error;
  return {
    features: withAdvanced(row, advanced),
    set: (key: VenueFeatureKey, on: boolean) =>
      key === 'advanced' ? setAdvanced.mutate(on) : mutation.mutate({ key, on, next: withFeature(row, key, on) }),
    error: error ? featureSaveMessage(error as { code?: string }) : null,
  };
}
