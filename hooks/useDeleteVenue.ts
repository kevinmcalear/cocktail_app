import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

export type VenueDeleteRequest = Row<'venue_delete_requests'>;

const requestKey = (barId: string | null) => ['venue-delete-request', barId] as const;

/**
 * The venue's scheduled delete, if an Admin asked for one: who asked and when
 * it goes. Every member of the venue reads it, so each of them can be told;
 * its Admins can undo it until then (useCancelVenueDelete).
 */
export function useVenueDeleteRequest(barId: string | null) {
  return useQuery({
    queryKey: requestKey(barId),
    enabled: !!barId,
    queryFn: async (): Promise<VenueDeleteRequest | null> => {
      const { data, error } = await supabase.from('venue_delete_requests').select('*').eq('bar_id', barId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * A venue's Admin asks to delete the venue, with its name typed back
 * (delete_venue). It goes 7 days later unless an Admin undoes it: drinks the
 * public could see stay on the bar's page, which goes back to unclaimed, and
 * everything else the venue held goes. The server refuses anyone but that
 * venue's Admin, and a name that doesn't match. Asking again keeps the date.
 */
export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ barId, confirmName }: { barId: string; confirmName: string }): Promise<VenueDeleteRequest> => {
      const { data, error } = await supabase.rpc('delete_venue', { p_bar_id: barId, p_confirm_name: confirmName });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, { barId }) => qc.setQueryData(requestKey(barId), data),
    onError: () => {},
  });
}

/** Undo a scheduled delete: any Admin of the venue, until it runs. */
export function useCancelVenueDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (barId: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc('cancel_venue_delete', { p_bar_id: barId });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, barId) => qc.setQueryData(requestKey(barId), null),
    onError: () => {},
  });
}
