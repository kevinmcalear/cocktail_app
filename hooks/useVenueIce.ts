import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { IceShape } from '@/lib/venueKit';
import type { Row } from '@/types/db';

// A venue's ice: ice items of the venue with what each looks like and where
// it comes from (item_ice, supabase/migrations/20261110100000_kit_and_ice.sql).
// Its team reads it; anyone with Prep changes it, through save_venue_ice and
// remove_venue_ice.

export type VenueIce = Omit<Row<'item_ice'>, 'item_id' | 'bar_id' | 'shape'> & {
  /** The ice item's id. */
  id: string;
  name: string;
  shape: IceShape;
  /** Null when the supplier isn't said, or this person can't see the venue's suppliers. */
  supplier_name: string | null;
};

/** An ice as the sheet saves it: every fact, so one left out is not said. No id adds it. */
export type VenueIceChange = Pick<VenueIce, 'name' | 'shape'> & Partial<Omit<VenueIce, 'name' | 'shape' | 'supplier_name'>>;

export const venueIceKey = (barId: string | null | undefined) => ['venue-ice', barId] as const;

/** The venue's ice, in the glass and to cut from, in the order it was added. */
export function useVenueIce(barId: string | null | undefined) {
  return useQuery({
    queryKey: venueIceKey(barId),
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VenueIce[]> => {
      const { data, error } = await supabase.rpc('venue_ice', { p_bar_id: barId! });
      if (error) throw error;
      // The generator types a function's columns as never null; these are item_ice's.
      return (data ?? []) as VenueIce[];
    },
  });
}

/** Add a venue's ice, or change one (by id). */
export function useSaveVenueIce(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (ice: VenueIceChange) => {
      const { error } = await supabase.rpc('save_venue_ice', {
        p_bar_id: barId,
        p_id: ice.id ?? null,
        p_name: ice.name,
        p_shape: ice.shape,
        p_draw_as: ice.draw_as ?? null,
        p_size_mm: ice.size_mm ?? null,
        p_length_mm: ice.length_mm ?? null,
        p_clear: ice.clear ?? null,
        p_stamped: ice.stamped ?? false,
        p_frozen_inside: ice.frozen_inside ?? null,
        p_source: ice.source ?? null,
        p_supplier_id: ice.supplier_id ?? null,
        p_machine: ice.machine ?? null,
        p_note: ice.note ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: venueIceKey(barId) }),
  });
}

/** Take an ice off the venue's kit. The database refuses while a drink pours it. */
export function useRemoveVenueIce(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('remove_venue_ice', { p_id: id });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: venueIceKey(barId) }),
  });
}
