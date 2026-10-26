import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppMode } from '@/store/useAppMode';

/** What delete_venue reports back. */
export interface VenueDeleted {
  drinks_kept: number;
  ingredients_kept: number;
  items_deleted: number;
  menus_to_page: number;
  /** The bar's public page, now unclaimed; null when the venue had none. */
  profile_id: string | null;
}

/**
 * A venue's Admin deletes the venue, with its name typed back
 * (delete_venue). Drinks the public could see stay on the bar's page, which
 * goes back to unclaimed; everything else the venue held goes. The server
 * refuses anyone but that venue's Admin, and a name that doesn't match.
 */
export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ barId, confirmName }: { barId: string; confirmName: string }): Promise<VenueDeleted> => {
      const { data, error } = await supabase.rpc('delete_venue', { p_bar_id: barId, p_confirm_name: confirmName });
      if (error) throw error;
      return data as unknown as VenueDeleted;
    },
    onSuccess: (_data, { barId }) => {
      if (useAppMode.getState().venueId === barId) useAppMode.getState().forgetVenue();
      // Reset, not invalidate: the venue's drinks, menus and team are cached
      // under many keys, and their refetches now fail.
      // ponytail: drops every cached query. Deleting a venue is rare.
      qc.resetQueries();
    },
    onError: () => {},
  });
}
